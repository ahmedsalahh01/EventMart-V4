import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import useRequireAuth from "../hooks/useRequireAuth";
import { listEventTypes } from "../lib/eventTypeConfig";
import {
  ATTENDEES_RANGES,
  CATEGORY_TO_SECTION,
  PACKAGE_SECTIONS,
  computeSectionTotals,
  getPackageMinimums,
  getTotalMinimum,
  validateMinimums
} from "../lib/packageMinimums";
import { apiRequest } from "../lib/api";
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
  const [builderConfig, setBuilderConfig] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(packageSlug));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selections, setSelections] = useState({});
  const [context, setContext] = useState(() => ({
    attendeesRange: "",
    eventType: searchParams.get("eventType") || "",
    venueType: ""
  }));
  const [packageGroupId] = useState(() => createPackageGroupId(packageSlug ? "package" : "builder"));
  const { requireAuth } = useRequireAuth();
  const { setItems } = useCart();

  const isConfigComplete = Boolean(context.venueType && context.eventType && context.attendeesRange);
  const selectionPayload = useMemo(() => buildSelectionPayload(selections), [selections]);

  useEffect(() => {
    apiRequest("/api/config/builder").then(setBuilderConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (!packageSlug && !isConfigComplete) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const hasPreview = Boolean(preview);
    const requestDelay = hasPreview ? 250 : 0;

    const timeoutId = window.setTimeout(() => {
      if (hasPreview) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      previewPackageBuilder(
        {
          context,
          packageGroupId,
          packageSlug: packageSlug || undefined,
          selectedItems: selectionPayload
        },
        { signal: controller.signal }
      )
        .then((payload) => {
          if (controller.signal.aborted) return;
          setPreview(payload);
          setLoading(false);
          setIsRefreshing(false);
        })
        .catch((requestError) => {
          if (controller.signal.aborted || requestError?.name === "AbortError") return;
          setError(requestError?.message || "Unable to load the package builder right now.");
          setLoading(false);
          setIsRefreshing(false);
        });
    }, requestDelay);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [context, isConfigComplete, packageGroupId, packageSlug, selectionPayload]);

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

  const minimums = useMemo(
    () => getPackageMinimums(context.venueType, context.eventType, context.attendeesRange, builderConfig?.minimumMatrix),
    [builderConfig?.minimumMatrix, context.venueType, context.eventType, context.attendeesRange]
  );

  const sectionTotals = useMemo(
    () => computeSectionTotals(Array.isArray(preview?.products) ? preview.products : [], selections),
    [preview?.products, selections]
  );

  const minimumViolations = useMemo(
    () => validateMinimums(minimums, sectionTotals),
    [minimums, sectionTotals]
  );

  const totalMinimum = useMemo(() => getTotalMinimum(minimums), [minimums]);

  const canCheckout = Boolean(preview?.canCheckout) && minimumViolations.length === 0;

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
    if (!nextPreview?.canCheckout || minimumViolations.length > 0) return;

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

  if (loading && !preview) {
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

  function renderSectionMinimum(group) {
    if (!minimums) return null;
    const sectionKey = CATEGORY_TO_SECTION[group.key];
    if (!sectionKey) return null;
    const required = minimums[sectionKey] || 0;
    if (required === 0) return null;
    const current = sectionTotals[sectionKey] || 0;
    const isMet = current >= required;
    const sectionLabel = PACKAGE_SECTIONS[sectionKey].label;
    return (
      <p className={`package-section-minimum ${isMet ? "is-met" : "is-unmet"}`}>
        {isMet
          ? `${sectionLabel} minimum met — ${current} / ${required} required`
          : `Minimum required quantity for ${sectionLabel} is ${required} for this event setup (you have ${current})`}
      </p>
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
                Select your venue type, event type, and attendees range to update product matches and package rules automatically.
              </p>
              {isRefreshing ? (
                <p className="package-refresh-state">Refreshing package pricing and builder rules...</p>
              ) : null}
            </div>

            <div className="package-builder-actions">
              <button
                className="package-primary-button"
                disabled={!canCheckout}
                onClick={() => handleSaveToCart(preview, { checkout: true })}
                type="button"
              >
                Checkout This Package
              </button>
              <button
                className="package-secondary-button"
                disabled={!canCheckout}
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
                <h2>Configure your event</h2>
                <p className="package-copy">Fill in the details below — the product list and pricing update automatically.</p>
              </div>
            </div>

            <div className="package-form-grid">
              <label className="package-field">
                <span>Venue type</span>
                <select value={context.venueType} onChange={(event) => updateContext("venueType", event.target.value)}>
                  <option value="">Select venue type</option>
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              </label>

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
                <span>Attendees range</span>
                <select value={context.attendeesRange} onChange={(event) => updateContext("attendeesRange", event.target.value)}>
                  <option value="">Select attendees range</option>
                  {(builderConfig?.attendeesRanges || ATTENDEES_RANGES).map((range) => (
                    <option key={range.key} value={range.key}>
                      {range.label}
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
                <h2>Choose your items</h2>
                <p className="package-copy package-products-hint">
                  Set quantity to 0 to exclude an item. Minimum quantities are based on the selected venue, event type, and attendees range.
                </p>
              </div>

              {isConfigComplete || packageSlug ? (
                <label className="package-search">
                  <span className="sr-only">Search package products</span>
                  <input
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name or category..."
                    type="search"
                    value={search}
                  />
                </label>
              ) : null}
            </div>

            {isConfigComplete || packageSlug ? (
              <div className="package-category-stack">
                {groupedProducts.map((group) => (
                  <section key={group.key} className={`package-category-group level-${group.level}`} aria-labelledby={`package-group-${group.key}`}>
                    <div className="package-category-head">
                      <div className="package-category-head-copy">
                        <div className="package-category-title-row">
                          <h3 id={`package-group-${group.key}`}>{group.label}</h3>
                          <span className={`package-requirement-pill is-${group.level}`}>
                            {group.level}
                          </span>
                        </div>
                        {group.message ? <p>{group.message}</p> : null}
                        {renderSectionMinimum(group)}
                      </div>
                    </div>

                    {group.products.length ? (
                      <div className="package-product-list">
                        {group.products.map((product) => {
                          const quantity = Number(product.quantity || 0);
                          const maxQuantity = Number(product.maxQuantity || 0);
                          const isDisabled = !product.eligibility?.eligible;
                          const selectedPreview = selectedItemMap.get(Number(product.id));
                          const currency = selectedPreview?.currency || "EGP";

                          return (
                            <article
                              className={`package-product-card${product.isSelected ? " is-selected" : ""}${isDisabled ? " is-disabled" : ""}`}
                              key={product.id}
                            >
                              <div className="package-product-media">
                                <img alt={product.name} src={product.imageUrl || "/assets/equipment-collage.jpg"} />
                                {product.isSelected ? (
                                  <span className="package-product-check" aria-label="Selected">
                                    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </span>
                                ) : null}
                              </div>

                              <div className="package-product-body">
                                <div className="package-product-header">
                                  <div>
                                    <p className="package-card-kicker">{product.builderCategoryLabel}</p>
                                    <h4>{product.name}</h4>
                                  </div>
                                  <div className="package-product-prices">
                                    {product.buyPrice !== null
                                      ? <span className="package-price-tag">Buy — {currency} {Number(product.buyPrice).toLocaleString()}</span>
                                      : null}
                                    {product.rentPricePerDay !== null
                                      ? <span className="package-price-tag">Rent — {currency} {Number(product.rentPricePerDay).toLocaleString()}/day</span>
                                      : null}
                                    {product.maxQuantity !== null
                                      ? <span className="package-price-tag is-limit">Max qty: {product.maxQuantity}</span>
                                      : null}
                                  </div>
                                </div>

                                {product.description ? (
                                  <p className="package-product-desc">{product.description}</p>
                                ) : null}

                                {selectedPreview ? (
                                  <div className="package-product-pricing-row">
                                    <span>Unit: {currency} {Number(selectedPreview.effectiveUnitPrice || selectedPreview.unitPrice || 0).toFixed(2)}</span>
                                    {selectedPreview.itemDiscount ? (
                                      <span className="is-discount">Saved: {currency} {Number(selectedPreview.itemDiscount).toFixed(2)}</span>
                                    ) : null}
                                    {selectedPreview.customizationFee ? (
                                      <span>Custom fee: {currency} {Number(selectedPreview.customizationFee).toFixed(2)}</span>
                                    ) : null}
                                  </div>
                                ) : null}

                                {!product.eligibility?.eligible ? (
                                  <p className="package-inline-error">
                                    {product.eligibility?.reasons?.[0] || "This product is not eligible right now."}
                                  </p>
                                ) : null}

                                <div className="package-product-controls">
                                  <label className="package-inline-field package-mode-field">
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

                                  <div className="package-inline-field">
                                    <span>Quantity</span>
                                    <div className="package-qty-controls">
                                      <button
                                        disabled={isDisabled || quantity <= 0}
                                        onClick={() => updateSelection(product, { quantity: Math.max(0, quantity - 1) })}
                                        type="button"
                                        aria-label="Decrease quantity"
                                      >
                                        −
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
                                        aria-label="Increase quantity"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {product.customizable ? (
                                    <label className="package-checkbox">
                                      <input
                                        checked={Boolean(selections[product.id]?.customizationRequested)}
                                        onChange={(event) => updateSelection(product, { customizationRequested: event.target.checked })}
                                        type="checkbox"
                                      />
                                      <span>Add customization</span>
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
                          : "No eligible products are available in this category for your selected setup."}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <p className="package-copy" style={{ padding: "1.5rem 0" }}>
                Complete the event setup above — venue type, event type, and attendees range — to see matching products and pricing.
              </p>
            )}
          </div>
        </section>

        <aside className="package-builder-summary">
          <div className="package-shell-card package-summary-card">
            <p className="package-eyebrow">Pricing Summary</p>
            <h2>Package totals</h2>

            <div className="package-summary-list">
              {preview ? (
                <>
                  {totalMinimum > 0 ? (
                    <div className="package-summary-row">
                      <span>Total minimum items</span>
                      <strong>{totalMinimum} items required</strong>
                    </div>
                  ) : null}
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
                </>
              ) : (
                <p className="package-copy">Complete the event setup to see package pricing.</p>
              )}
            </div>

            {preview ? (
              <div className="package-summary-notes">
                <p><strong>Shipping rule:</strong> {preview.summary.freeShipping ? "Free shipping unlocked." : "Add 4+ total items across any builder categories to unlock free shipping."}</p>
              </div>
            ) : null}

            {error ? <p className="package-inline-error">{error}</p> : null}
            {message ? <p className="package-inline-success">{message}</p> : null}

            <div className="package-validation-list">
              {minimumViolations.map((violation) => (
                <p className="package-validation is-warning" key={`min-${violation.section}`}>
                  Minimum required quantity for {violation.label} is {violation.required} for this event setup.
                </p>
              ))}
              {preview?.validations?.map((issue) => (
                <p className={`package-validation is-${issue.level}`} key={`${issue.code}-${issue.message}`}>
                  {issue.message}
                </p>
              ))}
            </div>

            <div className="package-summary-actions">
              <button
                className="package-primary-button"
                disabled={!canCheckout}
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
