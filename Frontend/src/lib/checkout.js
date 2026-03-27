const STORAGE_KEY = "eventmart_checkout_draft_v1";
const LOCAL_ORDER_CONFIRMATION_PREFIX = "eventmart_local_order_confirmation_v1:";
export const EGYPT_BOUNDS = Object.freeze({
  minLat: 21.7,
  maxLat: 31.9,
  minLng: 24.5,
  maxLng: 36.95
});

export const EGYPT_GOVERNORATES = [
  "Alexandria",
  "Aswan",
  "Asyut",
  "Beheira",
  "Beni Suef",
  "Cairo",
  "Dakahlia",
  "Damietta",
  "Faiyum",
  "Gharbia",
  "Giza",
  "Ismailia",
  "Kafr El Sheikh",
  "Luxor",
  "Matrouh",
  "Minya",
  "Monufia",
  "New Valley",
  "North Sinai",
  "Port Said",
  "Qalyubia",
  "Qena",
  "Red Sea",
  "Sharqia",
  "Sohag",
  "South Sinai",
  "Suez"
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: "card", label: "Card" },
  { value: "instapay", label: "Instapay" },
  { value: "vodafone_cash", label: "Vodafone Cash" },
  { value: "bank_transfer", label: "Bank Transfer" }
];

const GOVERNORATE_ALIASES = Object.freeze({
  alexandria: "Alexandria",
  "alexandria governorate": "Alexandria",
  "al iskandariyah": "Alexandria",
  aswan: "Aswan",
  asyut: "Asyut",
  assiut: "Asyut",
  beheira: "Beheira",
  البحيرة: "Beheira",
  "beni suef": "Beni Suef",
  "bani suwayf": "Beni Suef",
  cairo: "Cairo",
  "cairo governorate": "Cairo",
  "al qahirah": "Cairo",
  القاهرة: "Cairo",
  dakahlia: "Dakahlia",
  الدقهلية: "Dakahlia",
  damietta: "Damietta",
  دمياط: "Damietta",
  faiyum: "Faiyum",
  fayoum: "Faiyum",
  الفيوم: "Faiyum",
  gharbia: "Gharbia",
  الغربية: "Gharbia",
  giza: "Giza",
  "giza governorate": "Giza",
  "al jizah": "Giza",
  الجيزة: "Giza",
  ismailia: "Ismailia",
  "al ismailiyah": "Ismailia",
  الاسماعيلية: "Ismailia",
  "kafr el sheikh": "Kafr El Sheikh",
  "kafr ash shaykh": "Kafr El Sheikh",
  "kafr el-sheikh": "Kafr El Sheikh",
  luxor: "Luxor",
  الأقصر: "Luxor",
  matrouh: "Matrouh",
  مطروح: "Matrouh",
  minya: "Minya",
  المنيا: "Minya",
  monufia: "Monufia",
  "al minufiyah": "Monufia",
  المنوفية: "Monufia",
  "new valley": "New Valley",
  "al wadi al jadid": "New Valley",
  الواديالجديد: "New Valley",
  "north sinai": "North Sinai",
  "shamal sina": "North Sinai",
  "port said": "Port Said",
  بورسعيد: "Port Said",
  qalyubia: "Qalyubia",
  "al qalyubiyah": "Qalyubia",
  القليوبية: "Qalyubia",
  qena: "Qena",
  قنا: "Qena",
  "red sea": "Red Sea",
  "al bahr al ahmar": "Red Sea",
  "red sea governorate": "Red Sea",
  sharqia: "Sharqia",
  "ash sharqiyah": "Sharqia",
  الشرقية: "Sharqia",
  sohag: "Sohag",
  سوهاج: "Sohag",
  "south sinai": "South Sinai",
  "janub sina": "South Sinai",
  suez: "Suez",
  السويس: "Suez"
});

function normalizeLookupToken(value) {
  return sanitizeText(value, 120)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bgovernorate\b/g, "")
    .replace(/\bprovince\b/g, "")
    .replace(/\bstate\b/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function roundCurrency(value) {
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

function normalizeUploadTokenList(value) {
  const list = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];

  return Array.from(
    new Set(
      list
        .map((item) =>
          sanitizeText(
            item?.uploadToken || item?.upload_token || item,
            120
          )
        )
        .filter(Boolean)
    )
  );
}

export function normalizeInstapayUsernameInput(value) {
  return sanitizeText(value, 120).replace(/^@+/, "");
}

function joinNonEmpty(values, separator = " ") {
  return values
    .map((value) => sanitizeText(value, 120))
    .filter(Boolean)
    .join(separator);
}

function buildCombinedShippingAddress(addressLine, apartment) {
  return [sanitizeText(addressLine, 240), sanitizeText(apartment, 120)]
    .filter(Boolean)
    .join(", ");
}

export function splitFullName(value) {
  const normalized = sanitizeText(value, 120);
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ")
  };
}

function countPhoneDigits(value) {
  return sanitizePhone(value).replace(/\D/g, "").length;
}

function isValidPhone(value) {
  const digits = countPhoneDigits(value);
  return digits >= 8 && digits <= 15;
}

export function isLuhnValid(cardNumber) {
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

export function createInitialCheckoutForm(userName = "") {
  const safeName = sanitizeText(userName, 120);
  const nameParts = splitFullName(safeName);

  return {
    shipping: {
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      phoneNumber: "",
      shipmentAddress: "",
      apartment: "",
      city: "",
      governorate: "",
      postalCode: "",
      geolocation: null,
      saveInformation: false
    },
    billing: {
      fullName: safeName,
      phoneNumber: "",
      billingAddress: "",
      paymentMethod: "card",
      advancePaymentNoticeAccepted: false
    },
    payment: {
      cardholderName: safeName,
      cardNumber: "",
      expiryMonth: "",
      expiryYear: "",
      cvv: "",
      paymentReference: "",
      instapayTransactionReference: "",
      instapayName: safeName,
      instapayUsername: "",
      instapayNumber: ""
    }
  };
}

function buildPersistedDraft(form) {
  return {
    shipping: {
      firstName: sanitizeText(form?.shipping?.firstName, 80),
      lastName: sanitizeText(form?.shipping?.lastName, 80),
      phoneNumber: sanitizePhone(form?.shipping?.phoneNumber),
      shipmentAddress: sanitizeText(form?.shipping?.shipmentAddress, 240),
      apartment: sanitizeText(form?.shipping?.apartment, 120),
      city: sanitizeText(form?.shipping?.city, 80),
      governorate: sanitizeText(form?.shipping?.governorate, 80),
      postalCode: sanitizeText(form?.shipping?.postalCode, 20),
      geolocation: form?.shipping?.geolocation || null,
      saveInformation: Boolean(form?.shipping?.saveInformation)
    },
    billing: {
      fullName: sanitizeText(form?.billing?.fullName, 120),
      phoneNumber: sanitizePhone(form?.billing?.phoneNumber),
      billingAddress: sanitizeText(form?.billing?.billingAddress, 240),
      paymentMethod: sanitizeText(form?.billing?.paymentMethod, 40).toLowerCase(),
      advancePaymentNoticeAccepted: Boolean(form?.billing?.advancePaymentNoticeAccepted)
    }
  };
}

export function readCheckoutDraft(userName = "") {
  const defaults = createInitialCheckoutForm(userName);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    const draft = buildPersistedDraft(parsed);
    const legacyName = splitFullName(parsed?.shipping?.fullName || userName);

    return {
      ...defaults,
      shipping: {
        ...defaults.shipping,
        firstName: draft.shipping.firstName || legacyName.firstName || defaults.shipping.firstName,
        lastName: draft.shipping.lastName || legacyName.lastName || defaults.shipping.lastName,
        ...draft.shipping
      },
      billing: {
        ...defaults.billing,
        ...draft.billing
      },
      payment: {
        ...defaults.payment,
        cardholderName: sanitizeText(parsed?.payment?.cardholderName || defaults.payment.cardholderName, 120),
        instapayName: sanitizeText(parsed?.payment?.instapayName || defaults.payment.instapayName, 120),
        instapayUsername: normalizeInstapayUsernameInput(
          parsed?.payment?.instapayUsername || defaults.payment.instapayUsername
        ),
        instapayNumber: sanitizePhone(parsed?.payment?.instapayNumber || defaults.payment.instapayNumber),
        instapayTransactionReference: sanitizeText(
          parsed?.payment?.instapayTransactionReference || defaults.payment.instapayTransactionReference,
          80
        )
      }
    };
  } catch (_error) {
    return defaults;
  }
}

export function writeCheckoutDraft(form) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedDraft(form)));
  } catch (_error) {
    // Ignore storage write errors.
  }
}

export function clearCheckoutDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    // Ignore storage cleanup errors.
  }
}

export function isCoordinateWithinEgypt(latitude, longitude) {
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

export function normalizeGovernorateName(value) {
  const raw = sanitizeText(value, 120);
  if (!raw) return "";

  const rawKey = normalizeLookupToken(raw);
  if (!rawKey) return "";

  const aliasMatch = GOVERNORATE_ALIASES[rawKey];
  if (aliasMatch) return aliasMatch;

  for (const governorate of EGYPT_GOVERNORATES) {
    const governorateKey = normalizeLookupToken(governorate);
    if (
      rawKey === governorateKey ||
      rawKey.includes(governorateKey) ||
      governorateKey.includes(rawKey)
    ) {
      return governorate;
    }
  }

  return raw;
}

function pickAddressValue(address, keys) {
  for (const key of keys) {
    const value = sanitizeText(address?.[key], 120);
    if (value) return value;
  }

  return "";
}

function buildAddressLine(address, displayName) {
  const parts = [
    pickAddressValue(address, ["house_number"]),
    pickAddressValue(address, ["road", "pedestrian", "street"]),
    pickAddressValue(address, ["suburb", "neighbourhood", "neighborhood", "quarter", "city_district"])
  ].filter(Boolean);

  if (parts.length > 0) {
    return sanitizeText(parts.join(", "), 240);
  }

  return sanitizeText(
    String(displayName || "")
      .split(",")
      .map((part) => sanitizeText(part, 80))
      .filter(Boolean)
      .slice(0, 3)
      .join(", "),
    240
  );
}

export function extractEgyptAddressFromReversePayload(payload) {
  const address = payload?.address && typeof payload.address === "object" ? payload.address : {};
  const displayName = sanitizeText(payload?.display_name || payload?.displayName, 240);
  const countryCode = sanitizeText(
    payload?.countryCode || payload?.country_code || address.country_code,
    8
  ).toLowerCase();
  const city = pickAddressValue(address, [
    "city",
    "town",
    "village",
    "municipality",
    "hamlet",
    "county",
    "state_district"
  ]);
  const governorate = normalizeGovernorateName(
    payload?.governorate || payload?.state || address.state || address.region || address.county
  );
  const postalCode = sanitizeText(payload?.postalCode || payload?.postcode || address.postcode, 20);
  const addressLine = sanitizeText(
    payload?.addressLine || buildAddressLine(address, displayName),
    240
  );

  return {
    countryCode,
    addressLine,
    city,
    governorate,
    postalCode,
    displayName
  };
}

function normalizeLocationLookupPayload(payload, fallbackCoordinates) {
  const location = extractEgyptAddressFromReversePayload(payload);

  return {
    latitude: Number(payload?.latitude ?? payload?.lat ?? fallbackCoordinates?.latitude),
    longitude: Number(payload?.longitude ?? payload?.lon ?? fallbackCoordinates?.longitude),
    addressLine: location.addressLine,
    city: location.city,
    governorate: location.governorate,
    postalCode: location.postalCode,
    countryCode: location.countryCode,
    displayName: location.displayName
  };
}

function shouldFallbackToBrowserLookup(error) {
  const message = String(error?.message || "").toLowerCase();
  const status = Number(error?.status || 0);

  if ([404, 405, 500, 502, 503].includes(status)) {
    return true;
  }

  return (
    message.includes("cannot post") ||
    message.includes("invalid server response") ||
    message.includes("<html") ||
    message.includes("failed to fetch") ||
    message.includes("service unavailable")
  );
}

function createLocationLookupError(message) {
  const error = new Error(message);
  error.isLocationLookupError = true;
  return error;
}

export async function fetchEgyptLocationDetails(
  { latitude, longitude },
  { apiClient, fetchImpl } = {}
) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const client = typeof apiClient === "function" ? apiClient : null;
  const fetcher = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;

  if (!isCoordinateWithinEgypt(lat, lng)) {
    throw createLocationLookupError("This service is currently available in Egypt only.");
  }

  if (client) {
    try {
      const payload = await client("/api/geolocation/reverse-egypt", {
        method: "POST",
        body: {
          latitude: lat,
          longitude: lng
        }
      });

      const normalized = normalizeLocationLookupPayload(payload, { latitude: lat, longitude: lng });
      if (normalized.countryCode && normalized.countryCode !== "eg") {
        throw createLocationLookupError("This service is currently available in Egypt only.");
      }

      return normalized;
    } catch (error) {
      if (!shouldFallbackToBrowserLookup(error)) {
        throw createLocationLookupError(
          error?.message || "We couldn't auto-fill your location right now. Please enter the address manually."
        );
      }
    }
  }

  if (typeof fetcher !== "function") {
    throw createLocationLookupError(
      "We couldn't auto-fill your location right now. Please enter the address manually."
    );
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const response = await fetcher(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw createLocationLookupError(
      "We couldn't auto-fill your location right now. Please enter the address manually."
    );
  }

  const payload = await response.json();
  const normalized = normalizeLocationLookupPayload(payload, { latitude: lat, longitude: lng });

  if (normalized.countryCode !== "eg") {
    throw createLocationLookupError("This service is currently available in Egypt only.");
  }

  return normalized;
}

export function calculateCartSummary(items) {
  const list = Array.isArray(items) ? items : [];
  const subtotal = roundCurrency(
    list.reduce((sum, item) => {
      const quantity = Number(item?.quantity || 0);
      const multiplier = item?.mode === "rent" ? Number(item?.rental_days || 1) : 1;
      return sum + Number(item?.unit_price || 0) * quantity * multiplier;
    }, 0)
  );
  const total = subtotal;
  const depositRequired = roundCurrency(total * 0.3);
  const itemCount = list.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);

  return {
    subtotal,
    total,
    depositRequired,
    itemCount
  };
}

export function buildCheckoutPayload(form, items) {
  const shippingPhone = sanitizePhone(form?.shipping?.phoneNumber);
  const shippingAddress = buildCombinedShippingAddress(
    form?.shipping?.shipmentAddress,
    form?.shipping?.apartment
  );
  const paymentMethod = sanitizeText(form?.billing?.paymentMethod, 40).toLowerCase();
  const paymentReference = sanitizeText(
    paymentMethod === "instapay"
      ? form?.payment?.instapayTransactionReference
      : form?.payment?.paymentReference,
    80
  );

  return {
    shippingDetails: {
      fullName: joinNonEmpty([form?.shipping?.firstName, form?.shipping?.lastName]),
      phoneNumber: shippingPhone,
      shipmentAddress: shippingAddress,
      city: sanitizeText(form?.shipping?.city, 80),
      governorate: sanitizeText(form?.shipping?.governorate, 80),
      postalCode: sanitizeText(form?.shipping?.postalCode, 20),
      geolocation: form?.shipping?.geolocation || null
    },
    billingDetails: {
      fullName: sanitizeText(form?.billing?.fullName, 120),
      phoneNumber: shippingPhone,
      billingAddress: shippingAddress,
      paymentMethod: sanitizeText(form?.billing?.paymentMethod, 40).toLowerCase(),
      advancePaymentNoticeAccepted: Boolean(form?.billing?.advancePaymentNoticeAccepted)
    },
    paymentDetails: {
      cardholderName: sanitizeText(form?.payment?.cardholderName, 120),
      cardNumber: String(form?.payment?.cardNumber || "").replace(/\s+/g, ""),
      expiryMonth: String(form?.payment?.expiryMonth || "").trim(),
      expiryYear: String(form?.payment?.expiryYear || "").trim(),
      cvv: String(form?.payment?.cvv || "").trim(),
      paymentReference,
      transactionReferenceNumber: paymentReference,
      instapayName: sanitizeText(form?.payment?.instapayName, 120),
      instapayUsername: sanitizeText(form?.payment?.instapayUsername, 120),
      instapayNumber: sanitizePhone(form?.payment?.instapayNumber)
    },
    items: (Array.isArray(items) ? items : []).map((item) => ({
      id: item?.id,
      variation_id: item?.variation_id || item?.variationId || null,
      selected_color: sanitizeText(item?.selected_color || item?.selectedColor, 60),
      selected_size: sanitizeText(item?.selected_size || item?.selectedSize, 40),
      customization_upload_tokens: normalizeUploadTokenList(
        item?.customization_uploads || item?.customizationUploads
      ),
      mode: item?.mode === "rent" ? "rent" : "buy",
      quantity: Math.max(1, Number(item?.quantity || 1)),
      rental_days: item?.mode === "rent" ? Math.max(1, Number(item?.rental_days || 1)) : 1
    }))
  };
}

export function validateCheckoutForm(form, items) {
  const payload = buildCheckoutPayload(form, items);
  const errors = {};

  if (!sanitizeText(form?.shipping?.firstName, 80)) {
    errors["shipping.firstName"] = "First name is required.";
  }
  if (!sanitizeText(form?.shipping?.lastName, 80)) {
    errors["shipping.lastName"] = "Last name is required.";
  }
  if (!payload.shippingDetails.phoneNumber) {
    errors["shipping.phoneNumber"] = "Phone number is required.";
  } else if (!isValidPhone(payload.shippingDetails.phoneNumber)) {
    errors["shipping.phoneNumber"] = "Enter a valid phone number.";
  }
  if (!payload.shippingDetails.shipmentAddress) {
    errors["shipping.shipmentAddress"] = "Shipment address is required.";
  }
  if (!payload.shippingDetails.city) {
    errors["shipping.city"] = "City is required.";
  }
  if (!payload.shippingDetails.governorate) {
    errors["shipping.governorate"] = "Governorate is required.";
  }
  if (payload.shippingDetails.postalCode && payload.shippingDetails.postalCode.length < 3) {
    errors["shipping.postalCode"] = "Postal code must be at least 3 characters.";
  }

  if (!payload.billingDetails.fullName) {
    errors["billing.fullName"] = "Billing full name is required.";
  }
  if (!payload.billingDetails.paymentMethod) {
    errors["billing.paymentMethod"] = "Choose a payment method.";
  }
  if (!payload.billingDetails.advancePaymentNoticeAccepted) {
    errors["billing.advancePaymentNoticeAccepted"] = "You must accept the 30% advance-payment notice.";
  }

  if (payload.billingDetails.paymentMethod === "card") {
    if (!payload.paymentDetails.cardholderName) {
      errors["billing.cardholderName"] = "Cardholder name is required.";
    }
    if (!payload.paymentDetails.cardNumber) {
      errors["billing.cardNumber"] = "Card number is required.";
    } else if (!isLuhnValid(payload.paymentDetails.cardNumber)) {
      errors["billing.cardNumber"] = "Enter a valid card number.";
    }

    const expiryMonth = Number.parseInt(payload.paymentDetails.expiryMonth, 10);
    const expiryYear = Number.parseInt(payload.paymentDetails.expiryYear, 10);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (!Number.isInteger(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) {
      errors["billing.expiryMonth"] = "Enter a valid expiry month.";
    }
    if (!Number.isInteger(expiryYear) || expiryYear < currentYear || expiryYear > currentYear + 20) {
      errors["billing.expiryYear"] = "Enter a valid expiry year.";
    } else if (Number.isInteger(expiryMonth) && expiryYear === currentYear && expiryMonth < currentMonth) {
      errors["billing.expiryMonth"] = "This card has already expired.";
    }
    if (!/^\d{3,4}$/.test(payload.paymentDetails.cvv)) {
      errors["billing.cvv"] = "Enter a valid CVV.";
    }
  } else if (payload.billingDetails.paymentMethod === "instapay") {
    if (!payload.paymentDetails.transactionReferenceNumber) {
      errors["billing.instapayTransactionReference"] = "Transaction reference number is required.";
    }
    if (!payload.paymentDetails.instapayName) {
      errors["billing.instapayName"] = "Name is required.";
    }
    if (!payload.paymentDetails.instapayUsername) {
      errors["billing.instapayUsername"] = "Instapay username is required.";
    }
    if (!payload.paymentDetails.instapayNumber) {
      errors["billing.instapayNumber"] = "Number is required.";
    } else if (!isValidPhone(payload.paymentDetails.instapayNumber)) {
      errors["billing.instapayNumber"] = "Enter a valid number.";
    }
  } else if (!payload.paymentDetails.paymentReference) {
    errors["billing.paymentReference"] = "A payment reference is required for this payment method.";
  }

  if (!payload.items.length) {
    errors.items = "Your cart is empty.";
  }

  return errors;
}

export function buildShipmentAddress(details) {
  return [
    sanitizeText(details?.shipmentAddress, 240),
    sanitizeText(details?.city, 80),
    sanitizeText(details?.governorate, 80),
    sanitizeText(details?.postalCode, 20)
  ]
    .filter(Boolean)
    .join(", ");
}

export function getFieldError(errors, path) {
  return errors?.[path] || "";
}

function createLocalOrderId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `EM-${year}${month}${day}-${suffix}`;
}

function getLocalOrderStorageKey(orderId) {
  return `${LOCAL_ORDER_CONFIRMATION_PREFIX}${String(orderId || "").trim()}`;
}

export function createLocalInstapayConfirmationOrder({ form, items, summary, currency }) {
  const orderId = createLocalOrderId();
  const createdAt = new Date().toISOString();
  const paymentSummary = {
    method: "instapay",
    methodLabel: "Instapay",
    transactionReferenceNumber: sanitizeText(form?.payment?.instapayTransactionReference, 80),
    instapayName: sanitizeText(form?.payment?.instapayName, 120),
    instapayUsername: sanitizeText(form?.payment?.instapayUsername, 120),
    instapayNumber: sanitizePhone(form?.payment?.instapayNumber),
    followUpMessage: "Our team will contact you within 24 hours to confirm order details."
  };

  return {
    id: orderId,
    orderId,
    status: "pending_confirmation",
    currency,
    subtotal: Number(summary?.subtotal || 0),
    tax: 0,
    discount: 0,
    shipping: 0,
    total: Number(summary?.total || 0),
    depositRequired: Number(summary?.depositRequired || 0),
    depositPaid: Number(summary?.depositRequired || 0),
    depositStatus: "Pending review",
    deliveryEstimate: "Pending team confirmation",
    createdAt,
    paidAt: null,
    name: joinNonEmpty([form?.shipping?.firstName, form?.shipping?.lastName]),
    phoneNumber: sanitizePhone(form?.shipping?.phoneNumber),
    shipmentAddress: buildShipmentAddress({
      shipmentAddress: buildCombinedShippingAddress(form?.shipping?.shipmentAddress, form?.shipping?.apartment),
      city: form?.shipping?.city,
      governorate: form?.shipping?.governorate,
      postalCode: form?.shipping?.postalCode
    }),
    shippingDetails: {
      fullName: joinNonEmpty([form?.shipping?.firstName, form?.shipping?.lastName]),
      phoneNumber: sanitizePhone(form?.shipping?.phoneNumber),
      shipmentAddress: buildCombinedShippingAddress(form?.shipping?.shipmentAddress, form?.shipping?.apartment),
      city: sanitizeText(form?.shipping?.city, 80),
      governorate: sanitizeText(form?.shipping?.governorate, 80),
      postalCode: sanitizeText(form?.shipping?.postalCode, 20)
    },
    billingDetails: {
      fullName: sanitizeText(form?.billing?.fullName, 120),
      phoneNumber: sanitizePhone(form?.shipping?.phoneNumber),
      billingAddress: buildCombinedShippingAddress(form?.shipping?.shipmentAddress, form?.shipping?.apartment),
      paymentMethod: "instapay",
      paymentMethodLabel: "Instapay",
      advancePaymentNoticeAccepted: Boolean(form?.billing?.advancePaymentNoticeAccepted),
      paymentSummary
    },
    items: (Array.isArray(items) ? items : []).map((item) => {
      const multiplier = item?.mode === "rent" ? Number(item?.rental_days || 1) : 1;
      return {
        id: `${item?.id}-${item?.mode || "buy"}`,
        productId: Number(item?.id || 0),
        name: String(item?.name || "Product"),
        selectedColor: sanitizeText(item?.selected_color || item?.selectedColor, 60),
        selectedSize: sanitizeText(item?.selected_size || item?.selectedSize, 40),
        customizationRequested: Boolean(
          item?.customization_requested ||
          item?.customizationRequested ||
          normalizeUploadTokenList(item?.customization_uploads || item?.customizationUploads).length
        ),
        quantity: Number(item?.quantity || 0),
        mode: item?.mode === "rent" ? "rent" : "buy",
        rentalDays: item?.mode === "rent" ? Number(item?.rental_days || 1) : null,
        unitPrice: Number(item?.unit_price || 0),
        lineTotal: roundCurrency(Number(item?.unit_price || 0) * Number(item?.quantity || 0) * multiplier)
      };
    })
  };
}

export function writeLocalOrderConfirmation(order) {
  const orderId = String(order?.orderId || "").trim();
  if (!orderId) return;

  try {
    localStorage.setItem(getLocalOrderStorageKey(orderId), JSON.stringify(order));
  } catch (_error) {
    // Ignore local order persistence failures.
  }
}

export function readLocalOrderConfirmation(orderId) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) return null;

  try {
    const raw = localStorage.getItem(getLocalOrderStorageKey(normalizedOrderId));
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}
