const ATTENDEES_RANGES = Object.freeze([
  { key: "10-30", label: "10 – 30 guests" },
  { key: "31-50", label: "31 – 50 guests" },
  { key: "51-100", label: "51 – 100 guests" },
  { key: "101-150", label: "101 – 150 guests" },
  { key: "150-250", label: "150 – 250 guests" },
  { key: "300+", label: "300+ guests" }
]);

// Three groups per split range: birthday / outdoor / other
const MINIMUM_MATRIX = Object.freeze({
  "10-30": Object.freeze({ merch: 10, giveaways: 10, soundAndLights: 2, screen: 0, customWorkAndStage: 0 }),
  "31-50": Object.freeze({ merch: 20, giveaways: 20, soundAndLights: 3, screen: 0, customWorkAndStage: 0 }),
  "51-100": Object.freeze({
    birthday: Object.freeze({ merch: 40, giveaways: 40, soundAndLights: 3, screen: 0, customWorkAndStage: 0 }),
    outdoor:  Object.freeze({ merch: 30, giveaways: 30, soundAndLights: 6, screen: 1, customWorkAndStage: 0 }),
    other:    Object.freeze({ merch: 40, giveaways: 40, soundAndLights: 5, screen: 0, customWorkAndStage: 0 })
  }),
  "101-150": Object.freeze({
    birthday: Object.freeze({ merch: 60, giveaways: 60, soundAndLights: 4, screen: 0, customWorkAndStage: 0 }),
    outdoor:  Object.freeze({ merch: 40, giveaways: 40, soundAndLights: 8, screen: 1, customWorkAndStage: 1 }),
    other:    Object.freeze({ merch: 60, giveaways: 60, soundAndLights: 6, screen: 0, customWorkAndStage: 0 })
  }),
  "150-250": Object.freeze({
    birthday: Object.freeze({ merch: 80, giveaways: 80, soundAndLights: 5, screen: 0, customWorkAndStage: 0 }),
    outdoor:  Object.freeze({ merch: 50, giveaways: 50, soundAndLights: 10, screen: 2, customWorkAndStage: 1 }),
    other:    Object.freeze({ merch: 80, giveaways: 80, soundAndLights: 7, screen: 0, customWorkAndStage: 0 })
  }),
  "300+": Object.freeze({
    birthday: Object.freeze({ merch: 100, giveaways: 100, soundAndLights: 6, screen: 0, customWorkAndStage: 0 }),
    outdoor:  Object.freeze({ merch: 60, giveaways: 60, soundAndLights: 12, screen: 2, customWorkAndStage: 2 }),
    other:    Object.freeze({ merch: 100, giveaways: 100, soundAndLights: 8, screen: 0, customWorkAndStage: 0 })
  })
});

const DELIVERY_CLASS_FEES = Object.freeze({
  standard: 180,
  fragile: 280,
  oversized: 420
});

const DELIVERY_PLACE_WINDOWS = Object.freeze({
  metro: Object.freeze({
    maxLeadDays: 3,
    minLeadDays: 2,
    places: Object.freeze(["cairo", "giza", "qalyubia"])
  }),
  regional: Object.freeze({
    maxLeadDays: 4,
    minLeadDays: 3,
    places: Object.freeze(["alexandria", "dakahlia", "gharbia", "monufia", "sharqia", "suez", "ismailia"])
  }),
  extended: Object.freeze({
    maxLeadDays: 6,
    minLeadDays: 4,
    places: Object.freeze([])
  })
});

const PRODUCT_QUANTITY_LIMITS = Object.freeze({
  rubberWristband: 50,
  screen: 6,
  sound: 2,
  eventTypeMerchGiveaway: Object.freeze({
    small: Object.freeze({ types: Object.freeze(["party", "birthday"]), max: 10 }),
    large: Object.freeze({ types: Object.freeze(["corporate", "conference", "indoor", "outdoor", "wedding"]), max: 20 })
  })
});

const PACKAGE_ITEM_DISCOUNT_RATE = 0.15;

const FREE_SHIPPING_MINIMUM_UNITS = 4;

// Category requirement levels per event type — drives the builder UI requirement pills
const CATEGORY_REQUIREMENTS_BY_EVENT = Object.freeze({
  birthday:   Object.freeze({ merch: "recommended", giveaways: "recommended", sound: "recommended", lighting: "recommended" }),
  party:      Object.freeze({ merch: "recommended", giveaways: "recommended", sound: "recommended" }),
  corporate:  Object.freeze({ sound: "required", screen: "recommended", woodwork: "recommended" }),
  conference: Object.freeze({ sound: "required", screen: "required", stage: "recommended" }),
  wedding:    Object.freeze({ woodwork: "recommended", lighting: "recommended", sound: "recommended", stage: "recommended" }),
  outdoor:    Object.freeze({ stage: "recommended", sound: "recommended", screen: "recommended" }),
  indoor:     Object.freeze({ lighting: "recommended", sound: "recommended" }),
  engagement: Object.freeze({ woodwork: "recommended", lighting: "recommended", sound: "recommended" })
});

const HOME_CATEGORIES = Object.freeze([
  "Sound Systems",
  "Merchandise",
  "Giveaways",
  "Lighting Systems",
  "Wireless Microphones",
  "Stage Uplighting",
  "Promo Booth Kits",
  "LED Accent Lights"
]);

module.exports = {
  ATTENDEES_RANGES,
  CATEGORY_REQUIREMENTS_BY_EVENT,
  DELIVERY_CLASS_FEES,
  DELIVERY_PLACE_WINDOWS,
  FREE_SHIPPING_MINIMUM_UNITS,
  HOME_CATEGORIES,
  MINIMUM_MATRIX,
  PACKAGE_ITEM_DISCOUNT_RATE,
  PRODUCT_QUANTITY_LIMITS
};
