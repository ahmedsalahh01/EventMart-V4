import { apiRequest, buildApiUrl, resolveApiBaseUrl } from "./api.js";
import { materializeProductDetail } from "./productDetail.js";

const STORAGE_KEY = "eventmart_products_v1";
const METRICS_KEY = "eventmart_product_metrics_v1";
const PRODUCT_ID_REGEX = /^(?!00000)\d{5}$/;

export function formatMoney(value, currency = "USD") {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2
  }).format(Number(value));
}

export function fallbackImage() {
  return "/assets/equipment-collage.jpg";
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

function mergeUniqueImageLists(...values) {
  const seen = new Set();
  const merged = [];

  values.forEach((value) => {
    normalizeImageList(value).forEach((image) => {
      if (!seen.has(image)) {
        seen.add(image);
        merged.push(image);
      }
    });
  });

  return merged;
}

export function resolveProductImageUrl(source) {
  const value = String(source || "").trim();
  if (!value) return fallbackImage();

  if (/^(?:https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return buildApiUrl(value);
  }

  return value;
}

export function normalizeProductIdInput(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 5);
}

export function fallbackProductId(id) {
  const digits = String(id ?? "").replace(/\D/g, "");
  if (!digits) return "00001";

  const candidate = digits.slice(-5).padStart(5, "0");
  return PRODUCT_ID_REGEX.test(candidate) ? candidate : "00001";
}

function fallbackProductSlug(name, productId, id) {
  const base = String(name || "product")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = String(productId || id || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  return suffix ? `${base || "product"}-${suffix}` : base || "product";
}

export function getMode(product) {
  if (product.buy_enabled && product.rent_enabled) return "BOTH";
  if (product.buy_enabled) return "BUY_ONLY";
  if (product.rent_enabled) return "RENT_ONLY";
  return "NONE";
}

export function getModeLabel(mode) {
  if (mode === "BUY_ONLY") return "Buy Only";
  if (mode === "RENT_ONLY") return "Rent Only";
  if (mode === "BOTH") return "Buy / Rent";
  return "Unavailable";
}

export function getStartingPrice(product) {
  if (product.buy_enabled && product.buy_price !== null) return Number(product.buy_price);
  if (product.rent_enabled && product.rent_price_per_day !== null) return Number(product.rent_price_per_day);
  return 0;
}

function toNum(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

export function normalizeProduct(row) {
  const localId = String(row.id);
  const normalizedProductId = normalizeProductIdInput(row.product_id);
  const galleryImages = mergeUniqueImageLists(
    row.images,
    row.light_images,
    row.dark_images,
    row.image_url
  );
  const legacyImageUrl = String(row.image_url || "").trim();
  const qualityPoints = Array.isArray(row.quality_points)
    ? row.quality_points
    : typeof row.quality_points === "string"
      ? row.quality_points
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  const quantityAvailable =
    row.quantity_available !== undefined
      ? toNum(row.quantity_available, 0)
      : row.stock !== undefined
        ? toNum(row.stock, 0)
      : 0;
  const tags = Array.isArray(row.tags)
    ? row.tags
    : typeof row.tags === "string"
      ? row.tags
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  const detail = materializeProductDetail({
    colors: row.colors,
    quantity_available: quantityAvailable,
    size_mode: row.size_mode || row.sizeMode,
    sizes: row.sizes,
    variations: row.variations
  });

  const product = {
    id: localId,
    product_id: PRODUCT_ID_REGEX.test(normalizedProductId)
      ? normalizedProductId
      : fallbackProductId(row.product_id || localId),
    sku: String(row.sku || ""),
    slug: String(row.slug || fallbackProductSlug(row.name, row.product_id, localId)),
    name: String(row.name || "Unnamed Product"),
    category: String(row.category || "General"),
    subcategory: String(row.subcategory || "General"),
    dark_images: galleryImages,
    image_url: galleryImages[0] || legacyImageUrl,
    images: galleryImages,
    light_images: galleryImages,
    description: String(row.description || ""),
    quality: String(row.quality || ""),
    quality_points: qualityPoints,
    colors: detail.colors,
    size_mode: detail.size_mode,
    sizes: detail.sizes,
    customizable: Boolean(row.customizable),
    variations: detail.variations,
    buy_enabled: Boolean(row.buy_enabled),
    rent_enabled: Boolean(row.rent_enabled),
    buy_price: toNum(row.buy_price, null),
    rent_price_per_day: toNum(row.rent_price_per_day, null),
    base_price: toNum(row.base_price, null),
    currency: String(row.currency || "USD"),
    event_type: String(row.event_type || ""),
    tags,
    customization_fee: toNum(row.customization_fee, 0),
    venue_type: String(row.venue_type || ""),
    delivery_class: String(row.delivery_class || ""),
    featured: Boolean(row.featured),
    active: row.active !== false,
    quantity_available: quantityAvailable,
    stock: quantityAvailable
  };

  return {
    ...product,
    startingPrice: getStartingPrice(product)
  };
}

export function getProductImages(product, theme = "light") {
  const images = mergeUniqueImageLists(
    product?.images,
    product?.light_images,
    product?.dark_images,
    product?.image_url
  ).map(resolveProductImageUrl);

  if (images.length) return images;
  return [fallbackImage()];
}

export function getProductImage(product, theme = "light", index = 0) {
  const images = getProductImages(product, theme);
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return images[safeIndex] || images[0] || fallbackImage();
}

export function clearStoredProducts() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    // Ignore storage cleanup failures.
  }
}

export async function loadProducts() {
  const baseUrl = resolveApiBaseUrl();

  try {
    const rows = await apiRequest("/api/products", { baseUrl });
    clearStoredProducts();
    if (!Array.isArray(rows)) return [];

    return rows
      .map(normalizeProduct)
      .filter((product) => product.active !== false);
  } catch (_error) {
    clearStoredProducts();
    return [];
  }
}

export function getMetricsMap() {
  try {
    const raw = localStorage.getItem(METRICS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
}

export function bumpMetric(productId, metric, qty = 1) {
  if (!productId) return;
  const metrics = getMetricsMap();
  if (!metrics[productId]) metrics[productId] = {};
  metrics[productId][metric] = Number(metrics[productId][metric] || 0) + Number(qty || 1);
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
}

export function getProductMetric(productId, metric) {
  return Number(getMetricsMap()?.[productId]?.[metric] || 0);
}

export function metricScore(productId) {
  return getProductMetric(productId, "purchase") * 5 + getProductMetric(productId, "add_to_cart") * 2 + getProductMetric(productId, "product_view");
}

export function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

export function getProductRating(product) {
  const seed = hashCode(String(product.id || product.name || "product"));
  const score = metricScore(product.id);
  const spread = ((seed + score) % 6) / 10;
  const rating = Math.min(5, 4.5 + spread);
  return rating.toFixed(1);
}

export async function loadProductBySlug(slug) {
  const normalizedSlug = String(slug || "").trim();
  const baseUrl = resolveApiBaseUrl();

  try {
    const row = await apiRequest(`/api/products/slug/${encodeURIComponent(normalizedSlug)}`, { baseUrl });
    clearStoredProducts();
    return row ? normalizeProduct(row) : null;
  } catch (error) {
    clearStoredProducts();
    throw error;
  }
}

export async function uploadCustomizationFile({ file, productId, token, uploadKind, variationId }) {
  const params = new URLSearchParams({
    filename: String(file?.name || `${uploadKind || "design"}.file`),
    product_id: String(productId || ""),
    upload_kind: String(uploadKind || "")
  });

  if (variationId) {
    params.set("variation_id", String(variationId));
  }

  const response = await fetch(buildApiUrl(`/api/customization-uploads?${params.toString()}`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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

  if (!response.ok) {
    const error = new Error(payload?.error || payload?.details || "Customization upload failed.");
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function deleteCustomizationUploads(uploadTokens, token) {
  const list = Array.isArray(uploadTokens) ? uploadTokens.filter(Boolean) : [];
  if (!list.length) return;

  const response = await fetch(buildApiUrl("/api/customization-uploads"), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ uploadTokens: list })
  });

  if (!response.ok) {
    const text = await response.text();
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text ? { error: text } : null;
    }

    const error = new Error(payload?.error || payload?.details || "Customization cleanup failed.");
    error.status = response.status;
    throw error;
  }
}
