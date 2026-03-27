const ONE_SIZE_LABEL = "One Size";

const SIZE_DISPLAY_ORDER = Object.freeze([
  "XS",
  "Small",
  "Medium",
  "Large",
  "X-Large",
  "2X-Large",
  "3X-Large",
  "4X-Large"
]);

const SIZE_TOKEN_MAP = Object.freeze({
  xs: "XS",
  xsmall: "XS",
  xsmalls: "XS",
  xsm: "XS",
  small: "Small",
  sm: "Small",
  s: "Small",
  medium: "Medium",
  med: "Medium",
  md: "Medium",
  m: "Medium",
  large: "Large",
  lg: "Large",
  l: "Large",
  xlarge: "X-Large",
  extralarge: "X-Large",
  xl: "X-Large",
  "1xl": "X-Large",
  "2xlarge": "2X-Large",
  "2xl": "2X-Large",
  xxl: "2X-Large",
  "3xlarge": "3X-Large",
  "3xl": "3X-Large",
  xxxl: "3X-Large",
  "4xlarge": "4X-Large",
  "4xl": "4X-Large",
  xxxxl: "4X-Large",
  onesize: ONE_SIZE_LABEL,
  one: ONE_SIZE_LABEL,
  standard: ONE_SIZE_LABEL,
  default: ONE_SIZE_LABEL
});

const SIZE_SORT_INDEX = new Map(SIZE_DISPLAY_ORDER.map((size, index) => [size, index]));

function normalizeCatalogText(value, maxLength = 120) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function uniqueList(values) {
  const seen = new Set();
  const next = [];

  values.forEach((value) => {
    const normalized = normalizeCatalogText(value, 120);
    if (!normalized) return;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    next.push(normalized);
  });

  return next;
}

function normalizeTextList(value, maxItemLength = 60) {
  if (Array.isArray(value)) {
    return uniqueList(
      value.flatMap((item) => normalizeTextList(item, maxItemLength)).map((item) => item.slice(0, maxItemLength))
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        return normalizeTextList(JSON.parse(trimmed), maxItemLength);
      } catch (_error) {
        // Fall through to text splitting below.
      }
    }

    return uniqueList(
      trimmed
        .split(/\r?\n|,/)
        .map((item) => normalizeCatalogText(item, maxItemLength))
        .filter(Boolean)
    );
  }

  if (value && typeof value === "object") {
    return normalizeTextList(
      value.values || value.options || value.items || value.value || value.label || "",
      maxItemLength
    );
  }

  return [];
}

function normalizeSizeMode(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "varied"
    ? "varied"
    : "one-size";
}

function normalizeSizeToken(value) {
  return normalizeCatalogText(value, 40)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\s_]+/g, "")
    .replace(/-/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeSizeLabel(value, sizeMode = "varied") {
  if (normalizeSizeMode(sizeMode) === "one-size") {
    return ONE_SIZE_LABEL;
  }

  const raw = normalizeCatalogText(value, 40);
  if (!raw) return "";

  const mapped = SIZE_TOKEN_MAP[normalizeSizeToken(raw)];
  if (mapped && mapped !== ONE_SIZE_LABEL) {
    return mapped;
  }

  return raw;
}

function sortSizes(sizes, sizeMode = "varied") {
  const normalizedSizeMode = normalizeSizeMode(sizeMode);

  if (normalizedSizeMode === "one-size") {
    return [ONE_SIZE_LABEL];
  }

  return uniqueList(
    sizes
      .map((size) => normalizeSizeLabel(size, normalizedSizeMode))
      .filter(Boolean)
  ).sort((left, right) => {
    const leftIndex = SIZE_SORT_INDEX.has(left) ? SIZE_SORT_INDEX.get(left) : Number.POSITIVE_INFINITY;
    const rightIndex = SIZE_SORT_INDEX.has(right) ? SIZE_SORT_INDEX.get(right) : Number.POSITIVE_INFINITY;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right);
  });
}

function slugifyProductName(name, productId = "") {
  const base = normalizeCatalogText(name, 160)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeProductId = String(productId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  if (!base) {
    return safeProductId || "product";
  }

  if (!safeProductId) {
    return base;
  }

  if (base.endsWith(`-${safeProductId}`) || base === safeProductId) {
    return base;
  }

  return `${base}-${safeProductId}`;
}

function toWholeNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return fallback;
  return number;
}

function normalizeAvailabilityStatus(value, quantity = 0) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "unavailable" || normalized === "disabled") {
    return "unavailable";
  }

  if (normalized === "out_of_stock" || normalized === "sold_out") {
    return "out_of_stock";
  }

  return Number(quantity) > 0 ? "in_stock" : "out_of_stock";
}

function buildVariationKey(color, size) {
  return `${normalizeCatalogText(color, 60).toLowerCase()}::${normalizeCatalogText(size, 40).toLowerCase()}`;
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

function normalizeVariationEntry(entry, sizeMode = "one-size") {
  const normalizedSizeMode = normalizeSizeMode(sizeMode);
  const quantity = toWholeNumber(entry?.quantity, 0);
  const color = normalizeCatalogText(entry?.color, 60) || "Standard";
  const size = normalizedSizeMode === "one-size"
    ? ONE_SIZE_LABEL
    : normalizeSizeLabel(entry?.size, normalizedSizeMode) || "";

  return {
    id: entry?.id === null || entry?.id === undefined || entry?.id === "" ? null : Number(entry.id),
    color,
    size: size || (normalizedSizeMode === "one-size" ? ONE_SIZE_LABEL : ""),
    quantity,
    sku: normalizeCatalogText(entry?.sku, 80),
    availability_status: normalizeAvailabilityStatus(
      entry?.availability_status ?? entry?.availabilityStatus,
      quantity
    )
  };
}

function materializeProductCatalogShape(rawProduct = {}) {
  const sizeMode = normalizeSizeMode(rawProduct.size_mode || rawProduct.sizeMode);
  const quantityAvailable = toWholeNumber(rawProduct.quantity_available, 0);
  const incomingVariations = normalizeVariationList(rawProduct.variations);

  let variations = incomingVariations
    .map((entry) => normalizeVariationEntry(entry, sizeMode))
    .filter((entry) => entry.color && entry.size);

  if (!variations.length) {
    const fallbackColors = normalizeTextList(rawProduct.colors, 60);
    const fallbackSizes = sortSizes(normalizeTextList(rawProduct.sizes, 40), sizeMode);
    const fallbackColor = fallbackColors[0] || "Standard";
    const fallbackSize = sizeMode === "one-size" ? ONE_SIZE_LABEL : fallbackSizes[0] || "Standard";

    variations = [
      {
        id: null,
        color: fallbackColor,
        size: fallbackSize,
        quantity: quantityAvailable,
        sku: "",
        availability_status: normalizeAvailabilityStatus("in_stock", quantityAvailable)
      }
    ];
  }

  const colors = normalizeTextList(rawProduct.colors, 60);
  const sizes = sortSizes(normalizeTextList(rawProduct.sizes, 40), sizeMode);

  return {
    colors: colors.length ? colors : uniqueList(variations.map((entry) => entry.color)),
    size_mode: sizeMode,
    sizes: sizes.length ? sizes : sortSizes(variations.map((entry) => entry.size), sizeMode),
    variations,
    quantity_available: variations.reduce((sum, entry) => sum + toWholeNumber(entry.quantity, 0), 0)
  };
}

function isVariationAvailable(variation) {
  if (!variation) return false;
  return variation.availability_status === "in_stock" && Number(variation.quantity || 0) > 0;
}

module.exports = {
  ONE_SIZE_LABEL,
  SIZE_DISPLAY_ORDER,
  buildVariationKey,
  isVariationAvailable,
  materializeProductCatalogShape,
  normalizeAvailabilityStatus,
  normalizeCatalogText,
  normalizeSizeLabel,
  normalizeSizeMode,
  normalizeTextList,
  normalizeVariationEntry,
  slugifyProductName,
  sortSizes
};
