export const METRICS_KEY = "eventmart_product_metrics_v1";

const LOCAL_API_URL = "http://localhost:4000";
const PRODUCTION_API_URL = "https://eventmart-v4-production.up.railway.app";
const PRODUCTS_PATH = "/api/products";
const PACKAGES_PATH = "/api/packages";
const PRODUCT_IMAGE_UPLOAD_PATHS = ["/api/product-images/upload", "/product-images/upload"];
const PRODUCT_IMAGE_DELETE_PATHS = ["/api/product-images", "/product-images"];
const USERS_PATH = "/api/users";
const PACKAGE_STORAGE_KEY = "eventmart_admin_packages_v1";

const ISO_CURRENCY_ALPHA_REGEX = /^[A-Z]{3}$/;
const PRODUCT_ID_REGEX = /^(?!00000)\d{5}$/;
const DEFAULT_CURRENCY_ALPHA = "EGP";
const PLACEHOLDER_IMAGE_URL = "https://placehold.co/320x220?text=EventMart";
export const MAX_PRODUCT_IMAGES = 10;
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

function getPackageFallbackApiBaseUrl(baseUrl, location = readRuntimeLocation()) {
  const configuredFallback = getFallbackApiBaseUrl(baseUrl, location);
  return configuredFallback || "";
}

function readLocalStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  if (globalThis?.localStorage) {
    return globalThis.localStorage;
  }

  return null;
}

function slugifyValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shouldUsePackageStorageFallback(error) {
  const status = Number(error?.status || 0);
  if (status === 404) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("could not reach the api server") ||
    message.includes("cannot get /api/packages") ||
    message.includes("cannot post /api/packages") ||
    message.includes("cannot put /api/packages") ||
    message.includes("cannot delete /api/packages")
  );
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

function mergeUniqueImageLists(...sources) {
  const seen = new Set();

  return sources
    .flatMap((source) => normalizeImageList(source))
    .filter((item) => {
      const key = String(item || "").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
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
  const sharedImages = mergeUniqueImageLists(
    row?.images,
    row?.light_images,
    row?.dark_images,
    row?.image_url
  );
  const primaryImage = sharedImages[0] || String(row?.image_url ?? "").trim();

  return {
    dark_images: sharedImages,
    image_url: primaryImage,
    images: sharedImages,
    light_images: sharedImages
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

        const shouldRetryOnStatus =
          Array.isArray(options.retryStatusCodes) &&
          options.retryStatusCodes.includes(response.status) &&
          index < attemptBaseUrls.length - 1;

        if (shouldRetryOnStatus) {
          continue;
        }

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

export async function uploadProductImage(file, { productId, themeMode } = {}) {
  const params = new URLSearchParams({
    product_id: String(productId || "").trim(),
    theme_mode: String(themeMode || "light").trim(),
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
    images: imageCollections.images,
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

export function buildPackageMinimumQuantityNotice(productName, minimumQuantity) {
  const safeName = String(productName || "this item").trim() || "this item";
  const safeMinimum = Math.max(1, Number(minimumQuantity || 1));
  return `Selecting fewer than ${safeMinimum} unit${safeMinimum === 1 ? "" : "s"} of ${safeName} may apply extra fees.`;
}

export function createEmptyPackageDiscountTier() {
  return {
    discountPercent: "0",
    id: randomId(),
    label: "",
    maxQuantity: "",
    minQuantity: "1",
    unitPriceOverride: ""
  };
}

function normalizePackageDiscountTierRow(tier, index) {
  return {
    discountPercent: String(toNum(tier?.discountPercent ?? tier?.discount_percent, 0) ?? 0),
    id: tier?.id || randomId(),
    label: String(tier?.label || ""),
    maxQuantity:
      tier?.maxQuantity === null || tier?.maxQuantity === undefined || tier?.maxQuantity === ""
        ? ""
        : String(Math.max(1, Number(tier.maxQuantity))),
    minQuantity: String(Math.max(1, Number((tier?.minQuantity ?? tier?.min_quantity ?? (index === 0 ? 1 : 0)) || 1))),
    unitPriceOverride:
      tier?.unitPriceOverride === null || tier?.unitPriceOverride === undefined || tier?.unitPriceOverride === ""
        ? ""
        : String(toNum(tier.unitPriceOverride, 0) ?? 0)
  };
}

function normalizePackageDiscountTierRows(value) {
  const rows = Array.isArray(value) ? value : [];
  return rows.length ? rows.map(normalizePackageDiscountTierRow) : [createEmptyPackageDiscountTier()];
}

function normalizePackageModeInput(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["buy", "rent", "hybrid"].includes(normalized) ? normalized : "hybrid";
}

function normalizeBooleanSelectInput(value, fallback = false) {
  if (typeof value === "boolean") return value;

  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return fallback;
}

function formatVenueTypeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "indoor") return "Indoor";
  if (normalized === "outdoor") return "Outdoor";
  if (normalized === "hybrid") return "Hybrid";
  return "General";
}

function formatPackageModeLabel(value) {
  const normalized = normalizePackageModeInput(value);
  if (normalized === "buy") return "Buy only";
  if (normalized === "rent") return "Rent only";
  return "Hybrid";
}

function buildPackageDescriptionFromContext(contextDefaults) {
  const details = [];
  const guestCount = Math.max(0, Number(contextDefaults?.guestCount || 0));

  if (guestCount > 0) {
    details.push(`Fits up to ${guestCount} people`);
  }

  details.push(`${formatVenueTypeLabel(contextDefaults?.venueType)} setup`);
  details.push(contextDefaults?.customizationAvailable ? "Customizable items available" : "Non-customizable package");
  details.push(formatPackageModeLabel(contextDefaults?.packageMode));

  return details.join(". ");
}

function normalizePackageContextDefaults(value) {
  return {
    budget: String(value?.budget ?? ""),
    customizationAvailable: normalizeBooleanSelectInput(
      value?.customizationAvailable ??
      value?.customization_available ??
      value?.itemsCanBeCustomized ??
      value?.items_can_be_customized,
      false
    ),
    deliveryPlace: String(value?.deliveryPlace ?? value?.delivery_place ?? ""),
    eventType: String(value?.eventType ?? value?.event_type ?? ""),
    guestCount: String(value?.guestCount ?? value?.guest_count ?? ""),
    minimumPackagePrice: String(value?.minimumPackagePrice ?? value?.minimum_package_price ?? ""),
    packageMode: normalizePackageModeInput(value?.packageMode ?? value?.package_mode),
    packagePrice: String(value?.packagePrice ?? value?.package_price ?? ""),
    venueSize: String(value?.venueSize ?? value?.venue_size ?? ""),
    venueType: String(value?.venueType ?? value?.venue_type ?? "")
  };
}

function normalizePackageItemFormRow(item, index) {
  const product = item?.product && typeof item.product === "object" ? item.product : {};
  const minimumQuantity = Math.max(1, Number(item?.minimumQuantity ?? item?.minimum_quantity ?? 1));
  const defaultQuantity = Math.max(
    minimumQuantity,
    Number(item?.defaultQuantity ?? item?.default_quantity ?? minimumQuantity)
  );

  return {
    appliesToEventTypes: normalizeTextList(
      item?.appliesToEventTypes ?? item?.applies_to_event_types,
      80
    ).join("\n"),
    appliesToVenueTypes: normalizeTextList(
      item?.appliesToVenueTypes ?? item?.applies_to_venue_types,
      80
    ).join("\n"),
    defaultQuantity: String(defaultQuantity),
    discountTiers: normalizePackageDiscountTierRows(item?.discountTiers ?? item?.discount_tiers),
    id: item?.id || randomId(),
    minimumQuantity: String(minimumQuantity),
    minimumQuantityNotice:
      String(item?.minimumQuantityNotice || item?.minimum_quantity_notice || "").trim()
      || buildPackageMinimumQuantityNotice(product?.name, minimumQuantity),
    notes: String(item?.notes || ""),
    preferredMode: String(item?.preferredMode ?? item?.preferred_mode ?? "buy"),
    product,
    productId: String(item?.productId || item?.product_id || product?.id || ""),
    required: Boolean(item?.required ?? item?.is_required),
    sortOrder: Number(item?.sortOrder ?? item?.sort_order ?? index)
  };
}

function mapApiPackage(row) {
  const items = Array.isArray(row?.items) ? row.items : [];

  return {
    active: row?.active !== false,
    contextDefaults: normalizePackageContextDefaults(row?.contextDefaults || row?.context_defaults || {}),
    created_at: String(row?.created_at ?? ""),
    description: String(row?.description || ""),
    eventType: String(row?.eventType ?? row?.event_type ?? ""),
    id: Number(row?.id || 0),
    items: items.map((item, index) => {
      const rowItem = normalizePackageItemFormRow(item, index);
      const product = rowItem.product && typeof rowItem.product === "object" ? rowItem.product : {};

      return {
        ...rowItem,
        product: {
          active: product?.active !== false,
          buy_price: product?.buy_price === null || product?.buy_price === undefined ? null : Number(product.buy_price),
          category: String(product?.category || ""),
          currency: String(product?.currency || DEFAULT_CURRENCY_ALPHA),
          description: String(product?.description || ""),
          id: Number(product?.id || item?.product_id || 0),
          image_url: String(product?.image_url || ""),
          name: String(product?.name || ""),
          product_id: String(product?.product_id || ""),
          rent_price_per_day:
            product?.rent_price_per_day === null || product?.rent_price_per_day === undefined
              ? null
              : Number(product.rent_price_per_day),
          subcategory: String(product?.subcategory || "")
        }
      };
    }),
    name: String(row?.name || ""),
    preview: row?.preview && typeof row.preview === "object" ? row.preview : null,
    slug: String(row?.slug || ""),
    status: String(row?.status || "draft"),
    updated_at: String(row?.updated_at ?? ""),
    visibility: String(row?.visibility || "public")
  };
}

function nextStoredPackageId(packages) {
  return packages.reduce((max, pkg) => {
    const currentId = Number(pkg?.id || 0);
    return currentId > max ? currentId : max;
  }, 0) + 1;
}

function normalizeStoredPackageItem(item, index) {
  return normalizePackageItemFormRow(item, index);
}

function normalizeStoredPackage(pkg, index) {
  const items = Array.isArray(pkg?.items) ? pkg.items : [];
  const id = Number(pkg?.id || index + 1);
  const name = String(pkg?.name || "").trim();
  const baseSlug = slugifyValue(pkg?.slug || name) || `package-${id}`;

  return {
    active: pkg?.active !== false,
    contextDefaults: normalizePackageContextDefaults(pkg?.contextDefaults || pkg?.context_defaults || {}),
    created_at: String(pkg?.created_at || ""),
    description: String(pkg?.description || ""),
    eventType: String(pkg?.eventType ?? pkg?.event_type ?? ""),
    id,
    items: items.map((item, itemIndex) => normalizeStoredPackageItem(item, itemIndex)),
    name,
    preview: pkg?.preview && typeof pkg.preview === "object" ? pkg.preview : null,
    slug: baseSlug,
    status: String(pkg?.status || "draft"),
    updated_at: String(pkg?.updated_at || ""),
    visibility: String(pkg?.visibility || "public")
  };
}

function readStoredPackages() {
  const storage = readLocalStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(PACKAGE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeStoredPackage) : [];
  } catch {
    return [];
  }
}

function clearStoredPackages() {
  const storage = readLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(PACKAGE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function writeStoredPackages(packages) {
  const storage = readLocalStorage();
  if (!storage) {
    return packages;
  }

  storage.setItem(PACKAGE_STORAGE_KEY, JSON.stringify(packages));
  return packages;
}

function createStoredPackageSlug(name, packages, editingId = null) {
  const baseSlug = slugifyValue(name) || "package";
  let candidate = baseSlug;
  let suffix = 2;

  while (
    packages.some(
      (pkg) =>
        Number(pkg?.id || 0) !== Number(editingId || 0) &&
        String(pkg?.slug || "").trim().toLowerCase() === candidate
    )
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function savePackageToStorage(pkg, editingId) {
  const packages = readStoredPackages();
  const now = new Date().toISOString();
  const packageId =
    Number(editingId) > 0
      ? Number(editingId)
      : nextStoredPackageId(packages);
  const existingPackage = packages.find((entry) => Number(entry?.id || 0) === packageId) || null;

  const nextPackage = normalizeStoredPackage({
    active: pkg?.active !== false,
    contextDefaults: pkg?.contextDefaults || pkg?.context_defaults || {},
    created_at: existingPackage?.created_at || now,
    description: String(pkg?.description || "").trim(),
    eventType: String(pkg?.eventType ?? pkg?.event_type ?? "").trim(),
    id: packageId,
    items: (Array.isArray(pkg?.items) ? pkg.items : []).map((item, index) => ({
      appliesToEventTypes: item?.applies_to_event_types || item?.appliesToEventTypes || [],
      appliesToVenueTypes: item?.applies_to_venue_types || item?.appliesToVenueTypes || [],
      defaultQuantity: String(
        Math.max(
          Number(item?.minimum_quantity ?? item?.minimumQuantity ?? 1),
          Number(item?.default_quantity ?? item?.defaultQuantity ?? item?.minimum_quantity ?? item?.minimumQuantity ?? 1)
        )
      ),
      discountTiers: item?.discount_tiers || item?.discountTiers || [],
      id: existingPackage?.items?.[index]?.id || index + 1,
      minimumQuantity: String(Math.max(1, Number(item?.minimum_quantity ?? item?.minimumQuantity ?? 1))),
      minimumQuantityNotice: buildPackageMinimumQuantityNotice("", item?.minimum_quantity ?? item?.minimumQuantity ?? 1),
      notes: String(item?.notes || ""),
      preferredMode: String(item?.preferred_mode || item?.preferredMode || "buy"),
      product: {},
      productId: String(item?.product_id || item?.productId || ""),
      required: Boolean(item?.is_required ?? item?.required),
      sortOrder: index
    })),
    name: String(pkg?.name || "").trim(),
    status: String(pkg?.status || "draft").trim() || "draft",
    slug: createStoredPackageSlug(pkg?.name, packages, packageId),
    updated_at: now,
    visibility: String(pkg?.visibility || "public").trim() || "public"
  });

  const nextPackages = existingPackage
    ? packages.map((entry) => (Number(entry?.id || 0) === packageId ? nextPackage : entry))
    : [...packages, nextPackage];

  writeStoredPackages(nextPackages);
  return nextPackage;
}

function removePackageFromStorage(id) {
  const packageId = Number(id || 0);
  const packages = readStoredPackages();
  const nextPackages = packages.filter((entry) => Number(entry?.id || 0) !== packageId);
  writeStoredPackages(nextPackages);
}

function createMissingPackageApiError(baseUrl, path = PACKAGES_PATH) {
  return new Error(
    `The configured API at ${normalizeBaseUrl(baseUrl) || resolveApiBaseUrl()} does not currently serve ${path}. ` +
    "Deploy the Server app from the current repo or update VITE_API_URL to the backend that includes the packages routes."
  );
}

function normalizePackageApiError(error, baseUrl, path = PACKAGES_PATH) {
  if (Number(error?.status || 0) === 404) {
    const routeError = createMissingPackageApiError(baseUrl, path);
    routeError.status = 404;
    return routeError;
  }

  return error;
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

export async function loadPackages() {
  const runtimeLocation = readRuntimeLocation();
  const primaryBaseUrl = normalizeBaseUrl(resolveApiBaseUrl({ location: runtimeLocation }));

  try {
    const rows = await apiRequestJson(`${PACKAGES_PATH}?all=1`, {
      fallbackBaseUrl: getPackageFallbackApiBaseUrl(primaryBaseUrl, runtimeLocation),
      retryStatusCodes: [404]
    });
    clearStoredPackages();
    return Array.isArray(rows) ? rows.map(mapApiPackage) : [];
  } catch (error) {
    clearStoredPackages();
    throw normalizePackageApiError(error, primaryBaseUrl, PACKAGES_PATH);
  }
}

export async function previewPackageDraft(pkg, options = {}) {
  const runtimeLocation = readRuntimeLocation();
  const primaryBaseUrl = normalizeBaseUrl(resolveApiBaseUrl({ location: runtimeLocation }));

  try {
    return await apiRequestJson(`${PACKAGES_PATH}/preview`, {
      body: {
        context: options.context || pkg?.contextDefaults || {},
        package: pkg,
        packageGroupId: options.packageGroupId || `admin-preview-${Date.now()}`
      },
      fallbackBaseUrl: getPackageFallbackApiBaseUrl(primaryBaseUrl, runtimeLocation),
      method: "POST",
      retryStatusCodes: [404]
    });
  } catch (error) {
    throw normalizePackageApiError(error, primaryBaseUrl, `${PACKAGES_PATH}/preview`);
  }
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

export async function savePackage(pkg, editingId) {
  const runtimeLocation = readRuntimeLocation();
  const primaryBaseUrl = normalizeBaseUrl(resolveApiBaseUrl({ location: runtimeLocation }));
  const packageApiOptions = {
    fallbackBaseUrl: getPackageFallbackApiBaseUrl(primaryBaseUrl, runtimeLocation),
    retryStatusCodes: [404]
  };

  if (editingId) {
    const routeId = Number(editingId);
    if (!Number.isInteger(routeId) || routeId <= 0) {
      throw new Error("Package update requires a numeric database id.");
    }

    try {
      return await apiRequestJson(`${PACKAGES_PATH}/${routeId}`, {
        ...packageApiOptions,
        body: pkg,
        method: "PUT"
      });
    } catch (error) {
      throw normalizePackageApiError(error, primaryBaseUrl, `${PACKAGES_PATH}/${routeId}`);
    }
  }

  try {
    return await apiRequestJson(PACKAGES_PATH, {
      ...packageApiOptions,
      body: pkg,
      method: "POST"
    });
  } catch (error) {
    throw normalizePackageApiError(error, primaryBaseUrl, PACKAGES_PATH);
  }
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

export async function removePackage(id) {
  const routeId = Number(id);
  if (!Number.isInteger(routeId) || routeId <= 0) {
    throw new Error("Package deletion requires a numeric database id.");
  }

  const runtimeLocation = readRuntimeLocation();
  const primaryBaseUrl = normalizeBaseUrl(resolveApiBaseUrl({ location: runtimeLocation }));

  try {
    return await apiRequestJson(`${PACKAGES_PATH}/${routeId}`, {
      fallbackBaseUrl: getPackageFallbackApiBaseUrl(primaryBaseUrl, runtimeLocation),
      method: "DELETE",
      retryStatusCodes: [404]
    });
  } catch (error) {
    throw normalizePackageApiError(error, primaryBaseUrl, `${PACKAGES_PATH}/${routeId}`);
  }
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
    featured: false,
    images: [],
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

export function createEmptyPackageItem() {
  return {
    appliesToEventTypes: "",
    appliesToVenueTypes: "",
    defaultQuantity: "1",
    discountTiers: [createEmptyPackageDiscountTier()],
    id: randomId(),
    minimumQuantity: "1",
    notes: "",
    preferredMode: "buy",
    productId: "",
    required: true
  };
}

export function createEmptyPackageForm() {
  return {
    active: true,
    contextDefaults: normalizePackageContextDefaults({}),
    description: "",
    eventType: "",
    items: [createEmptyPackageItem()],
    name: "",
    status: "draft",
    visibility: "public"
  };
}

export function buildFormFromProduct(product) {
  const imageCollections = resolveImageCollections(product);
  const sizeMode = normalizeSizeModeInput(product.size_mode);

  return {
    active: Boolean(product.active),
    buy_enabled: Boolean(product.buy_enabled),
    buy_price: product.buy_price ?? "",
    category: product.category,
    colors: Array.isArray(product.colors) ? product.colors.join("\n") : "",
    currency: getSafeCurrencyAlpha(product.currency, DEFAULT_CURRENCY_ALPHA),
    description: product.description || "",
    featured: Boolean(product.featured),
    images: imageCollections.images,
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

export function buildFormFromPackage(pkg) {
  return {
    active: Boolean(pkg?.active),
    contextDefaults: normalizePackageContextDefaults(pkg?.contextDefaults || pkg?.context_defaults || {}),
    description: String(pkg?.description || ""),
    eventType: String(pkg?.eventType ?? pkg?.event_type ?? ""),
    items: Array.isArray(pkg?.items) && pkg.items.length
      ? pkg.items.map((item, index) => normalizePackageItemFormRow(item, index))
      : [createEmptyPackageItem()],
    name: String(pkg?.name || ""),
    status: String(pkg?.status || "draft"),
    visibility: String(pkg?.visibility || "public")
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
  const images = mergeUniqueImageLists(form.images);
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

  if (images.length > MAX_PRODUCT_IMAGES) {
    throw new Error("You can upload up to 10 shared attachments per product.");
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
    dark_images: images,
    featured: Boolean(form.featured),
    image_url: images[0] || "",
    images,
    light_images: images,
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

export function buildPackagePayload(form) {
  const name = String(form?.name || "").trim();
  const contextDefaults = {
    budget: toNum(form?.contextDefaults?.budget, 0) ?? 0,
    customizationAvailable: Boolean(form?.contextDefaults?.customizationAvailable),
    deliveryPlace: String(form?.contextDefaults?.deliveryPlace || "").trim(),
    eventType: String(form?.contextDefaults?.eventType || form?.eventType || "").trim(),
    guestCount: toNum(form?.contextDefaults?.guestCount, 0) ?? 0,
    minimumPackagePrice: toNum(form?.contextDefaults?.minimumPackagePrice, 0) ?? 0,
    packageMode: normalizePackageModeInput(form?.contextDefaults?.packageMode),
    packagePrice: toNum(form?.contextDefaults?.packagePrice, 0) ?? 0,
    venueSize: String(form?.contextDefaults?.venueSize || "").trim(),
    venueType: String(form?.contextDefaults?.venueType || "").trim()
  };
  const description = String(form?.description || "").trim() || buildPackageDescriptionFromContext(contextDefaults);
  const eventType = String(form?.eventType || "").trim();
  const visibility = String(form?.visibility || "public").trim().toLowerCase() || "public";
  const status = String(form?.status || "draft").trim().toLowerCase() || "draft";
  const active = Boolean(form?.active);
  const rows = Array.isArray(form?.items) ? form.items : [];

  if (!name) {
    throw new Error("Package name is required.");
  }

  if (!rows.length) {
    throw new Error("Add at least one package item.");
  }

  if (Number(contextDefaults.packagePrice || 0) <= 0) {
    throw new Error("Package overall price must be greater than 0.");
  }

  const seenProductIds = new Set();
  const items = rows.map((row, index) => {
    const productId = Number(row?.productId || 0);
    const minimumQuantity = Number(row?.minimumQuantity || 0);
    const defaultQuantity = Number(row?.defaultQuantity || minimumQuantity || 0);
    const preferredMode = String(
      contextDefaults.packageMode === "hybrid"
        ? row?.preferredMode
        : contextDefaults.packageMode
    ).trim().toLowerCase();
    const discountTierRows = Array.isArray(row?.discountTiers) ? row.discountTiers : [];

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error(`Package item ${index + 1} must select a product.`);
    }

    if (!Number.isInteger(minimumQuantity) || minimumQuantity < 1) {
      throw new Error(`Package item ${index + 1} minimum quantity must be at least 1.`);
    }

    if (!Number.isInteger(defaultQuantity) || defaultQuantity < minimumQuantity) {
      throw new Error(`Package item ${index + 1} default quantity must be at least the minimum quantity.`);
    }

    if (seenProductIds.has(productId)) {
      throw new Error("Each product can only appear once in a package.");
    }

    seenProductIds.add(productId);

    const discountTiers = discountTierRows
      .filter((tier) =>
        String(tier?.minQuantity || "").trim() ||
        String(tier?.maxQuantity || "").trim() ||
        String(tier?.discountPercent || "").trim() ||
        String(tier?.label || "").trim() ||
        String(tier?.unitPriceOverride || "").trim()
      )
      .map((tier, tierIndex) => {
        const minQuantity = Number(tier?.minQuantity || 0);
        const maxQuantityRaw = String(tier?.maxQuantity || "").trim();
        const maxQuantity = maxQuantityRaw ? Number(maxQuantityRaw) : null;
        const discountPercent = Number(tier?.discountPercent || 0);
        const unitPriceOverrideRaw = String(tier?.unitPriceOverride || "").trim();
        const unitPriceOverride = unitPriceOverrideRaw ? Number(unitPriceOverrideRaw) : null;

        if (!Number.isInteger(minQuantity) || minQuantity < 1) {
          throw new Error(`Package item ${index + 1} discount tier ${tierIndex + 1} requires a minimum quantity of at least 1.`);
        }

        if (maxQuantity !== null && (!Number.isInteger(maxQuantity) || maxQuantity < minQuantity)) {
          throw new Error(`Package item ${index + 1} discount tier ${tierIndex + 1} max quantity must be blank or greater than the minimum quantity.`);
        }

        if (Number.isNaN(discountPercent) || discountPercent < 0) {
          throw new Error(`Package item ${index + 1} discount tier ${tierIndex + 1} discount percent must be 0 or higher.`);
        }

        if (unitPriceOverride !== null && (Number.isNaN(unitPriceOverride) || unitPriceOverride < 0)) {
          throw new Error(`Package item ${index + 1} discount tier ${tierIndex + 1} unit price override must be 0 or higher.`);
        }

        return {
          discountPercent,
          label: String(tier?.label || "").trim(),
          maxQuantity,
          minQuantity,
          unitPriceOverride
        };
      });

    return {
      applies_to_event_types: normalizeTextList(row?.appliesToEventTypes, 80),
      applies_to_venue_types: normalizeTextList(row?.appliesToVenueTypes, 80),
      default_quantity: defaultQuantity,
      discount_tiers: discountTiers,
      is_required: Boolean(row?.required),
      minimum_quantity: minimumQuantity,
      notes: String(row?.notes || "").trim(),
      preferred_mode: preferredMode === "rent" ? "rent" : "buy",
      product_id: productId
    };
  });

  return {
    active,
    contextDefaults: {
      ...contextDefaults,
      eventType: String(contextDefaults.eventType || eventType).trim()
    },
    description,
    event_type: eventType,
    items,
    name,
    status,
    visibility
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

export function packageMatchesSearch(pkg, query) {
  if (!query) return true;

  const normalizedQuery = String(query || "").trim().toLowerCase();

  return [
    pkg?.name,
    pkg?.description,
    pkg?.eventType,
    pkg?.status,
    pkg?.visibility,
    ...(Array.isArray(pkg?.items)
      ? pkg.items.flatMap((item) => [
          item?.notes,
          item?.product?.name,
          item?.product?.category,
          item?.product?.subcategory,
          item?.product?.product_id
        ])
      : [])
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function getProductImage(product, theme = "light", index = 0) {
  const images = mergeUniqueImageLists(
    product?.images,
    product?.light_images,
    product?.dark_images,
    product?.image_url
  );

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
