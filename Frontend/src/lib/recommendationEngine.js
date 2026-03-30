import { metricScore } from "./products.js";
import { getEventTypeConfig, resolveEventType } from "./eventTypeConfig.js";
import {
  buildEntitySignals,
  getCategoryKey,
  getComplementaryCategoryKeys,
  getEntityLineBasePrice,
  getEntityUnitPrice,
  getPreferredMode,
  inferDominantEventType,
  isEntityCompatibleWithEventType,
  normalizeText,
  scoreEntityForEventType
} from "./productRuleEngine.js";
import { readBehaviorState } from "./userBehavior.js";

const DEFAULT_CANDIDATE_LIMIT = 12;

function toList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function uniqueValues(list, limit = Number.POSITIVE_INFINITY) {
  return Array.from(new Set(toList(list).map((value) => String(value || "").trim()).filter(Boolean))).slice(0, limit);
}

function truncateText(value, maxLength = 160) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function getContextEventType({ currentEventType = "", behavior, cartItems = [], currentProduct = null }) {
  return (
    resolveEventType(currentEventType) ||
    resolveEventType(behavior?.selectedEventType) ||
    resolveEventType(behavior?.trafficSource?.eventTypeHint) ||
    inferDominantEventType([...cartItems, currentProduct].filter(Boolean))
  );
}

function getObservedMode({ currentMode = "", behavior, cartItems = [], currentProduct = null }) {
  const normalizedCurrentMode = String(currentMode || "").toUpperCase();
  if (normalizedCurrentMode === "BUY_ONLY") return "buy";
  if (normalizedCurrentMode === "RENT_ONLY") return "rent";
  const explicit = getPreferredMode({ mode: currentMode });
  if (explicit === "buy" || explicit === "rent") return explicit;

  const cartMode = toList(cartItems).reduce(
    (map, item) => {
      map[getPreferredMode(item)] += 1;
      return map;
    },
    { buy: 0, rent: 0 }
  );

  if (cartMode.buy !== cartMode.rent) {
    return cartMode.buy > cartMode.rent ? "buy" : "rent";
  }

  const behaviorMode = behavior?.modePreference || {};
  if (Number(behaviorMode.buy || 0) !== Number(behaviorMode.rent || 0)) {
    return Number(behaviorMode.buy || 0) > Number(behaviorMode.rent || 0) ? "buy" : "rent";
  }

  return getPreferredMode(currentProduct);
}

function getCategoryEngagementScore(behavior, categoryKey) {
  const categories = behavior?.viewedCategories || {};

  return Object.values(categories).reduce((sum, entry) => {
    if (!entry) return sum;
    if (entry.categoryKey === categoryKey) {
      return sum + Number(entry.count || 0);
    }
    return sum;
  }, 0);
}

function getCartStats(cartItems) {
  const categoryCounts = {};
  const prices = [];
  const cartIds = new Set();

  toList(cartItems).forEach((item) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const categoryKey = getCategoryKey(item);
    const lineBasePrice = getEntityLineBasePrice(item);

    categoryCounts[categoryKey] = Number(categoryCounts[categoryKey] || 0) + quantity;
    if (lineBasePrice > 0) {
      prices.push(lineBasePrice / quantity);
    }

    if (item?.id) {
      cartIds.add(String(item.id));
    }
  });

  const averagePrice = prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : 0;

  return {
    averagePrice,
    cartIds,
    categoryCounts
  };
}

function getMissingPreferredCategories(eventType, cartItems) {
  const config = getEventTypeConfig(eventType);
  if (!config) return [];

  const present = new Set(toList(cartItems).map((item) => getCategoryKey(item)));
  return config.preferredCategories.filter((categoryKey) => !present.has(categoryKey));
}

function getBehaviorProfile(behaviorInput) {
  return behaviorInput && typeof behaviorInput === "object" ? behaviorInput : readBehaviorState();
}

function pickDominantVenuePreference(behavior) {
  const indoor = Number(behavior?.venuePreference?.indoor || 0);
  const outdoor = Number(behavior?.venuePreference?.outdoor || 0);

  if (indoor === outdoor) return "";
  return indoor > outdoor ? "indoor" : "outdoor";
}

function getTopBehaviorKeys(source, { field = "count", limit = 8 } = {}) {
  return Object.entries(source || {})
    .sort((left, right) => Number(right[1]?.[field] || 0) - Number(left[1]?.[field] || 0))
    .map(([key]) => String(key || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildRecommendationContext({
  behavior = null,
  cartItems = [],
  currentProduct = null,
  currentCategory = "",
  currentEventType = "",
  currentMode = ""
} = {}) {
  const profile = getBehaviorProfile(behavior);
  const resolvedEventType = getContextEventType({
    currentEventType,
    behavior: profile,
    cartItems,
    currentProduct
  });
  const observedMode = getObservedMode({
    currentMode,
    behavior: profile,
    cartItems,
    currentProduct
  });
  const currentCategoryKey = getCategoryKey(currentCategory || currentProduct || "");
  const cartStats = getCartStats(cartItems);
  const missingPreferredCategories = getMissingPreferredCategories(resolvedEventType, cartItems);

  return {
    behavior: profile,
    cartItems: toList(cartItems),
    cartStats,
    currentCategoryKey,
    currentEventType: resolvedEventType,
    currentProduct,
    currentProductId: currentProduct?.id ? String(currentProduct.id) : "",
    missingPreferredCategories,
    observedMode,
    preferredVenue: pickDominantVenuePreference(profile),
    trafficSource: profile?.trafficSource || {}
  };
}

function scoreProductRecommendation(product, contextInput = {}) {
  const context = contextInput.cartStats ? contextInput : buildRecommendationContext(contextInput);
  const cartIds = context.cartStats?.cartIds || new Set();
  const productId = String(product?.id || "");

  if (!productId || cartIds.has(productId) || productId === context.currentProductId) {
    return null;
  }

  const categoryKey = getCategoryKey(product);
  const productSignals = buildEntitySignals(product, {
    eventType: context.currentEventType,
    mode: context.observedMode
  });
  const reasons = [];
  const badges = [];
  let score = 0;

  if (productSignals.inStock) {
    score += 1.8;
  } else {
    score -= 6;
    reasons.push("Currently low stock");
  }

  if (context.currentCategoryKey !== "general" && categoryKey === context.currentCategoryKey) {
    score += 3.4;
    reasons.push("Matches the category you're browsing");
  }

  const categoryEngagement = getCategoryEngagementScore(context.behavior, categoryKey);
  if (categoryEngagement > 0) {
    score += Math.min(4.2, categoryEngagement * 0.8);
    reasons.push(`Fits your recent ${productSignals.categoryLabel.toLowerCase()} browsing`);
  }

  if (context.currentEventType) {
    const eventScore = scoreEntityForEventType(product, context.currentEventType);
    score += eventScore * 1.45;

    if (eventScore > 0) {
      reasons.push("Strong fit for your selected event type");
      badges.push("Recommended for Your Event");
    }

    if (!isEntityCompatibleWithEventType(product, context.currentEventType)) {
      score -= 3;
    }
  }

  const metricBoost = Number(metricScore(product.id) || 0);
  if (metricBoost > 0) {
    score += Math.min(2.2, metricBoost * 0.08);
  }

  toList(context.cartItems).forEach((cartItem) => {
    const cartCategoryKey = getCategoryKey(cartItem);
    const complementaryKeys = getComplementaryCategoryKeys(cartCategoryKey, context.currentEventType);

    if (categoryKey === cartCategoryKey) {
      score += 1.1;
    }

    if (complementaryKeys.includes(categoryKey)) {
      score += 2.6;
      reasons.push("Complements items already in your cart");
    }
  });

  if (context.missingPreferredCategories.includes(categoryKey)) {
    score += 2.9;
    reasons.push("Fills a missing category in your current setup");
    badges.push("Good Match");
  }

  const candidatePrice = getEntityUnitPrice(product, context.observedMode);
  if (candidatePrice > 0 && context.cartStats.averagePrice > 0) {
    const ratio = candidatePrice / context.cartStats.averagePrice;

    if (ratio >= 0.45 && ratio <= 1.6) {
      score += 1.5;
      reasons.push("Fits your current budget range");
    } else if (ratio < 0.45) {
      score += 0.9;
    } else if (ratio > 2.8) {
      score -= 0.8;
    }
  }

  if (context.observedMode === "rent" && product.rent_enabled) {
    score += 1.25;
    reasons.push("Available in your preferred rent flow");
  } else if (context.observedMode === "buy" && product.buy_enabled) {
    score += 1.25;
    reasons.push("Available in your preferred buy flow");
  }

  if (context.preferredVenue === "outdoor" && productSignals.venueCompatibility.includes("outdoor")) {
    score += 0.8;
  }
  if (context.preferredVenue === "indoor" && productSignals.venueCompatibility.includes("indoor")) {
    score += 0.8;
  }

  if (product.customizable && Number(context.behavior?.customizablePreference?.selected || 0) > 0) {
    score += 0.9;
    reasons.push("Matches your customization preference");
  }

  if (context.trafficSource?.channel === "social" && (product.customizable || product.featured)) {
    score += 0.55;
  }

  if (context.trafficSource?.channel === "organic-search" && context.currentCategoryKey !== "general" && categoryKey === context.currentCategoryKey) {
    score += 0.45;
  }

  if (product.featured) {
    score += 0.7;
    badges.push("Featured");
  }

  return {
    badges: Array.from(new Set(badges)).slice(0, 3),
    primaryReason: Array.from(new Set(reasons))[0] || "Recommended based on your current shopping context",
    product,
    reasons: Array.from(new Set(reasons)).slice(0, 3),
    score
  };
}

function getRankedRecommendations(products, context) {
  return toList(products)
    .map((product) => scoreProductRecommendation(product, context))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);
}

function getFallbackRecommendations(products, context, limit) {
  const eventType = context.currentEventType;
  const categoryKey = context.currentCategoryKey;

  const ranked = toList(products)
    .filter((product) => {
      const productId = String(product?.id || "");
      return productId && !context.cartStats.cartIds.has(productId) && productId !== context.currentProductId;
    })
    .map((product) => {
      const eventBias = eventType ? scoreEntityForEventType(product, eventType) * 1.2 : 0;
      const categoryBias = categoryKey !== "general" && getCategoryKey(product) === categoryKey ? 2 : 0;
      const featuredBias = product.featured ? 1 : 0;
      const stockBias = buildEntitySignals(product).inStock ? 1 : -5;

      return {
        badges: product.featured ? ["Featured"] : [],
        primaryReason: eventBias > 0
          ? "Curated for your selected event type"
          : categoryBias > 0
            ? "Matches the products you're browsing"
            : "Popular equipment pick",
        product,
        reasons: [],
        score: eventBias + categoryBias + featuredBias + stockBias
      };
    })
    .sort((left, right) => right.score - left.score);

  return ranked.slice(0, limit);
}

function getSmartRecommendationCandidates({
  behavior = null,
  cartItems = [],
  currentCategory = "",
  currentEventType = "",
  currentMode = "",
  currentProduct = null,
  candidateLimit = DEFAULT_CANDIDATE_LIMIT,
  products = []
} = {}) {
  const context = buildRecommendationContext({
    behavior,
    cartItems,
    currentCategory,
    currentEventType,
    currentMode,
    currentProduct
  });
  const safeLimit = Math.max(1, Number(candidateLimit || DEFAULT_CANDIDATE_LIMIT));
  const ranked = getRankedRecommendations(products, context);

  if (!ranked.length) {
    return getFallbackRecommendations(products, context, safeLimit);
  }

  const trimmed = ranked.slice(0, safeLimit);
  const meaningfulResults = trimmed.filter((item) => item.score > 0.25);

  return meaningfulResults.length ? meaningfulResults : getFallbackRecommendations(products, context, safeLimit);
}

function getSmartRecommendations({
  behavior = null,
  cartItems = [],
  currentCategory = "",
  currentEventType = "",
  currentMode = "",
  currentProduct = null,
  limit = 6,
  candidateLimit = DEFAULT_CANDIDATE_LIMIT,
  products = []
} = {}) {
  const safeLimit = Math.max(1, Number(limit || 6));
  const candidates = getSmartRecommendationCandidates({
    behavior,
    cartItems,
    currentCategory,
    currentEventType,
    currentMode,
    currentProduct,
    candidateLimit: Math.max(safeLimit, candidateLimit),
    products
  });
  const meaningfulResults = candidates.filter((item) => item.score > 0.6);

  return (meaningfulResults.length ? meaningfulResults : candidates).slice(0, safeLimit);
}

function getBehaviorViewedProductIds(behavior) {
  return getTopBehaviorKeys(behavior?.viewedProducts, { limit: 8 });
}

function getBehaviorViewedCategories(behavior) {
  return getTopBehaviorKeys(behavior?.viewedCategories, { limit: 6 });
}

function summarizeCartItemsForRequest(cartItems, modePreference = "") {
  return toList(cartItems)
    .slice(0, 8)
    .map((item) => ({
      productId: String(item.id || item.product_id || "").trim(),
      name: truncateText(item.name, 80),
      quantity: Math.max(1, Number(item.quantity || 1)),
      category: getCategoryKey(item),
      mode: getPreferredMode(item, modePreference),
      price: getEntityUnitPrice(item, modePreference)
    }))
    .filter((item) => item.productId);
}

function buildCandidateProductSnapshot(entry, context) {
  const product = entry?.product || {};
  const signals = buildEntitySignals(product, {
    eventType: context.currentEventType,
    mode: context.observedMode
  });

  return {
    id: String(product.id || "").trim(),
    name: truncateText(product.name, 120),
    category: truncateText(product.category, 60),
    categoryKey: signals.categoryKey,
    subcategory: truncateText(product.subcategory, 60),
    description: truncateText(product.description, 180),
    price: getEntityUnitPrice(product, context.observedMode),
    currency: String(product.currency || "USD"),
    featured: Boolean(product.featured),
    customizable: Boolean(product.customizable),
    inStock: Boolean(signals.inStock),
    buyEnabled: Boolean(product.buy_enabled),
    rentEnabled: Boolean(product.rent_enabled),
    venueCompatibility: uniqueValues(signals.venueCompatibility, 2),
    reasonHints: uniqueValues(entry.reasons, 2),
    deterministicScore: Number(entry.score.toFixed(3))
  };
}

function hasMeaningfulRecommendationSignal(body) {
  if (!body || typeof body !== "object") return false;

  return Boolean(
    body.eventType ||
    body.currentProductId ||
    body.modePreference ||
    toList(body.cartItems).length ||
    toList(body.viewedProductIds).length ||
    toList(body.viewedCategories).length
  );
}

function buildSmartRecommendationRequestPayload({
  behavior = null,
  cartItems = [],
  currentCategory = "",
  currentEventType = "",
  currentMode = "",
  currentProduct = null,
  limit = 6,
  candidateLimit = DEFAULT_CANDIDATE_LIMIT,
  products = []
} = {}) {
  const context = buildRecommendationContext({
    behavior,
    cartItems,
    currentCategory,
    currentEventType,
    currentMode,
    currentProduct
  });
  const candidateEntries = getSmartRecommendationCandidates({
    behavior: context.behavior,
    cartItems,
    currentCategory,
    currentEventType: context.currentEventType,
    currentMode: context.observedMode,
    currentProduct,
    candidateLimit: Math.max(limit, candidateLimit),
    products
  });

  if (!candidateEntries.length) {
    return null;
  }

  const body = {
    eventType: context.currentEventType,
    viewedProductIds: getBehaviorViewedProductIds(context.behavior),
    viewedCategories: getBehaviorViewedCategories(context.behavior),
    cartItems: summarizeCartItemsForRequest(cartItems, context.observedMode),
    modePreference: context.observedMode,
    currentProductId: context.currentProductId,
    currentCategory: context.currentCategoryKey,
    venuePreference: context.preferredVenue,
    trafficSource: {
      channel: String(context.trafficSource?.channel || ""),
      referrerHost: String(context.trafficSource?.referrerHost || ""),
      searchEngine: String(context.trafficSource?.searchEngine || ""),
      utmCampaign: String(context.trafficSource?.utmCampaign || ""),
      utmMedium: String(context.trafficSource?.utmMedium || ""),
      utmSource: String(context.trafficSource?.utmSource || ""),
      eventTypeHint: String(context.trafficSource?.eventTypeHint || "")
    },
    customizablePreference: {
      observed: Number(context.behavior?.customizablePreference?.observed || 0),
      selected: Number(context.behavior?.customizablePreference?.selected || 0)
    },
    candidateProducts: candidateEntries.map((entry) => buildCandidateProductSnapshot(entry, context))
  };

  return {
    body,
    candidateEntries,
    context,
    hasMeaningfulSignal: hasMeaningfulRecommendationSignal(body),
    limit: Math.max(1, Number(limit || 6))
  };
}

function mergeSmartRecommendationResults({ candidateEntries = [], aiResult = null, limit = 6 } = {}) {
  const safeLimit = Math.max(1, Number(limit || 6));
  const entryMap = new Map(
    toList(candidateEntries).map((entry) => [String(entry?.product?.id || ""), entry]).filter(([id]) => Boolean(id))
  );
  const aiIds = uniqueValues(aiResult?.recommendedProductIds, candidateEntries.length);
  const aiReasons = aiResult?.reasonsByProductId && typeof aiResult.reasonsByProductId === "object"
    ? aiResult.reasonsByProductId
    : {};
  const merged = [];
  const usedIds = new Set();

  aiIds.forEach((productId) => {
    const entry = entryMap.get(productId);
    if (!entry || usedIds.has(productId)) return;

    const signals = buildEntitySignals(entry.product);
    if (!signals.inStock) return;

    const aiReason = truncateText(aiReasons[productId], 140);
    merged.push({
      ...entry,
      primaryReason: aiReason || entry.primaryReason,
      reasons: aiReason ? uniqueValues([aiReason, ...entry.reasons], 3) : entry.reasons,
      source: "ai-reranked"
    });
    usedIds.add(productId);
  });

  toList(candidateEntries).forEach((entry) => {
    const productId = String(entry?.product?.id || "");
    if (!productId || usedIds.has(productId)) return;
    merged.push(entry);
  });

  return merged.slice(0, safeLimit);
}

function rankProductsForEventType(products, eventType, options = {}) {
  const resolvedEventType = resolveEventType(eventType);
  const mode = options.mode || "";

  return toList(products)
    .map((product) => {
      const eventScore = resolvedEventType ? scoreEntityForEventType(product, resolvedEventType) : 0;
      const featuredBias = product.featured ? 1 : 0;
      const stockBias = buildEntitySignals(product, { eventType: resolvedEventType, mode }).inStock ? 1 : -5;
      const popularityBias = Math.min(1.6, Number(metricScore(product.id) || 0) * 0.08);

      return {
        product,
        score: eventScore * 1.6 + featuredBias + stockBias + popularityBias
      };
    })
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.product);
}

function getRecommendationLeadText({ behavior, currentEventType = "", currentCategory = "" } = {}) {
  const profile = getBehaviorProfile(behavior);
  const eventType = resolveEventType(currentEventType) || resolveEventType(profile.selectedEventType);

  if (eventType) {
    return `Recommended around your ${getEventTypeConfig(eventType)?.label || "event"} flow.`;
  }

  if (currentCategory && currentCategory !== "ALL") {
    return `Recommended around your ${normalizeText(currentCategory).replace(/-/g, " ")} browsing.`;
  }

  return "Recommended from featured equipment and recent browsing signals.";
}

export {
  DEFAULT_CANDIDATE_LIMIT,
  buildRecommendationContext,
  buildSmartRecommendationRequestPayload,
  getRecommendationLeadText,
  getSmartRecommendationCandidates,
  getSmartRecommendations,
  hasMeaningfulRecommendationSignal,
  mergeSmartRecommendationResults,
  rankProductsForEventType,
  scoreProductRecommendation
};
