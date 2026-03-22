const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const pool = require("./db");
require("dotenv").config();

const fsp = fs.promises;

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "eventmart_dev_secret_change_me";
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const FRONTEND_URL = process.env.FRONTEND_URL || "";
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");
const PRODUCT_UPLOADS_DIR = path.join(UPLOADS_DIR, "products");
const MAX_PRODUCT_IMAGES_PER_MODE = 10;
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const DATA_IMAGE_URL_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/;
const PRODUCT_IMAGE_UPLOAD_PARSER = express.raw({ limit: "10mb", type: () => true });

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

app.use((req, _res, next) => {
  console.log("Request Origin:", req.headers.origin || "(none)");
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      console.log("CORS Origin Check:", origin || "(none)");
      console.log("Allowed Origins:", allowedOrigins);

      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.options("*", cors());

app.use(express.json({ limit: "120mb" }));
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
    conference: ["sound", "merch", "wood"],
    concert: ["stage", "sound", "light"],
    birthday: ["merch", "sound", "wood"],
    corporate: ["sound", "stage", "wood"],
    festival: ["stage", "sound", "light"],
    exhibition: ["wood", "merch", "stage"]
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

function formatPlannerReplyText(content) {
  return String(content || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/([^\n])\s+(###\s+)/g, "$1\n\n$2")
    .replace(/([^\n])\s+-\s+(?=(?:\*\*|[A-Za-z0-9]))/g, "$1\n- ")
    .replace(/\s+(You can refine this plan|I can refine this plan further)\b/g, "\n\n$1")
    .trim();
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return formatPlannerReplyText(payload.output_text);
  }

  const chunks = [];
  const output = Array.isArray(payload?.output) ? payload.output : [];

  output.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part) => {
      if (typeof part?.text === "string") chunks.push(part.text);
      if (typeof part?.output_text === "string") chunks.push(part.output_text);
    });
  });

  return formatPlannerReplyText(chunks.join("\n"));
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

function resolveProductImageCollections(row) {
  const lightImages = normalizeImageSourceList(row?.light_images);
  const darkImages = normalizeImageSourceList(row?.dark_images);
  const legacyImageUrl = String(row?.image_url || "").trim();

  if (!lightImages.length && !darkImages.length && legacyImageUrl) {
    lightImages.push(legacyImageUrl);
  }

  return {
    dark_images: darkImages,
    image_url: lightImages[0] || darkImages[0] || legacyImageUrl,
    light_images: lightImages
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

function parseThemeMode(value) {
  const themeMode = String(value || "").trim().toLowerCase();
  if (themeMode === "light" || themeMode === "dark") return themeMode;
  throw createHttpError(400, "theme_mode must be either 'light' or 'dark'.");
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
  return String(url || "").startsWith("/uploads/products/");
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

async function pruneEmptyUploadDirectories(filePath) {
  let currentDir = path.dirname(filePath);

  while (currentDir.startsWith(PRODUCT_UPLOADS_DIR) && currentDir !== PRODUCT_UPLOADS_DIR) {
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
  const absolutePath = getManagedUploadPathFromUrl(url);
  if (!absolutePath) return;

  try {
    await fsp.unlink(absolutePath);
    await pruneEmptyUploadDirectories(absolutePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("IMAGE CLEANUP WARNING:", error.message);
    }
  }
}

async function saveUploadedProductImageBuffer(productCode, themeMode, buffer, { fileName, mimeType }) {
  const themeDir = path.join(PRODUCT_UPLOADS_DIR, "catalog", productCode, themeMode);
  const extension = getPreferredImageExtension({ fileName, mimeType });

  await fsp.mkdir(themeDir, { recursive: true });

  const storedFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const filePath = path.join(themeDir, storedFileName);

  await fsp.writeFile(filePath, buffer);

  return `/uploads/products/catalog/${productCode}/${themeMode}/${storedFileName}`;
}

async function saveProductImageDataUrl(productId, themeMode, sortOrder, dataUrl) {
  const { buffer, extension } = decodeImageDataUrl(dataUrl);
  const themeDir = path.join(PRODUCT_UPLOADS_DIR, String(productId), themeMode);

  await fsp.mkdir(themeDir, { recursive: true });

  const fileName = `${Date.now()}-${sortOrder}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const filePath = path.join(themeDir, fileName);

  await fsp.writeFile(filePath, buffer);

  return `/uploads/products/${productId}/${themeMode}/${fileName}`;
}

async function materializeProductImages(productId, themeMode, imageSources, createdUploadUrls) {
  const resolvedUrls = [];

  for (let index = 0; index < imageSources.length; index += 1) {
    const source = imageSources[index];
    if (DATA_IMAGE_URL_REGEX.test(source)) {
      const storedUrl = await saveProductImageDataUrl(productId, themeMode, index, source);
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

const PRODUCT_SELECT_SQL = `
  SELECT
    p.id,
    p.product_id,
    p.name,
    p.category,
    p.subcategory,
    p.description,
    p.quality_points,
    p.buy_enabled,
    p.rent_enabled,
    p.buy_price,
    p.rent_price_per_day,
    p.currency,
    p.active,
    p.created_at,
    p.updated_at,
    COALESCE(inv.quantity_available, 0)::INT AS quantity_available,
    COALESCE(inv.reorder_level, 0)::INT AS reorder_level,
    COALESCE(cost.unit_cost, 0) AS unit_cost,
    COALESCE(cost.overhead_cost, 0) AS overhead_cost,
    COALESCE(img.light_images, '[]'::json) AS light_images,
    COALESCE(img.dark_images, '[]'::json) AS dark_images,
    COALESCE(img.image_url, '') AS image_url
  FROM products p
  LEFT JOIN product_inventory inv ON inv.product_id = p.id
  LEFT JOIN product_costs cost ON cost.product_id = p.id
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
  const currency = String(body?.currency || "USD")
    .trim()
    .toUpperCase();
  const legacyImageUrl = String(body?.image_url || "").trim();
  const lightImages = normalizeImageSourceList(body?.light_images);
  const darkImages = normalizeImageSourceList(body?.dark_images);

  if (!lightImages.length && !darkImages.length && legacyImageUrl) {
    lightImages.push(legacyImageUrl);
  }

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

  if (lightImages.length > MAX_PRODUCT_IMAGES_PER_MODE) {
    throw createHttpError(400, "A product can have up to 10 light mode images.");
  }

  if (darkImages.length > MAX_PRODUCT_IMAGES_PER_MODE) {
    throw createHttpError(400, "A product can have up to 10 dark mode images.");
  }

  return {
    product_id: productId,
    name,
    category,
    subcategory,
    description,
    quality_points: normalizeQualityPoints(body?.quality_points),
    buy_enabled: buyEnabled,
    rent_enabled: rentEnabled,
    buy_price: parseOptionalNumber(body?.buy_price, "Buy price"),
    rent_price_per_day: parseOptionalNumber(body?.rent_price_per_day, "Rent price / day"),
    currency,
    active: parseBoolean(body?.active, true),
    quantity_available: parseWholeNumber(body?.quantity_available, "Quantity available"),
    reorder_level: parseWholeNumber(body?.reorder_level, "Reorder level"),
    unit_cost: parseOptionalNumber(body?.unit_cost, "Unit cost") ?? 0,
    overhead_cost: parseOptionalNumber(body?.overhead_cost, "Overhead cost") ?? 0,
    image_url: lightImages[0] || darkImages[0] || legacyImageUrl,
    light_images: lightImages,
    dark_images: darkImages
  };
}

function parseProductRouteId(rawId) {
  const productId = Number(rawId);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw createHttpError(400, "Product id must be a positive integer.");
  }
  return productId;
}

async function listProducts() {
  const result = await pool.query(`${PRODUCT_SELECT_SQL} ORDER BY p.id ASC`);
  return result.rows.map((row) => ({
    ...row,
    ...resolveProductImageCollections(row)
  }));
}

async function getProductById(productId) {
  const result = await pool.query(`${PRODUCT_SELECT_SQL} WHERE p.id = $1 LIMIT 1`, [productId]);
  if (!result.rows[0]) return null;

  return {
    ...result.rows[0],
    ...resolveProductImageCollections(result.rows[0])
  };
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
    INSERT INTO product_inventory (product_id, quantity_available, reorder_level, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (product_id)
    DO UPDATE SET
      quantity_available = EXCLUDED.quantity_available,
      reorder_level = EXCLUDED.reorder_level,
      updated_at = NOW()
    `,
    [productId, product.quantity_available, product.reorder_level]
  );

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

  try {
    const lightImageUrls = await materializeProductImages(
      productId,
      "light",
      product.light_images,
      createdUploadUrls
    );
    const darkImageUrls = await materializeProductImages(
      productId,
      "dark",
      product.dark_images,
      createdUploadUrls
    );

    await client.query("DELETE FROM product_images WHERE product_id = $1", [productId]);

    for (let index = 0; index < lightImageUrls.length; index += 1) {
      await client.query(
        `
        INSERT INTO product_images (product_id, url, sort_order, theme_mode)
        VALUES ($1, $2, $3, 'light')
        `,
        [productId, lightImageUrls[index], index]
      );
    }

    for (let index = 0; index < darkImageUrls.length; index += 1) {
      await client.query(
        `
        INSERT INTO product_images (product_id, url, sort_order, theme_mode)
        VALUES ($1, $2, $3, 'dark')
        `,
        [productId, darkImageUrls[index], index]
      );
    }

    await cleanupUnusedProductUploads(previousUrls, [
      ...lightImageUrls,
      ...darkImageUrls
    ]);
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
    return res.status(409).json({ error: "Product ID already exists." });
  }

  console.error(logPrefix, error.message);

  return res.status(500).json({
    error: "Server error",
    details: error.message
  });
}

app.get("/", (_req, res) => {
  res.send("EventMart API running");
});

app.post(["/product-images/upload", "/api/product-images/upload"], PRODUCT_IMAGE_UPLOAD_PARSER, async (req, res) => {
  try {
    const productCode = parseProductCode(req.query.product_id);
    const themeMode = parseThemeMode(req.query.theme_mode);
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

    const url = await saveUploadedProductImageBuffer(productCode, themeMode, buffer, {
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

app.get(["/products", "/api/products"], async (_req, res) => {
  try {
    const rows = await listProducts();
    res.json(rows);
  } catch (err) {
    return sendProductError(res, err, "PRODUCTS ROUTE ERROR:");
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
          category,
          subcategory,
          description,
          quality_points,
          buy_enabled,
          rent_enabled,
          buy_price,
          rent_price_per_day,
          currency,
          active,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING id
        `,
        [
          product.product_id,
          product.name,
          product.category,
          product.subcategory,
          product.description,
          JSON.stringify(product.quality_points),
          product.buy_enabled,
          product.rent_enabled,
          product.buy_price,
          product.rent_price_per_day,
          product.currency,
          product.active
        ]
      );

      const productId = insertResult.rows[0].id;
      await syncProductRelations(client, productId, product);
      return productId;
    });

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
            category = $3,
            subcategory = $4,
            description = $5,
            quality_points = $6::jsonb,
            buy_enabled = $7,
            rent_enabled = $8,
            buy_price = $9,
            rent_price_per_day = $10,
            currency = $11,
            active = $12,
            updated_at = NOW()
        WHERE id = $13
        RETURNING id
        `,
        [
          product.product_id,
          product.name,
          product.category,
          product.subcategory,
          product.description,
          JSON.stringify(product.quality_points),
          product.buy_enabled,
          product.rent_enabled,
          product.buy_price,
          product.rent_price_per_day,
          product.currency,
          product.active,
          routeProductId
        ]
      );

      if (!updateResult.rows.length) {
        throw createHttpError(404, "Product not found.");
      }

      await syncProductRelations(client, routeProductId, product);
    });

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
    const existingUrls = existingImagesResult.rows
      .map((row) => String(row.url || "").trim())
      .filter(Boolean);
    const result = await pool.query("DELETE FROM products WHERE id = $1 RETURNING id", [routeProductId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Product not found." });
    }

    await Promise.all(
      existingUrls.filter((url) => isManagedProductUploadUrl(url)).map(removeManagedProductUploadUrl)
    );

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

    if (!OPENAI_API_KEY || typeof fetch !== "function") {
      return res.json({
        message: fallbackPlannerReply(prompt, context, catalog),
        source: "fallback"
      });
    }

    const systemPrompt = [
      "You are EventMart's AI Event Planner assistant.",
      "Create practical recommendations using only products from the provided catalog.",
      "Keep the answer structured with short sections and bullet points.",
      "Format the reply in markdown with ### headings and put every bullet on its own line.",
      "Always include: event summary, recommended products, and a concise timeline.",
      "Avoid mentioning products not in the catalog."
    ].join(" ");

    const userPrompt = JSON.stringify({
      request: prompt,
      context,
      catalog
    });

    const aiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.5,
        max_output_tokens: 850,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }]
          }
        ]
      })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI PLANNER OPENAI ERROR:", aiRes.status, errText.slice(0, 600));
      return res.json({
        message: fallbackPlannerReply(prompt, context, catalog),
        source: "fallback"
      });
    }

    const payload = await aiRes.json();
    const reply = extractResponseText(payload);

    if (!reply) {
      return res.json({
        message: fallbackPlannerReply(prompt, context, catalog),
        source: "fallback"
      });
    }

    return res.json({
      message: reply,
      source: "openai",
      model: OPENAI_MODEL
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

app.get("/api/me/orders", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        o.id,
        o.status,
        o.subtotal,
        o.tax,
        o.discount,
        o.shipping,
        o.total,
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
