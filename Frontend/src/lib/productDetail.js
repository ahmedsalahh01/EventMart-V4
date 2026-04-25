export const ONE_SIZE_LABEL = "One Size";
export const MAX_CUSTOMIZATION_FILE_BYTES = 10 * 1024 * 1024;

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
  small: "Small",
  s: "Small",
  medium: "Medium",
  m: "Medium",
  large: "Large",
  l: "Large",
  xlarge: "X-Large",
  xl: "X-Large",
  extralarge: "X-Large",
  "2xl": "2X-Large",
  xxl: "2X-Large",
  "2xlarge": "2X-Large",
  "3xl": "3X-Large",
  xxxl: "3X-Large",
  "3xlarge": "3X-Large",
  "4xl": "4X-Large",
  xxxxl: "4X-Large",
  "4xlarge": "4X-Large",
  onesize: ONE_SIZE_LABEL,
  standard: ONE_SIZE_LABEL,
  default: ONE_SIZE_LABEL
});

const SIZE_SORT_INDEX = new Map(SIZE_DISPLAY_ORDER.map((size, index) => [size, index]));

const COLOR_SWATCH_MAP = Object.freeze({
  black: "#111827",
  blue: "#2563eb",
  brown: "#7c4a23",
  gold: "#ca8a04",
  green: "#059669",
  grey: "#6b7280",
  gray: "#6b7280",
  navy: "#1e3a8a",
  orange: "#ea580c",
  pink: "#ec4899",
  purple: "#7c3aed",
  red: "#dc2626",
  silver: "#9ca3af",
  white: "#f8fafc",
  yellow: "#eab308"
});

function normalizeText(value, maxLength = 120) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function uniqueList(values) {
  const seen = new Set();
  const next = [];

  values.forEach((value) => {
    const normalized = normalizeText(value, 120);
    if (!normalized) return;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    next.push(normalized);
  });

  return next;
}

export function normalizeTextList(value, maxItemLength = 60) {
  if (Array.isArray(value)) {
    return uniqueList(value.flatMap((item) => normalizeTextList(item, maxItemLength)).map((item) => item.slice(0, maxItemLength)));
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
        // Fall through.
      }
    }

    return uniqueList(
      trimmed
        .split(/\r?\n|,/)
        .map((item) => normalizeText(item, maxItemLength))
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

export function normalizeSizeMode(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "varied"
    ? "varied"
    : "one-size";
}

function normalizeSizeToken(value) {
  return normalizeText(value, 40)
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .replace(/-/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeSizeLabel(value, sizeMode = "varied") {
  if (normalizeSizeMode(sizeMode) === "one-size") {
    return ONE_SIZE_LABEL;
  }

  const raw = normalizeText(value, 40);
  if (!raw) return "";

  return SIZE_TOKEN_MAP[normalizeSizeToken(raw)] || raw;
}

export function sortSizes(sizes, sizeMode = "varied") {
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

function normalizeVariation(entry, sizeMode) {
  const normalizedSizeMode = normalizeSizeMode(sizeMode);
  const quantity = Math.max(0, Number(entry?.quantity || 0));
  const color = normalizeText(entry?.color, 60) || "Standard";
  const size = normalizedSizeMode === "one-size"
    ? ONE_SIZE_LABEL
    : normalizeSizeLabel(entry?.size, normalizedSizeMode) || "";
  const availabilityStatus = String(entry?.availability_status || entry?.availabilityStatus || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return {
    id: entry?.id === null || entry?.id === undefined || entry?.id === "" ? null : String(entry.id),
    color,
    size: size || (normalizedSizeMode === "one-size" ? ONE_SIZE_LABEL : ""),
    quantity,
    sku: normalizeText(entry?.sku, 80),
    availability_status:
      availabilityStatus === "unavailable" || availabilityStatus === "disabled"
        ? "unavailable"
        : quantity > 0
          ? "in_stock"
          : "out_of_stock"
  };
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

export function materializeProductDetail(product) {
  const sizeMode = normalizeSizeMode(product?.size_mode || product?.sizeMode);
  const incomingVariations = normalizeVariationList(product?.variations);

  let variations = incomingVariations
    .map((entry) => normalizeVariation(entry, sizeMode))
    .filter((entry) => entry.color && entry.size);

  if (!variations.length) {
    variations = [
      {
        id: null,
        color: normalizeTextList(product?.colors, 60)[0] || "Standard",
        size: sizeMode === "one-size" ? ONE_SIZE_LABEL : sortSizes(normalizeTextList(product?.sizes, 40), sizeMode)[0] || "Standard",
        quantity: Math.max(0, Number(product?.quantity_available || 0)),
        sku: "",
        availability_status: Math.max(0, Number(product?.quantity_available || 0)) > 0 ? "in_stock" : "out_of_stock"
      }
    ];
  }

  return {
    colors: normalizeTextList(product?.colors, 60).length
      ? normalizeTextList(product?.colors, 60)
      : uniqueList(variations.map((entry) => entry.color)),
    size_mode: sizeMode,
    sizes: sortSizes(
      normalizeTextList(product?.sizes, 40).length
        ? normalizeTextList(product?.sizes, 40)
        : variations.map((entry) => entry.size),
      sizeMode
    ),
    variations
  };
}

function isVariationSelectable(variation) {
  return variation.availability_status === "in_stock" && Number(variation.quantity || 0) > 0;
}

function firstMatchingVariation(variations, filters = {}) {
  return variations.find((variation) => {
    if (filters.color && variation.color !== filters.color) return false;
    if (filters.size && variation.size !== filters.size) return false;
    return isVariationSelectable(variation);
  }) || null;
}

export function buildProductOptionState(product, selection = {}) {
  const detail = materializeProductDetail(product);
  const sizeMode = detail.size_mode;
  const requestedColor = normalizeText(selection.color, 60);
  const requestedSize = normalizeSizeLabel(selection.size, sizeMode);

  let selectedColor = requestedColor;
  let selectedSize = sizeMode === "one-size" ? ONE_SIZE_LABEL : requestedSize;

  if (!detail.colors.includes(selectedColor)) {
    selectedColor = "";
  }

  if (sizeMode === "one-size") {
    if (!selectedColor) {
      selectedColor = firstMatchingVariation(detail.variations)?.color || detail.colors[0] || "";
    }
  } else {
    const sizeMatchesColor = detail.variations.some(
      (variation) => variation.color === selectedColor && variation.size === selectedSize
    );
    if (!selectedColor || !sizeMatchesColor) {
      selectedSize = "";
    }
  }

  const colors = detail.colors.map((color) => {
    const matching = detail.variations.filter((variation) => variation.color === color);
    const isAvailable = matching.some(isVariationSelectable);

    return {
      color,
      isAvailable,
      isDisabled: !isAvailable,
      isSelected: color === selectedColor
    };
  });

  const visibleSizes = sizeMode === "one-size"
    ? []
    : sortSizes(
        detail.variations
          .filter((variation) => variation.color === selectedColor)
          .map((variation) => variation.size),
        sizeMode
      );

  const sizes = sizeMode === "one-size"
    ? []
    : visibleSizes.map((size) => {
        const matching = detail.variations.filter((variation) => variation.size === size && variation.color === selectedColor);
        const isAvailable = matching.some(isVariationSelectable);

        return {
          size,
          isAvailable,
          isDisabled: !isAvailable,
          isSelected: size === selectedSize
        };
      });

  let activeVariation = null;

  if (sizeMode === "one-size") {
    activeVariation = detail.variations.find(
      (variation) =>
        variation.color === selectedColor &&
        variation.size === ONE_SIZE_LABEL
    ) || null;

    if (!activeVariation || !isVariationSelectable(activeVariation)) {
      activeVariation = firstMatchingVariation(detail.variations, {
        color: selectedColor,
        size: ONE_SIZE_LABEL
      });
    }

    if (!activeVariation) {
      activeVariation = firstMatchingVariation(detail.variations);
    }

    if (activeVariation) {
      selectedColor = activeVariation.color;
      selectedSize = activeVariation.size;
    }
  } else if (selectedColor && selectedSize) {
    activeVariation = detail.variations.find(
      (variation) =>
        variation.color === selectedColor &&
        variation.size === selectedSize
    ) || null;
  }

  return {
    ...detail,
    activeVariation,
    colors,
    selectedColor,
    selectedSize,
    sizes
  };
}

export function validateCustomizationFile(file, options = {}) {
  if (!file) return "";

  const maxBytes = Number(options.maxBytes || MAX_CUSTOMIZATION_FILE_BYTES);
  const fileName = String(file.name || "");
  const fileType = String(file.type || "").toLowerCase();
  const extension = fileName.toLowerCase().split(".").pop();
  const isAllowedType =
    fileType === "image/png" ||
    fileType === "image/jpeg" ||
    fileType === "image/webp" ||
    fileType === "application/pdf" ||
    extension === "png" ||
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "webp" ||
    extension === "pdf";

  if (!isAllowedType) {
    return "Only PNG, JPG, WEBP, and PDF files are supported.";
  }

  if (Number(file.size || 0) <= 0) {
    return "The selected file is empty.";
  }

  if (Number(file.size || 0) > maxBytes) {
    return "Each customization file must be 10 MB or smaller.";
  }

  return "";
}

export function getColorSwatchValue(color) {
  const normalized = normalizeText(color, 60).toLowerCase();
  if (COLOR_SWATCH_MAP[normalized]) {
    return COLOR_SWATCH_MAP[normalized];
  }

  if (/^[a-z]+$/.test(normalized)) {
    return normalized;
  }

  return "#cbd5e1";
}
