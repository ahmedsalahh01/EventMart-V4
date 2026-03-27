const LOCAL_API_URL = "http://localhost:4000";
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

  const hostname = String(location?.hostname || "").trim().toLowerCase();
  if (!hostname || isLocalHostname(hostname)) {
    return LOCAL_API_URL;
  }

  return PRODUCTION_API_URL;
}

function getFallbackApiBaseUrl(baseUrl, location = readRuntimeLocation(), env = readImportMetaEnv()) {
  const configuredFallback = normalizeBaseUrl(env?.VITE_FALLBACK_API_URL);
  if (configuredFallback && configuredFallback !== baseUrl) {
    return configuredFallback;
  }

  if (!baseUrl || baseUrl === PRODUCTION_API_URL) {
    return "";
  }

  return PRODUCTION_API_URL;
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

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!normalizedPath.startsWith("/api/")) {
    return false;
  }

  const status = Number(response?.status || 0);
  const message = String(text || "");
  const sameOriginRequest = Boolean(location?.origin) && getAbsoluteOrigin(url, location) === location.origin;
  const targetsLocalBackend = baseUrl === LOCAL_API_URL;
  const htmlRouteMiss = /cannot\s+(get|post|put|delete|patch)\s+\/api\//i.test(message);
  const htmlPayload = /<!doctype html|<html|<pre>/i.test(message);

  return (sameOriginRequest || targetsLocalBackend) && (htmlRouteMiss || htmlPayload || status === 404 || status === 405);
}

function isNetworkFetchError(error) {
  const message = String(error?.message || "").trim().toLowerCase();
  return message === "failed to fetch" || message.includes("networkerror");
}

function createNetworkApiError() {
  return new Error("Could not reach the API server. This is usually a backend availability or CORS issue.");
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
    body: options.body ? JSON.stringify(options.body) : undefined
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
  const runtimeLocation = readRuntimeLocation();
  const runtimeEnv = readImportMetaEnv();
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
        continue;
      }

      const message =
        payload?.error ||
        payload?.details ||
        `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      error.fieldErrors = payload?.fieldErrors || null;
      throw error;
    } catch (error) {
      const canRetryAfterNetworkFailure =
        index === 0 &&
        fallbackBaseUrl &&
        fallbackBaseUrl !== currentBaseUrl &&
        currentBaseUrl === LOCAL_API_URL &&
        !isLocalHostname(runtimeLocation?.hostname || "");

      if (canRetryAfterNetworkFailure) {
        lastError = error;
        continue;
      }

      if (isNetworkFetchError(error)) {
        throw createNetworkApiError();
      }

      throw error;
    }
  }

  throw lastError || new Error("Request failed.");
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
