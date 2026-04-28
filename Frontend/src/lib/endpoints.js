// Central registry of every backend API path used by the frontend.
// Import the constant you need instead of writing raw strings.

export const ENDPOINTS = Object.freeze({

  // ── Config ────────────────────────────────────────────────────────────────
  CONFIG_BUILDER: "/api/config/builder",

  // ── Auth ──────────────────────────────────────────────────────────────────
  AUTH_LOGIN:    "/api/auth/login",
  AUTH_REGISTER: "/api/auth/register",

  // ── Current user ──────────────────────────────────────────────────────────
  ME:        "/api/me",
  ME_ORDERS: "/api/me/orders",

  // ── Orders ────────────────────────────────────────────────────────────────
  /** Append /:publicOrderId/confirmation */
  ORDER_CONFIRMATION: "/api/orders",

  /** POST — place a new order */
  CHECKOUT_ORDERS: "/api/checkout/orders",

  // ── Products ──────────────────────────────────────────────────────────────
  PRODUCTS: "/api/products",

  /** GET /api/products/slug/:slug */
  PRODUCTS_BY_SLUG: "/api/products/slug",

  // ── Packages ──────────────────────────────────────────────────────────────
  PACKAGES: "/api/packages",

  /** POST — preview a package by identifier */
  PACKAGES_PREVIEW: "/api/packages/preview",

  // ── Package builder ───────────────────────────────────────────────────────
  PACKAGE_BUILDER_PREVIEW:      "/api/package-builder/preview",
  PACKAGE_BUILDER_CART_PREVIEW: "/api/package-builder/cart-preview",

  // ── Recommendations ───────────────────────────────────────────────────────
  /** GET /api/recommendations/:productId */
  RECOMMENDATIONS: "/api/recommendations",

  RECOMMENDATIONS_SMART: "/api/recommendations/smart",
  RECOMMENDATIONS_TRACK: "/api/recommendations/track",

  // ── Customization uploads ─────────────────────────────────────────────────
  CUSTOMIZATION_UPLOADS: "/api/customization-uploads",

  // ── Geolocation ───────────────────────────────────────────────────────────
  GEOLOCATION_REVERSE: "/api/geolocation/reverse-egypt",

  // ── AI planner ────────────────────────────────────────────────────────────
  AI_PLANNER: "/api/ai-planner",

  // ── Admin ─────────────────────────────────────────────────────────────────
  ADMIN_PRODUCTS_IMPORT:          "/api/admin/products/import",
  ADMIN_PRODUCTS_IMPORT_TEMPLATE: "/api/admin/products/import-template",
  ADMIN_PRODUCTS_AUTO_DESCRIBE:   "/api/admin/products/auto-describe",

});
