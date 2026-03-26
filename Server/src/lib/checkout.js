const crypto = require("crypto");

const EGYPT_BOUNDS = Object.freeze({
  minLat: 21.7,
  maxLat: 31.9,
  minLng: 24.5,
  maxLng: 36.95
});

const SUPPORTED_PAYMENT_METHODS = Object.freeze([
  "card",
  "instapay",
  "vodafone_cash",
  "bank_transfer"
]);

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function sanitizeText(value, maxLength = 160) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function sanitizePhone(value) {
  return String(value || "")
    .trim()
    .replace(/[^\d+]/g, "")
    .slice(0, 20);
}

function countPhoneDigits(value) {
  return sanitizePhone(value).replace(/\D/g, "").length;
}

function isValidPhone(value) {
  const digits = countPhoneDigits(value);
  return digits >= 8 && digits <= 15;
}

function parsePositiveInteger(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeOrderCartItems(items) {
  const list = Array.isArray(items) ? items : [];

  return list
    .map((item) => {
      const productId = Number.parseInt(item?.id, 10);
      if (!Number.isFinite(productId) || productId <= 0) return null;

      const mode = String(item?.mode || "").trim().toLowerCase() === "rent" ? "rent" : "buy";

      return {
        id: productId,
        mode,
        quantity: parsePositiveInteger(item?.quantity, 1),
        rentalDays: mode === "rent" ? parsePositiveInteger(item?.rental_days ?? item?.rentalDays, 1) : 1
      };
    })
    .filter(Boolean);
}

function normalizePaymentMethod(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (SUPPORTED_PAYMENT_METHODS.includes(normalized)) {
    return normalized;
  }

  return "";
}

function getPaymentMethodLabel(method) {
  if (method === "card") return "Card";
  if (method === "instapay") return "Instapay";
  if (method === "vodafone_cash") return "Vodafone Cash";
  if (method === "bank_transfer") return "Bank Transfer";
  return "Unknown";
}

function maskSensitiveValue(value) {
  const clean = String(value || "").replace(/\s+/g, "");
  if (!clean) return "";
  if (clean.length <= 4) return clean;
  return `${"*".repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}

function isLuhnValid(cardNumber) {
  const digits = String(cardNumber || "").replace(/\D/g, "");
  if (digits.length < 12) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number.parseInt(digits[index], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return ["1", "true", "yes", "on"].includes(normalized);
}

function isCoordinateWithinEgypt(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  return (
    lat >= EGYPT_BOUNDS.minLat &&
    lat <= EGYPT_BOUNDS.maxLat &&
    lng >= EGYPT_BOUNDS.minLng &&
    lng <= EGYPT_BOUNDS.maxLng
  );
}

function formatDeliveryDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function calculateDeliveryEstimate(items, createdAt = new Date()) {
  const list = Array.isArray(items) ? items : [];
  const totalUnits = list.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
  const hasRental = list.some((item) => item?.mode === "rent");
  const hasLargeOrder = totalUnits >= 6;
  const startLeadDays = hasRental ? 3 : 2;
  const windowWidthDays = hasLargeOrder ? 3 : 2;
  const windowStart = addDays(createdAt, startLeadDays);
  const windowEnd = addDays(windowStart, windowWidthDays);

  return {
    estimatedFrom: windowStart.toISOString(),
    estimatedTo: windowEnd.toISOString(),
    label: `${formatDeliveryDate(windowStart)} - ${formatDeliveryDate(windowEnd)}`
  };
}

function buildPublicOrderId(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `EM-${year}${month}${day}-${suffix}`;
}

function calculateTotals(lineItems) {
  const subtotal = roundCurrency(
    (Array.isArray(lineItems) ? lineItems : []).reduce(
      (sum, item) => sum + Number(item?.lineTotal || 0),
      0
    )
  );
  const shipping = 0;
  const tax = 0;
  const discount = 0;
  const total = roundCurrency(subtotal + shipping + tax - discount);
  const depositRequired = roundCurrency(total * 0.3);

  return {
    subtotal,
    shipping,
    tax,
    discount,
    total,
    depositRequired
  };
}

function buildShippingSummary(shippingDetails) {
  return [
    sanitizeText(shippingDetails?.shipmentAddress, 240),
    sanitizeText(shippingDetails?.city, 80),
    sanitizeText(shippingDetails?.governorate, 80),
    sanitizeText(shippingDetails?.postalCode, 20)
  ]
    .filter(Boolean)
    .join(", ");
}

function createFieldError(message, fieldErrors = {}) {
  const error = new Error(message);
  error.status = 400;
  error.fieldErrors = fieldErrors;
  return error;
}

function createPaymentError(message) {
  const error = new Error(message);
  error.status = 402;
  error.code = "ADVANCE_PAYMENT_FAILED";
  return error;
}

function validateCheckoutSubmission(payload) {
  const shipping = payload?.shippingDetails && typeof payload.shippingDetails === "object"
    ? payload.shippingDetails
    : {};
  const billing = payload?.billingDetails && typeof payload.billingDetails === "object"
    ? payload.billingDetails
    : {};
  const payment = payload?.paymentDetails && typeof payload.paymentDetails === "object"
    ? payload.paymentDetails
    : {};
  const items = normalizeOrderCartItems(payload?.items);
  const fieldErrors = {};

  const shippingDetails = {
    fullName: sanitizeText(shipping.fullName, 120),
    phoneNumber: sanitizePhone(shipping.phoneNumber),
    shipmentAddress: sanitizeText(shipping.shipmentAddress, 240),
    city: sanitizeText(shipping.city, 80),
    governorate: sanitizeText(shipping.governorate, 80),
    postalCode: sanitizeText(shipping.postalCode, 20),
    geolocation: null
  };

  if (!shippingDetails.fullName) {
    fieldErrors["shipping.fullName"] = "Full name is required.";
  }
  if (!shippingDetails.phoneNumber) {
    fieldErrors["shipping.phoneNumber"] = "Phone number is required.";
  } else if (!isValidPhone(shippingDetails.phoneNumber)) {
    fieldErrors["shipping.phoneNumber"] = "Enter a valid phone number.";
  }
  if (!shippingDetails.shipmentAddress) {
    fieldErrors["shipping.shipmentAddress"] = "Shipment address is required.";
  }
  if (!shippingDetails.city) {
    fieldErrors["shipping.city"] = "City is required.";
  }
  if (!shippingDetails.governorate) {
    fieldErrors["shipping.governorate"] = "Governorate is required.";
  }
  if (shippingDetails.postalCode && shippingDetails.postalCode.length < 3) {
    fieldErrors["shipping.postalCode"] = "Postal code must be at least 3 characters.";
  }

  const method = normalizePaymentMethod(billing.paymentMethod);
  const billingDetails = {
    fullName: sanitizeText(billing.fullName, 120),
    phoneNumber: shippingDetails.phoneNumber,
    billingAddress: shippingDetails.shipmentAddress,
    paymentMethod: method,
    paymentMethodLabel: getPaymentMethodLabel(method),
    advancePaymentNoticeAccepted: toBoolean(billing.advancePaymentNoticeAccepted),
    paymentSummary: null
  };

  if (!billingDetails.fullName) {
    fieldErrors["billing.fullName"] = "Billing full name is required.";
  }
  if (!billingDetails.paymentMethod) {
    fieldErrors["billing.paymentMethod"] = "Choose a payment method.";
  }
  if (!billingDetails.advancePaymentNoticeAccepted) {
    fieldErrors["billing.advancePaymentNoticeAccepted"] = "You must accept the 30% advance-payment notice.";
  }

  const paymentDetails = {
    method,
    cardholderName: sanitizeText(payment.cardholderName || billing.fullName, 120),
    cardNumber: String(payment.cardNumber || "").replace(/\s+/g, ""),
    expiryMonth: String(payment.expiryMonth || "").trim(),
    expiryYear: String(payment.expiryYear || "").trim(),
    cvv: String(payment.cvv || "").trim(),
    paymentReference: sanitizeText(
      payment.paymentReference || payment.transactionReferenceNumber || payment.instapayTransactionReference,
      80
    ),
    transactionReferenceNumber: sanitizeText(
      payment.transactionReferenceNumber || payment.instapayTransactionReference || payment.paymentReference,
      80
    ),
    instapayName: sanitizeText(payment.instapayName || billing.fullName, 120),
    instapayUsername: sanitizeText(payment.instapayUsername, 120),
    instapayNumber: sanitizePhone(payment.instapayNumber)
  };

  if (method === "card") {
    if (!paymentDetails.cardholderName) {
      fieldErrors["billing.cardholderName"] = "Cardholder name is required.";
    }

    if (!paymentDetails.cardNumber) {
      fieldErrors["billing.cardNumber"] = "Card number is required.";
    } else if (!isLuhnValid(paymentDetails.cardNumber)) {
      fieldErrors["billing.cardNumber"] = "Enter a valid card number.";
    }

    const expiryMonth = Number.parseInt(paymentDetails.expiryMonth, 10);
    const expiryYear = Number.parseInt(paymentDetails.expiryYear, 10);

    if (!Number.isInteger(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) {
      fieldErrors["billing.expiryMonth"] = "Enter a valid expiry month.";
    }

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    if (!Number.isInteger(expiryYear) || expiryYear < currentYear || expiryYear > currentYear + 20) {
      fieldErrors["billing.expiryYear"] = "Enter a valid expiry year.";
    } else if (Number.isInteger(expiryMonth) && expiryYear === currentYear && expiryMonth < currentMonth) {
      fieldErrors["billing.expiryMonth"] = "This card has already expired.";
    }

    if (!/^\d{3,4}$/.test(paymentDetails.cvv)) {
      fieldErrors["billing.cvv"] = "Enter a valid CVV.";
    }
  }

  if (method === "instapay") {
    if (!paymentDetails.transactionReferenceNumber) {
      fieldErrors["billing.instapayTransactionReference"] = "Transaction reference number is required.";
    }
    if (!paymentDetails.instapayName) {
      fieldErrors["billing.instapayName"] = "Name is required.";
    }
    if (!paymentDetails.instapayUsername) {
      fieldErrors["billing.instapayUsername"] = "Instapay username is required.";
    }
    if (!paymentDetails.instapayNumber) {
      fieldErrors["billing.instapayNumber"] = "Number is required.";
    } else if (!isValidPhone(paymentDetails.instapayNumber)) {
      fieldErrors["billing.instapayNumber"] = "Enter a valid number.";
    }
  } else if (method && method !== "card") {
    if (!paymentDetails.paymentReference) {
      fieldErrors["billing.paymentReference"] = "A payment reference is required for this payment method.";
    }
  }

  if (!items.length) {
    fieldErrors.items = "Your cart is empty.";
  }

  const rawGeo = shipping?.geolocation && typeof shipping.geolocation === "object" ? shipping.geolocation : null;
  if (rawGeo) {
    const latitude = Number(rawGeo.latitude);
    const longitude = Number(rawGeo.longitude);

    if (isCoordinateWithinEgypt(latitude, longitude)) {
      shippingDetails.geolocation = {
        latitude,
        longitude,
        countryCode: "eg",
        addressLine: sanitizeText(rawGeo.addressLine, 240),
        city: sanitizeText(rawGeo.city, 80),
        governorate: sanitizeText(rawGeo.governorate, 80),
        postalCode: sanitizeText(rawGeo.postalCode, 20)
      };
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw createFieldError("Checkout data is incomplete.", fieldErrors);
  }

  return {
    items,
    shippingDetails,
    billingDetails,
    paymentDetails
  };
}

function authorizeAdvancePayment({ billingDetails, paymentDetails, total }) {
  const depositRequired = roundCurrency(Number(total || 0) * 0.3);

  if (depositRequired <= 0) {
    throw createPaymentError("The order total must be greater than zero.");
  }

  if (paymentDetails.method === "card") {
    const digits = String(paymentDetails.cardNumber || "").replace(/\D/g, "");
    if (digits === "4000000000000002") {
      throw createPaymentError("Advance payment could not be authorized. Please try another card.");
    }

    billingDetails.paymentSummary = {
      method: billingDetails.paymentMethod,
      methodLabel: billingDetails.paymentMethodLabel,
      cardholderName: sanitizeText(paymentDetails.cardholderName, 120),
      maskedAccount: `**** **** **** ${digits.slice(-4)}`,
      authorizationStatus: "approved"
    };
  } else if (paymentDetails.method === "instapay") {
    const reference = String(paymentDetails.transactionReferenceNumber || paymentDetails.paymentReference || "").trim();
    if (/FAIL$/i.test(reference)) {
      throw createPaymentError("Advance payment could not be verified. Please check the reference and try again.");
    }

    billingDetails.paymentSummary = {
      method: billingDetails.paymentMethod,
      methodLabel: billingDetails.paymentMethodLabel,
      transactionReferenceNumber: reference,
      instapayName: sanitizeText(paymentDetails.instapayName, 120),
      instapayUsername: sanitizeText(paymentDetails.instapayUsername, 120),
      instapayNumber: sanitizePhone(paymentDetails.instapayNumber),
      maskedAccount: maskSensitiveValue(paymentDetails.instapayNumber),
      authorizationStatus: "approved",
      followUpMessage: "Our team will contact you within 24 hours to confirm order details."
    };
  } else {
    const reference = String(paymentDetails.paymentReference || "").trim();
    if (/FAIL$/i.test(reference)) {
      throw createPaymentError("Advance payment could not be verified. Please check the reference and try again.");
    }

    billingDetails.paymentSummary = {
      method: billingDetails.paymentMethod,
      methodLabel: billingDetails.paymentMethodLabel,
      maskedAccount: maskSensitiveValue(reference),
      authorizationStatus: "approved"
    };
  }

  return {
    depositRequired,
    depositPaid: depositRequired,
    depositStatus: "paid",
    paidAt: new Date().toISOString()
  };
}

function extractEgyptAddressFromReversePayload(payload) {
  const address = payload?.address && typeof payload.address === "object" ? payload.address : {};
  const countryCode = String(address.country_code || "").trim().toLowerCase();

  const city = sanitizeText(
    address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.hamlet ||
      "",
    80
  );
  const governorate = sanitizeText(address.state || address.region || address.county || "", 80);
  const postalCode = sanitizeText(address.postcode || "", 20);
  const addressLine = [
    sanitizeText(address.house_number, 30),
    sanitizeText(address.road, 120),
    sanitizeText(address.suburb || address.neighbourhood, 120)
  ]
    .filter(Boolean)
    .join(", ");

  return {
    countryCode,
    city,
    governorate,
    postalCode,
    addressLine: addressLine || sanitizeText(payload?.display_name, 240),
    displayName: sanitizeText(payload?.display_name, 240)
  };
}

module.exports = {
  EGYPT_BOUNDS,
  SUPPORTED_PAYMENT_METHODS,
  authorizeAdvancePayment,
  buildPublicOrderId,
  buildShippingSummary,
  calculateDeliveryEstimate,
  calculateTotals,
  extractEgyptAddressFromReversePayload,
  getPaymentMethodLabel,
  isCoordinateWithinEgypt,
  isLuhnValid,
  maskSensitiveValue,
  normalizeOrderCartItems,
  normalizePaymentMethod,
  roundCurrency,
  validateCheckoutSubmission
};
