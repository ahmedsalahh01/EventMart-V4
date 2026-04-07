const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const pool = require("./db");
const {
  deleteManagedProductImage,
  isManagedProductImageUrl: isManagedCloudinaryProductImageUrl,
  uploadProductImageBuffer: uploadProductImageToCloudinary
} = require("./lib/cloudinary");
const {
  ONE_SIZE_LABEL,
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
} = require("./lib/catalog");
const {
  authorizeAdvancePayment,
  buildPublicOrderId,
  buildShippingSummary,
  calculateDeliveryEstimate,
  extractEgyptAddressFromReversePayload,
  isCoordinateWithinEgypt,
  normalizeOrderCartItems,
  roundCurrency,
  validateCheckoutSubmission
} = require("./lib/checkout");
const { applyPricingToResolvedLines, getBuilderCategory, normalizePackageMeta } = require("./lib/packageBuilder");
const createAdminProductsRouter = require("./routes/adminProducts");
const createPackagesRouter = require("./routes/packages");
const recommendationRouter = require("./routes/recommendations");
require("dotenv").config();

const fsp = fs.promises;

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "eventmart_dev_secret_change_me";
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const FRONTEND_URL = process.env.FRONTEND_URL || "";
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");
const PRODUCT_UPLOADS_DIR = path.join(UPLOADS_DIR, "products");
const PRIVATE_UPLOADS_DIR = path.resolve(__dirname, "../private-uploads");
const CUSTOMIZATION_UPLOADS_DIR = path.join(PRIVATE_UPLOADS_DIR, "customizations");
const MAX_PRODUCT_IMAGES = 10;
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CUSTOMIZATION_UPLOAD_BYTES = 10 * 1024 * 1024;
const PRODUCT_CATALOG_CACHE_TTL_MS = 15000;
const DATA_IMAGE_URL_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/;
const PRODUCT_IMAGE_UPLOAD_PARSER = express.raw({ limit: "10mb", type: () => true });
const CUSTOMIZATION_UPLOAD_PARSER = express.raw({ limit: "12mb", type: () => true });
const CUSTOMIZATION_UPLOAD_KIND_SET = new Set(["mockup", "design"]);
const CUSTOMIZATION_UPLOAD_EXTENSIONS = Object.freeze({
  "application/pdf": "pdf",
  "image/png": "png"
});
const CUSTOMIZATION_UPLOAD_ALLOWED_EXTENSIONS = new Set(["pdf", "png"]);
const productCatalogCache = {
  expiresAt: 0,
  rows: null
};

const allowedOrigins = Array.from(
  new Set(
    [
      "https://event-mart-v4.vercel.app",
      "http://localhost:5173",
      "http://localhost:5174",
      FRONTEND_URL
    ].filter(Boolean)
  )
);

function isLocalOriginHost(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]";
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const { hostname, protocol } = new URL(origin);

    if (protocol !== "http:" && protocol !== "https:") {
      return false;
    }

    if (isLocalOriginHost(hostname)) {
      return true;
    }

    if (hostname.endsWith(".vercel.app")) {
      return true;
    }
  } catch (_error) {
    return false;
  }

  return false;
}

const corsOptions = {
  origin(origin, callback) {
    console.log("CORS Origin Check:", origin || "(none)");
    console.log("Allowed Origins:", allowedOrigins);

    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use((req, _res, next) => {
  console.log("Request Origin:", req.headers.origin || "(none)");
  next();
});

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

app.use(express.json({ limit: "120mb" }));
app.use("/api/recommendations", recommendationRouter);
app.use("/api/admin/products", createAdminProductsRouter({ pool }));
app.use("/api", createPackagesRouter({ pool }));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use((error, _req, res, next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Uploaded images are too large. Keep each image under 5 MB."
    });
  }

  return next(error);
});

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeUser(userRow) {
  return {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    role: userRow.role,
    created_at: userRow.created_at,
    last_login_at: userRow.last_login_at
  };
}

function createAuthToken(userRow) {
  return jwt.sign(
    {
      sub: userRow.id,
      email: userRow.email,
      role: userRow.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice(7).trim();
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = Number(decoded.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ error: "Invalid token payload." });
    }
    req.auth = {
      userId,
      email: decoded.email,
      role: decoded.role
    };
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

async function ensureSchema() {
  try {
    const schemaPath = path.resolve(__dirname, "../schema.sql");
    console.log("Looking for schema at:", schemaPath);

    if (!fs.existsSync(schemaPath)) {
      console.error("schema.sql not found. Skipping schema setup.");
      return;
    }

    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    if (!schemaSql.trim()) {
      console.error("schema.sql is empty. Skipping schema setup.");
      return;
    }

    await pool.query(schemaSql);
    console.log("Schema applied successfully.");
  } catch (error) {
    console.error("Schema setup failed:", error.message);
  }
}

function formatUsd(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function summarizeProductCatalog(rows) {
  return rows.slice(0, 45).map((row) => {
    const mode =
      row.buy_enabled && row.rent_enabled
        ? "buy/rent"
        : row.buy_enabled
          ? "buy"
          : row.rent_enabled
            ? "rent"
            : "n/a";

    return {
      id: row.id,
      product_id: row.product_id,
      name: row.name,
      category: row.category,
      mode,
      buy_price: row.buy_price,
      rent_price_per_day: row.rent_price_per_day
    };
  });
}

function fallbackPlannerReply(prompt, context, products) {
  const eventType = String(context?.eventType || "Event");
  const attendees = Number(context?.attendees || 0) || 100;
  const budget = Number(context?.budget || 0) || 5000;
  const venue = String(context?.venue || "Indoor");

  const categoryHints = {
    wedding: ["wood", "sound", "stage"],
    "private-party": ["merch", "giveaway", "sound"],
    birthday: ["merch", "sound", "wood"],
    corporate: ["sound", "stage", "wood"],
    outdoor: ["stage", "sound", "screen"],
    indoor: ["light", "sound", "screen"]
  };

  const hints = categoryHints[eventType.toLowerCase()] || [];
  const picked = products
    .filter((item) => {
      if (!hints.length) return true;
      const c = String(item.category || "").toLowerCase();
      return hints.some((hint) => c.includes(hint));
    })
    .slice(0, 5);

  const lines = [
    `### Your ${eventType} Plan`,
    `- **Attendees:** ${attendees}`,
    `- **Venue:** ${venue}`,
    `- **Budget:** ${formatUsd(budget)}`,
    "",
    "### Recommended Products"
  ];

  if (picked.length === 0) {
    lines.push("- No products found yet. Add products from Admin to get matching recommendations.");
  } else {
    picked.forEach((item) => {
      const price = Number.isFinite(Number(item.buy_price))
        ? formatUsd(item.buy_price)
        : Number.isFinite(Number(item.rent_price_per_day))
          ? `${formatUsd(item.rent_price_per_day)}/day`
          : "Price unavailable";

      lines.push(`- **${item.name}** (${item.mode}) - ${price}`);
    });
  }

  lines.push(
    "",
    "### Suggested Timeline",
    "- 8 weeks before: confirm venue and core equipment",
    "- 4 weeks before: finalize quantities and delivery",
    "- 1 week before: setup rehearsal and crew checklist",
    "- Event day: setup starts 4-6 hours before guests",
    "",
    `You can refine this plan by adding more details to: "${prompt}".`
  );

  return lines.join("\n");
}

const PRODUCT_ID_REGEX = /^(?!00000)\d{5}$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

function normalizeImageSourceList(value) {
  const list = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];

  return list
    .flatMap((item) => {
      if (Array.isArray(item)) return normalizeImageSourceList(item);
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (!trimmed) return [];

        if (
          (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
          (trimmed.startsWith("{") && trimmed.endsWith("}"))
        ) {
          try {
            return normalizeImageSourceList(JSON.parse(trimmed));
          } catch (_error) {
            return [trimmed];
          }
        }

        return [trimmed];
      }
      if (item && typeof item === "object") {
        return normalizeImageSourceList(
          item.value || item.url || item.src || item.preview_url || ""
        );
      }
      return [];
    });
}

function mergeUniqueImageSourceLists(...values) {
  const seen = new Set();
  const merged = [];

  values.forEach((value) => {
    normalizeImageSourceList(value).forEach((image) => {
      if (!seen.has(image)) {
        seen.add(image);
        merged.push(image);
      }
    });
  });

  return merged;
}

function resolveProductImageCollections(row) {
  const images = mergeUniqueImageSourceLists(
    row?.images,
    row?.light_images,
    row?.dark_images,
    row?.image_url
  );
  const legacyImageUrl = String(row?.image_url || "").trim();

  return {
    dark_images: images,
    image_url: images[0] || legacyImageUrl,
    images,
    light_images: images
  };
}

function getImageExtensionForMimeType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();

  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/svg+xml") return "svg";
  if (normalized === "image/avif") return "avif";
  if (normalized === "image/bmp") return "bmp";

  return "bin";
}

function getImageExtensionFromFilename(fileName) {
  const extension = path.extname(String(fileName || "")).toLowerCase().replace(/^\./, "");
  return extension.replace(/[^a-z0-9]/g, "").slice(0, 10);
}

function sanitizeStoredFilename(fileName) {
  return path
    .basename(String(fileName || "product-image"))
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isSupportedImageExtension(extension) {
  return ["avif", "bmp", "gif", "jpg", "jpeg", "png", "svg", "webp"].includes(
    String(extension || "").toLowerCase()
  );
}

function getPreferredImageExtension({ fileName, mimeType }) {
  const fromMimeType = getImageExtensionForMimeType(mimeType);
  if (fromMimeType !== "bin") return fromMimeType;

  const fromFileName = getImageExtensionFromFilename(fileName);
  return fromFileName || "bin";
}

function parseProductCode(value) {
  const rawValue = String(value || "").trim();
  const digitsOnly = rawValue.replace(/\D/g, "");
  const productCode = PRODUCT_ID_REGEX.test(rawValue)
    ? rawValue
    : PRODUCT_ID_REGEX.test(digitsOnly)
      ? digitsOnly
      : "";

  if (!PRODUCT_ID_REGEX.test(productCode)) {
    throw createHttpError(400, "product_id must be exactly 5 digits like 00001.");
  }

  return productCode;
}

function decodeImageDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(DATA_IMAGE_URL_REGEX);
  if (!match) {
    throw createHttpError(400, "Uploaded product images must be valid image files.");
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  if (!buffer.length) {
    throw createHttpError(400, "Uploaded product images cannot be empty.");
  }

  if (buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw createHttpError(400, "Each uploaded product image must be 5 MB or smaller.");
  }

  return {
    buffer,
    extension: getImageExtensionForMimeType(mimeType),
    mimeType
  };
}

function isManagedProductUploadUrl(url) {
  return (
    String(url || "").startsWith("/uploads/products/") ||
    isManagedCloudinaryProductImageUrl(url)
  );
}

function getManagedUploadPathFromUrl(url) {
  const normalized = String(url || "").trim();
  if (!normalized.startsWith("/uploads/")) return null;

  const relativePath = normalized.replace(/^\/uploads\//, "");
  const absolutePath = path.resolve(UPLOADS_DIR, relativePath);

  if (!absolutePath.startsWith(UPLOADS_DIR)) {
    return null;
  }

  return absolutePath;
}

async function pruneEmptyDirectories(filePath, rootDir) {
  let currentDir = path.dirname(filePath);
  const safeRootDir = path.resolve(rootDir);

  while (currentDir.startsWith(safeRootDir) && currentDir !== safeRootDir) {
    try {
      await fsp.rmdir(currentDir);
    } catch (error) {
      if (error?.code === "ENOENT") {
        currentDir = path.dirname(currentDir);
        continue;
      }

      if (error?.code === "ENOTEMPTY" || error?.code === "EPERM") {
        break;
      }

      break;
    }

    currentDir = path.dirname(currentDir);
  }
}

async function removeManagedProductUploadUrl(url) {
  if (isManagedCloudinaryProductImageUrl(url)) {
    try {
      await deleteManagedProductImage(url);
    } catch (error) {
      console.warn("IMAGE CLEANUP WARNING:", error.message);
    }
    return;
  }

  const absolutePath = getManagedUploadPathFromUrl(url);
  if (!absolutePath) return;

  try {
    await fsp.unlink(absolutePath);
    await pruneEmptyDirectories(absolutePath, PRODUCT_UPLOADS_DIR);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("IMAGE CLEANUP WARNING:", error.message);
    }
  }
}

async function saveUploadedProductImageBuffer(productCode, buffer, { fileName, mimeType }) {
  const upload = await uploadProductImageToCloudinary(buffer, {
    fileName: `${sanitizeStoredFilename(fileName) || "product-image"}.${getPreferredImageExtension({ fileName, mimeType })}`,
    folderSegments: ["catalog", productCode, "shared"],
    mimeType
  });

  return upload.secureUrl;
}

async function saveProductImageDataUrl(productCode, sortOrder, dataUrl) {
  const { buffer, extension, mimeType } = decodeImageDataUrl(dataUrl);
  const upload = await uploadProductImageToCloudinary(buffer, {
    fileName: `inline-${sortOrder}.${extension}`,
    folderSegments: ["catalog", productCode, "shared"],
    mimeType
  });

  return upload.secureUrl;
}

async function materializeProductImages(productCode, imageSources, createdUploadUrls) {
  const resolvedUrls = [];

  for (let index = 0; index < imageSources.length; index += 1) {
    const source = imageSources[index];
    if (DATA_IMAGE_URL_REGEX.test(source)) {
      const storedUrl = await saveProductImageDataUrl(productCode, index, source);
      createdUploadUrls.push(storedUrl);
      resolvedUrls.push(storedUrl);
      continue;
    }

    resolvedUrls.push(source);
  }

  return resolvedUrls;
}

async function cleanupUnusedProductUploads(previousUrls, nextUrls) {
  const nextSet = new Set(nextUrls);
  const staleUrls = previousUrls.filter(
    (url) => isManagedProductUploadUrl(url) && !nextSet.has(url)
  );

  await Promise.all(staleUrls.map(removeManagedProductUploadUrl));
}

function parseCustomizationUploadKind(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (CUSTOMIZATION_UPLOAD_KIND_SET.has(normalized)) {
    return normalized;
  }

  throw createHttpError(400, "upload_kind must be either 'mockup' or 'design'.");
}

function getCustomizationUploadExtension({ fileName, mimeType }) {
  const normalizedMimeType = String(mimeType || "").toLowerCase();
  if (CUSTOMIZATION_UPLOAD_EXTENSIONS[normalizedMimeType]) {
    return CUSTOMIZATION_UPLOAD_EXTENSIONS[normalizedMimeType];
  }

  const fromFileName = getImageExtensionFromFilename(fileName);
  if (CUSTOMIZATION_UPLOAD_ALLOWED_EXTENSIONS.has(fromFileName)) {
    return fromFileName;
  }

  return "";
}

async function saveCustomizationUploadBuffer({
  buffer,
  fileName,
  mimeType,
  productCode,
  uploadToken,
  userId
}) {
  const extension = getCustomizationUploadExtension({ fileName, mimeType });

  if (!extension) {
    throw createHttpError(400, "Only PNG and PDF files are supported.");
  }

  if (!buffer.length) {
    throw createHttpError(400, "Uploaded customization files cannot be empty.");
  }

  if (buffer.length > MAX_CUSTOMIZATION_UPLOAD_BYTES) {
    throw createHttpError(400, "Each customization file must be 10 MB or smaller.");
  }

  const targetDir = path.join(CUSTOMIZATION_UPLOADS_DIR, String(productCode || "product"), String(userId || "guest"));
  await fsp.mkdir(targetDir, { recursive: true });

  const storedPath = path.join(targetDir, `${uploadToken}.${extension}`);
  await fsp.writeFile(storedPath, buffer);

  return storedPath;
}

async function removeManagedCustomizationFile(filePath) {
  const absolutePath = path.resolve(String(filePath || ""));
  if (!absolutePath.startsWith(PRIVATE_UPLOADS_DIR)) return;

  try {
    await fsp.unlink(absolutePath);
    await pruneEmptyDirectories(absolutePath, CUSTOMIZATION_UPLOADS_DIR);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("CUSTOMIZATION CLEANUP WARNING:", error.message);
    }
  }
}

const PRODUCT_SELECT_SQL = `
  SELECT
    p.id,
    p.product_id,
    p.sku,
    p.name,
    p.slug,
    p.category,
    p.subcategory,
    p.description,
    p.quality,
    p.quality_points,
    COALESCE(p.colors, '[]'::jsonb) AS colors,
    COALESCE(p.size_mode, 'one-size') AS size_mode,
    COALESCE(p.sizes, '[]'::jsonb) AS sizes,
    COALESCE(p.customizable, FALSE) AS customizable,
    p.buy_enabled,
    p.rent_enabled,
    p.buy_price,
    p.rent_price_per_day,
    COALESCE(p.base_price, p.buy_price, p.rent_price_per_day) AS base_price,
    p.currency,
    COALESCE(p.event_type, '') AS event_type,
    COALESCE(p.tags, '[]'::jsonb) AS tags,
    COALESCE(p.customization_fee, 0) AS customization_fee,
    COALESCE(p.venue_type, '') AS venue_type,
    COALESCE(p.delivery_class, '') AS delivery_class,
    p.featured,
    p.active,
    p.created_at,
    p.updated_at,
    COALESCE(var.total_quantity, inv.quantity_available, 0)::INT AS quantity_available,
    COALESCE(inv.reorder_level, 0)::INT AS reorder_level,
    COALESCE(cost.unit_cost, 0) AS unit_cost,
    COALESCE(cost.overhead_cost, 0) AS overhead_cost,
    COALESCE(var.variations, '[]'::json) AS variations,
    COALESCE(img.light_images, '[]'::json) AS light_images,
    COALESCE(img.dark_images, '[]'::json) AS dark_images,
    COALESCE(img.image_url, '') AS image_url
  FROM products p
  LEFT JOIN product_inventory inv ON inv.product_id = p.id
  LEFT JOIN product_costs cost ON cost.product_id = p.id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', pv.id,
            'color', pv.color,
            'size', pv.size,
            'quantity', pv.quantity,
            'sku', pv.sku,
            'availability_status', pv.availability_status
          )
          ORDER BY pv.color ASC, pv.size ASC, pv.id ASC
        ),
        '[]'::json
      ) AS variations,
      CASE
        WHEN COUNT(pv.id) = 0 THEN NULL
        ELSE COALESCE(SUM(pv.quantity), 0)::INT
      END AS total_quantity
    FROM product_variations pv
    WHERE pv.product_id = p.id
  ) var ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        JSON_AGG(url ORDER BY sort_order ASC, id ASC) FILTER (WHERE theme_mode = 'light'),
        '[]'::json
      ) AS light_images,
      COALESCE(
        JSON_AGG(url ORDER BY sort_order ASC, id ASC) FILTER (WHERE theme_mode = 'dark'),
        '[]'::json
      ) AS dark_images,
      COALESCE(
        (
          SELECT url
          FROM product_images pi_primary
          WHERE pi_primary.product_id = p.id AND pi_primary.theme_mode = 'light'
          ORDER BY pi_primary.sort_order ASC, pi_primary.id ASC
          LIMIT 1
        ),
        (
          SELECT url
          FROM product_images pi_fallback
          WHERE pi_fallback.product_id = p.id AND pi_fallback.theme_mode = 'dark'
          ORDER BY pi_fallback.sort_order ASC, pi_fallback.id ASC
          LIMIT 1
        ),
        ''
      ) AS image_url
    FROM product_images
    WHERE product_id = p.id
  ) img ON TRUE
`;

function materializeProductRow(row) {
  const imageCollections = resolveProductImageCollections(row);
  const catalogShape = materializeProductCatalogShape({
    colors: row?.colors,
    quantity_available: row?.quantity_available,
    size_mode: row?.size_mode,
    sizes: row?.sizes,
    variations: row?.variations
  });

  return {
    ...row,
    ...imageCollections,
    slug: normalizeCatalogText(row?.slug, 180) || slugifyProductName(row?.name, row?.product_id || row?.id),
    quality: normalizeCatalogText(row?.quality, 160),
    colors: catalogShape.colors,
    size_mode: catalogShape.size_mode,
    sizes: catalogShape.sizes,
    customizable: Boolean(row?.customizable),
    variations: catalogShape.variations,
    quantity_available: catalogShape.quantity_available
  };
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseOptionalNumber(value, fieldLabel) {
  if (value === null || value === undefined || value === "") return null;

  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw createHttpError(400, `${fieldLabel} must be a valid number.`);
  }
  if (num < 0) {
    throw createHttpError(400, `${fieldLabel} cannot be negative.`);
  }

  return num;
}

function parseWholeNumber(value, fieldLabel) {
  if (value === null || value === undefined || value === "") return 0;

  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    throw createHttpError(400, `${fieldLabel} must be a non-negative whole number.`);
  }

  return num;
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }

  return fallback;
}

function normalizeQualityPoints(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeVariationPayloadList(value, sizeMode, fallbackQuantity) {
  const normalizedSizeMode = normalizeSizeMode(sizeMode);
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();

  const variations = list.map((entry, index) => {
    const color = normalizeCatalogText(entry?.color, 60);
    const size = normalizedSizeMode === "one-size"
      ? ONE_SIZE_LABEL
      : normalizeSizeLabel(entry?.size, normalizedSizeMode);

    if (!color) {
      throw createHttpError(400, `Variation ${index + 1} must include a color.`);
    }

    if (!size) {
      throw createHttpError(400, `Variation ${index + 1} must include a size.`);
    }

    const quantity = parseWholeNumber(entry?.quantity, `Variation ${index + 1} quantity`);
    const key = buildVariationKey(color, size);

    if (seen.has(key)) {
      throw createHttpError(400, `Duplicate variation found for ${color} / ${size}.`);
    }

    seen.add(key);

    return {
      color,
      size,
      quantity,
      sku: normalizeCatalogText(entry?.sku, 80),
      availability_status: normalizeAvailabilityStatus(
        entry?.availability_status ?? entry?.availabilityStatus,
        quantity
      )
    };
  });

  if (variations.length) {
    return variations;
  }

  return [
    {
      color: "Standard",
      size: normalizedSizeMode === "one-size" ? ONE_SIZE_LABEL : "Standard",
      quantity: Math.max(0, Number(fallbackQuantity || 0)),
      sku: "",
      availability_status: normalizeAvailabilityStatus("in_stock", fallbackQuantity)
    }
  ];
}

function normalizeProductPayload(body) {
  const rawProductId = String(body?.product_id || "").trim();
  const digitsOnlyProductId = rawProductId.replace(/\D/g, "");
  const productId = PRODUCT_ID_REGEX.test(rawProductId)
    ? rawProductId
    : PRODUCT_ID_REGEX.test(digitsOnlyProductId)
      ? digitsOnlyProductId
      : "";

  const name = String(body?.name || "").trim();
  const category = String(body?.category || "").trim();
  const subcategory = String(body?.subcategory || "").trim();
  const description = String(body?.description || "").trim();
  const quality = normalizeCatalogText(body?.quality, 160);
  const currency = String(body?.currency || "USD")
    .trim()
    .toUpperCase();
  const sizeMode = normalizeSizeMode(body?.size_mode || body?.sizeMode);
  const legacyImageUrl = String(body?.image_url || "").trim();
  const images = mergeUniqueImageSourceLists(
    body?.images,
    body?.light_images,
    body?.dark_images,
    legacyImageUrl
  );
  const quantityAvailable = parseWholeNumber(body?.quantity_available, "Quantity available");
  const variations = normalizeVariationPayloadList(body?.variations, sizeMode, quantityAvailable);
  const colors = normalizeTextList(body?.colors, 60);
  const sizes = sortSizes(normalizeTextList(body?.sizes, 40), sizeMode);

  if (!PRODUCT_ID_REGEX.test(productId)) {
    throw createHttpError(400, "Product ID must be exactly 5 digits like 00001.");
  }
  if (!name) throw createHttpError(400, "Product name is required.");
  if (!category) throw createHttpError(400, "Category is required.");
  if (!subcategory) throw createHttpError(400, "Subcategory is required.");
  if (!CURRENCY_REGEX.test(currency)) {
    throw createHttpError(400, "Currency must be a 3-letter ISO code like USD or EGP.");
  }

  const buyEnabled = parseBoolean(body?.buy_enabled, true);
  const rentEnabled = parseBoolean(body?.rent_enabled, false);

  if (!buyEnabled && !rentEnabled) {
    throw createHttpError(400, "Enable at least Buy or Rent.");
  }

  if (images.length > MAX_PRODUCT_IMAGES) {
    throw createHttpError(400, "A product can have up to 10 images.");
  }

  const catalogShape = materializeProductCatalogShape({
    colors,
    quantity_available: quantityAvailable,
    size_mode: sizeMode,
    sizes,
    variations
  });

  if (!catalogShape.colors.length) {
    throw createHttpError(400, "At least one product color is required.");
  }

  if (catalogShape.size_mode === "varied" && !catalogShape.sizes.length) {
    throw createHttpError(400, "Varied-size products must include at least one size.");
  }

  const allowedColors = new Set(catalogShape.colors.map((entry) => entry.toLowerCase()));
  const allowedSizes = new Set(catalogShape.sizes.map((entry) => entry.toLowerCase()));

  catalogShape.variations.forEach((variation, index) => {
    if (!allowedColors.has(String(variation.color || "").toLowerCase())) {
      throw createHttpError(400, `Variation ${index + 1} color must match one of the product colors.`);
    }

    if (
      catalogShape.size_mode === "varied" &&
      !allowedSizes.has(String(variation.size || "").toLowerCase())
    ) {
      throw createHttpError(400, `Variation ${index + 1} size must match one of the product sizes.`);
    }
  });

  return {
    product_id: productId,
    slug: slugifyProductName(name, productId),
    name,
    category,
    subcategory,
    description,
    quality,
    quality_points: normalizeQualityPoints(body?.quality_points),
    colors: catalogShape.colors,
    size_mode: catalogShape.size_mode,
    sizes: catalogShape.sizes,
    customizable: parseBoolean(body?.customizable, false),
    variations: catalogShape.variations,
    buy_enabled: buyEnabled,
    rent_enabled: rentEnabled,
    buy_price: parseOptionalNumber(body?.buy_price, "Buy price"),
    rent_price_per_day: parseOptionalNumber(body?.rent_price_per_day, "Rent price / day"),
    currency,
    featured: parseBoolean(body?.featured, false),
    active: parseBoolean(body?.active, true),
    quantity_available: catalogShape.quantity_available,
    reorder_level: parseWholeNumber(body?.reorder_level, "Reorder level"),
    unit_cost: parseOptionalNumber(body?.unit_cost, "Unit cost") ?? 0,
    overhead_cost: parseOptionalNumber(body?.overhead_cost, "Overhead cost") ?? 0,
    image_url: images[0] || legacyImageUrl,
    images,
    light_images: images,
    dark_images: images
  };
}

function parseProductRouteId(rawId) {
  const productId = Number(rawId);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw createHttpError(400, "Product id must be a positive integer.");
  }
  return productId;
}

function parseOptionalPositiveInteger(value, fieldLabel) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw createHttpError(400, `${fieldLabel} must be a positive integer.`);
  }

  return number;
}

function readProductCatalogCache() {
  if (Array.isArray(productCatalogCache.rows) && productCatalogCache.expiresAt > Date.now()) {
    return productCatalogCache.rows;
  }

  return null;
}

function writeProductCatalogCache(rows) {
  productCatalogCache.rows = Array.isArray(rows) ? rows : [];
  productCatalogCache.expiresAt = Date.now() + PRODUCT_CATALOG_CACHE_TTL_MS;
  return productCatalogCache.rows;
}

function clearProductCatalogCache() {
  productCatalogCache.rows = null;
  productCatalogCache.expiresAt = 0;
}

async function listProducts() {
  const cachedRows = readProductCatalogCache();
  if (cachedRows) {
    return cachedRows;
  }

  const result = await pool.query(`${PRODUCT_SELECT_SQL} ORDER BY p.id ASC`);
  return writeProductCatalogCache(result.rows.map(materializeProductRow));
}

async function getProductById(productId) {
  const cachedRows = readProductCatalogCache();
  if (cachedRows) {
    return cachedRows.find((row) => Number(row?.id || 0) === Number(productId || 0)) || null;
  }

  const result = await pool.query(`${PRODUCT_SELECT_SQL} WHERE p.id = $1 LIMIT 1`, [productId]);
  if (!result.rows[0]) return null;

  return materializeProductRow(result.rows[0]);
}

async function getProductBySlug(slug) {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSlug) return null;

  const cachedRows = readProductCatalogCache();
  if (cachedRows) {
    return cachedRows.find((row) => String(row?.slug || "").trim().toLowerCase() === normalizedSlug) || null;
  }

  const result = await pool.query(`${PRODUCT_SELECT_SQL} WHERE p.slug = $1 LIMIT 1`, [normalizedSlug]);
  if (!result.rows[0]) return null;

  return materializeProductRow(result.rows[0]);
}

const PACKAGE_SELECT_SQL = `
  SELECT
    pkg.id,
    pkg.name,
    pkg.slug,
    pkg.active,
    pkg.created_at,
    pkg.updated_at,
    COALESCE(item_rows.items, '[]'::json) AS items
  FROM packages pkg
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', pi.id,
            'product_id', pi.product_id,
            'minimum_quantity', pi.minimum_quantity,
            'sort_order', pi.sort_order,
            'product', JSON_BUILD_OBJECT(
              'id', p.id,
              'product_id', p.product_id,
              'name', p.name,
              'category', p.category,
              'subcategory', p.subcategory,
              'buy_price', p.buy_price,
              'rent_price_per_day', p.rent_price_per_day,
              'currency', p.currency,
              'featured', p.featured,
              'active', p.active,
              'image_url',
              COALESCE(
                (
                  SELECT img.url
                  FROM product_images img
                  WHERE img.product_id = p.id
                  ORDER BY img.sort_order ASC, img.id ASC
                  LIMIT 1
                ),
                ''
              )
            )
          )
          ORDER BY pi.sort_order ASC, pi.id ASC
        ),
        '[]'::json
      ) AS items
    FROM package_items pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.package_id = pkg.id
  ) item_rows ON TRUE
`;

function slugifyPackageName(name) {
  const base = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "package";
}

function buildPackageMinimumQuantityNotice(productName, minimumQuantity) {
  const safeName = normalizeCatalogText(productName, 160) || "this item";
  const safeMinimum = Math.max(1, Number(minimumQuantity || 1));
  return `Selecting fewer than ${safeMinimum} unit${safeMinimum === 1 ? "" : "s"} of ${safeName} may apply extra fees.`;
}

function materializePackageRow(row) {
  const items = Array.isArray(row?.items) ? row.items : [];

  return {
    id: Number(row?.id || 0),
    name: normalizeCatalogText(row?.name, 160),
    slug: normalizeCatalogText(row?.slug, 180),
    active: Boolean(row?.active),
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    items: items
      .map((item, index) => {
        const product = item?.product && typeof item.product === "object" ? item.product : {};
        const minimumQuantity = Math.max(1, Number(item?.minimum_quantity || 1));

        return {
          id: Number(item?.id || 0),
          product_id: Number(item?.product_id || product.id || 0),
          minimum_quantity: minimumQuantity,
          sort_order: Number(item?.sort_order ?? index),
          minimum_quantity_notice: buildPackageMinimumQuantityNotice(product?.name, minimumQuantity),
          product: {
            id: Number(product?.id || item?.product_id || 0),
            product_id: normalizeCatalogText(product?.product_id, 20),
            name: normalizeCatalogText(product?.name, 160),
            category: normalizeCatalogText(product?.category, 120),
            subcategory: normalizeCatalogText(product?.subcategory, 120),
            buy_price: product?.buy_price === null || product?.buy_price === undefined ? null : Number(product.buy_price),
            rent_price_per_day:
              product?.rent_price_per_day === null || product?.rent_price_per_day === undefined
                ? null
                : Number(product.rent_price_per_day),
            currency: normalizeCatalogText(product?.currency, 10) || "USD",
            featured: Boolean(product?.featured),
            active: product?.active !== false,
            image_url: String(product?.image_url || "").trim()
          }
        };
      })
      .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)
  };
}

function parsePackageRouteId(rawId) {
  const packageId = Number(rawId);
  if (!Number.isInteger(packageId) || packageId <= 0) {
    throw createHttpError(400, "Package id must be a positive integer.");
  }
  return packageId;
}

async function ensureUniquePackageSlug(client, name, excludeId = null) {
  const baseSlug = slugifyPackageName(name);
  let suffix = 1;

  while (true) {
    const candidate = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;
    const result = await client.query(
      `
      SELECT id
      FROM packages
      WHERE LOWER(slug) = LOWER($1)
        AND ($2::BIGINT IS NULL OR id <> $2)
      LIMIT 1
      `,
      [candidate, excludeId]
    );

    if (!result.rows.length) {
      return candidate;
    }

    suffix += 1;
  }
}

function normalizePackagePayload(body) {
  const name = normalizeCatalogText(body?.name, 160);
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  if (!name) {
    throw createHttpError(400, "Package name is required.");
  }

  if (!rawItems.length) {
    throw createHttpError(400, "Add at least one product to the package.");
  }

  const seenProductIds = new Set();
  const items = rawItems.map((entry, index) => {
    const productId = parseOptionalPositiveInteger(entry?.product_id ?? entry?.productId, `Package item ${index + 1} product`);
    const minimumQuantity = parseWholeNumber(entry?.minimum_quantity ?? entry?.minimumQuantity, `Package item ${index + 1} minimum quantity`);

    if (!productId) {
      throw createHttpError(400, `Package item ${index + 1} must select a product.`);
    }

    if (minimumQuantity < 1) {
      throw createHttpError(400, `Package item ${index + 1} minimum quantity must be at least 1.`);
    }

    if (seenProductIds.has(productId)) {
      throw createHttpError(400, "Each product can only appear once per package.");
    }

    seenProductIds.add(productId);

    return {
      product_id: productId,
      minimum_quantity: minimumQuantity,
      sort_order: index
    };
  });

  return {
    name,
    active: parseBoolean(body?.active, true),
    items
  };
}

async function assertPackageProductsExist(client, items) {
  const productIds = items.map((item) => Number(item.product_id));
  const result = await client.query(
    `
    SELECT id
    FROM products
    WHERE id = ANY($1::BIGINT[])
    `,
    [productIds]
  );

  if (result.rows.length !== productIds.length) {
    throw createHttpError(400, "One or more selected products no longer exist.");
  }
}

async function syncPackageItems(client, packageId, pkg) {
  await assertPackageProductsExist(client, pkg.items);
  await client.query("DELETE FROM package_items WHERE package_id = $1", [packageId]);

  for (const item of pkg.items) {
    await client.query(
      `
      INSERT INTO package_items (
        package_id,
        product_id,
        minimum_quantity,
        sort_order,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      `,
      [packageId, item.product_id, item.minimum_quantity, item.sort_order]
    );
  }
}

async function listPackages() {
  const result = await pool.query(`${PACKAGE_SELECT_SQL} ORDER BY pkg.updated_at DESC, pkg.id DESC`);
  return result.rows.map(materializePackageRow);
}

async function getPackageById(packageId) {
  const result = await pool.query(`${PACKAGE_SELECT_SQL} WHERE pkg.id = $1 LIMIT 1`, [packageId]);
  if (!result.rows[0]) return null;

  return materializePackageRow(result.rows[0]);
}

async function syncAggregateInventory(client, productId, reorderLevel = null, fallbackQuantity = 0) {
  const summary = await client.query(
    `
    SELECT
      COUNT(*)::INT AS variation_count,
      COALESCE(SUM(quantity), 0)::INT AS total_quantity
    FROM product_variations
    WHERE product_id = $1
    `,
    [productId]
  );

  const variationCount = Number(summary.rows[0]?.variation_count || 0);
  const totalQuantity =
    variationCount > 0
      ? Number(summary.rows[0]?.total_quantity || 0)
      : Number(fallbackQuantity || 0);
  const safeReorderLevel = reorderLevel === null || reorderLevel === undefined
    ? Number(
        (
          await client.query(
            "SELECT COALESCE(reorder_level, 0)::INT AS reorder_level FROM product_inventory WHERE product_id = $1",
            [productId]
          )
        ).rows[0]?.reorder_level || 0
      )
    : Number(reorderLevel || 0);

  await client.query(
    `
    INSERT INTO product_inventory (product_id, quantity_available, reorder_level, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (product_id)
    DO UPDATE SET
      quantity_available = EXCLUDED.quantity_available,
      reorder_level = EXCLUDED.reorder_level,
      updated_at = NOW()
    `,
    [productId, totalQuantity, safeReorderLevel]
  );
}

async function syncProductRelations(client, productId, product) {
  const existingImagesResult = await client.query(
    "SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC",
    [productId]
  );
  const previousUrls = existingImagesResult.rows
    .map((row) => String(row.url || "").trim())
    .filter(Boolean);
  const createdUploadUrls = [];

  await client.query(
    `
    INSERT INTO product_costs (product_id, unit_cost, overhead_cost, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (product_id)
    DO UPDATE SET
      unit_cost = EXCLUDED.unit_cost,
      overhead_cost = EXCLUDED.overhead_cost,
      updated_at = NOW()
    `,
    [productId, product.unit_cost, product.overhead_cost]
  );

  await client.query("DELETE FROM product_variations WHERE product_id = $1", [productId]);

  for (const variation of product.variations) {
    await client.query(
      `
      INSERT INTO product_variations (
        product_id,
        color,
        size,
        quantity,
        sku,
        availability_status,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
      [
        productId,
        variation.color,
        variation.size,
        variation.quantity,
        variation.sku || null,
        variation.availability_status
      ]
    );
  }

  await syncAggregateInventory(client, productId, product.reorder_level, product.quantity_available);

  try {
    const imageUrls = await materializeProductImages(product.product_id, product.images, createdUploadUrls);

    await client.query("DELETE FROM product_images WHERE product_id = $1", [productId]);

    for (let index = 0; index < imageUrls.length; index += 1) {
      await client.query(
        `
        INSERT INTO product_images (product_id, url, sort_order, theme_mode)
        VALUES ($1, $2, $3, 'light')
        `,
        [productId, imageUrls[index], index]
      );
    }

    await cleanupUnusedProductUploads(previousUrls, imageUrls);
  } catch (error) {
    await Promise.all(createdUploadUrls.map(removeManagedProductUploadUrl));
    throw error;
  }
}

async function runProductTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function sendProductError(res, error, logPrefix) {
  if (error?.status) {
    return res.status(error.status).json({ error: error.message });
  }

  if (error?.code === "23505") {
    return res.status(409).json({ error: "A product with this ID or slug already exists." });
  }

  console.error(logPrefix, error.message);

  return res.status(500).json({
    error: "Server error",
    details: error.message
  });
}

function sendPackageError(res, error, logPrefix) {
  if (error?.status) {
    return res.status(error.status).json({ error: error.message });
  }

  if (error?.code === "23505") {
    return res.status(409).json({ error: "A package with this name already exists." });
  }

  console.error(logPrefix, error.message);

  return res.status(500).json({
    error: "Server error",
    details: error.message
  });
}

function sendCheckoutError(res, error, logPrefix) {
  if (error?.fieldErrors) {
    return res.status(error.status || 400).json({
      error: error.message || "Checkout validation failed.",
      fieldErrors: error.fieldErrors
    });
  }

  if (error?.status) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error(logPrefix, error.message);

  return res.status(500).json({
    error: "Server error",
    details: error.message
  });
}

function setCatalogResponseHeaders(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
}

async function fetchProductsForCheckout(productIds, client = pool) {
  const ids = Array.from(new Set(productIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)));

  if (!ids.length) {
    return [];
  }

  const result = await client.query(
    `
    SELECT
      p.id,
      p.name,
      p.active,
      p.product_id,
      p.category,
      p.subcategory,
      p.description,
      p.buy_enabled,
      p.rent_enabled,
      p.buy_price,
      p.rent_price_per_day,
      p.currency,
      COALESCE(p.size_mode, 'one-size') AS size_mode,
      COALESCE(p.colors, '[]'::jsonb) AS colors,
      COALESCE(p.sizes, '[]'::jsonb) AS sizes,
      COALESCE(p.customizable, FALSE) AS customizable,
      COALESCE(var.variations, '[]'::json) AS variations,
      COALESCE(var.total_quantity, inv.quantity_available, 0)::INT AS quantity_available,
      COALESCE(cost.unit_cost, 0) AS unit_cost
    FROM products p
    LEFT JOIN product_inventory inv ON inv.product_id = p.id
    LEFT JOIN product_costs cost ON cost.product_id = p.id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', pv.id,
              'color', pv.color,
              'size', pv.size,
              'quantity', pv.quantity,
              'sku', pv.sku,
              'availability_status', pv.availability_status
            )
            ORDER BY pv.color ASC, pv.size ASC, pv.id ASC
          ),
          '[]'::json
        ) AS variations,
        CASE
          WHEN COUNT(pv.id) = 0 THEN NULL
          ELSE COALESCE(SUM(pv.quantity), 0)::INT
        END AS total_quantity
      FROM product_variations pv
      WHERE pv.product_id = p.id
    ) var ON TRUE
    WHERE p.id = ANY($1::BIGINT[])
    `,
    [ids]
  );

  return result.rows.map((row) => ({
    ...row,
    ...materializeProductCatalogShape({
      colors: row.colors,
      quantity_available: row.quantity_available,
      size_mode: row.size_mode,
      sizes: row.sizes,
      variations: row.variations
    })
  }));
}

function resolveCheckoutVariation(product, item) {
  const variations = Array.isArray(product?.variations) ? product.variations : [];
  const sizeMode = normalizeSizeMode(product?.size_mode);
  const requestedColor = normalizeCatalogText(item?.selectedColor, 60);
  const requestedSize = sizeMode === "one-size"
    ? ONE_SIZE_LABEL
    : normalizeSizeLabel(item?.selectedSize, sizeMode);
  const requestedVariationId = Number(item?.variationId || item?.variation_id || 0);

  if (!variations.length) {
    return null;
  }

  if (requestedVariationId > 0) {
    return variations.find((variation) => Number(variation.id || 0) === requestedVariationId) || null;
  }

  if (requestedColor && requestedSize) {
    return variations.find((variation) => variation.color === requestedColor && variation.size === requestedSize) || null;
  }

  if (requestedColor) {
    return variations.find((variation) => variation.color === requestedColor && isVariationAvailable(variation))
      || variations.find((variation) => variation.color === requestedColor)
      || null;
  }

  if (requestedSize) {
    return variations.find((variation) => variation.size === requestedSize && isVariationAvailable(variation))
      || variations.find((variation) => variation.size === requestedSize)
      || null;
  }

  return variations.find(isVariationAvailable) || variations[0] || null;
}

async function validateCustomizationUploadsForItem(client, {
  customizationUploadTokens,
  itemIndex,
  product,
  userId,
  variation
}) {
  if (!customizationUploadTokens.length) {
    return;
  }

  if (!product.customizable) {
    throw createHttpError(400, `${product.name} does not support customization uploads.`);
  }

  const result = await client.query(
    `
    SELECT upload_token, variation_id
    FROM customization_uploads
    WHERE user_id = $1
      AND product_id = $2
      AND upload_token = ANY($3::TEXT[])
      AND order_item_id IS NULL
    `,
    [userId, product.id, customizationUploadTokens]
  );

  if (result.rows.length !== customizationUploadTokens.length) {
    const error = new Error("One or more customization files are no longer available.");
    error.status = 400;
    error.fieldErrors = {
      [`items.${itemIndex}`]: "One or more customization files are no longer available."
    };
    throw error;
  }

  const expectedVariationId = Number(variation?.id || 0);
  if (expectedVariationId > 0 && result.rows.some((row) => Number(row.variation_id || 0) !== expectedVariationId)) {
    const error = new Error("Customization files no longer match the selected product variation.");
    error.status = 400;
    error.fieldErrors = {
      [`items.${itemIndex}`]: "Customization files no longer match the selected product variation."
    };
    throw error;
  }
}

async function attachCustomizationUploadsToOrderItem(client, {
  customizationUploadTokens,
  orderItemId,
  productId,
  userId,
  variationId
}) {
  if (!customizationUploadTokens.length) return;

  const result = await client.query(
    `
    UPDATE customization_uploads
    SET order_item_id = $1,
        variation_id = COALESCE(variation_id, $2)
    WHERE user_id = $3
      AND product_id = $4
      AND upload_token = ANY($5::TEXT[])
      AND order_item_id IS NULL
    RETURNING upload_token
    `,
    [orderItemId, variationId, userId, productId, customizationUploadTokens]
  );

  if (result.rows.length !== customizationUploadTokens.length) {
    throw createHttpError(409, "Some customization files could not be attached to this order.");
  }
}

async function reserveInventoryForLineItems(client, lineItems) {
  const touchedProductIds = new Set();

  for (const item of lineItems) {
    if (item.variationId) {
      const reservation = await client.query(
        `
        UPDATE product_variations
        SET quantity = quantity - $2,
            availability_status = CASE
              WHEN availability_status = 'unavailable' THEN 'unavailable'
              WHEN quantity - $2 > 0 THEN 'in_stock'
              ELSE 'out_of_stock'
            END,
            updated_at = NOW()
        WHERE id = $1
          AND quantity >= $2
          AND availability_status <> 'unavailable'
        RETURNING id
        `,
        [item.variationId, item.quantity]
      );

      if (!reservation.rows.length) {
        throw createHttpError(
          409,
          `${item.productName} is no longer available in ${item.selectedColor} / ${item.selectedSize}.`
        );
      }
    } else {
      const reservation = await client.query(
        `
        UPDATE product_inventory
        SET quantity_available = quantity_available - $2,
            updated_at = NOW()
        WHERE product_id = $1
          AND quantity_available >= $2
        RETURNING product_id
        `,
        [item.productId, item.quantity]
      );

      if (!reservation.rows.length) {
        throw createHttpError(
          409,
          `${item.productName} is no longer available in the selected quantity.`
        );
      }
    }

    touchedProductIds.add(item.productId);
  }

  for (const productId of touchedProductIds) {
    await syncAggregateInventory(client, productId);
  }
}

async function buildCheckoutLineItems(rawItems, { client = pool, userId } = {}) {
  const items = normalizeOrderCartItems(rawItems);
  if (!items.length) {
    const error = new Error("Your cart is empty.");
    error.status = 400;
    error.fieldErrors = { items: "Your cart is empty." };
    throw error;
  }

  const productRows = await fetchProductsForCheckout(items.map((item) => item.id), client);
  const productMap = new Map(productRows.map((row) => [Number(row.id), row]));
  const lineItems = [];
  const itemErrors = {};

  for (const [index, item] of items.entries()) {
    const product = productMap.get(Number(item.id));

    if (!product) {
      itemErrors[`items.${index}`] = "One of the selected products no longer exists.";
      continue;
    }

    if (product.active === false) {
      itemErrors[`items.${index}`] = `${product.name} is currently unavailable.`;
      continue;
    }

    if (item.mode === "buy" && !product.buy_enabled) {
      itemErrors[`items.${index}`] = `${product.name} is not available for purchase right now.`;
      continue;
    }

    if (item.mode === "rent" && !product.rent_enabled) {
      itemErrors[`items.${index}`] = `${product.name} is not available for rent right now.`;
      continue;
    }

    const variation = resolveCheckoutVariation(product, item);
    if (Array.isArray(product.variations) && product.variations.length && !variation) {
      itemErrors[`items.${index}`] = `${product.name} is no longer available in the selected color and size.`;
      continue;
    }

    const availableQuantity = variation
      ? Number(variation.quantity || 0)
      : Number(product.quantity_available || 0);

    if (variation && !isVariationAvailable(variation)) {
      itemErrors[`items.${index}`] = `${product.name} is unavailable for ${variation.color} / ${variation.size}.`;
      continue;
    }

    if (availableQuantity <= 0) {
      const stockLabel = variation
        ? `${product.name} in ${variation.color} / ${variation.size}`
        : product.name;
      itemErrors[`items.${index}`] = `${stockLabel} is currently out of stock.`;
      continue;
    }

    if (availableQuantity > 0 && Number(item.quantity) > availableQuantity) {
      const stockLabel = variation
        ? `${product.name} in ${variation.color} / ${variation.size}`
        : product.name;
      itemErrors[`items.${index}`] = `Only ${availableQuantity} units of ${stockLabel} are currently available.`;
      continue;
    }

    const unitPrice = getUnitPriceForMode(product, item.mode);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      itemErrors[`items.${index}`] = `${product.name} does not have a valid checkout price.`;
      continue;
    }

    try {
      await validateCustomizationUploadsForItem(client, {
        customizationUploadTokens: item.customizationUploadTokens || [],
        itemIndex: index,
        product,
        userId,
        variation
      });
    } catch (error) {
      if (error?.fieldErrors) {
        Object.assign(itemErrors, error.fieldErrors);
        continue;
      }

      throw error;
    }

    const multiplier = item.mode === "rent" ? Number(item.rentalDays || 1) : 1;
    const lineTotal = roundCurrency(unitPrice * Number(item.quantity || 0) * multiplier);
    const packageMeta = item.packageMeta && typeof item.packageMeta === "object"
      ? normalizePackageMeta(item.packageMeta, {
          builderCategory: getBuilderCategory(product)
        })
      : null;

    if (packageMeta) {
      packageMeta.customizationRequested =
        Boolean(item.customizationRequested) ||
        Boolean((item.customizationUploadTokens || []).length) ||
        Boolean(packageMeta.customizationRequested);
    }

    lineItems.push({
      builderCategory: packageMeta?.builderCategory || getBuilderCategory(product),
      productId: Number(product.id),
      productName: String(product.name || "Unnamed Product"),
      category: String(product.category || "General"),
      subcategory: String(product.subcategory || "General"),
      description: String(product.description || ""),
      variationId: variation?.id ? Number(variation.id) : null,
      selectedColor: variation?.color || normalizeCatalogText(item.selectedColor, 60) || "Standard",
      selectedSize: variation?.size || (
        normalizeSizeMode(product.size_mode) === "one-size"
          ? ONE_SIZE_LABEL
          : normalizeSizeLabel(item.selectedSize, product.size_mode)
      ) || "",
      customizationRequested:
        Boolean(item.customizationRequested) ||
        Boolean((item.customizationUploadTokens || []).length),
      customizationUploadTokens: item.customizationUploadTokens || [],
      deliveryClass: String(product.delivery_class || ""),
      packageMeta,
      productCustomizationFee: roundCurrency(Number(product.customization_fee || 0)),
      quantity: Number(item.quantity || 1),
      mode: item.mode,
      rentalDays: item.mode === "rent" ? Number(item.rentalDays || 1) : null,
      unitPrice: roundCurrency(unitPrice),
      unitCostSnapshot: roundCurrency(Number(product.unit_cost || 0)),
      lineTotal,
      currency: String(product.currency || "USD")
    });
  }

  if (Object.keys(itemErrors).length > 0) {
    const error = new Error("One or more cart items could not be checked out.");
    error.status = 400;
    error.fieldErrors = itemErrors;
    throw error;
  }

  const currencies = Array.from(new Set(lineItems.map((item) => item.currency)));
  if (currencies.length > 1) {
    const error = new Error("Your cart contains multiple currencies, which is not supported at checkout.");
    error.status = 400;
    error.fieldErrors = {
      items: "Your cart contains multiple currencies, which is not supported at checkout."
    };
    throw error;
  }

  return lineItems;
}

function buildCheckoutTotalsFromLineItems(lineItems) {
  const pricing = applyPricingToResolvedLines(lineItems);
  const fallbackDeliveryEstimate = calculateDeliveryEstimate(lineItems);
  const pricedLineItems = pricing.lines.map((line) => ({
    ...line,
    lineTotal: Number(line.chargedLineTotal || line.lineTotal || 0)
  }));

  return {
    deliveryEstimate: pricing.packageGroups[0]?.deliveryEstimate?.label || fallbackDeliveryEstimate.label,
    lineItems: pricedLineItems,
    totals: {
      depositRequired: roundCurrency(pricing.total * 0.3),
      discount: pricing.discount,
      shipping: pricing.shipping,
      subtotal: pricing.subtotal,
      tax: 0,
      total: pricing.total
    }
  };
}

function normalizeOrderResponse(row) {
  if (!row) return null;

  const shippingDetails = row.shipping_details && typeof row.shipping_details === "object" ? row.shipping_details : {};
  const billingDetails = row.billing_details && typeof row.billing_details === "object" ? row.billing_details : {};
  const items = (Array.isArray(row.items) ? row.items : []).map((item) => ({
    id: Number(item?.id),
    productId: Number(item?.productId),
    name: String(item?.name || "Product"),
    selectedColor: String(item?.selectedColor || ""),
    selectedSize: String(item?.selectedSize || ""),
    customizationRequested: Boolean(item?.customizationRequested),
    quantity: Number(item?.quantity || 0),
    mode: String(item?.mode || "buy"),
    rentalDays: item?.rentalDays === null || item?.rentalDays === undefined ? null : Number(item.rentalDays),
    unitPrice: Number(item?.unitPrice || 0),
    lineTotal: Number(item?.lineTotal || 0)
  }));

  return {
    id: Number(row.id),
    orderId: String(row.public_order_id || ""),
    status: String(row.status || "pending"),
    currency: String(row.currency || "USD"),
    subtotal: Number(row.subtotal || 0),
    tax: Number(row.tax || 0),
    discount: Number(row.discount || 0),
    shipping: Number(row.shipping || 0),
    total: Number(row.total || 0),
    depositRequired: Number(row.deposit_required || 0),
    depositPaid: Number(row.deposit_paid || 0),
    depositStatus: String(row.deposit_status || "unpaid"),
    deliveryEstimate: String(row.delivery_estimate || ""),
    createdAt: row.created_at,
    paidAt: row.paid_at,
    name: String(shippingDetails.fullName || ""),
    phoneNumber: String(shippingDetails.phoneNumber || ""),
    shipmentAddress: buildShippingSummary(shippingDetails),
    shippingDetails,
    billingDetails,
    items
  };
}

async function getConfirmedOrderForUser(userId, publicOrderId) {
  const result = await pool.query(
    `
    SELECT
      o.id,
      o.public_order_id,
      o.status,
      o.currency,
      o.subtotal,
      o.tax,
      o.discount,
      o.shipping,
      o.total,
      o.delivery_estimate,
      o.deposit_required,
      o.deposit_paid,
      o.deposit_status,
      o.shipping_details,
      o.billing_details,
      o.created_at,
      o.paid_at,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', oi.id,
            'productId', oi.product_id,
            'name', COALESCE(p.name, 'Product'),
            'selectedColor', COALESCE(oi.selected_color, ''),
            'selectedSize', COALESCE(oi.selected_size, ''),
            'customizationRequested', COALESCE(oi.customization_requested, FALSE),
            'quantity', oi.quantity,
            'mode', oi.type,
            'rentalDays', oi.rent_days,
            'unitPrice', oi.unit_price,
            'lineTotal', oi.line_total
          )
          ORDER BY oi.id ASC
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) AS items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.user_id = $1
      AND o.public_order_id = $2
      AND o.deposit_status = 'paid'
      AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered', 'completed')
    GROUP BY o.id
    LIMIT 1
    `,
    [userId, publicOrderId]
  );

  return normalizeOrderResponse(result.rows[0] || null);
}

app.get("/", (_req, res) => {
  res.send("EventMart API running");
});

app.post("/api/geolocation/reverse-egypt", async (req, res) => {
  try {
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude ?? req.body?.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: "Valid latitude and longitude are required." });
    }

    if (!isCoordinateWithinEgypt(latitude, longitude)) {
      return res.status(400).json({ error: "This service is currently available in Egypt only." });
    }

    if (typeof fetch !== "function") {
      return res.status(503).json({
        error: "We couldn't auto-fill your location right now. Please enter the address manually."
      });
    }

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "en");

    const geoResponse = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "EventMart Checkout Geolocation"
      }
    });

    if (!geoResponse.ok) {
      throw createHttpError(
        502,
        "We couldn't auto-fill your location right now. Please enter the address manually."
      );
    }

    const payload = await geoResponse.json();
    const address = extractEgyptAddressFromReversePayload(payload);

    if (address.countryCode !== "eg") {
      return res.status(400).json({ error: "This service is currently available in Egypt only." });
    }

    return res.json({
      latitude,
      longitude,
      ...address
    });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }

    console.error("EGYPT GEOLOCATION ROUTE ERROR:", err.message);
    return res.status(500).json({
      error: "We couldn't auto-fill your location right now. Please enter the address manually."
    });
  }
});

app.post(["/product-images/upload", "/api/product-images/upload"], PRODUCT_IMAGE_UPLOAD_PARSER, async (req, res) => {
  try {
    const productCode = parseProductCode(req.query.product_id);
    const mimeType = String(req.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const fileName = String(req.query.filename || "image");
    const fileExtension = getImageExtensionFromFilename(fileName);
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");

    if (!mimeType.startsWith("image/") && !isSupportedImageExtension(fileExtension)) {
      throw createHttpError(400, "Only image files can be uploaded.");
    }

    if (!buffer.length) {
      throw createHttpError(400, "Uploaded product images cannot be empty.");
    }

    if (buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
      throw createHttpError(400, "Each uploaded product image must be 5 MB or smaller.");
    }

    const url = await saveUploadedProductImageBuffer(productCode, buffer, {
      fileName,
      mimeType
    });

    return res.status(201).json({ url });
  } catch (err) {
    return sendProductError(res, err, "PRODUCT IMAGE UPLOAD ERROR:");
  }
});

app.delete(["/product-images", "/api/product-images"], async (req, res) => {
  try {
    const urls = normalizeImageSourceList(req.body?.urls);
    await Promise.all(
      urls.filter((url) => isManagedProductUploadUrl(url)).map(removeManagedProductUploadUrl)
    );

    return res.status(204).send();
  } catch (err) {
    return sendProductError(res, err, "PRODUCT IMAGE DELETE ERROR:");
  }
});

app.post(["/customization-uploads", "/api/customization-uploads"], requireAuth, CUSTOMIZATION_UPLOAD_PARSER, async (req, res) => {
  try {
    const productId = parseProductRouteId(req.query.product_id);
    const variationId = parseOptionalPositiveInteger(req.query.variation_id, "variation_id");
    const uploadKind = parseCustomizationUploadKind(req.query.upload_kind);
    const mimeType = String(req.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const fileName = String(req.query.filename || `${uploadKind}.file`);
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    const productResult = await pool.query(
      "SELECT id, product_id, customizable FROM products WHERE id = $1 LIMIT 1",
      [productId]
    );
    const product = productResult.rows[0];

    if (!product) {
      throw createHttpError(404, "Product not found.");
    }

    if (!product.customizable) {
      throw createHttpError(400, "This product does not support customization uploads.");
    }

    if (variationId) {
      const variationResult = await pool.query(
        "SELECT id FROM product_variations WHERE id = $1 AND product_id = $2 LIMIT 1",
        [variationId, productId]
      );

      if (!variationResult.rows.length) {
        throw createHttpError(400, "Selected variation is invalid for this product.");
      }
    }

    const uploadToken = crypto.randomUUID();
    const storedPath = await saveCustomizationUploadBuffer({
      buffer,
      fileName,
      mimeType,
      productCode: product.product_id,
      uploadToken,
      userId: req.auth.userId
    });

    await pool.query(
      `
      INSERT INTO customization_uploads (
        upload_token,
        product_id,
        variation_id,
        user_id,
        upload_kind,
        original_file_name,
        stored_path,
        mime_type,
        size_bytes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        uploadToken,
        productId,
        variationId,
        req.auth.userId,
        uploadKind,
        fileName,
        storedPath,
        mimeType || "application/octet-stream",
        buffer.length
      ]
    );

    return res.status(201).json({
      uploadKind,
      uploadToken,
      originalFileName: fileName
    });
  } catch (err) {
    return sendProductError(res, err, "CUSTOMIZATION UPLOAD ERROR:");
  }
});

app.delete(["/customization-uploads", "/api/customization-uploads"], requireAuth, async (req, res) => {
  try {
    const uploadTokens = normalizeTextList(req.body?.uploadTokens || req.body?.upload_tokens, 120);

    if (!uploadTokens.length) {
      return res.status(204).send();
    }

    const result = await pool.query(
      `
      SELECT id, stored_path
      FROM customization_uploads
      WHERE user_id = $1
        AND upload_token = ANY($2::TEXT[])
        AND order_item_id IS NULL
      `,
      [req.auth.userId, uploadTokens]
    );

    await Promise.all(result.rows.map((row) => removeManagedCustomizationFile(row.stored_path)));

    await pool.query(
      `
      DELETE FROM customization_uploads
      WHERE user_id = $1
        AND upload_token = ANY($2::TEXT[])
        AND order_item_id IS NULL
      `,
      [req.auth.userId, uploadTokens]
    );

    return res.status(204).send();
  } catch (err) {
    return sendProductError(res, err, "CUSTOMIZATION DELETE ERROR:");
  }
});

app.get(["/products", "/api/products"], async (_req, res) => {
  try {
    setCatalogResponseHeaders(res);
    const rows = await listProducts();
    res.json(rows);
  } catch (err) {
    return sendProductError(res, err, "PRODUCTS ROUTE ERROR:");
  }
});

app.get("/api/products/slug/:slug", async (req, res) => {
  try {
    setCatalogResponseHeaders(res);
    const product = await getProductBySlug(req.params.slug);

    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    return res.json(product);
  } catch (err) {
    return sendProductError(res, err, "PRODUCT SLUG ROUTE ERROR:");
  }
});

app.post(["/products", "/api/products"], async (req, res) => {
  try {
    const product = normalizeProductPayload(req.body);

    const createdId = await runProductTransaction(async (client) => {
      const insertResult = await client.query(
        `
        INSERT INTO products (
          product_id,
          name,
          slug,
          category,
          subcategory,
          description,
          quality,
          quality_points,
          colors,
          size_mode,
          sizes,
          customizable,
          buy_enabled,
          rent_enabled,
          buy_price,
          rent_price_per_day,
          currency,
          featured,
          active,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11::jsonb, $12, $13,
          $14, $15, $16, $17, $18, $19, NOW()
        )
        RETURNING id
        `,
        [
          product.product_id,
          product.name,
          product.slug,
          product.category,
          product.subcategory,
          product.description,
          product.quality,
          JSON.stringify(product.quality_points),
          JSON.stringify(product.colors),
          product.size_mode,
          JSON.stringify(product.sizes),
          product.customizable,
          product.buy_enabled,
          product.rent_enabled,
          product.buy_price,
          product.rent_price_per_day,
          product.currency,
          product.featured,
          product.active
        ]
      );

      const productId = insertResult.rows[0].id;
      await syncProductRelations(client, productId, product);
      return productId;
    });

    clearProductCatalogCache();
    const created = await getProductById(createdId);
    return res.status(201).json(created);
  } catch (err) {
    return sendProductError(res, err, "CREATE PRODUCT ROUTE ERROR:");
  }
});

app.put(["/products/:id", "/api/products/:id"], async (req, res) => {
  try {
    const routeProductId = parseProductRouteId(req.params.id);
    const product = normalizeProductPayload(req.body);

    await runProductTransaction(async (client) => {
      const updateResult = await client.query(
        `
        UPDATE products
        SET product_id = $1,
            name = $2,
            slug = $3,
            category = $4,
            subcategory = $5,
            description = $6,
            quality = $7,
            quality_points = $8::jsonb,
            colors = $9::jsonb,
            size_mode = $10,
            sizes = $11::jsonb,
            customizable = $12,
            buy_enabled = $13,
            rent_enabled = $14,
            buy_price = $15,
            rent_price_per_day = $16,
            currency = $17,
            featured = $18,
            active = $19,
            updated_at = NOW()
        WHERE id = $20
        RETURNING id
        `,
        [
          product.product_id,
          product.name,
          product.slug,
          product.category,
          product.subcategory,
          product.description,
          product.quality,
          JSON.stringify(product.quality_points),
          JSON.stringify(product.colors),
          product.size_mode,
          JSON.stringify(product.sizes),
          product.customizable,
          product.buy_enabled,
          product.rent_enabled,
          product.buy_price,
          product.rent_price_per_day,
          product.currency,
          product.featured,
          product.active,
          routeProductId
        ]
      );

      if (!updateResult.rows.length) {
        throw createHttpError(404, "Product not found.");
      }

      await syncProductRelations(client, routeProductId, product);
    });

    clearProductCatalogCache();
    const updated = await getProductById(routeProductId);
    return res.json(updated);
  } catch (err) {
    return sendProductError(res, err, "UPDATE PRODUCT ROUTE ERROR:");
  }
});

app.delete(["/products/:id", "/api/products/:id"], async (req, res) => {
  try {
    const routeProductId = parseProductRouteId(req.params.id);
    const existingImagesResult = await pool.query(
      "SELECT url FROM product_images WHERE product_id = $1 ORDER BY id ASC",
      [routeProductId]
    );
    const existingCustomizationResult = await pool.query(
      "SELECT stored_path FROM customization_uploads WHERE product_id = $1 ORDER BY id ASC",
      [routeProductId]
    );
    const existingUrls = existingImagesResult.rows
      .map((row) => String(row.url || "").trim())
      .filter(Boolean);
    const storedPaths = existingCustomizationResult.rows
      .map((row) => String(row.stored_path || "").trim())
      .filter(Boolean);
    const result = await pool.query("DELETE FROM products WHERE id = $1 RETURNING id", [routeProductId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Product not found." });
    }

    await Promise.all(
      existingUrls.filter((url) => isManagedProductUploadUrl(url)).map(removeManagedProductUploadUrl)
    );
    await Promise.all(storedPaths.map(removeManagedCustomizationFile));
    clearProductCatalogCache();

    return res.status(204).send();
  } catch (err) {
    return sendProductError(res, err, "DELETE PRODUCT ROUTE ERROR:");
  }
});

app.post("/api/ai-planner", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const context = req.body?.context && typeof req.body.context === "object" ? req.body.context : {};

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const catalogResult = await pool.query(
      `
      SELECT
        id,
        product_id,
        name,
        category,
        buy_enabled,
        rent_enabled,
        buy_price,
        rent_price_per_day
      FROM products
      WHERE active = TRUE
      ORDER BY id DESC
      LIMIT 80
      `
    );
    const catalog = summarizeProductCatalog(catalogResult.rows);

    return res.json({
      message: fallbackPlannerReply(prompt, context, catalog),
      source: "deterministic"
    });
  } catch (err) {
    console.error("AI PLANNER ROUTE ERROR:", err.message);
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const created = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at, last_login_at`,
      [name, email, passwordHash]
    );

    const user = sanitizeUser(created.rows[0]);
    const token = createAuthToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error("REGISTER ROUTE ERROR:", err.message);
    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );
    const userRow = result.rows[0];

    if (!userRow) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const ok = await bcrypt.compare(password, userRow.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const loginUpdate = await pool.query(
      `UPDATE users
       SET last_login_at = NOW()
       WHERE id = $1
       RETURNING id, name, email, role, created_at, last_login_at`,
      [userRow.id]
    );

    const user = sanitizeUser(loginUpdate.rows[0]);
    const token = createAuthToken(user);
    res.json({ user, token });
  } catch (err) {
    console.error("LOGIN ROUTE ERROR:", err.message);
    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

app.get("/api/users", async (_req, res) => {
  try {
    const users = await pool.query(
      `SELECT id, name, email, role, created_at, last_login_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(users.rows);
  } catch (err) {
    console.error("USERS ROUTE ERROR:", err.message);
    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, created_at, last_login_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.auth.userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("ME ROUTE ERROR:", err.message);
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

app.put("/api/me", requireAuth, async (req, res) => {
  try {
    const incomingName = req.body?.name;
    const incomingEmail = req.body?.email;
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    const currentResult = await pool.query(
      "SELECT * FROM users WHERE id = $1 LIMIT 1",
      [req.auth.userId]
    );
    const currentUser = currentResult.rows[0];

    if (!currentUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const nextName =
      typeof incomingName === "string"
        ? incomingName.trim()
        : String(currentUser.name || "").trim();

    const nextEmail =
      typeof incomingEmail === "string"
        ? normalizeEmail(incomingEmail)
        : normalizeEmail(currentUser.email);

    if (!nextName || !nextEmail) {
      return res.status(400).json({ error: "Name and email are required." });
    }

    if (nextEmail !== normalizeEmail(currentUser.email)) {
      const existing = await pool.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1",
        [nextEmail, req.auth.userId]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "Email is already registered." });
      }
    }

    let nextPasswordHash = currentUser.password_hash;

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters." });
      }

      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required to set a new password." });
      }

      const passwordOk = await bcrypt.compare(currentPassword, currentUser.password_hash);

      if (!passwordOk) {
        return res.status(401).json({ error: "Current password is incorrect." });
      }

      nextPasswordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    }

    const updated = await pool.query(
      `UPDATE users
       SET name = $1,
           email = $2,
           password_hash = $3
       WHERE id = $4
       RETURNING id, name, email, role, created_at, last_login_at`,
      [nextName, nextEmail, nextPasswordHash, req.auth.userId]
    );

    const user = sanitizeUser(updated.rows[0]);
    const token = createAuthToken(user);

    return res.json({ user, token });
  } catch (err) {
    console.error("UPDATE ME ROUTE ERROR:", err.message);
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

app.post("/api/checkout/orders", requireAuth, async (req, res) => {
  try {
    const checkoutInput = validateCheckoutSubmission(req.body);
    const previewLineItems = await buildCheckoutLineItems(checkoutInput.items, {
      userId: req.auth.userId
    });
    const { deliveryEstimate, totals: previewTotals } = buildCheckoutTotalsFromLineItems(previewLineItems);
    const currency = String(previewLineItems[0]?.currency || "USD");

    checkoutInput.billingDetails.advancePaymentRequiredPercentage = 30;

    const paymentResult = authorizeAdvancePayment({
      billingDetails: checkoutInput.billingDetails,
      paymentDetails: checkoutInput.paymentDetails,
      total: previewTotals.total
    });

    checkoutInput.billingDetails.depositRequired = paymentResult.depositRequired;
    checkoutInput.billingDetails.depositPaid = paymentResult.depositPaid;
    checkoutInput.billingDetails.depositStatus = paymentResult.depositStatus;

    const publicOrderId = buildPublicOrderId();
    const paidAt = paymentResult.paidAt;

    await runProductTransaction(async (client) => {
      const lineItems = await buildCheckoutLineItems(checkoutInput.items, {
        client,
        userId: req.auth.userId
      });
      const { lineItems: pricedLineItems, totals } = buildCheckoutTotalsFromLineItems(lineItems);

      if (totals.total !== previewTotals.total) {
        throw createHttpError(
          409,
          "Your cart changed while we were confirming payment. Please review the latest pricing and stock."
        );
      }

      await reserveInventoryForLineItems(client, pricedLineItems);

      const orderInsert = await client.query(
        `
        INSERT INTO orders (
          user_id,
          status,
          public_order_id,
          subtotal,
          tax,
          discount,
          shipping,
          total,
          currency,
          shipping_details,
          billing_details,
          delivery_estimate,
          deposit_required,
          deposit_paid,
          deposit_status,
          deposit_paid_at,
          paid_at
        )
        VALUES (
          $1,
          'confirmed',
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::jsonb,
          $10::jsonb,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16
        )
        RETURNING id
        `,
        [
          req.auth.userId,
          publicOrderId,
          totals.subtotal,
          totals.tax,
          totals.discount,
          totals.shipping,
          totals.total,
          currency,
          JSON.stringify(checkoutInput.shippingDetails),
          JSON.stringify(checkoutInput.billingDetails),
          deliveryEstimate.label,
          paymentResult.depositRequired,
          paymentResult.depositPaid,
          paymentResult.depositStatus,
          paidAt,
          paidAt
        ]
      );

      const orderId = orderInsert.rows[0].id;

      for (const item of pricedLineItems) {
        const orderItemInsert = await client.query(
          `
          INSERT INTO order_items (
            order_id,
            product_id,
            variation_id,
            quantity,
            type,
            selected_color,
            selected_size,
            customization_requested,
            rent_days,
            unit_price,
            unit_cost_snapshot,
            line_total
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
          `,
          [
            orderId,
            item.productId,
            item.variationId,
            item.quantity,
            item.mode,
            item.selectedColor,
            item.selectedSize,
            Boolean(item.customizationRequested) || item.customizationUploadTokens.length > 0,
            item.mode === "rent" ? item.rentalDays : null,
            item.unitPrice,
            item.unitCostSnapshot,
            item.lineTotal
          ]
        );

        await attachCustomizationUploadsToOrderItem(client, {
          customizationUploadTokens: item.customizationUploadTokens,
          orderItemId: orderItemInsert.rows[0].id,
          productId: item.productId,
          userId: req.auth.userId,
          variationId: item.variationId
        });
      }
    });

    const order = await getConfirmedOrderForUser(req.auth.userId, publicOrderId);

    if (!order) {
      throw createHttpError(500, "The order was created but could not be loaded afterward.");
    }

    return res.status(201).json({ order });
  } catch (err) {
    return sendCheckoutError(res, err, "CHECKOUT ROUTE ERROR:");
  }
});

app.get("/api/orders/:publicOrderId/confirmation", requireAuth, async (req, res) => {
  try {
    const publicOrderId = String(req.params.publicOrderId || "").trim().toUpperCase();

    if (!publicOrderId) {
      return res.status(400).json({ error: "Order ID is required." });
    }

    const order = await getConfirmedOrderForUser(req.auth.userId, publicOrderId);

    if (!order) {
      return res.status(404).json({
        error: "We couldn't find a confirmed order for that confirmation page."
      });
    }

    return res.json({ order });
  } catch (err) {
    return sendCheckoutError(res, err, "ORDER CONFIRMATION ROUTE ERROR:");
  }
});

app.get("/api/me/orders", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        o.id,
        o.public_order_id,
        o.status,
        o.delivery_estimate,
        o.subtotal,
        o.tax,
        o.discount,
        o.shipping,
        o.total,
        o.currency,
        o.deposit_required,
        o.deposit_paid,
        o.deposit_status,
        o.created_at,
        o.paid_at,
        COALESCE(SUM(oi.quantity), 0)::INT AS total_items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
      `,
      [req.auth.userId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("ME ORDERS ROUTE ERROR:", err.message);
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

async function start() {
  try {
    console.log("Starting EventMart backend...");
    console.log("PORT:", PORT);
    console.log("PGHOST:", process.env.PGHOST || "(missing)");
    console.log("PGPORT:", process.env.PGPORT || "(missing)");
    console.log("PGDATABASE:", process.env.PGDATABASE || "(missing)");
    console.log("PGUSER:", process.env.PGUSER || "(missing)");
    console.log("PGPASSWORD exists:", Boolean(process.env.PGPASSWORD));

    await pool.query("SELECT 1");
    console.log("Database connected.");

    await ensureSchema();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("SERVER STARTUP ERROR:", err.message);
    process.exit(1);
  }
}

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

start();
