import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";
import useRequireAuth from "../hooks/useRequireAuth";
import { resolveEventType } from "../lib/eventTypeConfig";
import {
  ONE_SIZE_LABEL,
  buildProductOptionState,
  getColorSwatchValue,
  validateCustomizationFile
} from "../lib/productDetail";
import {
  bumpMetric,
  deleteCustomizationUploads,
  formatMoney,
  getProductImages,
  loadProductBySlug,
  uploadCustomizationFile
} from "../lib/products";
import { finishProductDwell, startProductDwell, trackEventTypeSelection, trackProductView } from "../lib/userBehavior";
import "../styles/shop.css";

function deriveType(product) {
  if (!product) return "buy";
  if (product.buy_enabled && product.rent_enabled) return "both";
  if (product.rent_enabled) return "rent";
  return "buy";
}

const TYPE_BADGE = {
  rent: { label: "Rental only", className: "ptype-badge ptype-badge-rent" },
  buy: { label: "Buy only", className: "ptype-badge ptype-badge-buy" },
  both: { label: "Rent or buy", className: "ptype-badge ptype-badge-both" }
};

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function diffDaysInclusive(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  const ms = end.getTime() - start.getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

function ProductDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const { theme } = useTheme();
  const { addItem } = useCart();
  const { token } = useAuth();
  const { requireAuth } = useRequireAuth();

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("Loading product...");
  const [error, setError] = useState("");
  const [activeMode, setActiveMode] = useState("buy");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [rentStart, setRentStart] = useState(todayIso());
  const [rentEnd, setRentEnd] = useState(tomorrowIso());
  const [isAdding, setIsAdding] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState("info");
  const [uploads, setUploads] = useState({ design: null, mockup: null });
  const [uploadErrors, setUploadErrors] = useState({ design: "", mockup: "" });
  const [zoom, setZoom] = useState({ active: false, x: 50, y: 50 });

  const mediaRef = useRef(null);
  const activeEventType = resolveEventType(new URLSearchParams(location.search).get("eventType"));
  const shopBackLink = location.search ? `/shop${location.search}` : "/shop";

  useEffect(() => {
    let cancelled = false;
    let loadedProductId = "";

    async function loadProduct() {
      setStatus("Loading product...");
      setError("");

      try {
        const next = await loadProductBySlug(slug);
        if (cancelled) return;

        const initial = buildProductOptionState(next, {});
        const type = deriveType(next);

        setProduct(next);
        setActiveMode(type === "rent" ? "rent" : "buy");
        setSelectedColor(initial.selectedColor);
        setSelectedSize(initial.selectedSize || (initial.size_mode === "one-size" ? ONE_SIZE_LABEL : ""));
        setActiveImageIndex(0);
        setQuantity(1);
        setUploads({ design: null, mockup: null });
        setUploadErrors({ design: "", mockup: "" });
        setActionMessage("");
        setActionTone("info");
        setActiveTab("overview");
        setStatus("");

        bumpMetric(next.id, "product_view", 1);
        loadedProductId = String(next.id || "");
        trackProductView(next, { category: next.category, eventType: activeEventType });
        if (activeEventType) trackEventTypeSelection(activeEventType, { source: "product-detail" });
        startProductDwell(next.id);
      } catch (loadError) {
        if (cancelled) return;
        setProduct(null);
        setError(loadError?.status === 404 ? "We couldn't find that product." : loadError?.message || "We couldn't load this product.");
        setStatus("");
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
      if (loadedProductId) finishProductDwell(loadedProductId);
    };
  }, [activeEventType, slug]);

  const type = deriveType(product);
  const optionState = product
    ? buildProductOptionState(product, { color: selectedColor, size: selectedSize })
    : null;
  const gallery = product ? getProductImages(product, theme) : [];
  const activeVariation = optionState?.activeVariation || null;
  const stockLimit = Math.max(0, Number(activeVariation?.quantity || 0));
  const rentDays = useMemo(() => diffDaysInclusive(rentStart, rentEnd), [rentStart, rentEnd]);
  const datesInvalid = activeMode === "rent" && (!rentStart || !rentEnd || rentDays < 1);

  const customizationFee = Number(product?.customization_fee || 0);
  const isCustomizable = Boolean(product?.customizable);

  function applySelection(next) {
    if (!product) return;
    const nextState = buildProductOptionState(product, next);
    setSelectedColor(nextState.selectedColor);
    setSelectedSize(nextState.selectedSize || (nextState.size_mode === "one-size" ? ONE_SIZE_LABEL : ""));
    setQuantity((current) => {
      const nextStock = Math.max(1, Number(nextState.activeVariation?.quantity || 1));
      return Math.min(current, nextStock);
    });
    setActionMessage("");
  }

  function handleQuantityChange(nextQuantity) {
    setQuantity(Math.max(1, Math.min(Number(nextQuantity || 1), Math.max(1, stockLimit || 1))));
    setActionMessage("");
  }

  function handleUploadChange(uploadKind, fileList) {
    const file = Array.from(fileList || [])[0] || null;
    const validationMessage = validateCustomizationFile(file);
    setUploadErrors((current) => ({ ...current, [uploadKind]: validationMessage }));
    setUploads((current) => ({ ...current, [uploadKind]: validationMessage ? null : file }));
    setActionMessage("");
  }

  function handleZoomMove(event) {
    const node = mediaRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setZoom({ active: true, x, y });
  }

  async function handleAddToCart() {
    if (optionState?.size_mode === "varied" && !selectedColor) {
      setActionMessage("Choose a color first.");
      setActionTone("error");
      return;
    }
    if (optionState?.size_mode === "varied" && !selectedSize) {
      setActionMessage("Choose a size from the selected color.");
      setActionTone("error");
      return;
    }
    if (!product || !optionState || !activeVariation) {
      setActionMessage("This product variation could not be loaded. Please refresh and try again.");
      setActionTone("error");
      return;
    }
    if (stockLimit <= 0) {
      setActionMessage("This selection is currently unavailable.");
      setActionTone("error");
      return;
    }
    if (activeMode === "rent" && datesInvalid) {
      setActionMessage("Pick a start and end date for your rental.");
      setActionTone("error");
      return;
    }
    if (!requireAuth({ returnTo: `/shop/${product.slug}${location.search || ""}` })) return;
    if (uploadErrors.design || uploadErrors.mockup) {
      setActionMessage("Please fix the customization file errors before continuing.");
      setActionTone("error");
      return;
    }

    setIsAdding(true);
    setActionMessage("");
    const uploadedAssets = [];

    try {
      for (const uploadKind of ["mockup", "design"]) {
        const file = uploads[uploadKind];
        if (!file) continue;
        const uploaded = await uploadCustomizationFile({
          file, productId: product.id, token, uploadKind, variationId: activeVariation.id
        });
        uploadedAssets.push(uploaded);
      }

      addItem(product, quantity, activeMode, {
        customization_requested: uploadedAssets.length > 0,
        customization_uploads: uploadedAssets,
        selected_color: activeVariation.color,
        selected_size: activeVariation.size,
        sku: activeVariation.sku,
        stock: activeVariation.quantity,
        variation_id: activeVariation.id,
        event_type: activeEventType,
        rent_start_date: activeMode === "rent" ? rentStart : null,
        rent_end_date: activeMode === "rent" ? rentEnd : null,
        rent_days: activeMode === "rent" ? rentDays : null
      });

      bumpMetric(product.id, activeMode === "rent" ? "add_to_booking" : "add_to_cart", quantity);
      setActionMessage(activeMode === "rent" ? "Booking added. Dates and selections were saved." : "Added to cart.");
      setActionTone("success");
      setUploads({ design: null, mockup: null });
      setUploadErrors({ design: "", mockup: "" });
    } catch (submitError) {
      if (uploadedAssets.length) {
        await deleteCustomizationUploads(uploadedAssets.map((a) => a.uploadToken), token).catch(() => {});
      }
      setActionMessage(submitError?.message || "We couldn't complete this action right now.");
      setActionTone("error");
    } finally {
      setIsAdding(false);
    }
  }

  if (status) {
    return (
      <main className="pdp-shell" data-theme-scope="shop">
        <section className="pdp-status-card"><p>{status}</p></section>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="pdp-shell" data-theme-scope="shop">
        <section className="pdp-status-card pdp-status-card-error">
          <p className="pdp-kicker">Product unavailable</p>
          <h1>This product page is not available.</h1>
          <p>{error || "We couldn't find that product."}</p>
          <Link className="pdp-back" to={shopBackLink}>Back to shop</Link>
        </section>
      </main>
    );
  }

  const badge = TYPE_BADGE[type];
  const description = (product.description || "").trim();
  const qualityPoints = Array.isArray(product.quality_points) ? product.quality_points : [];
  const showOverview = description.length > 0 || qualityPoints.length > 0;

  function renderPriceBlock() {
    if (activeMode === "rent") {
      return (
        <div className="pdp-price-block">
          <strong>{formatMoney(product.rent_price_per_day, product.currency)}</strong>
          <span>/ day</span>
        </div>
      );
    }
    return (
      <div className="pdp-price-block">
        <strong>{formatMoney(product.buy_price, product.currency)}</strong>
      </div>
    );
  }

  return (
    <motion.main
      className="pdp-shell"
      data-theme-scope="shop"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      <div className="pdp-page">
        <nav className="pdp-breadcrumbs" aria-label="Breadcrumb">
          <Link to={shopBackLink}>Shop</Link>
          <span>/</span>
          <span>{product.category}</span>
          <span>/</span>
          <span>{product.name}</span>
        </nav>

        <section className="pdp-hero">
          <div className="pdp-gallery">
            <div
              className={`pdp-media${zoom.active ? " is-zooming" : ""}`}
              ref={mediaRef}
              onMouseEnter={() => setZoom((z) => ({ ...z, active: true }))}
              onMouseMove={handleZoomMove}
              onMouseLeave={() => setZoom({ active: false, x: 50, y: 50 })}
            >
              <img
                src={gallery[activeImageIndex] || gallery[0]}
                alt={product.name}
                style={zoom.active ? {
                  transformOrigin: `${zoom.x}% ${zoom.y}%`,
                  transform: "scale(1.8)"
                } : undefined}
              />
            </div>
            {gallery.length > 1 ? (
              <div className="pdp-thumbs" aria-label="Gallery thumbnails">
                {gallery.map((image, index) => (
                  <button
                    key={`${product.id}-${image}-${index}`}
                    type="button"
                    className={`pdp-thumb${index === activeImageIndex ? " is-active" : ""}`}
                    onClick={() => setActiveImageIndex(index)}
                  >
                    <img src={image} alt={`${product.name} view ${index + 1}`} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="pdp-info">
            <div className="pdp-info-head">
              <span className={badge.className}>{badge.label}</span>
              <p className="pdp-category">{product.category} / {product.subcategory}</p>
              <h1>{product.name}</h1>
              {product.availability_note ? (
                <p className="pdp-availability">{product.availability_note}</p>
              ) : null}
            </div>

            {type === "both" ? (
              <div className="pdp-mode-tabs" role="tablist" aria-label="Choose buy or rent">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeMode === "rent"}
                  className={`pdp-mode-tab${activeMode === "rent" ? " is-active" : ""}`}
                  onClick={() => setActiveMode("rent")}
                >
                  Rent
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeMode === "buy"}
                  className={`pdp-mode-tab${activeMode === "buy" ? " is-active" : ""}`}
                  onClick={() => setActiveMode("buy")}
                >
                  Buy
                </button>
              </div>
            ) : null}

            <div className="pdp-pricing-card">
              {renderPriceBlock()}

              {activeMode === "rent" ? (
                <div className="pdp-date-grid">
                  <label>
                    <span>Start date</span>
                    <input
                      type="date"
                      min={todayIso()}
                      value={rentStart}
                      onChange={(event) => setRentStart(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>End date</span>
                    <input
                      type="date"
                      min={rentStart || todayIso()}
                      value={rentEnd}
                      onChange={(event) => setRentEnd(event.target.value)}
                    />
                  </label>
                  <p className="pdp-duration">
                    {rentDays > 0
                      ? `${rentDays} day${rentDays === 1 ? "" : "s"} - ${formatMoney(Number(product.rent_price_per_day || 0) * rentDays * quantity, product.currency)} total`
                      : "Pick valid dates"}
                  </p>
                </div>
              ) : (
                <div className="pdp-stock-row">
                  <span>{stockLimit > 0 ? `${stockLimit} in stock` : "Out of stock"}</span>
                </div>
              )}

              {optionState.colors.length > 0 ? (
                <div className="pdp-option-row">
                  <span className="pdp-option-label">Color: <strong>{selectedColor || "Select"}</strong></span>
                  <div className="pdp-swatches">
                    {optionState.colors.map((opt) => (
                      <button
                        key={opt.color}
                        type="button"
                        disabled={opt.isDisabled}
                        className={`pdp-swatch${opt.isSelected ? " is-active" : ""}`}
                        onClick={() => applySelection({ color: opt.color, size: "" })}
                        title={opt.color}
                        aria-label={opt.color}
                      >
                        <span style={{ background: getColorSwatchValue(opt.color) }} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {optionState.size_mode === "varied" && optionState.selectedColor ? (
                <div className="pdp-option-row">
                  <span className="pdp-option-label">Size: <strong>{selectedSize || "Select"}</strong></span>
                  <div className="pdp-size-row">
                    {optionState.sizes.map((opt) => (
                      <button
                        key={opt.size}
                        type="button"
                        disabled={opt.isDisabled}
                        className={`pdp-sizebtn${opt.isSelected ? " is-active" : ""}`}
                        onClick={() => applySelection({ color: selectedColor, size: opt.size })}
                      >
                        {opt.size}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="pdp-qty-row">
                <span>Quantity</span>
                <div className="pdp-qty-stepper">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1 || isAdding}
                    aria-label="Decrease quantity"
                  >-</button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={quantity >= Math.max(1, stockLimit) || isAdding || stockLimit <= 0}
                    aria-label="Increase quantity"
                  >+</button>
                </div>
              </div>

              <button
                type="button"
                className="pdp-cta"
                onClick={handleAddToCart}
                disabled={isAdding || stockLimit <= 0 || datesInvalid}
              >
                {isAdding
                  ? (activeMode === "rent" ? "Booking..." : "Adding...")
                  : (activeMode === "rent" ? "Add to booking" : "Add to cart")}
              </button>

              {actionMessage ? (
                <p className={`pdp-action-msg pdp-action-msg-${actionTone}`}>{actionMessage}</p>
              ) : null}
            </div>
          </aside>
        </section>

        <section className="pdp-tabs-section">
          <div className="pdp-tabs" role="tablist">
            {showOverview ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "overview"}
                className={`pdp-tab${activeTab === "overview" ? " is-active" : ""}`}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
            ) : null}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "specs"}
              className={`pdp-tab${activeTab === "specs" ? " is-active" : ""}`}
              onClick={() => setActiveTab("specs")}
            >
              Specs
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "terms"}
              className={`pdp-tab${activeTab === "terms" ? " is-active" : ""}`}
              onClick={() => setActiveTab("terms")}
            >
              Terms
            </button>
          </div>

          <div className="pdp-tab-panel">
            {activeTab === "overview" && showOverview ? (
              <div className="pdp-overview">
                {description ? <p>{description}</p> : null}
                {qualityPoints.length ? (
                  <ul>
                    {qualityPoints.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {activeTab === "specs" ? (
              <dl className="pdp-specs">
                <div><dt>Category</dt><dd>{product.category} / {product.subcategory}</dd></div>
                {product.quality ? <div><dt>Quality</dt><dd>{product.quality}</dd></div> : null}
                {product.colors?.length ? <div><dt>Available colors</dt><dd>{product.colors.length}</dd></div> : null}
                {product.size_mode === "varied" && product.sizes?.length
                  ? <div><dt>Available sizes</dt><dd>{product.sizes.join(", ")}</dd></div>
                  : <div><dt>Sizing</dt><dd>One size</dd></div>}
                {product.event_type ? <div><dt>Event type</dt><dd>{product.event_type}</dd></div> : null}
                {product.venue_type ? <div><dt>Venue type</dt><dd>{product.venue_type}</dd></div> : null}
                {product.availability_note ? <div><dt>Availability</dt><dd>{product.availability_note}</dd></div> : null}
                {product.sku ? <div><dt>SKU</dt><dd>{product.sku}</dd></div> : null}
              </dl>
            ) : null}

            {activeTab === "terms" ? (
              <div className="pdp-terms">
                {type === "rent" || (type === "both" && activeMode === "rent") ? (
                  <>
                    <h3>Rental terms</h3>
                    <ul>
                      <li>Pricing is per day. Total = daily rate x rental days x quantity.</li>
                      <li>Items must be returned in the condition received; damages may incur fees.</li>
                      <li>Bookings are confirmed once payment is received.</li>
                      <li>Cancellation and deposit terms are set by EventMart and shared at checkout.</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <h3>Purchase terms</h3>
                    <ul>
                      <li>Prices are listed per unit and include applicable taxes shown at checkout.</li>
                      <li>Returns and exchanges are handled per EventMart's standard policy.</li>
                      <li>Delivery timing depends on stock and shipping address.</li>
                    </ul>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </section>

        {isCustomizable ? (
          <section className="pdp-custom-section" aria-labelledby="pdp-custom-heading">
            <div className="pdp-custom-head">
              <h2 id="pdp-custom-heading">Customize this item</h2>
              {customizationFee > 0 ? (
                <span className="pdp-custom-fee">
                  + {formatMoney(customizationFee, product.currency)} customization fee
                </span>
              ) : (
                <span className="pdp-custom-fee pdp-custom-fee-free">No extra fee</span>
              )}
            </div>
            <p className="pdp-custom-copy">
              Upload a mockup to show placement and a final design file your production should use. Both fields are optional.
            </p>

            <div className="pdp-custom-grid">
              {[
                { key: "mockup", label: "Mockup", description: "PNG or PDF showing rough placement." },
                { key: "design", label: "Final design", description: "PNG, JPG, WEBP, or PDF for production." }
              ].map((field) => (
                <label className="pdp-custom-card" key={field.key}>
                  <span className="pdp-custom-title">{field.label}</span>
                  <span className="pdp-custom-desc">{field.description}</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
                    onChange={(event) => handleUploadChange(field.key, event.target.files)}
                  />
                  <strong>{uploads[field.key]?.name || "Choose file"}</strong>
                  {uploadErrors[field.key] ? (
                    <small className="pdp-custom-error">{uploadErrors[field.key]}</small>
                  ) : (
                    <small>Supports PNG, JPG, WEBP, PDF</small>
                  )}
                </label>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </motion.main>
  );
}

export default ProductDetailPage;
