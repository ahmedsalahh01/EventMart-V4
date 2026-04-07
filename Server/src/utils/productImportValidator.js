const { resolveEventType } = require("../lib/eventTypeConfig");
const { normalizeSizeLabel, normalizeSizeMode, normalizeTextList, sortSizes } = require("../lib/catalog");
const { isValidSku, normalizeSku } = require("./skuGenerator");

const PRODUCT_ID_REGEX = /^(?!00000)\d{5}$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

function normalizeText(value, maxLength = 240) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeProductId(value) {
  const digitsOnly = String(value || "").replace(/\D/g, "").slice(0, 5);
  return PRODUCT_ID_REGEX.test(digitsOnly) ? digitsOnly : "";
}

function splitDelimitedList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => splitDelimitedList(entry));
  }

  const raw = String(value || "").trim();
  if (!raw) return [];

  if (
    (raw.startsWith("[") && raw.endsWith("]")) ||
    (raw.startsWith("{") && raw.endsWith("}"))
  ) {
    try {
      return splitDelimitedList(JSON.parse(raw));
    } catch (_error) {
      // Fall through to delimiter splitting.
    }
  }

  return raw
    .split(/\r?\n|,|;/)
    .map((entry) => normalizeText(entry, 160))
    .filter(Boolean);
}

function parseBooleanValue(value, fieldLabel, errors) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;

  if (["true", "yes", "y", "1", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0", "off"].includes(normalized)) {
    return false;
  }

  errors.push(`Invalid ${fieldLabel}. Use yes/no, true/false, or 1/0.`);
  return null;
}

function parseOptionalNumber(value, fieldLabel, errors) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(number)) {
    errors.push(`Invalid ${fieldLabel}.`);
    return null;
  }

  return number;
}

function parseNonNegativeInteger(value, fieldLabel, errors) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isInteger(number) || number < 0) {
    errors.push(`Invalid ${fieldLabel}.`);
    return null;
  }

  return number;
}

function normalizeImportRow(rawRow = {}) {
  const errors = [];
  const rowNumber = Number(rawRow.__rowNumber || 0) || 0;
  const sku = normalizeText(rawRow.sku, 80);
  const variationSku = normalizeText(rawRow.variation_sku || rawRow.variant_sku, 80);
  const productId = normalizeProductId(rawRow.product_id);
  const eventTypeInput = normalizeText(rawRow.event_type, 120);
  const resolvedEventType = eventTypeInput ? resolveEventType(eventTypeInput) : "";
  const currency = normalizeText(rawRow.currency || "EGP", 3).toUpperCase();
  const variationColor = normalizeText(
    rawRow.variation_name || rawRow.color || rawRow.option_name,
    60
  );
  const variationValue = normalizeText(
    rawRow.variation_value || rawRow.size || rawRow.option_value,
    60
  );

  if (sku && !isValidSku(sku)) {
    errors.push("Invalid sku.");
  }

  if (variationSku && !isValidSku(variationSku)) {
    errors.push("Invalid variation_sku.");
  }

  if (String(rawRow.product_id || "").trim() && !productId) {
    errors.push("Product ID must be exactly 5 digits like 00001.");
  }

  if (!CURRENCY_REGEX.test(currency)) {
    errors.push("Currency must be a 3-letter code.");
  }

  if (eventTypeInput && !resolvedEventType) {
    errors.push("Unsupported event_type.");
  }

  const quantity = parseNonNegativeInteger(
    rawRow.quantity ?? rawRow.stock ?? rawRow.quantity_available,
    "quantity",
    errors
  );
  const variationQuantity = parseNonNegativeInteger(
    rawRow.variation_quantity,
    "variation_quantity",
    errors
  );
  const buyPrice = parseOptionalNumber(rawRow.buy_price, "buy_price", errors);
  const rentPrice = parseOptionalNumber(
    rawRow.rent_price_per_day ?? rawRow.rent_price,
    "rent_price",
    errors
  );
  const basePrice = parseOptionalNumber(rawRow.base_price, "base_price", errors);
  const unitCost = parseOptionalNumber(rawRow.unit_cost, "unit_cost", errors);
  const overheadCost = parseOptionalNumber(rawRow.overhead_cost, "overhead_cost", errors);
  const reorderLevel = parseNonNegativeInteger(rawRow.reorder_level, "reorder_level", errors);
  const customizationFee = parseOptionalNumber(
    rawRow.customization_fee,
    "customization_fee",
    errors
  );

  return {
    errors,
    value: {
      rowNumber,
      sku: sku ? normalizeSku(sku) : "",
      product_id: productId,
      name: normalizeText(rawRow.name, 160),
      description: normalizeText(rawRow.description, 4000),
      category: normalizeText(rawRow.category, 120),
      subcategory: normalizeText(rawRow.subcategory, 120),
      event_type: resolvedEventType,
      buy_price: buyPrice,
      rent_price_per_day: rentPrice,
      base_price: basePrice,
      quantity,
      customizable: parseBooleanValue(rawRow.customizable, "customizable", errors),
      active: parseBooleanValue(rawRow.active, "active", errors),
      featured: parseBooleanValue(rawRow.featured, "featured", errors),
      image_url: normalizeText(rawRow.image_url, 2048),
      image_urls: splitDelimitedList(rawRow.image_urls || rawRow.images),
      tags: normalizeTextList(splitDelimitedList(rawRow.tags), 60),
      variation_group: normalizeText(rawRow.variation_group, 120),
      variation_name: variationColor,
      variation_value: variationValue,
      variation_sku: variationSku ? normalizeSku(variationSku) : "",
      variation_quantity: variationQuantity,
      customization_fee: customizationFee,
      venue_type: normalizeText(rawRow.venue_type, 120),
      delivery_class: normalizeText(rawRow.delivery_class, 120),
      quality: normalizeText(rawRow.quality, 160),
      quality_points: normalizeTextList(splitDelimitedList(rawRow.quality_points), 140),
      colors: normalizeTextList(splitDelimitedList(rawRow.colors), 60),
      sizes: normalizeTextList(splitDelimitedList(rawRow.sizes), 40),
      currency,
      buy_enabled: parseBooleanValue(rawRow.buy_enabled, "buy_enabled", errors),
      rent_enabled: parseBooleanValue(rawRow.rent_enabled, "rent_enabled", errors),
      unit_cost: unitCost,
      overhead_cost: overheadCost,
      reorder_level: reorderLevel
    }
  };
}

function coalesceValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && !value.length) continue;
    return value;
  }

  return null;
}

function mergeUniqueLists(...values) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
        .map((entry) => normalizeText(entry, 2048))
        .filter(Boolean)
    )
  );
}

function buildVariationEntries(rows, {
  colors = [],
  quantity = 0,
  sizeMode = "one-size"
} = {}) {
  const normalizedSizeMode = normalizeSizeMode(sizeMode);
  const variations = [];
  const seen = new Set();

  rows.forEach((row) => {
    const color = row.variation_name || row.colors[0] || colors[0] || "Standard";
    const size = normalizedSizeMode === "one-size"
      ? "One Size"
      : normalizeSizeLabel(row.variation_value || row.sizes[0] || "", normalizedSizeMode) || "";
    const nextQuantity = row.variation_quantity ?? row.quantity ?? quantity ?? 0;
    const variation = {
      color,
      size: normalizedSizeMode === "one-size" ? "One Size" : size || "Standard",
      quantity: Math.max(0, Number(nextQuantity || 0)),
      sku: row.variation_sku || "",
      availability_status: Number(nextQuantity || 0) > 0 ? "in_stock" : "out_of_stock"
    };
    const key = `${variation.color.toLowerCase()}::${variation.size.toLowerCase()}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    variations.push(variation);
  });

  return variations;
}

function buildImportProduct(rows) {
  const groupRows = Array.isArray(rows) ? rows : [];
  const firstRow = groupRows[0] || {};
  const errors = [];

  const name = normalizeText(coalesceValue(...groupRows.map((row) => row.name)), 160);
  const category = normalizeText(coalesceValue(...groupRows.map((row) => row.category)), 120);
  const subcategory = normalizeText(coalesceValue(...groupRows.map((row) => row.subcategory)), 120);
  const quantity = Number(coalesceValue(...groupRows.map((row) => row.quantity), 0) || 0);
  const explicitSizes = mergeUniqueLists(...groupRows.map((row) => row.sizes));
  const hasVariationValues = groupRows.some((row) => row.variation_value);
  const sizeMode = hasVariationValues || explicitSizes.length ? "varied" : "one-size";
  const colors = mergeUniqueLists(...groupRows.map((row) => row.colors));
  const variations = buildVariationEntries(groupRows, {
    colors,
    quantity,
    sizeMode
  });
  const mergedColors = colors.length
    ? colors
    : Array.from(new Set(variations.map((variation) => variation.color).filter(Boolean)));
  const mergedSizes = sizeMode === "one-size"
    ? []
    : sortSizes(
      explicitSizes.length
        ? explicitSizes
        : variations.map((variation) => variation.size),
      sizeMode
    );
  const quantityAvailable = variations.length
    ? variations.reduce((sum, variation) => sum + Number(variation.quantity || 0), 0)
    : Math.max(0, quantity);
  const buyPrice = coalesceValue(...groupRows.map((row) => row.buy_price), firstRow.base_price);
  const rentPrice = coalesceValue(...groupRows.map((row) => row.rent_price_per_day));
  const explicitBuyEnabled = coalesceValue(...groupRows.map((row) => row.buy_enabled));
  const explicitRentEnabled = coalesceValue(...groupRows.map((row) => row.rent_enabled));
  const buyEnabled = explicitBuyEnabled === null ? null : Boolean(explicitBuyEnabled);
  const rentEnabled = explicitRentEnabled === null ? null : Boolean(explicitRentEnabled);

  if (!name) errors.push("Missing name.");
  if (!category) errors.push("Missing category.");
  if (!subcategory) errors.push("Missing subcategory.");
  if (!mergedColors.length) {
    errors.push("At least one color is required.");
  }

  if (sizeMode === "varied" && !mergedSizes.length) {
    errors.push("Varied products require at least one size.");
  }

  return {
    errors,
    value: {
      sku: firstRow.sku || "",
      product_id: firstRow.product_id || "",
      name,
      description: normalizeText(coalesceValue(...groupRows.map((row) => row.description)) || "", 4000),
      category,
      subcategory,
      event_type: coalesceValue(...groupRows.map((row) => row.event_type)) || "",
      buy_price: buyPrice,
      rent_price_per_day: rentPrice,
      base_price: firstRow.base_price ?? buyPrice ?? rentPrice ?? null,
      quantity_available: quantityAvailable,
      customizable: coalesceValue(...groupRows.map((row) => row.customizable)),
      active: coalesceValue(...groupRows.map((row) => row.active)),
      featured: coalesceValue(...groupRows.map((row) => row.featured)),
      images: mergeUniqueLists(
        ...groupRows.flatMap((row) => [row.image_url, ...(Array.isArray(row.image_urls) ? row.image_urls : [])])
      ),
      tags: mergeUniqueLists(...groupRows.map((row) => row.tags)),
      quality: normalizeText(coalesceValue(...groupRows.map((row) => row.quality)) || "", 160),
      quality_points: mergeUniqueLists(...groupRows.map((row) => row.quality_points)),
      colors: mergedColors,
      size_mode: sizeMode,
      sizes: mergedSizes,
      currency: coalesceValue(...groupRows.map((row) => row.currency), "EGP") || "EGP",
      buy_enabled: buyEnabled,
      rent_enabled: rentEnabled,
      unit_cost: Number(coalesceValue(...groupRows.map((row) => row.unit_cost), 0) || 0),
      overhead_cost: Number(coalesceValue(...groupRows.map((row) => row.overhead_cost), 0) || 0),
      reorder_level: Number(coalesceValue(...groupRows.map((row) => row.reorder_level), 0) || 0),
      customization_fee: Number(coalesceValue(...groupRows.map((row) => row.customization_fee), 0) || 0),
      venue_type: normalizeText(coalesceValue(...groupRows.map((row) => row.venue_type)) || "", 120),
      delivery_class: normalizeText(coalesceValue(...groupRows.map((row) => row.delivery_class)) || "", 120),
      variations
    }
  };
}

module.exports = {
  CURRENCY_REGEX,
  PRODUCT_ID_REGEX,
  buildImportProduct,
  normalizeImportRow,
  normalizeProductId,
  parseBooleanValue,
  splitDelimitedList
};
