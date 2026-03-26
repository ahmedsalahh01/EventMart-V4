import assert from "node:assert/strict";
import {
  buildCheckoutPayload,
  buildShipmentAddress,
  calculateCartSummary,
  createInitialCheckoutForm,
  extractEgyptAddressFromReversePayload,
  fetchEgyptLocationDetails,
  isCoordinateWithinEgypt,
  isLuhnValid,
  normalizeGovernorateName,
  validateCheckoutForm
} from "./checkout.js";

function runTest(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
}

async function runAsyncTest(name, assertion) {
  await assertion();
  console.log(`PASS ${name}`);
}

function buildValidForm() {
  const form = createInitialCheckoutForm("Sara Ahmed");

  form.shipping.phoneNumber = "+201001234567";
  form.shipping.shipmentAddress = "15 Tahrir Street";
  form.shipping.city = "Cairo";
  form.shipping.governorate = "Cairo";
  form.shipping.postalCode = "11511";

  form.billing.paymentMethod = "card";
  form.billing.advancePaymentNoticeAccepted = true;

  form.payment.cardholderName = "Sara Ahmed";
  form.payment.cardNumber = "4242 4242 4242 4242";
  form.payment.expiryMonth = "12";
  form.payment.expiryYear = String(new Date().getFullYear() + 1);
  form.payment.cvv = "123";

  return form;
}

function buildValidInstapayForm() {
  const form = createInitialCheckoutForm("Sara Ahmed");

  form.shipping.phoneNumber = "+201001234567";
  form.shipping.shipmentAddress = "15 Tahrir Street";
  form.shipping.city = "Cairo";
  form.shipping.governorate = "Cairo";
  form.shipping.postalCode = "11511";

  form.billing.paymentMethod = "instapay";
  form.billing.advancePaymentNoticeAccepted = true;

  form.payment.instapayTransactionReference = "INSTA-123456";
  form.payment.instapayName = "Sara Ahmed";
  form.payment.instapayUsername = "sara@instapay";
  form.payment.instapayNumber = "+201001234567";

  return form;
}

runTest("should calculate subtotal and 30 percent deposit from cart items", () => {
  const summary = calculateCartSummary([
    { quantity: 2, unit_price: 100, mode: "buy" },
    { quantity: 1, unit_price: 50, mode: "rent", rental_days: 3 }
  ]);

  assert.equal(summary.subtotal, 350);
  assert.equal(summary.total, 350);
  assert.equal(summary.depositRequired, 105);
  assert.equal(summary.itemCount, 3);
});

runTest("should validate a complete checkout form without errors", () => {
  const form = buildValidForm();
  const errors = validateCheckoutForm(form, [{ id: "1", quantity: 1, unit_price: 100, mode: "buy" }]);

  assert.deepEqual(errors, {});
});

runTest("should flag missing checkout fields and empty carts", () => {
  const errors = validateCheckoutForm(createInitialCheckoutForm(), []);

  assert.equal(errors["shipping.firstName"], "First name is required.");
  assert.equal(errors["shipping.lastName"], "Last name is required.");
  assert.equal(errors["billing.paymentMethod"], undefined);
  assert.equal(
    errors["billing.advancePaymentNoticeAccepted"],
    "You must accept the 30% advance-payment notice."
  );
  assert.equal(errors.items, "Your cart is empty.");
});

runTest("should build a safe payload and normalize the shipment address", () => {
  const form = buildValidForm();
  const payload = buildCheckoutPayload(form, [{ id: "9", quantity: 2, mode: "rent", rental_days: 4 }]);

  assert.equal(payload.paymentDetails.cardNumber, "4242424242424242");
  assert.equal(payload.items[0].rental_days, 4);
  assert.equal(payload.billingDetails.phoneNumber, "+201001234567");
  assert.equal(payload.billingDetails.billingAddress, "15 Tahrir Street");
  assert.equal(buildShipmentAddress(payload.shippingDetails), "15 Tahrir Street, Cairo, Cairo, 11511");
});

runTest("should require and include detailed Instapay fields", () => {
  const form = buildValidInstapayForm();
  const errors = validateCheckoutForm(form, [{ id: "2", quantity: 1, unit_price: 45, mode: "buy" }]);
  const payload = buildCheckoutPayload(form, [{ id: "2", quantity: 1, unit_price: 45, mode: "buy" }]);

  assert.deepEqual(errors, {});
  assert.equal(payload.paymentDetails.transactionReferenceNumber, "INSTA-123456");
  assert.equal(payload.paymentDetails.instapayName, "Sara Ahmed");
  assert.equal(payload.paymentDetails.instapayUsername, "sara@instapay");
  assert.equal(payload.paymentDetails.instapayNumber, "+201001234567");
});

runTest("should validate card numbers with the luhn check", () => {
  assert.equal(isLuhnValid("4242424242424242"), true);
  assert.equal(isLuhnValid("4242424242421111"), false);
});

runTest("should normalize Egypt governorates and reverse-geocode payloads", () => {
  const payload = extractEgyptAddressFromReversePayload({
    display_name: "15 Tahrir Street, Cairo, Egypt",
    address: {
      country_code: "eg",
      city: "Cairo",
      state: "Cairo Governorate",
      postcode: "11511",
      road: "Tahrir Street",
      house_number: "15"
    }
  });

  assert.equal(normalizeGovernorateName("Cairo Governorate"), "Cairo");
  assert.equal(isCoordinateWithinEgypt(30.0444, 31.2357), true);
  assert.equal(payload.governorate, "Cairo");
  assert.equal(payload.city, "Cairo");
  assert.equal(payload.postalCode, "11511");
  assert.equal(payload.addressLine, "15, Tahrir Street");
});

await runAsyncTest("should fall back to browser reverse lookup when the backend endpoint is unavailable", async () => {
  const location = await fetchEgyptLocationDetails(
    { latitude: 30.0444, longitude: 31.2357 },
    {
      apiClient: async () => {
        const error = new Error("<!DOCTYPE html><pre>Cannot POST /api/geolocation/reverse-egypt</pre>");
        error.status = 404;
        throw error;
      },
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return {
            display_name: "15 Tahrir Street, Cairo, Egypt",
            address: {
              country_code: "eg",
              city: "Cairo",
              state: "Cairo Governorate",
              postcode: "11511",
              road: "Tahrir Street",
              house_number: "15"
            }
          };
        }
      })
    }
  );

  assert.equal(location.countryCode, "eg");
  assert.equal(location.addressLine, "15, Tahrir Street");
  assert.equal(location.city, "Cairo");
  assert.equal(location.governorate, "Cairo");
  assert.equal(location.postalCode, "11511");
});
