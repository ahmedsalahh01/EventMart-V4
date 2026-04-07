import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import useRequireAuth from "../hooks/useRequireAuth";
import { EGYPT_GOVERNORATES } from "../lib/checkout";
import { listEventTypes } from "../lib/eventTypeConfig";
import {
  createCartItemsFromBuilderPreview,
  createPackageGroupId,
  previewPackageBuilder
} from "../lib/packages";
import "../styles/packages.css";

function buildSelectionPayload(selections) {
  return Object.values(selections || {}).map((entry) => ({
    customizationRequested: Boolean(entry?.customizationRequested),
    mode: entry?.mode || "buy",
    productId: Number(entry?.productId),
    quantity: Number(entry?.quantity || 0)
  }));
}

function matchesPackageSearch(product, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    product?.name,
    product?.category,
    product?.subcategory,
    product?.builderCategoryLabel,
    product?.description,
    product?.productId
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function PackageBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packageSlug = searchParams.get("package") || "";
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [selections, setSelections] = useState({});
  const [context, setContext] = useState(() => ({
    budget: "",
    deliveryPlace: "",
    eventType: searchParams.get("eventType") || "",
    guestCount: "",
    venueSize: "",
    venueType: ""
  }));
  const [packageGroupId] = useState(() => createPackageGroupId(packageSlug ? "package" : "builder"));
  const { requireAuth } = useRequireAuth();
  const { setItems } = useCart();

  const selectionPayload = useMemo(() => buildSelectionPayload(selections), [selections]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    previewPackageBuilder({
      context,
      packageGroupId,
      packageSlug: packageSlug || undefined,
      selectedItems: selectionPayload
    })
      .then((payload) => {
        if (cancelled) return;
        setPreview(payload);
        setLoading(false);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError?.message || "Unable to load the package builder right now.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [context, packageGroupId, packageSlug, selectionPayload]);

  const groupedProducts = useMemo(() => {
    const products = Array.isArray(preview?.products) ? preview.products : [];
    return (Array.isArray(preview?.categories) ? preview.categories : []).map((category) => ({
      ...category,
      products: products.filter(
        (product) =>
          product.builderCategory === category.key &&
          matchesPackageSearch(product, search)
      )
    }));
  }, [preview?.categories, preview?.products, search]);

  const selectedItemMap = useMemo(
    () => new Map((Array.isArray(preview?.selectedItems) ? preview.selectedItems : []).map((item) => [Number(item.id), item])),
    [preview?.selectedItems]
  );

  function updateContext(field, value) {
    setContext((current) => ({
      ...current,
      [field]: value
    }));
    setMessage("");
  }

  function updateSelection(product, changes) {
    setSelections((current) => {
      const existing = current[product.id] || {
        customizationRequested: false,
        mode: product.defaultMode || "buy",
        productId: Number(product.id),
        quantity: 0
      };
      const next = {
        ...existing,
        ...changes,
        productId: Number(product.id)
      };

      return {
        ...current,
        [product.id]: next
      };
    });
    setMessage("");
  }

  function replacePackageCartItems(nextPreview) {
    const cartItems = createCartItemsFromBuilderPreview(nextPreview);

    setItems((current) => [
      ...current.filter((item) => item?.package_meta?.packageGroupId !== packageGroupId),
      ...cartItems
    ]);
  }

  function handleSaveToCart(nextPreview, { checkout = false } = {}) {
    if (!nextPreview?.canCheckout) return;

    replacePackageCartItems(nextPreview);
    setMessage(checkout ? "Package saved to cart. Redirecting to checkout..." : "Package saved to your cart.");

    if (checkout) {
      if (!requireAuth({ returnTo: "/checkout" })) {
        return;
      }

      navigate("/checkout");
      return;
    }

    navigate("/cart");
  }

  if (loading) {
    return (
      <main className="packages-page" data-theme-scope="packages">
        <section className="package-shell-card package-state-card">
          <p className="package-eyebrow">Package Builder</p>
          <h1>Loading your builder workspace...</h1>
          <p>We&apos;re matching products, pricing tiers, and package rules.</p>
        </section>
      </main>
    );
  }

  if (error || !preview) {
    return (
      <main className="packages-page" data-theme-scope="packages">
        <section className="package-shell-card package-state-card">
          <p className="package-eyebrow">Package Builder</p>
          <h1>This builder is currently unavailable.</h1>
          <p>{error || "We couldn't prepare the package builder."}</p>
          <Link className="package-primary-link" to="/packages">
            Browse Packages
          </Link>
        </section>
      </main>
    );
  }

  return (
    <motion.main
      className="packages-page"
      data-theme-scope="packages"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      <div className="packages-layout package-builder-layout">
        <section className="package-builder-main">
          <div className="package-shell-card package-builder-hero">
            <div>
              <p className="package-eyebrow">{packageSlug ? "Customize Package" : "Start Building"}</p>
              <h1>{packageSlug ? "Adjust the default package to fit your event." : "Create your event package with live rules and pricing."}</h1>
              <p className="package-copy">
                Select your event details, choose the items that fit your venue and budget, and keep the bundle valid with live quantity, shipping, and discount guidance.
              </p>
            </div>

            <div className="package-builder-actions">
              <button
                className="package-primary-button"
                disabled={!preview.canCheckout}
                onClick={() => handleSaveToCart(preview, { checkout: true })}
                type="button"
              >
                Checkout This Package
              </button>
              <button
                className="package-secondary-button"
                disabled={!preview.canCheckout}
                onClick={() => handleSaveToCart(preview)}
                type="button"
              >
                Save to Cart
              </button>
            </div>
          </div>

          <div className="package-shell-card package-filters-card">
            <div className="package-card-head">
              <div>
                <p className="package-eyebrow">Event Setup</p>
                <h2>Package parameters</h2>
              </div>
            </div>

            <div className="package-form-grid">
              <label className="package-field">
                <span>Event type</span>
                <select value={context.eventType} onChange={(event) => updateContext("eventType", event.target.value)}>
                  <option value="">Select event type</option>
                  {listEventTypes().map((eventType) => (
                    <option key={eventType.slug} value={eventType.slug}>
                      {eventType.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="package-field">
                <span>Venue type</span>
                <select value={context.venueType} onChange={(event) => updateContext("venueType", event.target.value)}>
                  <option value="">Select venue type</option>
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              </label>

              <label className="package-field">
                <span>Venue size</span>
                <input
                  onChange={(event) => updateContext("venueSize", event.target.value)}
                  placeholder="Hall, ballroom, open ground..."
                  type="text"
                  value={context.venueSize}
                />
              </label>

              <label className="package-field">
                <span>Guest count</span>
                <input
                  min="0"
                  onChange={(event) => updateContext("guestCount", event.target.value)}
                  placeholder="120"
                  type="number"
                  value={context.guestCount}
                />
              </label>

              <label className="package-field">
                <span>Budget</span>
                <input
                  min="0"
                  onChange={(event) => updateContext("budget", event.target.value)}
                  placeholder="15000"
                  type="number"
                  value={context.budget}
                />
              </label>

              <label className="package-field">
                <span>Delivery place</span>
                <select value={context.deliveryPlace} onChange={(event) => updateContext("deliveryPlace", event.target.value)}>
                  <option value="">Select governorate</option>
                  {EGYPT_GOVERNORATES.map((governorate) => (
                    <option key={governorate} value={governorate}>
                      {governorate}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="package-shell-card package-products-card">
            <div className="package-card-head">
              <div>
                <p className="package-eyebrow">Catalog Selection</p>
                <h2>Grouped products</h2>
              </div>

              <label className="package-search">
                <span className="sr-only">Search package products</span>
                <input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search merch, screens, sound..."
                  type="search"
                  value={search}
                />
              </label>
            </div>

            <div className="package-category-stack">
              {groupedProducts.map((group) => (
                <section key={group.key} className="package-category-group" aria-labelledby={`package-group-${group.key}`}>
                  <div className="package-category-head">
                    <div>
                      <h3 id={`package-group-${group.key}`}>{group.label}</h3>
                      <p>{group.message}</p>
                    </div>
                    <span className={`package-requirement-pill is-${group.level}`}>
                      {group.level}
                    </span>
                  </div>

                  {group.products.length ? (
                    <div className="package-product-grid">
                      {group.products.map((product) => {
                        const quantity = Number(product.quantity || 0);
                        const maxQuantity = Number(product.maxQuantity || 0);
                        const isDisabled = !product.eligibility?.eligible;
                        const selectedPreview = selectedItemMap.get(Number(product.id));

                        return (
                          <article
                            className={`package-product-card${product.isSelected ? " is-selected" : ""}${isDisabled ? " is-disabled" : ""}`}
                            key={product.id}
                          >
                            <div className="package-product-media">
                              <img alt={product.name} src={product.imageUrl || "/assets/equipment-collage.jpg"} />
                            </div>

                            <div className="package-product-body">
                              <div className="package-product-copy">
                                <div>
                                  <p className="package-card-kicker">{product.builderCategoryLabel}</p>
                                  <h4>{product.name}</h4>
                                </div>
                                <p>{product.description || "No description available for this item."}</p>
                              </div>

                              <div className="package-product-meta">
                                <span>{product.buyPrice !== null ? `Buy ${product.buyPrice}` : "Buy unavailable"}</span>
                                <span>{product.rentPricePerDay !== null ? `Rent ${product.rentPricePerDay}/day` : "Rent unavailable"}</span>
                                {product.maxQuantity !== null ? <span>Max {product.maxQuantity}</span> : null}
                              </div>

                              {selectedPreview ? (
                                <div className="package-product-pricing">
                                  <span>Effective unit {selectedPreview.currency} {Number(selectedPreview.effectiveUnitPrice || selectedPreview.unitPrice || 0).toFixed(2)}</span>
                                  {selectedPreview.itemDiscount ? (
                                    <span>Discount {selectedPreview.currency} {Number(selectedPreview.itemDiscount || 0).toFixed(2)}</span>
                                  ) : null}
                                  {selectedPreview.customizationFee ? (
                                    <span>Customization {selectedPreview.currency} {Number(selectedPreview.customizationFee || 0).toFixed(2)}</span>
                                  ) : null}
                                </div>
                              ) : null}

                              {!product.eligibility?.eligible ? (
                                <p className="package-inline-error">
                                  {product.eligibility?.reasons?.[0] || "This product is not eligible right now."}
                                </p>
                              ) : null}

                              <div className="package-product-controls">
                                <label className="package-inline-field">
                                  <span>Mode</span>
                                  <select
                                    disabled={isDisabled}
                                    onChange={(event) => updateSelection(product, { mode: event.target.value })}
                                    value={(selections[product.id]?.mode || product.defaultMode || "buy")}
                                  >
                                    {product.buyEnabled ? <option value="buy">Buy</option> : null}
                                    {product.rentEnabled ? <option value="rent">Rent</option> : null}
                                  </select>
                                </label>

                                <label className="package-inline-field">
                                  <span>Qty</span>
                                  <div className="package-qty-controls">
                                    <button
                                      disabled={isDisabled || quantity <= 0}
                                      onClick={() => updateSelection(product, { quantity: Math.max(0, quantity - 1) })}
                                      type="button"
                                    >
                                      -
                                    </button>
                                    <input
                                      disabled={isDisabled}
                                      max={maxQuantity || undefined}
                                      min="0"
                                      onChange={(event) => updateSelection(product, { quantity: Number(event.target.value || 0) })}
                                      type="number"
                                      value={quantity}
                                    />
                                    <button
                                      disabled={isDisabled || (maxQuantity > 0 && quantity >= maxQuantity)}
                                      onClick={() => updateSelection(product, { quantity: quantity + 1 })}
                                      type="button"
                                    >
                                      +
                                    </button>
                                  </div>
                                </label>

                                {product.customizable ? (
                                  <label className="package-checkbox">
                                    <input
                                      checked={Boolean(selections[product.id]?.customizationRequested)}
                                      onChange={(event) => updateSelection(product, { customizationRequested: event.target.checked })}
                                      type="checkbox"
                                    />
                                    <span>Customization</span>
                                  </label>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="package-category-empty">
                      {search
                        ? "No products in this category match the current search."
                        : "No eligible products are currently available in this category for the selected setup."}
                    </p>
                  )}
                </section>
              ))}
            </div>
          </div>
        </section>

        <aside className="package-builder-summary">
          <div className="package-shell-card package-summary-card">
            <p className="package-eyebrow">Pricing Summary</p>
            <h2>Package totals</h2>

            <div className="package-summary-list">
              <div className="package-summary-row">
                <span>Subtotal</span>
                <strong>{preview.summary.currency} {Number((preview.summary.baseSubtotal ?? preview.summary.subtotal) || 0).toFixed(2)}</strong>
              </div>
              <div className="package-summary-row">
                <span>Item discounts</span>
                <strong>-{preview.summary.currency} {preview.summary.itemDiscounts.toFixed(2)}</strong>
              </div>
              <div className="package-summary-row">
                <span>Customization fees</span>
                <strong>{preview.summary.currency} {preview.summary.customizationFees.toFixed(2)}</strong>
              </div>
              {Number(preview.summary.minimumPackagePrice || 0) > 0 ? (
                <div className="package-summary-row">
                  <span>Minimum package price</span>
                  <strong>{preview.summary.currency} {Number(preview.summary.minimumPackagePrice || 0).toFixed(2)}</strong>
                </div>
              ) : null}
              {Number(preview.summary.bundleDiscount || 0) > 0 ? (
                <div className="package-summary-row">
                  <span>Bundle discount</span>
                  <strong>-{preview.summary.currency} {preview.summary.bundleDiscount.toFixed(2)}</strong>
                </div>
              ) : null}
              <div className="package-summary-row">
                <span>Shipping</span>
                <strong>{preview.summary.currency} {preview.summary.shipping.toFixed(2)}</strong>
              </div>
              <div className="package-summary-row is-total">
                <span>Final total</span>
                <strong>{preview.summary.currency} {preview.summary.finalTotal.toFixed(2)}</strong>
              </div>
            </div>

            <div className="package-summary-notes">
              <p><strong>Delivery estimate:</strong> {preview.summary.deliveryEstimate?.label || "Choose a delivery place to estimate timing."}</p>
              <p><strong>Shipping rule:</strong> {preview.summary.freeShipping ? "Free shipping unlocked." : "Add 4+ units within one builder category to unlock free shipping."}</p>
              {Number(preview.summary.minimumPackagePrice || 0) > 0 ? (
                <p>
                  <strong>Proceed rule:</strong>{" "}
                  {preview.summary.meetsMinimumPackagePrice
                    ? "This package meets the minimum package price."
                    : `Add ${preview.summary.currency} ${Number(preview.summary.remainingToMinimumPrice || 0).toFixed(2)} more in items to continue.`}
                </p>
              ) : null}
            </div>

            {message ? <p className="package-inline-success">{message}</p> : null}

            <div className="package-validation-list">
              {preview.validations.map((issue) => (
                <p className={`package-validation is-${issue.level}`} key={`${issue.code}-${issue.message}`}>
                  {issue.message}
                </p>
              ))}
            </div>

            <div className="package-summary-actions">
              <button
                className="package-primary-button"
                disabled={!preview.canCheckout}
                onClick={() => handleSaveToCart(preview, { checkout: true })}
                type="button"
              >
                Checkout This Package
              </button>
              <Link className="package-secondary-link" to="/packages">
                Browse default packages
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </motion.main>
  );
}

export default PackageBuilderPage;
