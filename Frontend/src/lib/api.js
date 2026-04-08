const PRODUCTION_API_URL = "https://eventmart-v4-production.up.railway.app";

function readImportMetaEnv() {
  return import.meta?.env || {};
}

function readRuntimeLocation() {
  if (typeof window !== "undefined" && window.location) {
    return window.location;
  }

  return globalThis.location || null;
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isLocalHostname(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]";
}

function getAbsoluteOrigin(url, location = readRuntimeLocation()) {
  try {
    const baseOrigin = location?.origin || undefined;
    return new URL(url, baseOrigin).origin;
  } catch {
    return "";
  }
}

export function resolveApiBaseUrl({ env = readImportMetaEnv(), location = readRuntimeLocation() } = {}) {
  const configuredBaseUrl = normalizeBaseUrl(env?.VITE_API_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  return PRODUCTION_API_URL;
}

function getFallbackApiBaseUrl(baseUrl, location = readRuntimeLocation(), env = readImportMetaEnv()) {
  const configuredFallback = normalizeBaseUrl(env?.VITE_FALLBACK_API_URL);
  if (configuredFallback && configuredFallback !== baseUrl) {
    return configuredFallback;
  }

  return "";
}

function normalizeApiPath(path) {
  return path.startsWith("/") ? path : `/${path}`;
}

function isPackageApiPath(path) {
  const normalizedPath = normalizeApiPath(path);
  return normalizedPath.startsWith("/api/packages") || normalizedPath.startsWith("/api/package-builder");
}

function createMissingApiRouteError({ baseUrl = resolveApiBaseUrl(), path = "" } = {}) {
  const normalizedPath = normalizeApiPath(path);
  return new Error(
    `The configured API at ${normalizeBaseUrl(baseUrl) || resolveApiBaseUrl()} does not currently serve ${normalizedPath}. ` +
    "Deploy the Server app from the current repo or point VITE_API_URL to a backend that includes this route."
  );
}

export function sanitizeApiErrorMessage(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) {
    return "Invalid server response";
  }

  const routeMiss = text.match(/Cannot\s+(GET|POST|PUT|DELETE|PATCH)\s+([^\s<]+)/i);
  if (routeMiss) {
    return `${routeMiss[1].toUpperCase()} ${routeMiss[2]} is not available right now.`;
  }

  const cleanText = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanText || "Invalid server response";
}

function shouldRetryAgainstFallback({ path, url, baseUrl, fallbackBaseUrl, response, text, location = readRuntimeLocation() }) {
  if (!fallbackBaseUrl || fallbackBaseUrl === baseUrl) {
    return false;
  }

  const normalizedPath = normalizeApiPath(path);
  if (!normalizedPath.startsWith("/api/")) {
    return false;
  }

  const status = Number(response?.status || 0);
  const message = String(text || "");
  const sameOriginRequest = Boolean(location?.origin) && getAbsoluteOrigin(url, location) === location.origin;
  const runningLocally = isLocalHostname(location?.hostname);
  const htmlRouteMiss = /cannot\s+(get|post|put|delete|patch)\s+\/api\//i.test(message);
  const htmlPayload = /<!doctype html|<html|<pre>/i.test(message);

  return (sameOriginRequest || runningLocally) &&
    (htmlRouteMiss || htmlPayload || status === 404 || status === 405);
}

function isNetworkFetchError(error) {
  const message = String(error?.message || "").trim().toLowerCase();
  return message === "failed to fetch" || message.includes("networkerror");
}

function createNetworkApiError({ attemptBaseUrls = [], location = readRuntimeLocation(), path = "", previousError = null } = {}) {
  const attemptedTargets = attemptBaseUrls.filter(Boolean).join(" or ");

  return new Error(
    `Could not reach the API server${attemptedTargets ? ` at ${attemptedTargets}` : ""}. Check VITE_API_URL and backend CORS availability.`
  );
}

async function requestJson(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const method = options.method || "GET";

  const response = await fetch(url, {
    method,
    headers,
    cache: options.cache || "no-store",
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal
  });

  const text = await response.text();

  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: sanitizeApiErrorMessage(text) };
  }

  return { payload, response, text };
}

export function buildApiUrl(path, options = {}) {
  if (/^https?:\/\//i.test(path)) return path;

  const baseUrl = normalizeBaseUrl(options.baseUrl || resolveApiBaseUrl(options));
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

export async function apiRequest(path, options = {}) {
  const runtimeLocation = options.location || readRuntimeLocation();
  const runtimeEnv = options.env || readImportMetaEnv();
  const primaryBaseUrl = normalizeBaseUrl(options.baseUrl || resolveApiBaseUrl({
    env: runtimeEnv,
    location: runtimeLocation
  }));
  const fallbackBaseUrl = normalizeBaseUrl(
    options.fallbackBaseUrl || getFallbackApiBaseUrl(primaryBaseUrl, runtimeLocation, runtimeEnv)
  );
  const attemptBaseUrls = [primaryBaseUrl, fallbackBaseUrl].filter((value, index, all) => value && all.indexOf(value) === index);

  let lastError = null;

  for (let index = 0; index < attemptBaseUrls.length; index += 1) {
    const currentBaseUrl = attemptBaseUrls[index];
    const url = buildApiUrl(path, { baseUrl: currentBaseUrl });

    try {
      const { payload, response, text } = await requestJson(url, options);

      if (response.ok) {
        return payload;
      }

      const message =
        payload?.error ||
        payload?.details ||
        `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      error.fieldErrors = payload?.fieldErrors || null;

      if (index === 0 && response.status === 404 && isPackageApiPath(path) && fallbackBaseUrl && fallbackBaseUrl !== currentBaseUrl) {
        lastError = error;
        continue;
      }

      if (
        index === 0 &&
        shouldRetryAgainstFallback({
          baseUrl: currentBaseUrl,
          fallbackBaseUrl,
          location: runtimeLocation,
          path,
          response,
          text,
          url
        })
      ) {
        lastError = error;
        continue;
      }

      if (response.status === 404 && isPackageApiPath(path)) {
        const routeError = createMissingApiRouteError({
          baseUrl: currentBaseUrl,
          path
        });
        routeError.status = response.status;
        routeError.payload = payload;
        routeError.fieldErrors = payload?.fieldErrors || null;
        throw routeError;
      }

      throw error;
    } catch (error) {
      const canRetryAfterNetworkFailure =
        index === 0 &&
        fallbackBaseUrl &&
        fallbackBaseUrl !== currentBaseUrl;

      if (canRetryAfterNetworkFailure) {
        lastError = error;
        continue;
      }

      if (isNetworkFetchError(error)) {
        throw createNetworkApiError({
          attemptBaseUrls,
          location: runtimeLocation,
          path,
          previousError: lastError
        });
      }

      throw error;
    }
  }

  throw lastError || createNetworkApiError({
    attemptBaseUrls,
    location: runtimeLocation,
    path,
    previousError: lastError
  });
}

export async function authRequest(path, token, options = {}) {
  return apiRequest(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

export async function sendAIPlannerMessage(data) {
  return apiRequest("/api/ai-planner", {
    method: "POST",
    body: data
  });
}

export async function requestSmartRecommendationRerank(data) {
  return apiRequest("/api/recommendations/smart", {
    method: "POST",
    body: data
  });
}
