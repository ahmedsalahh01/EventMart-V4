const path = require("path");
const XLSX = require("xlsx");

const SUPPORTED_IMPORT_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);

const HEADER_ALIASES = Object.freeze({
  active: "active",
  base_price: "base_price",
  buy_enabled: "buy_enabled",
  buy_price: "buy_price",
  category: "category",
  colors: "colors",
  currency: "currency",
  customizable: "customizable",
  customization_fee: "customization_fee",
  delivery_class: "delivery_class",
  description: "description",
  event_type: "event_type",
  featured: "featured",
  image: "image_url",
  image_url: "image_url",
  image_urls: "image_urls",
  images: "image_urls",
  name: "name",
  overhead_cost: "overhead_cost",
  price: "base_price",
  product_id: "product_id",
  product_name: "name",
  quality: "quality",
  quality_points: "quality_points",
  quantity: "quantity",
  quantity_available: "quantity",
  rent_enabled: "rent_enabled",
  rent_price: "rent_price_per_day",
  rent_price_per_day: "rent_price_per_day",
  reorder_level: "reorder_level",
  sku: "sku",
  sizes: "sizes",
  stock: "quantity",
  subcategory: "subcategory",
  tags: "tags",
  unit_cost: "unit_cost",
  variation_group: "variation_group",
  variation_name: "variation_name",
  variation_quantity: "variation_quantity",
  variation_sku: "variation_sku",
  variation_value: "variation_value",
  venue_type: "venue_type"
});

function normalizeHeaderName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRowHeaders(row) {
  return Object.entries(row || {}).reduce((next, [rawHeader, value]) => {
    const normalizedHeader = normalizeHeaderName(rawHeader);
    const targetKey = HEADER_ALIASES[normalizedHeader] || normalizedHeader;

    if (!targetKey) {
      return next;
    }

    if (next[targetKey] === undefined || next[targetKey] === "") {
      next[targetKey] = value;
      return next;
    }

    if (value !== undefined && value !== null && value !== "") {
      next[targetKey] = value;
    }

    return next;
  }, {});
}

function getFileExtension(fileName = "") {
  return path.extname(String(fileName || "").trim()).toLowerCase();
}

function assertSupportedFileType(fileName = "") {
  const extension = getFileExtension(fileName);
  if (SUPPORTED_IMPORT_EXTENSIONS.has(extension)) {
    return extension;
  }

  throw new Error("Only CSV and XLSX product import files are supported.");
}

function parseProductImportBuffer({ buffer, originalName = "products.csv" } = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error("Import file is empty.");
  }

  assertSupportedFileType(originalName);

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    raw: false
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("The import file does not contain any sheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    blankrows: false,
    defval: "",
    raw: false
  });

  if (!rawRows.length) {
    throw new Error("The import file does not contain any product rows.");
  }

  return {
    fileType: getFileExtension(originalName).slice(1),
    rows: rawRows.map((row, index) => ({
      __rowNumber: index + 2,
      ...normalizeRowHeaders(row)
    })),
    sheetName: firstSheetName
  };
}

module.exports = {
  HEADER_ALIASES,
  SUPPORTED_IMPORT_EXTENSIONS,
  assertSupportedFileType,
  normalizeHeaderName,
  normalizeRowHeaders,
  parseProductImportBuffer
};
