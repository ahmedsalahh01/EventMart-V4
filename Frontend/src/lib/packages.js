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

export async function previewPackageBuilder(payload) {
  return apiRequest("/api/package-builder/preview", {
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
