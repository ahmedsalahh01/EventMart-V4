const assert = require("node:assert/strict");
const {
  authorizeAdvancePayment,
  buildPublicOrderId,
  calculateDeliveryEstimate,
  calculateTotals,
  extractEgyptAddressFromReversePayload,
  isCoordinateWithinEgypt,
  normalizeOrderCartItems,
  validateCheckoutSubmission
} = require("./checkout");

function runTest(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
}

function buildValidPayload() {
  return {
    shippingDetails: {
      fullName: "Mariam Youssef",
      phoneNumber: "+201112223334",
      shipmentAddress: "22 Nile Corniche",
      city: "Cairo",
      governorate: "Cairo",
      postalCode: "11511"
    },
    billingDetails: {
      fullName: "Mariam Youssef",
      paymentMethod: "card",
      advancePaymentNoticeAccepted: true
    },
    paymentDetails: {
      cardholderName: "Mariam Youssef",
      cardNumber: "4242424242424242",
      expiryMonth: "12",
      expiryYear: String(new Date().getUTCFullYear() + 1),
      cvv: "123"
    },
    items: [{ id: "4", quantity: 2, mode: "buy" }]
  };
}

function buildValidInstapayPayload() {
  return {
    shippingDetails: {
      fullName: "Mariam Youssef",
      phoneNumber: "+201112223334",
      shipmentAddress: "22 Nile Corniche",
      city: "Cairo",
      governorate: "Cairo",
      postalCode: "11511"
    },
    billingDetails: {
      fullName: "Mariam Youssef",
      paymentMethod: "instapay",
      advancePaymentNoticeAccepted: true
    },
    paymentDetails: {
      instapayTransactionReference: "INSTA-998877",
      instapayName: "Mariam Youssef",
      instapayUsername: "mariam@instapay",
      instapayNumber: "+201112223334"
    },
    items: [{ id: "4", quantity: 1, mode: "buy" }]
  };
}

runTest("should validate a complete checkout submission", () => {
  const payload = validateCheckoutSubmission(buildValidPayload());

  assert.equal(payload.shippingDetails.fullName, "Mariam Youssef");
  assert.equal(payload.billingDetails.phoneNumber, "+201112223334");
  assert.equal(payload.billingDetails.billingAddress, "22 Nile Corniche");
  assert.equal(payload.billingDetails.paymentMethod, "card");
  assert.equal(payload.items.length, 1);
});

runTest("should normalize variation selections and customization tokens", () => {
  const items = normalizeOrderCartItems([
    {
      id: "4",
      variation_id: "11",
      selected_color: "Red",
      selected_size: "Medium",
      customization_upload_tokens: ["tok-1", "tok-2", "tok-1"],
      quantity: 2,
      mode: "buy"
    }
  ]);

  assert.equal(items[0].variationId, 11);
  assert.equal(items[0].selectedColor, "Red");
  assert.equal(items[0].selectedSize, "Medium");
  assert.deepEqual(items[0].customizationUploadTokens, ["tok-1", "tok-2"]);
});

runTest("should report required field errors for incomplete checkout data", () => {
  assert.throws(
    () => validateCheckoutSubmission({ shippingDetails: {}, billingDetails: {}, items: [] }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.fieldErrors["shipping.fullName"], "Full name is required.");
      assert.equal(
        error.fieldErrors["billing.advancePaymentNoticeAccepted"],
        "You must accept the 30% advance-payment notice."
      );
      assert.equal(error.fieldErrors.items, "Your cart is empty.");
      return true;
    }
  );
});

runTest("should calculate totals, deposit, and delivery estimate", () => {
  const totals = calculateTotals([{ lineTotal: 500 }, { lineTotal: 250 }]);
  const delivery = calculateDeliveryEstimate(
    [{ quantity: 2, mode: "buy" }],
    new Date("2026-03-26T00:00:00.000Z")
  );

  assert.equal(totals.total, 750);
  assert.equal(totals.depositRequired, 225);
  assert.match(delivery.label, /Mar/);
});

runTest("should authorize a successful advance payment and mask the account", () => {
  const payload = validateCheckoutSubmission(buildValidPayload());
  const payment = authorizeAdvancePayment({
    billingDetails: payload.billingDetails,
    paymentDetails: payload.paymentDetails,
    total: 1000
  });

  assert.equal(payment.depositRequired, 300);
  assert.equal(payment.depositStatus, "paid");
  assert.equal(payload.billingDetails.paymentSummary.maskedAccount, "**** **** **** 4242");
});

runTest("should validate and summarize Instapay payment details", () => {
  const payload = validateCheckoutSubmission(buildValidInstapayPayload());
  const payment = authorizeAdvancePayment({
    billingDetails: payload.billingDetails,
    paymentDetails: payload.paymentDetails,
    total: 450
  });

  assert.equal(payment.depositRequired, 135);
  assert.equal(payload.paymentDetails.transactionReferenceNumber, "INSTA-998877");
  assert.equal(payload.billingDetails.paymentSummary.instapayUsername, "mariam@instapay");
  assert.equal(
    payload.billingDetails.paymentSummary.followUpMessage,
    "Our team will contact you within 24 hours to confirm order details."
  );
});

runTest("should reject declined advance payments", () => {
  const payload = validateCheckoutSubmission({
    ...buildValidPayload(),
    paymentDetails: {
      cardholderName: "Mariam Youssef",
      cardNumber: "4000000000000002",
      expiryMonth: "12",
      expiryYear: String(new Date().getUTCFullYear() + 1),
      cvv: "123"
    }
  });

  assert.throws(
    () =>
      authorizeAdvancePayment({
        billingDetails: payload.billingDetails,
        paymentDetails: payload.paymentDetails,
        total: 1000
      }),
    (error) => {
      assert.equal(error.status, 402);
      assert.match(error.message, /could not be authorized/i);
      return true;
    }
  );
});

runTest("should validate Egypt coordinates and extract reverse-geocode details", () => {
  assert.equal(isCoordinateWithinEgypt(30.0444, 31.2357), true);
  assert.equal(isCoordinateWithinEgypt(48.8566, 2.3522), false);

  const parsed = extractEgyptAddressFromReversePayload({
    display_name: "15 Tahrir Street, Cairo, Egypt",
    address: {
      country_code: "eg",
      city: "Cairo",
      state: "Cairo",
      postcode: "11511",
      road: "Tahrir Street",
      house_number: "15"
    }
  });

  assert.equal(parsed.countryCode, "eg");
  assert.equal(parsed.city, "Cairo");
  assert.equal(parsed.governorate, "Cairo");
  assert.equal(parsed.addressLine, "15, Tahrir Street");
});

runTest("should build a unique public order id format", () => {
  const orderId = buildPublicOrderId(new Date("2026-03-26T00:00:00.000Z"));
  assert.match(orderId, /^EM-20260326-[A-F0-9]{6}$/);
});
