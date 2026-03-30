import { EVENT_TYPE_ORDER, getEventTypeConfig, resolveEventType } from "./eventTypeConfig.js";

const CATEGORY_DEFINITIONS = Object.freeze([
  {
    key: "merch",
    label: "Merchandise",
    categoryKeywords: ["merchandise", "merch", "wearables", "apparel", "shirts", "hoodie", "cap", "hat", "lanyard"],
    productKeywords: ["merch", "merchandise", "shirt", "hoodie", "cap", "lanyard", "uniform", "branding"]
  },
  {
    key: "giveaways",
    label: "Giveaways",
    categoryKeywords: ["giveaway", "giveaways", "souvenir", "promo gifts", "gifts"],
    productKeywords: ["giveaway", "gift", "souvenir", "promotional", "promo", "gift bag", "welcome kit"]
  },
  {
    key: "sound",
    label: "Sound Systems",
    categoryKeywords: ["sound systems", "sound system", "sound", "audio", "microphone", "microphones", "dj", "speaker"],
    productKeywords: ["sound", "audio", "speaker", "microphone", "mic", "dj", "mixer", "subwoofer", "podium mic"]
  },
  {
    key: "lighting",
    label: "Lighting Systems",
    categoryKeywords: ["lighting systems", "lighting system", "lighting", "lights", "uplight", "uplighting"],
    productKeywords: ["light", "lighting", "uplight", "uplighting", "led", "beam", "wash light", "accent light"]
  },
  {
    key: "stage",
    label: "Stages",
    categoryKeywords: ["stage", "stages", "staging", "platform", "truss", "riser"],
    productKeywords: ["stage", "staging", "platform", "riser", "truss", "booth", "performance riser"]
  },
  {
    key: "screen",
    label: "Screens",
    categoryKeywords: ["screen", "screens", "display", "displays", "led screen", "led screens", "panel", "panels"],
    productKeywords: ["screen", "display", "led panel", "led wall", "videowall", "projector", "presentation screen"]
  },
  {
    key: "woodwork",
    label: "Woodworks",
    categoryKeywords: ["woodworks", "woodwork", "gate", "gates", "booth", "booths", "podium", "arch"],
    productKeywords: ["woodwork", "gate", "podium", "arch", "booth", "backdrop", "counter", "display stand"]
  }
]);

const CATEGORY_MAP = Object.freeze(Object.fromEntries(CATEGORY_DEFINITIONS.map((entry) => [entry.key, entry])));

const CATEGORY_DISPLAY_LABELS = Object.freeze(
  CATEGORY_DEFINITIONS.reduce((map, entry) => {
    map[entry.key] = entry.label;
    return map;
  }, {})
);

const BASE_COMPLEMENTARY_CATEGORY_MAP = Object.freeze({
  merch: ["giveaways", "lighting", "woodwork"],
  giveaways: ["merch", "lighting", "sound"],
  sound: ["lighting", "stage", "screen"],
  lighting: ["sound", "stage", "woodwork"],
  stage: ["sound", "lighting", "screen"],
  screen: ["sound", "stage", "woodwork"],
  woodwork: ["lighting", "sound", "merch"],
  general: ["sound", "lighting", "merch"]
});

const EVENT_COMPLEMENTARY_CATEGORY_MAP = Object.freeze({
  birthday: {
    sound: ["lighting", "giveaways", "merch"],
    lighting: ["sound", "giveaways", "merch"],
    merch: ["giveaways", "sound", "lighting"]
  },
  corporate: {
    sound: ["screen", "woodwork", "stage"],
    screen: ["sound", "woodwork", "stage"],
    woodwork: ["sound", "screen", "merch"]
  },
  indoor: {
    lighting: ["sound", "screen", "woodwork"],
    sound: ["lighting", "screen", "woodwork"]
  },
  outdoor: {
    stage: ["sound", "screen", "lighting"],
    screen: ["stage", "sound", "lighting"],
    sound: ["stage", "screen", "lighting"]
  },
  "private-party": {
    merch: ["giveaways", "lighting", "sound"],
    giveaways: ["merch", "lighting", "sound"]
  },
  wedding: {
    woodwork: ["lighting", "sound", "stage"],
    lighting: ["woodwork", "sound", "stage"],
    sound: ["woodwork", "lighting", "stage"]
  }
});

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getEntitySearchText(entity) {
  return normalizeText(
    [
      entity?.name,
      entity?.description,
      entity?.category,
      entity?.subcategory,
      entity?.selected_color,
      entity?.selected_size
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function textIncludesAny(text, keywords) {
  const normalizedText = normalizeText(text);
  return keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)));
}

function getCategoryKey(entityOrCategory) {
  const categoryText =
    typeof entityOrCategory === "string"
      ? normalizeText(entityOrCategory)
      : normalizeText(entityOrCategory?.category);
  const fullText =
    typeof entityOrCategory === "string"
      ? categoryText
      : getEntitySearchText(entityOrCategory);

  for (const definition of CATEGORY_DEFINITIONS) {
    if (
      definition.categoryKeywords.some((keyword) => categoryText.includes(keyword)) ||
      definition.productKeywords.some((keyword) => fullText.includes(keyword))
    ) {
      return definition.key;
    }
  }

  return "general";
}

function getCategoryLabelFromKey(categoryKey) {
  return CATEGORY_DISPLAY_LABELS[categoryKey] || "General";
}

function getCategoryLabel(entityOrCategory) {
  const categoryKey = getCategoryKey(entityOrCategory);
  return getCategoryLabelFromKey(categoryKey);
}

function isRubberWristband(entity) {
  return getEntitySearchText(entity).includes("rubber wristband");
}

function isScreenProduct(entity) {
  return getCategoryKey(entity) === "screen" || textIncludesAny(getEntitySearchText(entity), ["screen", "display", "led panel"]);
}

function isSoundSystemProduct(entity) {
  return getCategoryKey(entity) === "sound" || textIncludesAny(getEntitySearchText(entity), ["sound system", "speaker", "audio"]);
}

function getVenueCompatibility(entity) {
  const text = getEntitySearchText(entity);

  if (textIncludesAny(text, ["weather", "weatherproof", "outdoor", "festival", "concert", "open-air"])) {
    return ["outdoor"];
  }

  if (textIncludesAny(text, ["indoor", "ballroom", "hall", "ceiling", "conference room"])) {
    return ["indoor"];
  }

  const categoryKey = getCategoryKey(entity);

  if (categoryKey === "stage" || categoryKey === "screen" || categoryKey === "sound") {
    return ["indoor", "outdoor"];
  }

  return ["indoor", "outdoor"];
}

function isEntityCompatibleWithEventType(entity, eventType) {
  const config = getEventTypeConfig(eventType);
  if (!config) return true;

  const categoryKey = getCategoryKey(entity);
  if (!config.allowedCategories.includes(categoryKey) && categoryKey !== "general") {
    return false;
  }

  const venueCompatibility = getVenueCompatibility(entity);
  const eventVenue = config.venueCompatibility;

  if (!eventVenue.length || venueCompatibility.includes("indoor") && venueCompatibility.includes("outdoor")) {
    return true;
  }

  return eventVenue.some((value) => venueCompatibility.includes(value));
}

function getPreferredMode(entity, fallback = "") {
  const explicitMode = String(entity?.mode || "").toLowerCase();
  if (explicitMode === "buy" || explicitMode === "rent") return explicitMode;

  const observedMode = String(fallback || "").toLowerCase();
  if (observedMode === "buy" || observedMode === "rent") return observedMode;

  if (entity?.buy_enabled && entity?.rent_enabled) return "buy";
  if (entity?.buy_enabled) return "buy";
  if (entity?.rent_enabled) return "rent";
  return "buy";
}

function getEntityUnitPrice(entity, mode = "") {
  const preferredMode = getPreferredMode(entity, mode);

  if (entity?.unit_price !== undefined && entity?.unit_price !== null) {
    return toNumber(entity.unit_price, 0);
  }

  if (preferredMode === "rent" && entity?.rent_price_per_day !== undefined && entity?.rent_price_per_day !== null) {
    return toNumber(entity.rent_price_per_day, 0);
  }

  if (entity?.buy_price !== undefined && entity?.buy_price !== null) {
    return toNumber(entity.buy_price, 0);
  }

  return toNumber(entity?.rent_price_per_day, 0);
}

function getEntityLineBasePrice(entity, mode = "") {
  const quantity = Math.max(1, toNumber(entity?.quantity, 1));
  const unitPrice = getEntityUnitPrice(entity, mode);
  const rentalDays = getPreferredMode(entity, mode) === "rent" ? Math.max(1, toNumber(entity?.rental_days || entity?.rentalDays, 1)) : 1;

  return unitPrice * quantity * rentalDays;
}

function getEntityStock(entity) {
  if (entity?.quantity_available !== undefined || entity?.stock !== undefined) {
    return toNumber(entity?.quantity_available ?? entity?.stock, 0);
  }

  return Number.POSITIVE_INFINITY;
}

function isEntityInStock(entity) {
  return getEntityStock(entity) > 0;
}

function scoreEntityForEventType(entity, eventType) {
  const config = getEventTypeConfig(eventType);
  if (!config) return 0;

  const categoryKey = getCategoryKey(entity);
  const text = getEntitySearchText(entity);
  const venueCompatibility = getVenueCompatibility(entity);
  let score = 0;

  if (config.preferredCategories.includes(categoryKey)) score += 4;
  else if (config.allowedCategories.includes(categoryKey)) score += 2;

  config.recommendedTags.forEach((tag) => {
    if (text.includes(normalizeText(tag))) {
      score += 1.5;
    }
  });

  if (config.venueCompatibility.some((venue) => venueCompatibility.includes(venue))) {
    score += 1;
  }

  if (entity?.customizable && (categoryKey === "merch" || categoryKey === "giveaways" || categoryKey === "woodwork")) {
    score += 0.8;
  }

  return score;
}

function inferDominantEventType(entities, preferredEventType = "") {
  const resolvedPreferred = resolveEventType(preferredEventType);
  if (resolvedPreferred) {
    return resolvedPreferred;
  }

  const list = Array.isArray(entities) ? entities : [];
  if (!list.length) return "";

  const scores = EVENT_TYPE_ORDER.reduce((map, slug) => {
    map[slug] = 0;
    return map;
  }, {});

  list.forEach((entity) => {
    EVENT_TYPE_ORDER.forEach((slug) => {
      scores[slug] += scoreEntityForEventType(entity, slug);
    });
  });

  return EVENT_TYPE_ORDER.reduce((best, slug) => {
    if (!best || scores[slug] > scores[best]) {
      return slug;
    }

    return best;
  }, "");
}

function getComplementaryCategoryKeys(categoryKey, eventType = "") {
  const resolvedEventType = resolveEventType(eventType);
  const eventOverrides = EVENT_COMPLEMENTARY_CATEGORY_MAP[resolvedEventType] || {};
  return eventOverrides[categoryKey] || BASE_COMPLEMENTARY_CATEGORY_MAP[categoryKey] || BASE_COMPLEMENTARY_CATEGORY_MAP.general;
}

function buildEntitySignals(entity, { eventType = "", mode = "" } = {}) {
  const categoryKey = getCategoryKey(entity);

  return {
    categoryKey,
    categoryLabel: getCategoryLabelFromKey(categoryKey),
    displayPrice: getEntityUnitPrice(entity, mode),
    eventScore: scoreEntityForEventType(entity, eventType),
    inStock: isEntityInStock(entity),
    isRubberWristband: isRubberWristband(entity),
    isScreen: isScreenProduct(entity),
    isSoundSystem: isSoundSystemProduct(entity),
    searchableText: getEntitySearchText(entity),
    venueCompatibility: getVenueCompatibility(entity)
  };
}

function matchCategoryLabelToKey(categoryLabel, categoryKey) {
  return getCategoryKey(categoryLabel) === categoryKey;
}

export {
  CATEGORY_DEFINITIONS,
  CATEGORY_DISPLAY_LABELS,
  CATEGORY_MAP,
  buildEntitySignals,
  getCategoryKey,
  getCategoryLabel,
  getCategoryLabelFromKey,
  getComplementaryCategoryKeys,
  getEntityLineBasePrice,
  getEntitySearchText,
  getEntityStock,
  getEntityUnitPrice,
  getPreferredMode,
  getVenueCompatibility,
  inferDominantEventType,
  isEntityCompatibleWithEventType,
  isEntityInStock,
  isRubberWristband,
  isScreenProduct,
  isSoundSystemProduct,
  matchCategoryLabelToKey,
  normalizeText,
  scoreEntityForEventType,
  textIncludesAny,
  toNumber
};
