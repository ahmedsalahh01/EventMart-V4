import { apiRequest } from "./api";

const CACHE_TTL_MS = 2 * 60 * 1000;
const AUTH_STORAGE_KEY = "eventmart_auth_v1";
const responseCache = new Map();
const inflightRequests = new Map();

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function getCachedResponse(cacheKey) {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function readAuthSession() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return { token: "", user: null };
  }

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { token: "", user: null };
  } catch (_error) {
    return { token: "", user: null };
  }
}

function getAudienceScope() {
  const session = readAuthSession();
  const userId = String(session?.user?.id || "").trim();

  return {
    scopeKey: userId ? `user:${userId}` : "guest",
    token: String(session?.token || "").trim()
  };
}

export function createSmartRecommendationCacheKey(payload) {
  const audience = getAudienceScope();
  return stableSerialize({
    audience: audience.scopeKey,
    payload: payload || {}
  });
}

export async function requestSmartRecommendationRerank(payload) {
  const audience = getAudienceScope();
  const cacheKey = createSmartRecommendationCacheKey(payload);
  const cached = getCachedResponse(cacheKey);

  if (cached) {
    return cached;
  }

  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  const request = apiRequest("/api/recommendations/smart", {
    method: "POST",
    body: payload,
    headers: audience.token
      ? {
          Authorization: `Bearer ${audience.token}`
        }
      : undefined
  })
    .then((response) => {
      responseCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: response
      });
      return response;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request);
  return request;
}

export function clearSmartRecommendationCache() {
  responseCache.clear();
  inflightRequests.clear();
}
