import { resolveEventType } from "./eventTypeConfig.js";
import { buildEntitySignals, getCategoryLabel, getCategoryKey, getPreferredMode, toNumber } from "./productRuleEngine.js";

const AUTH_STORAGE_KEY = "eventmart_auth_v1";
const STORAGE_KEY_PREFIX = "eventmart_user_behavior_v2:";
const DWELL_STORAGE_PREFIX = "eventmart_product_dwell_started_v2:";
const SEARCH_ENGINE_HOSTS = ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex."];
const SOCIAL_HOSTS = ["facebook.", "instagram.", "tiktok.", "x.com", "twitter.", "linkedin.", "pinterest.", "youtube."];

const DEFAULT_BEHAVIOR = Object.freeze({
  viewedProducts: {},
  viewedCategories: {},
  eventTypes: {},
  productDwellSeconds: {},
  addToCart: {},
  modePreference: {
    buy: 0,
    rent: 0
  },
  venuePreference: {
    indoor: 0,
    outdoor: 0
  },
  customizablePreference: {
    observed: 0,
    selected: 0
  },
  cartSnapshot: {
    itemCount: 0,
    categoryCounts: {},
    modeCounts: {
      buy: 0,
      rent: 0
    }
  },
  trafficSource: {
    channel: "",
    referrerHost: "",
    searchEngine: "",
    landingPath: "",
    utmCampaign: "",
    utmMedium: "",
    utmSource: "",
    eventTypeHint: "",
    tracked: false
  },
  scopeKey: "guest",
  selectedEventType: "",
  updatedAt: ""
});

function cloneDefaultBehavior() {
  return JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR));
}

function canUseWindow() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAuthSession() {
  if (!canUseWindow()) return { token: "", user: null };

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { token: "", user: null };
  } catch (_error) {
    return { token: "", user: null };
  }
}

function getCurrentBehaviorScope() {
  const userId = String(readAuthSession()?.user?.id || "").trim();
  return userId ? `user:${userId}` : "guest";
}

function getBehaviorStorageKey(scopeKey = getCurrentBehaviorScope()) {
  return `${STORAGE_KEY_PREFIX}${scopeKey}`;
}

function getDwellStorageKey(productId, scopeKey = getCurrentBehaviorScope()) {
  return `${DWELL_STORAGE_PREFIX}${scopeKey}:${String(productId || "").trim()}`;
}

function dispatchBehaviorUpdate(detail) {
  if (!canUseWindow()) return;
  window.dispatchEvent(new CustomEvent("eventmart:behavior-updated", { detail }));
}

function normalizeBehaviorState(parsed, scopeKey = getCurrentBehaviorScope()) {
  const defaults = cloneDefaultBehavior();

  return {
    ...defaults,
    ...(parsed || {}),
    scopeKey,
    modePreference: {
      ...defaults.modePreference,
      ...(parsed?.modePreference || {})
    },
    venuePreference: {
      ...defaults.venuePreference,
      ...(parsed?.venuePreference || {})
    },
    customizablePreference: {
      ...defaults.customizablePreference,
      ...(parsed?.customizablePreference || {})
    },
    cartSnapshot: {
      ...defaults.cartSnapshot,
      ...(parsed?.cartSnapshot || {}),
      modeCounts: {
        ...defaults.cartSnapshot.modeCounts,
        ...(parsed?.cartSnapshot?.modeCounts || {})
      }
    },
    trafficSource: {
      ...defaults.trafficSource,
      ...(parsed?.trafficSource || {})
    }
  };
}

function readBehaviorState(options = {}) {
  const scopeKey = options.scopeKey || getCurrentBehaviorScope();
  if (!canUseWindow()) return normalizeBehaviorState(null, scopeKey);

  try {
    const raw = localStorage.getItem(getBehaviorStorageKey(scopeKey));
    if (!raw) return normalizeBehaviorState(null, scopeKey);
    return normalizeBehaviorState(JSON.parse(raw), scopeKey);
  } catch (_error) {
    return normalizeBehaviorState(null, scopeKey);
  }
}

function writeBehaviorState(nextState, options = {}) {
  const scopeKey = options.scopeKey || getCurrentBehaviorScope();
  const payload = normalizeBehaviorState(
    {
      ...cloneDefaultBehavior(),
      ...nextState,
      updatedAt: new Date().toISOString()
    },
    scopeKey
  );

  if (!canUseWindow()) return payload;

  try {
    localStorage.setItem(getBehaviorStorageKey(scopeKey), JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage failures so recommendations keep working in memory.
  }

  if (options.dispatch !== false) {
    dispatchBehaviorUpdate(payload);
  }

  return payload;
}

function updateBehavior(mutator, options = {}) {
  const scopeKey = options.scopeKey || getCurrentBehaviorScope();
  const current = readBehaviorState({ scopeKey });
  const nextState = typeof mutator === "function" ? mutator(current) : current;
  return writeBehaviorState(nextState, { ...options, scopeKey });
}

function announceBehaviorScopeChange() {
  dispatchBehaviorUpdate(readBehaviorState());
}

function resetBehaviorState(options = {}) {
  const scopeKey = options.scopeKey || getCurrentBehaviorScope();
  return writeBehaviorState(cloneDefaultBehavior(), { scopeKey, dispatch: options.dispatch !== false });
}

function resetGuestBehaviorState() {
  return resetBehaviorState({ scopeKey: "guest" });
}

function bumpNestedCounter(target, key, amount = 1, extra = {}) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return target;

  const current = target[normalizedKey] || {};
  target[normalizedKey] = {
    ...current,
    ...extra,
    count: Number(current.count || 0) + Number(amount || 1),
    updatedAt: new Date().toISOString()
  };

  return target;
}

function recordVenuePreference(product) {
  const signals = buildEntitySignals(product);
  const next = {
    indoor: 0,
    outdoor: 0
  };

  signals.venueCompatibility.forEach((venue) => {
    if (venue === "indoor" || venue === "outdoor") {
      next[venue] += 1;
    }
  });

  return next;
}

function normalizeHost(value) {
  return String(value || "").trim().toLowerCase().replace(/^www\./, "");
}

function inferTrafficChannel({ referrerHost = "", utmMedium = "" }) {
  const normalizedMedium = String(utmMedium || "").trim().toLowerCase();
  const normalizedHost = normalizeHost(referrerHost);

  if (normalizedMedium === "email") return "email";
  if (normalizedMedium === "cpc" || normalizedMedium === "paid" || normalizedMedium === "ppc") return "paid";
  if (SOCIAL_HOSTS.some((host) => normalizedHost.includes(host))) return "social";
  if (SEARCH_ENGINE_HOSTS.some((host) => normalizedHost.includes(host))) return "organic-search";
  if (normalizedHost) return "referral";
  return "direct";
}

function inferSearchEngine(referrerHost) {
  const normalizedHost = normalizeHost(referrerHost);
  if (!normalizedHost) return "";
  if (normalizedHost.includes("google.")) return "google";
  if (normalizedHost.includes("bing.")) return "bing";
  if (normalizedHost.includes("yahoo.")) return "yahoo";
  if (normalizedHost.includes("duckduckgo.")) return "duckduckgo";
  if (normalizedHost.includes("baidu.")) return "baidu";
  if (normalizedHost.includes("yandex.")) return "yandex";
  return "";
}

function trackTrafficSource(options = {}) {
  if (!canUseWindow()) return null;

  const current = readBehaviorState(options);
  if (current.trafficSource?.tracked && !options.force) {
    return current;
  }

  const searchParams = new URLSearchParams(options.search || window.location.search || "");
  const landingPath = `${window.location.pathname || "/"}${window.location.search || ""}`;
  let referrerHost = "";

  try {
    const rawReferrer = options.referrer ?? document.referrer ?? "";
    const referrer = String(rawReferrer).trim();
    if (referrer) {
      referrerHost = new URL(referrer).hostname;
    }
  } catch (_error) {
    referrerHost = "";
  }

  const utmSource = String(searchParams.get("utm_source") || "").trim();
  const utmMedium = String(searchParams.get("utm_medium") || "").trim();
  const utmCampaign = String(searchParams.get("utm_campaign") || "").trim();
  const searchEngine = inferSearchEngine(referrerHost);
  const channel = inferTrafficChannel({ referrerHost, utmMedium });
  const eventTypeHint = resolveEventType(
    [
      utmCampaign,
      utmSource,
      utmMedium,
      landingPath,
      referrerHost
    ]
      .filter(Boolean)
      .join(" ")
  );

  return updateBehavior(
    (behavior) => ({
      ...behavior,
      trafficSource: {
        ...behavior.trafficSource,
        channel,
        eventTypeHint,
        landingPath,
        referrerHost: normalizeHost(referrerHost),
        searchEngine,
        tracked: true,
        utmCampaign,
        utmMedium,
        utmSource
      }
    }),
    options
  );
}

function trackProductView(product, { eventType = "", category = "" } = {}) {
  if (!product?.id) return;

  const resolvedEventType = resolveEventType(eventType);
  const categoryLabel = category || product.category || getCategoryLabel(product);
  const categoryKey = getCategoryKey(product);
  const preferredMode = getPreferredMode(product);
  const venuePreference = recordVenuePreference(product);

  updateBehavior((current) => {
    const next = {
      ...current,
      eventTypes: { ...(current.eventTypes || {}) },
      viewedProducts: { ...current.viewedProducts },
      viewedCategories: { ...current.viewedCategories },
      modePreference: { ...current.modePreference },
      venuePreference: { ...current.venuePreference },
      customizablePreference: { ...current.customizablePreference }
    };

    bumpNestedCounter(next.viewedProducts, product.id, 1, {
      category: categoryLabel,
      categoryKey,
      lastMode: preferredMode,
      name: product.name
    });
    bumpNestedCounter(next.viewedCategories, categoryLabel, 1, {
      categoryKey
    });

    next.modePreference[preferredMode] = Number(next.modePreference[preferredMode] || 0) + 1;
    next.venuePreference.indoor += venuePreference.indoor;
    next.venuePreference.outdoor += venuePreference.outdoor;

    if (product.customizable) {
      next.customizablePreference.observed += 1;
    }

    if (resolvedEventType) {
      bumpNestedCounter(next.eventTypes || (next.eventTypes = {}), resolvedEventType, 1, {
        source: "product-view"
      });
      next.selectedEventType = resolvedEventType;
    }

    return next;
  });
}

function trackCategoryView(category, extra = {}) {
  const categoryLabel = String(category || "").trim();
  if (!categoryLabel) return;

  updateBehavior((current) => {
    const next = {
      ...current,
      viewedCategories: { ...current.viewedCategories }
    };

    bumpNestedCounter(next.viewedCategories, categoryLabel, 1, {
      categoryKey: getCategoryKey(categoryLabel),
      ...extra
    });

    return next;
  });
}

function trackEventTypeSelection(eventType, extra = {}) {
  const resolvedEventType = resolveEventType(eventType);
  if (!resolvedEventType) return;

  updateBehavior((current) => {
    const next = {
      ...current,
      eventTypes: { ...current.eventTypes },
      selectedEventType: resolvedEventType
    };

    bumpNestedCounter(next.eventTypes, resolvedEventType, 1, {
      source: extra.source || "selection"
    });

    return next;
  });
}

function trackProductDwellTime(productId, seconds) {
  const safeProductId = String(productId || "").trim();
  const safeSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  if (!safeProductId || safeSeconds <= 0) return;

  updateBehavior((current) => {
    const next = {
      ...current,
      productDwellSeconds: { ...current.productDwellSeconds }
    };

    next.productDwellSeconds[safeProductId] = Number(next.productDwellSeconds[safeProductId] || 0) + safeSeconds;
    return next;
  });
}

function startProductDwell(productId) {
  if (!canUseWindow() || !productId) return;

  try {
    localStorage.setItem(getDwellStorageKey(productId), String(Date.now()));
  } catch (_error) {
    // Ignore dwell persistence failures.
  }
}

function finishProductDwell(productId) {
  if (!canUseWindow() || !productId) return;

  try {
    const key = getDwellStorageKey(productId);
    const startedAt = Number(localStorage.getItem(key) || 0);
    localStorage.removeItem(key);
    if (!startedAt) return;

    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    trackProductDwellTime(productId, seconds);
  } catch (_error) {
    // Ignore dwell persistence failures.
  }
}

function trackAddToCart(product, { quantity = 1, mode = "", eventType = "", customizationRequested = false } = {}) {
  if (!product?.id) return;

  const safeQuantity = Math.max(1, Number(quantity || 1));
  const preferredMode = getPreferredMode(product, mode);
  const resolvedEventType = resolveEventType(eventType);
  const categoryLabel = product.category || getCategoryLabel(product);
  const categoryKey = getCategoryKey(product);

  updateBehavior((current) => {
    const next = {
      ...current,
      eventTypes: { ...(current.eventTypes || {}) },
      addToCart: { ...current.addToCart },
      viewedCategories: { ...current.viewedCategories },
      modePreference: { ...current.modePreference },
      customizablePreference: { ...current.customizablePreference }
    };

    bumpNestedCounter(next.addToCart, product.id, safeQuantity, {
      category: categoryLabel,
      categoryKey,
      mode: preferredMode,
      name: product.name
    });
    bumpNestedCounter(next.viewedCategories, categoryLabel, 1, {
      categoryKey
    });

    next.modePreference[preferredMode] = Number(next.modePreference[preferredMode] || 0) + safeQuantity;

    if (customizationRequested || product.customizable) {
      next.customizablePreference.selected += customizationRequested ? safeQuantity : 0;
      next.customizablePreference.observed += product.customizable ? 1 : 0;
    }

    if (resolvedEventType) {
      next.selectedEventType = resolvedEventType;
      bumpNestedCounter(next.eventTypes || (next.eventTypes = {}), resolvedEventType, safeQuantity, {
        source: "cart"
      });
    }

    return next;
  });
}

function syncCartBehavior(items, { eventType = "" } = {}) {
  const list = Array.isArray(items) ? items : [];
  const categoryCounts = {};
  const modeCounts = { buy: 0, rent: 0 };

  list.forEach((item) => {
    const categoryKey = getCategoryKey(item);
    categoryCounts[categoryKey] = Number(categoryCounts[categoryKey] || 0) + Math.max(1, Number(item.quantity || 1));

    const mode = getPreferredMode(item);
    modeCounts[mode] = Number(modeCounts[mode] || 0) + Math.max(1, Number(item.quantity || 1));
  });

  updateBehavior((current) => ({
    ...current,
    selectedEventType: resolveEventType(eventType) || current.selectedEventType,
    cartSnapshot: {
      itemCount: list.reduce((sum, item) => sum + Math.max(1, toNumber(item.quantity, 1)), 0),
      categoryCounts,
      modeCounts
    }
  }));
}

function getSelectedEventType() {
  return resolveEventType(readBehaviorState().selectedEventType);
}

export {
  DEFAULT_BEHAVIOR,
  announceBehaviorScopeChange,
  finishProductDwell,
  getCurrentBehaviorScope,
  getSelectedEventType,
  readBehaviorState,
  resetBehaviorState,
  resetGuestBehaviorState,
  startProductDwell,
  syncCartBehavior,
  trackAddToCart,
  trackCategoryView,
  trackEventTypeSelection,
  trackProductDwellTime,
  trackProductView,
  trackTrafficSource,
  updateBehavior,
  writeBehaviorState
};
