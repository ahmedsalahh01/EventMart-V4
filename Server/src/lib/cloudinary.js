const crypto = require("crypto");

const DEFAULT_PRODUCT_IMAGE_FOLDER = "eventmart/products";

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeFolderPath(value, fallback = DEFAULT_PRODUCT_IMAGE_FOLDER) {
  const normalized = normalizeString(value).replace(/^\/+|\/+$/g, "");
  return normalized || fallback;
}

function parseCloudinaryUrlConfig(value) {
  const rawValue = normalizeString(value);
  if (!rawValue) return null;

  try {
    const parsed = new URL(rawValue);
    if (parsed.protocol !== "cloudinary:") {
      return null;
    }

    return {
      apiKey: decodeURIComponent(parsed.username || ""),
      apiSecret: decodeURIComponent(parsed.password || ""),
      cloudName: decodeURIComponent(parsed.hostname || "")
    };
  } catch (_error) {
    return null;
  }
}

function getCloudinaryConfig() {
  const parsedUrlConfig = parseCloudinaryUrlConfig(process.env.CLOUDINARY_URL);
  const cloudName = normalizeString(process.env.CLOUDINARY_CLOUD_NAME || parsedUrlConfig?.cloudName);
  const apiKey = normalizeString(process.env.CLOUDINARY_API_KEY || parsedUrlConfig?.apiKey);
  const apiSecret = normalizeString(process.env.CLOUDINARY_API_SECRET || parsedUrlConfig?.apiSecret);
  const productImageFolder = normalizeFolderPath(process.env.CLOUDINARY_PRODUCT_IMAGE_FOLDER);

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary product image uploads are not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }

  return {
    apiKey,
    apiSecret,
    cloudName,
    productImageFolder
  };
}

function ensureCloudinaryRequestPrimitives() {
  if (
    typeof fetch !== "function" ||
    typeof FormData !== "function" ||
    typeof Blob !== "function"
  ) {
    throw new Error("This Node runtime does not support fetch/FormData/Blob for Cloudinary uploads.");
  }
}

function sanitizePathSegment(value, fallback = "item") {
  const normalized = normalizeString(value)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function sanitizeFileStem(value, fallback = "product-image") {
  const rawValue = normalizeString(value).replace(/\.[^.]+$/, "");
  return sanitizePathSegment(rawValue, fallback);
}

function createSignature(params, apiSecret) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : String(value)}`)
    .join("&");

  return crypto.createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
}

async function sendCloudinaryRequest(endpointPath, params, filePayload = null) {
  ensureCloudinaryRequestPrimitives();

  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const signaturePayload = {
    ...params,
    timestamp
  };
  const signature = createSignature(signaturePayload, config.apiSecret);
  const formData = new FormData();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, Array.isArray(value) ? value.join(",") : String(value));
    }
  });

  formData.append("api_key", config.apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);

  if (filePayload) {
    formData.append(
      "file",
      new Blob([filePayload.buffer], {
        type: filePayload.mimeType || "application/octet-stream"
      }),
      filePayload.fileName || "image"
    );
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${endpointPath}`, {
    method: "POST",
    body: formData
  });
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text ? { error: { message: text } } : null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
      payload?.message ||
      `Cloudinary request failed with status ${response.status}.`
    );
  }

  return payload;
}

function getManagedProductImageFolder(folderSegments = []) {
  const { productImageFolder } = getCloudinaryConfig();

  return [
    productImageFolder,
    ...folderSegments.map((segment) => sanitizePathSegment(segment))
  ].join("/");
}

async function uploadProductImageBuffer(buffer, { fileName, mimeType, folderSegments = [] } = {}) {
  const folder = getManagedProductImageFolder(folderSegments);
  const publicId = `${sanitizeFileStem(fileName)}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const payload = await sendCloudinaryRequest(
    "image/upload",
    {
      folder,
      public_id: publicId
    },
    {
      buffer,
      fileName,
      mimeType
    }
  );

  return {
    publicId: String(payload?.public_id || ""),
    secureUrl: String(payload?.secure_url || "").trim()
  };
}

function extractCloudinaryPublicId(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    if (parsed.hostname !== "res.cloudinary.com") {
      return "";
    }

    const marker = "/image/upload/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return "";
    }

    const suffix = parsed.pathname.slice(markerIndex + marker.length);
    const segments = suffix
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    if (!segments.length) {
      return "";
    }

    if (/^v\d+$/.test(segments[0])) {
      segments.shift();
    }

    if (!segments.length) {
      return "";
    }

    const lastSegment = segments.pop();
    const withoutExtension = String(lastSegment || "").replace(/\.[^.]+$/, "");
    const publicId = [...segments, withoutExtension].filter(Boolean).join("/");
    const { productImageFolder } = getCloudinaryConfig();

    return publicId.startsWith(`${productImageFolder}/`) ? publicId : "";
  } catch (_error) {
    return "";
  }
}

function isManagedProductImageUrl(url) {
  return Boolean(extractCloudinaryPublicId(url));
}

async function deleteManagedProductImage(url) {
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return false;

  const payload = await sendCloudinaryRequest("image/destroy", {
    invalidate: "true",
    public_id: publicId
  });

  return payload?.result === "ok" || payload?.result === "not found";
}

module.exports = {
  deleteManagedProductImage,
  isManagedProductImageUrl,
  uploadProductImageBuffer
};
