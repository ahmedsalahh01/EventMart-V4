const crypto = require("crypto");
const { resolveEventType } = require("../lib/eventTypeConfig");

const MAX_CART_ITEMS = 8;
const MAX_CANDIDATE_PRODUCTS = 20;
const MAX_VIEWED_CATEGORIES = 6;
const MAX_VIEWED_PRODUCT_IDS = 8;

function toList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function sanitizeText(value, maxLength = 160) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function uniqueStringList(value, limit) {
  return Array.from(
    new Set(
      toList(value)
        .map((item) => sanitizeText(item, 80))
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeModePreference(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "rent" || normalized === "buy" ? normalized : "";
}

function stableFraction(seed) {
  const digest = crypto.createHash("sha256").update(String(seed || "")).digest("hex").slice(0, 8);
  return parseInt(digest, 16) / 0xffffffff;
}

function normalizeCandidateProduct(product) {
  const id = sanitizeText(product?.id, 40);
  if (!id) return null;

  const explicitInStock = product?.inStock;
  const stockValue = toFiniteNumber(product?.stock ?? product?.quantity_available, Number.NaN);
  const inStock =
    typeof explicitInStock === "boolean"
      ? explicitInStock
      : Number.isFinite(stockValue)
        ? stockValue > 0
        : true;

  return {
    id,
    name: sanitizeText(product?.name, 120),
    category: sanitizeText(product?.category, 60),
    categoryKey: sanitizeText(product?.categoryKey, 40),
    subcategory: sanitizeText(product?.subcategory, 60),
    description: sanitizeText(product?.description, 180),
    price: Math.max(0, toFiniteNumber(product?.price, 0)),
    currency: sanitizeText(product?.currency || "USD", 12) || "USD",
    featured: Boolean(product?.featured),
    customizable: Boolean(product?.customizable),
    inStock,
    buyEnabled: Boolean(product?.buyEnabled),
    rentEnabled: Boolean(product?.rentEnabled),
    deterministicScore: toFiniteNumber(product?.deterministicScore, 0),
    reasonHints: uniqueStringList(product?.reasonHints, 2),
    venueCompatibility: uniqueStringList(product?.venueCompatibility, 2)
  };
}

function normalizeCartItem(item) {
  const productId = sanitizeText(item?.productId || item?.product_id, 40);
  if (!productId) return null;

  return {
    productId,
    name: sanitizeText(item?.name, 100),
    quantity: Math.max(1, Math.round(toFiniteNumber(item?.quantity, 1))),
    category: sanitizeText(item?.category, 60),
    mode: normalizeModePreference(item?.mode),
    price: Math.max(0, toFiniteNumber(item?.price, 0))
  };
}

function normalizeSmartRecommendationRequest(body) {
  const candidateProducts = toList(body?.candidateProducts)
    .map(normalizeCandidateProduct)
    .filter(Boolean)
    .slice(0, MAX_CANDIDATE_PRODUCTS);
  const trafficSource = {
    channel: sanitizeText(body?.trafficSource?.channel, 40),
    referrerHost: sanitizeText(body?.trafficSource?.referrerHost, 80),
    searchEngine: sanitizeText(body?.trafficSource?.searchEngine, 40),
    utmCampaign: sanitizeText(body?.trafficSource?.utmCampaign, 80),
    utmMedium: sanitizeText(body?.trafficSource?.utmMedium, 40),
    utmSource: sanitizeText(body?.trafficSource?.utmSource, 80),
    eventTypeHint: resolveEventType(body?.trafficSource?.eventTypeHint || "")
  };
  const resolvedEventType =
    resolveEventType(body?.eventType || body?.selectedEventType || "") ||
    trafficSource.eventTypeHint;

  return {
    eventType: resolvedEventType,
    viewedProductIds: uniqueStringList(body?.viewedProductIds, MAX_VIEWED_PRODUCT_IDS),
    viewedCategories: uniqueStringList(body?.viewedCategories, MAX_VIEWED_CATEGORIES),
    cartItems: toList(body?.cartItems).map(normalizeCartItem).filter(Boolean).slice(0, MAX_CART_ITEMS),
    modePreference: normalizeModePreference(body?.modePreference),
    currentProductId: sanitizeText(body?.currentProductId, 40),
    currentCategory: sanitizeText(body?.currentCategory, 60),
    venuePreference: sanitizeText(body?.venuePreference, 20),
    trafficSource,
    customizablePreference: {
      observed: Math.max(0, Math.round(toFiniteNumber(body?.customizablePreference?.observed, 0))),
      selected: Math.max(0, Math.round(toFiniteNumber(body?.customizablePreference?.selected, 0)))
    },
    candidateProducts
  };
}

function sortCandidatesForAudience(candidates, audienceKey = "") {
  return [...candidates].sort((left, right) => {
    const scoreDelta = Number(right?.deterministicScore || 0) - Number(left?.deterministicScore || 0);

    if (Math.abs(scoreDelta) > 0.35) {
      return scoreDelta;
    }

    return stableFraction(`${audienceKey}:${right?.id || ""}`) - stableFraction(`${audienceKey}:${left?.id || ""}`);
  });
}

function buildFallbackReason(candidate, request) {
  if (candidate?.reasonHints?.length) {
    return candidate.reasonHints[0];
  }

  if (request.eventType && candidate.category) {
    return `A strong fit for ${request.eventType} ${candidate.category.toLowerCase()} needs.`;
  }

  if (request.modePreference === "rent" && candidate.rentEnabled) {
    return "Matches your recent rent-focused browsing.";
  }

  if (request.modePreference === "buy" && candidate.buyEnabled) {
    return "Matches your recent buy-focused browsing.";
  }

  return "Matches your recent browsing and cart activity.";
}

function buildFallbackSmartRecommendationResponse(request, options = {}) {
  const recommendedCandidates = sortCandidatesForAudience(
    request.candidateProducts.filter((candidate) => candidate.inStock),
    request.audienceContext?.key || "guest"
  ).slice(0, 8);

  return {
    confidence: 0,
    inferredEventType: request.eventType || "",
    reasonsByProductId: Object.fromEntries(
      recommendedCandidates.map((candidate) => [candidate.id, buildFallbackReason(candidate, request)])
    ),
    recommendedProductIds: recommendedCandidates.map((candidate) => candidate.id),
    source: options.source || "fallback"
  };
}

function buildOpenAIRecommendationPromptInput(request) {
  return {
    audienceContext: {
      type: String(request.audienceContext?.type || "guest"),
      stableProfileKey: String(request.audienceContext?.key || "guest")
    },
    instructions: {
      eventType: request.eventType || null,
      modePreference: request.modePreference || null,
      currentProductId: request.currentProductId || null,
      currentCategory: request.currentCategory || null,
      venuePreference: request.venuePreference || null,
      customizablePreference: request.customizablePreference,
      trafficSource: request.trafficSource || null
    },
    browsingSignals: {
      viewedCategories: request.viewedCategories,
      viewedProductIds: request.viewedProductIds
    },
    cartItems: request.cartItems,
    allowedProductIds: request.candidateProducts.map((candidate) => candidate.id),
    candidateProducts: request.candidateProducts.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      category: candidate.category,
      categoryKey: candidate.categoryKey,
      subcategory: candidate.subcategory,
      description: candidate.description,
      price: candidate.price,
      currency: candidate.currency,
      featured: candidate.featured,
      customizable: candidate.customizable,
      buyEnabled: candidate.buyEnabled,
      rentEnabled: candidate.rentEnabled,
      inStock: candidate.inStock,
      venueCompatibility: candidate.venueCompatibility,
      deterministicScore: candidate.deterministicScore,
      reasonHints: candidate.reasonHints
    }))
  };
}

module.exports = {
  buildFallbackSmartRecommendationResponse,
  buildOpenAIRecommendationPromptInput,
  normalizeSmartRecommendationRequest
};
