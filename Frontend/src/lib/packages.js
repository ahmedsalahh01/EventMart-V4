import { apiRequest } from "./api";

function createRandomSuffix() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

export function createPackageGroupId(prefix = "pkg") {
  return `${prefix}-${createRandomSuffix()}`;
}

export async function loadPackages() {
  const rows = await apiRequest("/api/packages");
  return Array.isArray(rows) ? rows : [];
}

export async function loadPackageByIdentifier(identifier) {
  return apiRequest(`/api/packages/${encodeURIComponent(identifier)}`);
}

export async function previewPackageBuilder(payload, options = {}) {
  return apiRequest("/api/package-builder/preview", {
    ...options,
    body: payload,
    method: "POST"
  });
}

export async function previewPackage(payload) {
  return apiRequest("/api/packages/preview", {
    body: payload,
    method: "POST"
  });
}

export async function previewPackageCart(items) {
  return apiRequest("/api/package-builder/cart-preview", {
    body: { items },
    method: "POST"
  });
}

export function normalizePackageMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["buy", "rent", "hybrid"].includes(normalized) ? normalized : "hybrid";
}

export function getPackageCurrency(pkg) {
  const items = Array.isArray(pkg?.items) ? pkg.items : [];
  const firstItemCurrency = items.find((item) => item?.product?.currency)?.product?.currency;
  return String(firstItemCurrency || "EGP");
}

export function getPackageDisplayPrice(pkg) {
  const configuredPrice = Number(pkg?.contextDefaults?.packagePrice || 0);
  const currency = getPackageCurrency(pkg);

  return {
    amount: configuredPrice > 0 ? configuredPrice : 0,
    currency,
    source: configuredPrice > 0 ? "configured" : "missing"
  };
}

export function getPackageVenueLabel(pkg) {
  const venueType = String(pkg?.contextDefaults?.venueType || "").trim().toLowerCase();
  if (venueType === "indoor") return "Indoor";
  if (venueType === "outdoor") return "Outdoor";
  if (venueType === "hybrid") return "Hybrid";
  return "General";
}

export function getPackageAudienceLabel(pkg) {
  const guestCount = Math.max(0, Number(pkg?.contextDefaults?.guestCount || 0));
  return guestCount > 0 ? `${guestCount} people` : "Flexible guest count";
}

export function getPackageCustomizationLabel(pkg) {
  const explicitValue = pkg?.contextDefaults?.customizationAvailable;
  const hasCustomizableItem = Array.isArray(pkg?.items) && pkg.items.some((item) => Boolean(item?.product?.customizable));
  const isCustomizable = explicitValue === undefined || explicitValue === null
    ? hasCustomizableItem
    : Boolean(explicitValue);

  return isCustomizable ? "Customizable items" : "No customization";
}

export function getPackageModeLabel(pkg) {
  const mode = normalizePackageMode(pkg?.contextDefaults?.packageMode);
  if (mode === "buy") return "Buy only";
  if (mode === "rent") return "Rent only";
  return "Hybrid";
}

export function buildPackageDescription(pkg) {
  const explicitDescription = String(pkg?.description || "").trim();
  if (explicitDescription) {
    return explicitDescription;
  }

  const details = [];
  const guestCount = Math.max(0, Number(pkg?.contextDefaults?.guestCount || 0));

  if (guestCount > 0) {
    details.push(`Fits up to ${guestCount} people`);
  }

  details.push(`${getPackageVenueLabel(pkg)} setup`);
  details.push(getPackageCustomizationLabel(pkg));
  details.push(getPackageModeLabel(pkg));

  return details.join(". ");
}

export function createCartItemsFromBuilderPreview(preview) {
  const products = Array.isArray(preview?.products) ? preview.products : [];
  const selectedItems = Array.isArray(preview?.selectedItems) ? preview.selectedItems : [];
  const productMap = new Map(products.map((product) => [Number(product.id), product]));

  return selectedItems
    .map((entry) => {
      const product = productMap.get(Number(entry?.id));
      if (!product) return null;

      return {
        buy_enabled: Boolean(product.buyEnabled),
        buy_price: product.buyPrice,
        category: product.category,
        currency: product.currency,
        customizable: Boolean(product.customizable),
        customization_requested: Boolean(entry?.packageMeta?.customizationRequested),
        description: product.description,
        id: String(product.id),
        image_url: product.imageUrl || "",
        images: product.imageUrl ? [product.imageUrl] : [],
        mode: entry.mode === "rent" ? "rent" : "buy",
        name: product.name,
        package_meta: entry.packageMeta || null,
        product_id: String(product.productId || ""),
        quantity: Number(entry.quantity || 1),
        rent_enabled: Boolean(product.rentEnabled),
        rent_price_per_day: product.rentPricePerDay,
        slug: product.slug || "",
        stock: Number(product.stock || product.maxQuantity || 0),
        subcategory: product.subcategory
      };
    })
    .filter(Boolean);
}
