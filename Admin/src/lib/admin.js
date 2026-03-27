export const METRICS_KEY = "eventmart_product_metrics_v1";

const LOCAL_API_URL = "http://localhost:4000";
const PRODUCTION_API_URL = "https://eventmart-v4-production.up.railway.app";
const PRODUCTS_PATH = "/api/products";
const PRODUCT_IMAGE_UPLOAD_PATHS = ["/api/product-images/upload", "/product-images/upload"];
const PRODUCT_IMAGE_DELETE_PATHS = ["/api/product-images", "/product-images"];
const USERS_PATH = "/api/users";

const ISO_CURRENCY_ALPHA_REGEX = /^[A-Z]{3}$/;
const PRODUCT_ID_REGEX = /^(?!00000)\d{5}$/;
const DEFAULT_CURRENCY_ALPHA = "EGP";
const PLACEHOLDER_IMAGE_URL = "https://placehold.co/320x220?text=EventMart";
export const MAX_IMAGES_PER_MODE = 10;
export const ONE_SIZE_LABEL = "One Size";
const CURRENCY_NUMERIC_TO_ALPHA = Object.freeze({
  "008": "ALL",
  "012": "DZD",
  "032": "ARS",
  "036": "AUD",
  "124": "CAD",
  "156": "CNY",
  "392": "JPY",
  "410": "KRW",
  "682": "SAR",
  "784": "AED",
  "818": "EGP",
  "826": "GBP",
  "840": "USD",
  "978": "EUR"
});

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

function resolveApiBaseUrl({ env = readImportMetaEnv(), location = readRuntimeLocation() } = {}) {
  const configuredBaseUrl = normalizeBaseUrl(env?.VITE_API_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  return PRODUCTION_API_URL;
}

function getFallbackApiBaseUrl(baseUrl, location = readRuntimeLocation()) {
  const configuredFallback = normalizeBaseUrl(readImportMetaEnv()?.VITE_FALLBACK_API_URL);
  if (configuredFallback && configuredFallback !== baseUrl) {
    return configuredFallback;
  }

  return "";
}

function randomId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `p_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

function toNum(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isNaN(number) ? fallback : number;
}

function apiErrorMessage(payload, status) {
  const rawMessage = payload?.error || payload?.details || `Request failed with status ${status}`;
  const cleanMessage = String(rawMessage || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (status === 413 || /payload too large/i.test(cleanMessage)) {
    return "Uploaded images are too large. Please try smaller image files.";
  }

  return cleanMessage || `Request failed with status ${status}`;
}

function resolveApiUrl(path, baseUrl = resolveApiBaseUrl()) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

function isNetworkFetchError(error) {
  const message = String(error?.message || "").trim().toLowerCase();
  return message === "failed to fetch" || message.includes("networkerror");
}

function createNetworkApiError(baseUrls) {
  const targets = (Array.isArray(baseUrls) ? baseUrls : [baseUrls])
    .filter(Boolean)
    .join(" or ");

  return new Error(
    `Could not reach the API server at ${targets || resolveApiBaseUrl()}. ` +
    "Make sure VITE_API_URL points to a reachable backend."
  );
}

function tagProductActionError(error, stage) {
  if (error && !error.productActionStage) {
    error.productActionStage = stage;
  }
  return error;
}

function normalizeImageList(value) {
  const list = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];

  return list
    .flatMap((item) => {
      if (Array.isArray(item)) return normalizeImageList(item);
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (!trimmed) return [];

        if (
          (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
          (trimmed.startsWith("{") && trimmed.endsWith("}"))
        ) {
          try {
            return normalizeImageList(JSON.parse(trimmed));
          } catch (_error) {
            return [trimmed];
          }
        }

        return [trimmed];
      }
      if (item && typeof item === "object") {
        return normalizeImageList(item.value || item.url || item.src || item.preview_url || "");
      }
      return [];
    });
}

export function isLocalImageEntry(value) {
  return Boolean(value && typeof value === "object" && value.kind === "local" && value.file);
}

export function createLocalImageEntry(file) {
  return {
    file,
    file_name: String(file?.name || "image"),
    id: randomId(),
    kind: "local",
    preview_url: URL.createObjectURL(file)
  };
}

export function revokeLocalImageEntry(value) {
  if (isLocalImageEntry(value) && value.preview_url) {
    URL.revokeObjectURL(value.preview_url);
  }
}

export function getImagePreviewSource(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return String(value.preview_url || value.url || value.value || value.src || "").trim();
  }
  return "";
}

export function getImagePreviewKey(value, fallback) {
  if (typeof value === "string") return `${fallback}-${value.slice(0, 40)}`;
  if (value && typeof value === "object") {
    return String(value.id || value.url || value.preview_url || fallback);
  }
  return fallback;
}

export function isMissingImageUploadEndpointError(error) {
  const message = String(error?.message || "");
  return Number(error?.status) === 404 || /cannot (post|delete)\s+\/?(api\/)?product-images/i.test(message);
}

function resolveImageCollections(row) {
  const lightImages = normalizeImageList(row?.light_images);
  const darkImages = normalizeImageList(row?.dark_images);
  const legacyImageUrl = String(row?.image_url ?? "").trim();

  if (!lightImages.length && !darkImages.length && legacyImageUrl) {
    lightImages.push(legacyImageUrl);
  }

  return {
    dark_images: darkImages,
    image_url: lightImages[0] || darkImages[0] || legacyImageUrl,
    light_images: lightImages
  };
}

export function resolveAssetUrl(source, fallback = PLACEHOLDER_IMAGE_URL) {
  const value = getImagePreviewSource(source);
  if (!value) return fallback;

  if (/^(?:https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return resolveApiUrl(value);
  }

  return value;
}

async function apiRequestJson(path, options = {}) {
  const runtimeLocation = readRuntimeLocation();
  const primaryBaseUrl = normalizeBaseUrl(options.baseUrl || resolveApiBaseUrl({ location: runtimeLocation }));
  const fallbackBaseUrl = normalizeBaseUrl(options.fallbackBaseUrl || getFallbackApiBaseUrl(primaryBaseUrl, runtimeLocation));
  const attemptBaseUrls = [primaryBaseUrl, fallbackBaseUrl].filter(
    (value, index, all) => value && all.indexOf(value) === index
  );

  for (let index = 0; index < attemptBaseUrls.length; index += 1) {
    const currentBaseUrl = attemptBaseUrls[index];
    const url = resolveApiUrl(path, currentBaseUrl);
    const method = options.method || "GET";

    try {
      const response = await fetch(url, {
        method,
        cache: options.cache || "no-store",
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const text = await response.text();
      let payload = null;

      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text ? { error: text } : null;
      }

      if (!response.ok) {
        console.error("[Admin API] request failed", {
          baseUrl: currentBaseUrl,
          body: payload,
          method,
          status: response.status,
          url
        });
        const error = new Error(apiErrorMessage(payload, response.status));
        error.status = response.status;
        throw error;
      }

      return payload;
    } catch (error) {
      const hasFallback = index < attemptBaseUrls.length - 1;
      if (isNetworkFetchError(error) && hasFallback) {
        continue;
      }

      if (isNetworkFetchError(error)) {
        throw createNetworkApiError(attemptBaseUrls);
      }

      throw error;
    }
  }

  throw createNetworkApiError(attemptBaseUrls);
}

export async function uploadProductImage(file, { productId, themeMode }) {
  const params = new URLSearchParams({
    product_id: String(productId || "").trim(),
    theme_mode: String(themeMode || "").trim(),
    filename: String(file?.name || "image")
  });

  const runtimeLocation = readRuntimeLocation();
  const primaryBaseUrl = normalizeBaseUrl(resolveApiBaseUrl({ location: runtimeLocation }));
  const fallbackBaseUrl = normalizeBaseUrl(getFallbackApiBaseUrl(primaryBaseUrl, runtimeLocation));
  const attemptBaseUrls = [primaryBaseUrl, fallbackBaseUrl].filter(
    (value, index, all) => value && all.indexOf(value) === index
  );
  let lastError = null;

  for (const baseUrl of attemptBaseUrls) {
    for (const path of PRODUCT_IMAGE_UPLOAD_PATHS) {
      try {
        const response = await fetch(resolveApiUrl(`${path}?${params.toString()}`, baseUrl), {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": file?.type || "application/octet-stream"
          },
          body: file
        });

        const text = await response.text();
        let payload = null;

        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
          payload = text ? { error: text } : null;
        }

        if (response.ok) {
          return String(payload?.url || "").trim();
        }

        const error = tagProductActionError(
          new Error(apiErrorMessage(payload, response.status)),
          "upload"
        );
        error.status = response.status;
        lastError = error;

        if (!isMissingImageUploadEndpointError(error)) {
          throw error;
        }
      } catch (error) {
        if (isNetworkFetchError(error)) {
          lastError = tagProductActionError(createNetworkApiError(attemptBaseUrls), "upload");
          continue;
        }

        throw tagProductActionError(error, "upload");
      }
    }
  }

  throw tagProductActionError(
    lastError || new Error("Product image upload endpoint is unavailable."),
    "upload"
  );
}

export function formatProductActionError(error) {
  const message = String(error?.message || "").trim() || "Unable to save product.";
  const stage = String(error?.productActionStage || "").trim().toLowerCase();

  if (stage === "upload") {
    return `Product images could not be uploaded. ${message}`;
  }

  if (stage === "save") {
    return `Product details could not be saved. ${message}`;
  }

  if (stage === "refresh") {
    return `The product may have been saved, but the catalog could not be refreshed. ${message}`;
  }

  return message;
}

export async function deleteUploadedImages(urls) {
  const cleanUrls = normalizeImageList(urls);
  if (!cleanUrls.length) return;
  let lastError = null;

  for (const path of PRODUCT_IMAGE_DELETE_PATHS) {
    try {
      await apiRequestJson(path, {
        body: { urls: cleanUrls },
        method: "DELETE"
      });
      return;
    } catch (error) {
      lastError = error;
      if (!isMissingImageUploadEndpointError(error)) {
        throw error;
      }
    }
  }

  if (lastError && !isMissingImageUploadEndpointError(lastError)) {
    throw lastError;
  }
}

export function normalizeProductIdInput(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 5);
}

export function normalizeCurrencyCodeInput(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

function formatProductIdNumber(value) {
  const numeric = Math.trunc(Number(value));
  const safe = Number.isFinite(numeric) ? Math.min(Math.max(numeric, 1), 99999) : 1;
  return String(safe).padStart(5, "0");
}

function parseProductIdNumber(value) {
  const normalized = normalizeProductIdInput(value);
  if (!PRODUCT_ID_REGEX.test(normalized)) return null;
  return Number(normalized);
}

export function fallbackProductId(seed) {
  const digits = String(seed ?? "").replace(/\D/g, "");
  if (!digits) return "00001";

  const candidate = digits.slice(-5).padStart(5, "0");
  return PRODUCT_ID_REGEX.test(candidate) ? candidate : "00001";
}

function normalizeTextList(value, maxItemLength = 60) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n|,/)
      : value === null || value === undefined || value === ""
        ? []
        : [value];

  return Array.from(
    new Set(
      list
        .map((item) => String(item || "").trim().replace(/\s+/g, " ").slice(0, maxItemLength))
        .filter(Boolean)
    )
  );
}

function normalizeQualityPointsInput(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        return normalizeQualityPointsInput(JSON.parse(trimmed));
      } catch (_error) {
        // Fall through to line splitting.
      }
    }

    return trimmed
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeSizeModeInput(value) {
  return String(value || "").trim().toLowerCase() === "varied" ? "varied" : "one-size";
}

function normalizeSizeLabel(value, sizeMode = "varied") {
  if (normalizeSizeModeInput(sizeMode) === "one-size") {
    return ONE_SIZE_LABEL;
  }

  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = raw
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .replace(/-/g, "");

  if (normalized === "xs" || normalized === "xsmall") return "XS";
  if (normalized === "s" || normalized === "small") return "Small";
  if (normalized === "m" || normalized === "medium") return "Medium";
  if (normalized === "l" || normalized === "large") return "Large";
  if (normalized === "xl" || normalized === "xlarge") return "X-Large";
  if (normalized === "2xl" || normalized === "2xlarge" || normalized === "xxl") return "2X-Large";
  if (normalized === "3xl" || normalized === "3xlarge" || normalized === "xxxl") return "3X-Large";
  if (normalized === "4xl" || normalized === "4xlarge" || normalized === "xxxxl") return "4X-Large";

  return raw;
}

function sortSizes(sizes, sizeMode = "varied") {
  const normalizedSizeMode = normalizeSizeModeInput(sizeMode);

  if (normalizedSizeMode === "one-size") {
    return [ONE_SIZE_LABEL];
  }

  const order = new Map([
    ["XS", 0],
    ["Small", 1],
    ["Medium", 2],
    ["Large", 3],
    ["X-Large", 4],
    ["2X-Large", 5],
    ["3X-Large", 6],
    ["4X-Large", 7]
  ]);

  return normalizeTextList(sizes, 40)
    .map((size) => normalizeSizeLabel(size, normalizedSizeMode))
    .filter(Boolean)
    .sort((left, right) => {
      const leftIndex = order.has(left) ? order.get(left) : Number.POSITIVE_INFINITY;
      const rightIndex = order.has(right) ? order.get(right) : Number.POSITIVE_INFINITY;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.localeCompare(right);
    });
}

function normalizeVariationList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeVariationList(entry));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        return normalizeVariationList(JSON.parse(trimmed));
      } catch (_error) {
        return [];
      }
    }

    return [];
  }

  if (value && typeof value === "object") {
    const nested =
      value.variations ??
      value.items ??
      value.rows ??
      value.value;

    if (nested !== undefined) {
      const normalizedNested = normalizeVariationList(nested);
      if (normalizedNested.length) {
        return normalizedNested;
      }
    }

    return [value];
  }

  return [];
}

export function getCatalogColorOptions(value) {
  return normalizeTextList(value, 60);
}

export function getCatalogSizeOptions(value, sizeMode = "varied") {
  const normalizedSizeMode = normalizeSizeModeInput(sizeMode);
  return normalizedSizeMode === "one-size"
    ? [ONE_SIZE_LABEL]
    : sortSizes(normalizeTextList(value, 40), normalizedSizeMode);
}

export function getDerivedVariationAvailability(quantity) {
  return Number(quantity) > 0 ? "in_stock" : "out_of_stock";
}

export function createEmptyVariationRow(sizeMode = "one-size") {
  return {
    availability_status: getDerivedVariationAvailability(0),
    color: "",
    quantity: "0",
    size: normalizeSizeModeInput(sizeMode) === "one-size" ? ONE_SIZE_LABEL : "",
    sku: ""
  };
}

export function generateNextProductId(products) {
  const maxNumeric = products.reduce((max, product) => {
    const number = parseProductIdNumber(product.product_id);
    return number !== null && number > max ? number : max;
  }, 0);

  return formatProductIdNumber(maxNumeric + 1);
}

function normalizeCurrencyAlphaInput(value) {
  return normalizeCurrencyCodeInput(value);
}

function getSafeCurrencyAlpha(value, fallback = DEFAULT_CURRENCY_ALPHA) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  const normalizedAlpha = normalizeCurrencyAlphaInput(raw);
  if (ISO_CURRENCY_ALPHA_REGEX.test(normalizedAlpha)) {
    return normalizedAlpha;
  }

  const digitsOnly = String(raw).replace(/\D/g, "").slice(0, 3);
  return CURRENCY_NUMERIC_TO_ALPHA[digitsOnly] || fallback;
}

export function formatMoney(value, currency = DEFAULT_CURRENCY_ALPHA) {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) {
    return "-";
  }

  const safeCurrency = getSafeCurrencyAlpha(currency, DEFAULT_CURRENCY_ALPHA);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2
    }).format(Number(value));
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: DEFAULT_CURRENCY_ALPHA,
      maximumFractionDigits: 2
    }).format(Number(value));
  }
}

export function formatDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Invalid date";
  return date.toLocaleString();
}

export function toDateTimeLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getRangeFromPreset(preset) {
  if (preset === "custom") {
    return {
      end: null,
      endInput: "",
      start: null,
      startInput: ""
    };
  }

  const end = new Date();
  const start = new Date(end);

  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (preset === "week") {
    start.setDate(end.getDate() - 7);
  } else if (preset === "month") {
    start.setMonth(end.getMonth() - 1);
  } else if (preset === "year") {
    start.setFullYear(end.getFullYear() - 1);
  }

  return {
    end,
    endInput: toDateTimeLocal(end),
    start,
    startInput: toDateTimeLocal(start)
  };
}

function mapApiProduct(row) {
  const mappedId = String(row.id ?? randomId());
  const normalizedProductId = normalizeProductIdInput(row.product_id);
  const imageCollections = resolveImageCollections(row);
  const sizeMode = normalizeSizeModeInput(row.size_mode ?? row.sizeMode);
  const variations = normalizeVariationList(row.variations).map((variation) => ({
    availability_status: String(
      variation.availability_status ||
      variation.availabilityStatus ||
      getDerivedVariationAvailability(variation.quantity)
    ),
    color: String(variation.color || ""),
    id: variation.id ?? null,
    quantity: toNum(variation.quantity, 0),
    size: normalizeSizeLabel(variation.size, sizeMode),
    sku: String(variation.sku || "")
  }));

  return {
    active: row.active !== false,
    buy_enabled: Boolean(row.buy_enabled),
    buy_price: toNum(row.buy_price, null),
    category: String(row.category ?? "General"),
    colors: getCatalogColorOptions(row.colors),
    created_at: String(row.created_at ?? ""),
    currency: getSafeCurrencyAlpha(row.currency, DEFAULT_CURRENCY_ALPHA),
    description: String(row.description ?? ""),
    id: mappedId,
    image_url: imageCollections.image_url,
    light_images: imageCollections.light_images,
    dark_images: imageCollections.dark_images,
    name: String(row.name ?? ""),
    overhead_cost: toNum(row.overhead_cost, 0),
    featured: Boolean(row.featured),
    product_id: PRODUCT_ID_REGEX.test(normalizedProductId)
      ? normalizedProductId
      : fallbackProductId(row.product_id || mappedId),
    quality: String(row.quality ?? ""),
    quality_points: normalizeQualityPointsInput(row.quality_points),
    quantity_available: toNum(row.quantity_available, 0),
    rent_enabled: Boolean(row.rent_enabled),
    rent_price_per_day: toNum(row.rent_price_per_day, null),
    reorder_level: toNum(row.reorder_level, 0),
    size_mode: sizeMode,
    sizes: getCatalogSizeOptions(row.sizes, sizeMode),
    subcategory: String(row.subcategory ?? "General"),
    customizable: Boolean(row.customizable),
    unit_cost: toNum(row.unit_cost, 0),
    updated_at: String(row.updated_at ?? ""),
    variations
  };
}

function ensureUniqueProductIds(list) {
  const used = new Set();

  return list.map((product) => {
    let number = parseProductIdNumber(product.product_id) ?? parseProductIdNumber(product.id) ?? 1;
    let candidate = formatProductIdNumber(number);

    while (used.has(candidate) && number < 99999) {
      number += 1;
      candidate = formatProductIdNumber(number);
    }

    used.add(candidate);
    return { ...product, product_id: candidate };
  });
}

export async function loadProducts() {
  const rows = await apiRequestJson(PRODUCTS_PATH);
  return Array.isArray(rows) ? ensureUniqueProductIds(rows.map(mapApiProduct)) : [];
}

export async function loadUsers() {
  const rows = await apiRequestJson(USERS_PATH);
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    created_at: row.created_at || null,
    email: String(row.email ?? ""),
    id: String(row.id ?? ""),
    last_login_at: row.last_login_at || null,
    name: String(row.name ?? "Unnamed User"),
    role: String(row.role ?? "customer")
  }));
}

export async function saveProduct(product, editingId) {
  if (editingId) {
    const routeId = Number(editingId);
    if (!Number.isInteger(routeId) || routeId <= 0) {
      throw new Error("Product update requires a numeric database id.");
    }

    return apiRequestJson(`${PRODUCTS_PATH}/${routeId}`, {
      body: product,
      method: "PUT"
    });
  }

  return apiRequestJson(PRODUCTS_PATH, {
    body: product,
    method: "POST"
  });
}

export async function removeProduct(id) {
  const routeId = Number(id);
  if (!Number.isInteger(routeId) || routeId <= 0) {
    throw new Error("Product deletion requires a numeric database id.");
  }

  return apiRequestJson(`${PRODUCTS_PATH}/${routeId}`, {
    method: "DELETE"
  });
}

export function createEmptyProductForm(products) {
  return {
    active: true,
    buy_enabled: true,
    buy_price: "",
    category: "",
    colors: "",
    currency: DEFAULT_CURRENCY_ALPHA,
    description: "",
    dark_images: [],
    featured: false,
    light_images: [],
    name: "",
    overhead_cost: "0",
    product_id: generateNextProductId(products),
    quality: "",
    quality_points: "",
    quantity_available: "0",
    rent_enabled: false,
    rent_price_per_day: "",
    reorder_level: "0",
    size_mode: "one-size",
    sizes: "",
    subcategory: "",
    customizable: false,
    variations: [createEmptyVariationRow("one-size")],
    unit_cost: "0"
  };
}

export function buildFormFromProduct(product) {
  const lightImages = normalizeImageList(product.light_images);
  const darkImages = normalizeImageList(product.dark_images);
  const sizeMode = normalizeSizeModeInput(product.size_mode);
  const legacyImages =
    !lightImages.length && !darkImages.length
      ? normalizeImageList(product.image_url)
      : [];

  return {
    active: Boolean(product.active),
    buy_enabled: Boolean(product.buy_enabled),
    buy_price: product.buy_price ?? "",
    category: product.category,
    colors: Array.isArray(product.colors) ? product.colors.join("\n") : "",
    currency: getSafeCurrencyAlpha(product.currency, DEFAULT_CURRENCY_ALPHA),
    description: product.description || "",
    dark_images: darkImages,
    featured: Boolean(product.featured),
    light_images: lightImages.length ? lightImages : legacyImages,
    name: product.name,
    overhead_cost: product.overhead_cost ?? 0,
    product_id: product.product_id || fallbackProductId(product.id),
    quality: product.quality || "",
    quality_points: normalizeQualityPointsInput(product.quality_points).join("\n"),
    quantity_available: product.quantity_available ?? 0,
    rent_enabled: Boolean(product.rent_enabled),
    rent_price_per_day: product.rent_price_per_day ?? "",
    reorder_level: product.reorder_level ?? 0,
    size_mode: sizeMode,
    sizes: sizeMode === "varied" ? getCatalogSizeOptions(product.sizes, sizeMode).join("\n") : "",
    subcategory: product.subcategory,
    customizable: Boolean(product.customizable),
    variations: normalizeVariationList(product.variations).length
      ? normalizeVariationList(product.variations).map((variation) => ({
          availability_status: String(
            variation.availability_status || getDerivedVariationAvailability(variation.quantity)
          ),
          color: String(variation.color || ""),
          id: variation.id ?? null,
          quantity: variation.quantity ?? 0,
          size: normalizeSizeLabel(variation.size, sizeMode),
          sku: String(variation.sku || "")
        }))
      : [createEmptyVariationRow(sizeMode)],
    unit_cost: product.unit_cost ?? 0
  };
}

export function buildProductPayload(form, { editingId, products }) {
  const normalizedProductId = normalizeProductIdInput(form.product_id);
  const normalizedCurrency = normalizeCurrencyCodeInput(form.currency);
  const qualityPoints = String(form.quality_points || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const buyEnabled = Boolean(form.buy_enabled);
  const rentEnabled = Boolean(form.rent_enabled);
  const lightImages = normalizeImageList(form.light_images);
  const darkImages = normalizeImageList(form.dark_images);
  const sizeMode = normalizeSizeModeInput(form.size_mode);
  const colors = getCatalogColorOptions(form.colors);
  const sizes = getCatalogSizeOptions(form.sizes, sizeMode);

  if (!buyEnabled && !rentEnabled) {
    throw new Error("Enable at least Buy or Rent.");
  }

  if (!PRODUCT_ID_REGEX.test(normalizedProductId)) {
    throw new Error("Product ID must be exactly 5 digits like 00001.");
  }

  const duplicate = products.find(
    (product) =>
      String(product.id) !== String(editingId ?? "") &&
      String(product.product_id || "") === normalizedProductId
  );
  if (duplicate) {
    throw new Error("Product ID already exists. Use a unique Product ID.");
  }

  if (!ISO_CURRENCY_ALPHA_REGEX.test(normalizedCurrency)) {
    throw new Error("Currency must be exactly 3 uppercase letters like EGP or USD.");
  }

  const name = String(form.name || "").trim();
  const category = String(form.category || "").trim();
  const subcategory = String(form.subcategory || "").trim();

  if (!name || !category || !subcategory) {
    throw new Error("Name, category, and subcategory are required.");
  }

  if (lightImages.length > MAX_IMAGES_PER_MODE) {
    throw new Error("You can upload up to 10 light mode images per product.");
  }

  if (darkImages.length > MAX_IMAGES_PER_MODE) {
    throw new Error("You can upload up to 10 dark mode images per product.");
  }

  const variationRows = Array.isArray(form.variations) ? form.variations : [];
  const variations = variationRows
    .filter((row) =>
      String(row?.color || "").trim() ||
      String(row?.size || "").trim() ||
      String(row?.sku || "").trim() ||
      Number(row?.quantity || 0) > 0
    )
    .map((row, index) => {
      const color = String(row.color || "").trim();
      const size = sizeMode === "one-size" ? ONE_SIZE_LABEL : normalizeSizeLabel(row.size, sizeMode);
      const quantity = toNum(row.quantity, 0);

      if (!color) {
        throw new Error(`Variation ${index + 1} requires a color.`);
      }

      if (!size) {
        throw new Error(`Variation ${index + 1} requires a size.`);
      }

      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 0) {
        throw new Error(`Variation ${index + 1} quantity must be a non-negative whole number.`);
      }

      if (colors.length && !colors.some((option) => option.toLowerCase() === color.toLowerCase())) {
        throw new Error(`Variation ${index + 1} color must be chosen from the color options list.`);
      }

      if (
        sizeMode === "varied" &&
        sizes.length &&
        !sizes.some((option) => option.toLowerCase() === size.toLowerCase())
      ) {
        throw new Error(`Variation ${index + 1} size must be chosen from the size options list.`);
      }

      return {
        availability_status: getDerivedVariationAvailability(quantity),
        color,
        quantity: Number(quantity),
        size,
        sku: String(row.sku || "").trim()
      };
    });

  const normalizedVariations = variations.length
    ? variations
    : [
        {
          availability_status: getDerivedVariationAvailability(toNum(form.quantity_available, 0)),
          color: colors[0] || "Standard",
          quantity: Number(toNum(form.quantity_available, 0)),
          size: sizeMode === "one-size" ? ONE_SIZE_LABEL : sizes[0] || "Standard",
          sku: ""
        }
      ];

  const variationKeys = new Set();
  normalizedVariations.forEach((variation) => {
    const key = `${variation.color.toLowerCase()}::${variation.size.toLowerCase()}`;
    if (variationKeys.has(key)) {
      throw new Error(`Duplicate variation found for ${variation.color} / ${variation.size}.`);
    }
    variationKeys.add(key);
  });

  const normalizedColors = colors.length
    ? colors
    : Array.from(new Set(normalizedVariations.map((variation) => variation.color)));
  const normalizedSizes = sizeMode === "one-size"
    ? []
    : sizes.length
      ? sizes
      : sortSizes(normalizedVariations.map((variation) => variation.size), sizeMode);

  if (!normalizedColors.length) {
    throw new Error("Add at least one color option.");
  }

  if (sizeMode === "varied" && !normalizedSizes.length) {
    throw new Error("Varied-size products need at least one size.");
  }

  return {
    active: Boolean(form.active),
    buy_enabled: buyEnabled,
    buy_price: toNum(form.buy_price, null),
    category,
    colors: normalizedColors,
    currency: normalizedCurrency,
    description: String(form.description || "").trim(),
    dark_images: darkImages,
    featured: Boolean(form.featured),
    image_url: lightImages[0] || darkImages[0] || "",
    light_images: lightImages,
    name,
    overhead_cost: toNum(form.overhead_cost, 0),
    product_id: normalizedProductId,
    quality: String(form.quality || "").trim(),
    quality_points: qualityPoints,
    quantity_available: normalizedVariations.reduce((sum, variation) => sum + Number(variation.quantity || 0), 0),
    rent_enabled: rentEnabled,
    rent_price_per_day: toNum(form.rent_price_per_day, null),
    reorder_level: toNum(form.reorder_level, 0),
    size_mode: sizeMode,
    sizes: normalizedSizes,
    subcategory,
    customizable: Boolean(form.customizable),
    unit_cost: toNum(form.unit_cost, 0),
    variations: normalizedVariations
  };
}

function isWithinRange(isoDate, range) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) return true;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
}

export function computeDashboardMetrics(products, range) {
  const inRange = products.filter((product) =>
    isWithinRange(product.created_at || product.updated_at, range)
  );
  const activeCount = inRange.filter((product) => product.active).length;
  const lowStock = inRange.filter(
    (product) => Number(product.quantity_available) <= Number(product.reorder_level)
  ).length;
  const categories = new Set(
    inRange.map((product) => product.category.trim()).filter(Boolean)
  );
  const avgStartPrice = inRange.length
    ? inRange.reduce(
        (sum, product) =>
          sum + Number(product.buy_price ?? product.rent_price_per_day ?? 0),
        0
      ) / inRange.length
    : 0;

  return [
    {
      sub: "Filtered by selected date range.",
      title: "Products In Range",
      value: inRange.length
    },
    {
      sub: `${inRange.length - activeCount} inactive`,
      title: "Active Products",
      value: activeCount
    },
    {
      sub: "Dynamic categories from product records.",
      title: "Categories",
      value: categories.size
    },
    {
      sub: "Quantity less than or equal reorder level.",
      title: "Low Stock",
      value: lowStock
    },
    {
      sub: "Buy price if available, else rent/day.",
      title: "Avg Starting Price",
      value: formatMoney(avgStartPrice, DEFAULT_CURRENCY_ALPHA)
    }
  ];
}

export function productMatchesSearch(product, query) {
  if (!query) return true;

  return [
    product.product_id,
    product.name,
    product.category,
    product.subcategory,
    product.description,
    product.quality,
    ...(Array.isArray(product.colors) ? product.colors : [])
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function userMatchesSearch(user, query) {
  if (!query) return true;
  return `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query);
}

export function getProductImage(product, theme = "light", index = 0) {
  const lightImages = normalizeImageList(product?.light_images);
  const darkImages = normalizeImageList(product?.dark_images);
  const preferredImages = theme === "dark" ? darkImages : lightImages;
  const fallbackImages = theme === "dark" ? lightImages : darkImages;
  const images = preferredImages.length
    ? preferredImages
    : fallbackImages.length
      ? fallbackImages
      : normalizeImageList(product?.image_url);

  return resolveAssetUrl(
    images[index] || images[0] || product?.image_url || "",
    PLACEHOLDER_IMAGE_URL
  );
}

function getMetricsMap() {
  try {
    const raw = localStorage.getItem(METRICS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function computeAnalyticsRows(products) {
  const metrics = getMetricsMap();
  const byProduct = products.map((product) => {
    const itemMetrics = metrics[product.id] || {};
    const sold = Number(itemMetrics.purchase || 0);
    const visited = Number(itemMetrics.product_view || 0);
    const added = Number(itemMetrics.add_to_cart || 0);
    const buyPrice = Number(product.buy_price || 0);
    const margin =
      buyPrice - Number(product.unit_cost || 0) - Number(product.overhead_cost || 0);
    const totalProfit = margin * sold;
    const conversion = added > 0 ? (sold / added) * 100 : 0;

    return {
      added,
      conversion,
      product,
      sold,
      totalProfit,
      visited
    };
  });

  return {
    cartVsSuccess: [...byProduct]
      .sort((a, b) => b.conversion - a.conversion)
      .slice(0, 6)
      .map((item) => ({
        sub: `Add-to-cart: ${item.added}, Purchases: ${item.sold}, Conversion: ${item.conversion.toFixed(1)}%`,
        title: item.product.name
      })),
    profitability: [...byProduct]
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 6)
      .map((item) => ({
        sub: `Estimated profit: ${formatMoney(item.totalProfit, item.product.currency || "USD")}`,
        title: item.product.name
      })),
    topSold: [...byProduct]
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 6)
      .map((item) => ({
        sub: `${item.product.category} / ${item.product.subcategory}`,
        title: `${item.product.name} (${item.sold})`
      })),
    topVisited: [...byProduct]
      .sort((a, b) => b.visited - a.visited)
      .slice(0, 6)
      .map((item) => ({
        sub: `${item.added} add-to-cart`,
        title: `${item.product.name} (${item.visited} views)`
      }))
  };
}
