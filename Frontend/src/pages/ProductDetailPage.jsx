import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import ProductCard from "../components/shop/ProductCard";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";
import useSmartRecommendations from "../hooks/useSmartRecommendations";
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
  getModeLabel,
  getProductImages,
  loadProducts,
  loadProductBySlug,
  uploadCustomizationFile
} from "../lib/products";
import { finishProductDwell, startProductDwell, trackEventTypeSelection, trackProductView } from "../lib/userBehavior";
import "../styles/shop.css";

const INTEREST_CAROUSEL_GAP = 18;
const INTEREST_CAROUSEL_MOVE_MS = 2000;
const INTEREST_CAROUSEL_CYCLE_MS = 5000;

function getInterestVisibleCount(width) {
  const safeWidth = Number(width || 0);

  if (safeWidth >= 1380) return 4;
  if (safeWidth >= 1040) return 3;
  if (safeWidth >= 720) return 2;
  return 1;
}

function ProductDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const { theme } = useTheme();
  const { addItem, items } = useCart();
  const { token } = useAuth();
  const { requireAuth } = useRequireAuth();
  const [product, setProduct] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState("Loading product...");
  const [error, setError] = useState("");
  const [selectedMode, setSelectedMode] = useState("buy");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState("info");
  const [uploads, setUploads] = useState({ design: null, mockup: null });
  const [uploadErrors, setUploadErrors] = useState({ design: "", mockup: "" });
  const [interestCarouselIndex, setInterestCarouselIndex] = useState(0);
  const [interestVisibleCount, setInterestVisibleCount] = useState(1);
  const [interestViewportWidth, setInterestViewportWidth] = useState(0);
  const interestViewportRef = useRef(null);
  const activeEventType = resolveEventType(new URLSearchParams(location.search).get("eventType"));
  const shopBackLink = location.search ? `/shop${location.search}` : "/shop";

  useEffect(() => {
    let cancelled = false;

    loadProducts()
      .then((rows) => {
        if (!cancelled) {
          setCatalog(Array.isArray(rows) ? rows : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadedProductId = "";

    async function loadProduct() {
      setStatus("Loading product...");
      setError("");

      try {
        const nextProduct = await loadProductBySlug(slug);
        if (cancelled) return;

        const initialState = buildProductOptionState(nextProduct, {});
        setProduct(nextProduct);
        setSelectedColor(initialState.selectedColor);
        setSelectedSize(initialState.selectedSize || (initialState.size_mode === "one-size" ? ONE_SIZE_LABEL : ""));
        setSelectedMode(
          nextProduct.buy_enabled && nextProduct.buy_price !== null
            ? "buy"
            : "rent"
        );
        setActiveImageIndex(0);
        setQuantity(1);
        setUploads({ design: null, mockup: null });
        setUploadErrors({ design: "", mockup: "" });
        setActionMessage("");
        setActionTone("info");
        setStatus("");
        bumpMetric(nextProduct.id, "product_view", 1);
        loadedProductId = String(nextProduct.id || "");
        trackProductView(nextProduct, {
          category: nextProduct.category,
          eventType: activeEventType
        });
        if (activeEventType) {
          trackEventTypeSelection(activeEventType, { source: "product-detail" });
        }
        startProductDwell(nextProduct.id);
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
      if (loadedProductId) {
        finishProductDwell(loadedProductId);
      }
    };
  }, [activeEventType, slug]);

  const optionState = product
    ? buildProductOptionState(product, { color: selectedColor, size: selectedSize })
    : null;
  const gallery = product ? getProductImages(product, theme) : [];
  const activeVariation = optionState?.activeVariation || null;
  const canBuy = Boolean(product?.buy_enabled && product?.buy_price !== null);
  const canRent = Boolean(product?.rent_enabled && product?.rent_price_per_day !== null);
  const stockLimit = Math.max(0, Number(activeVariation?.quantity || 0));
  const selectedModePrice = selectedMode === "rent"
    ? formatMoney(product?.rent_price_per_day, product?.currency)
    : formatMoney(product?.buy_price, product?.currency);
  const qualityPoints = Array.isArray(product?.quality_points) && product.quality_points.length
    ? product.quality_points
    : [];
  const { recommendations: interestRecommendations } = useSmartRecommendations({
    cartItems: items,
    currentCategory: product?.category || "",
    currentEventType: activeEventType,
    currentMode: selectedMode,
    currentProduct: product,
    limit: 4,
    products: catalog
  });
  const interestMaxIndex = Math.max(0, interestRecommendations.length - interestVisibleCount);
  const hasInterestControls = interestRecommendations.length > interestVisibleCount;
  const interestSlideWidth = interestViewportWidth
    ? Math.max(0, (interestViewportWidth - (INTEREST_CAROUSEL_GAP * (interestVisibleCount - 1))) / interestVisibleCount)
    : 0;
  const interestTrackOffset = interestCarouselIndex * (interestSlideWidth + INTEREST_CAROUSEL_GAP);

  useEffect(() => {
    function updateInterestLayout() {
      const viewportWidth = interestViewportRef.current?.clientWidth || 0;
      const widthBasis = viewportWidth || (typeof window !== "undefined" ? window.innerWidth : 0);
      setInterestViewportWidth(viewportWidth);
      setInterestVisibleCount(getInterestVisibleCount(widthBasis));
    }

    updateInterestLayout();

    let resizeObserver = null;

    if (typeof ResizeObserver === "function" && interestViewportRef.current) {
      resizeObserver = new ResizeObserver(() => updateInterestLayout());
      resizeObserver.observe(interestViewportRef.current);
    }

    window.addEventListener("resize", updateInterestLayout);

    return () => {
      window.removeEventListener("resize", updateInterestLayout);
      resizeObserver?.disconnect();
    };
  }, [interestRecommendations.length]);

  useEffect(() => {
    setInterestCarouselIndex(0);
  }, [product?.id]);

  useEffect(() => {
    setInterestCarouselIndex((current) => Math.min(current, interestMaxIndex));
  }, [interestMaxIndex]);

  useEffect(() => {
    if (interestMaxIndex <= 0) return undefined;

    const intervalId = window.setInterval(() => {
      setInterestCarouselIndex((current) => (current >= interestMaxIndex ? 0 : current + 1));
    }, INTEREST_CAROUSEL_CYCLE_MS);

    return () => window.clearInterval(intervalId);
  }, [interestMaxIndex]);

  function applySelection(nextSelection) {
    if (!product) return;

    const nextState = buildProductOptionState(product, nextSelection);
    setSelectedColor(nextState.selectedColor);
    setSelectedSize(nextState.selectedSize || (nextState.size_mode === "one-size" ? ONE_SIZE_LABEL : ""));
    setQuantity((current) => {
      const nextStock = Math.max(1, Number(nextState.activeVariation?.quantity || 1));
      return Math.min(current, nextStock);
    });
    setActionMessage("");
    setActionTone("info");
  }

  function handleQuantityChange(nextQuantity) {
    setQuantity(Math.max(1, Math.min(Number(nextQuantity || 1), Math.max(1, stockLimit || 1))));
    setActionMessage("");
  }

  function handleUploadChange(uploadKind, fileList) {
    const file = Array.from(fileList || [])[0] || null;
    const validationMessage = validateCustomizationFile(file);

    setUploadErrors((current) => ({
      ...current,
      [uploadKind]: validationMessage
    }));
    setUploads((current) => ({
      ...current,
      [uploadKind]: validationMessage ? null : file
    }));
    setActionMessage("");
    setActionTone("info");
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
      setActionMessage("This variation is currently out of stock.");
      setActionTone("error");
      return;
    }

    if (!requireAuth({ returnTo: `/shop/${product.slug}${location.search || ""}` })) {
      return;
    }

    if (uploadErrors.design || uploadErrors.mockup) {
      setActionMessage("Please fix the customization file errors before adding to cart.");
      setActionTone("error");
      return;
    }

    setIsAdding(true);
    setActionMessage("");
    setActionTone("info");
    const uploadedAssets = [];

    try {
      for (const uploadKind of ["mockup", "design"]) {
        const file = uploads[uploadKind];
        if (!file) continue;

        const uploaded = await uploadCustomizationFile({
          file,
          productId: product.id,
          token,
          uploadKind,
          variationId: activeVariation.id
        });

        uploadedAssets.push(uploaded);
      }

      addItem(
        product,
        quantity,
        selectedMode,
        {
          customization_requested: uploadedAssets.length > 0,
          customization_uploads: uploadedAssets,
          selected_color: activeVariation.color,
          selected_size: activeVariation.size,
          sku: activeVariation.sku,
          stock: activeVariation.quantity,
          variation_id: activeVariation.id,
          event_type: activeEventType
        }
      );
      bumpMetric(product.id, "add_to_cart", quantity);
      setActionMessage("Added to cart. Your selected color, size, and any uploaded files were saved.");
      setActionTone("success");
      setUploads({ design: null, mockup: null });
      setUploadErrors({ design: "", mockup: "" });
    } catch (submitError) {
      if (uploadedAssets.length) {
        await deleteCustomizationUploads(
          uploadedAssets.map((asset) => asset.uploadToken),
          token
        ).catch(() => {});
      }

      setActionMessage(submitError?.message || "We couldn't add this item to your cart right now.");
      setActionTone("error");
    } finally {
      setIsAdding(false);
    }
  }

  function handleInterestPrev() {
    if (interestMaxIndex <= 0) return;
    setInterestCarouselIndex((current) => (current <= 0 ? interestMaxIndex : current - 1));
  }

  function handleInterestNext() {
    if (interestMaxIndex <= 0) return;
    setInterestCarouselIndex((current) => (current >= interestMaxIndex ? 0 : current + 1));
  }

  if (status) {
    return (
      <main className="product-detail-shell" data-theme-scope="shop">
        <section className="product-detail-status-card">
          <p>{status}</p>
        </section>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="product-detail-shell" data-theme-scope="shop">
        <section className="product-detail-status-card product-detail-status-card-error">
          <p className="product-detail-kicker">Product unavailable</p>
          <h1>This product page is not available.</h1>
          <p>{error || "We couldn't find that product."}</p>
          <Link className="product-detail-back-link" to={shopBackLink}>
            Back to shop
          </Link>
        </section>
      </main>
    );
  }

  const stockMessage = optionState.size_mode === "varied" && !optionState.selectedColor
    ? "Choose a color to see the sizes available for that option."
    : optionState.size_mode === "varied" && !optionState.selectedSize
      ? "Choose a size from the selected color to continue."
      : stockLimit > 0
        ? `Items available for ${activeVariation?.color} / ${activeVariation?.size}.`
        : "This selection is currently unavailable.";
  const selectedColorLabel = optionState.selectedColor || "Select color";
  const selectedSizeLabel = optionState.size_mode === "one-size"
    ? ONE_SIZE_LABEL
    : optionState.selectedSize || "Select size";
  const itemSummaryLabel = `${selectedColorLabel} selected - ${selectedSizeLabel}`;

  return (
    <motion.main
      className="product-detail-shell"
      data-theme-scope="shop"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
    >
      <div className="product-detail-page">
        <nav className="product-detail-breadcrumbs" aria-label="Breadcrumb">
          <Link to={shopBackLink}>Shop</Link>
          <span>/</span>
          <span>{product.name}</span>
        </nav>

        <section className="product-detail-hero">
          <div className="product-detail-gallery">
            <div className="product-detail-main-image">
              <img src={gallery[activeImageIndex] || gallery[0]} alt={product.name} />
            </div>
            {gallery.length > 1 ? (
              <div className="product-detail-thumbs" aria-label="Product gallery thumbnails">
                {gallery.map((image, index) => (
                  <button
                    className={`product-detail-thumb${index === activeImageIndex ? " is-active" : ""}`}
                    key={`${product.id}-${image}-${index}`}
                    onClick={() => setActiveImageIndex(index)}
                    type="button"
                  >
                    <img src={image} alt={`${product.name} view ${index + 1}`} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="product-detail-info">
            <div className="product-detail-heading">
              <div>
                <p className="product-detail-kicker">{product.category} / {product.subcategory}</p>
                <h1>{product.name}</h1>
              </div>
              <span className="product-detail-mode-pill">{getModeLabel(canBuy && canRent ? "BOTH" : canBuy ? "BUY_ONLY" : "RENT_ONLY")}</span>
            </div>

            <p className="product-detail-description">{product.description || "No description provided."}</p>

            <div className="product-detail-prices">
              {canBuy ? (
                <button
                  className={`product-detail-price-card${selectedMode === "buy" ? " is-active" : ""}`}
                  onClick={() => setSelectedMode("buy")}
                  type="button"
                >
                  <span>Buy</span>
                  <strong>{formatMoney(product.buy_price, product.currency)}</strong>
                </button>
              ) : null}
              {canRent ? (
                <button
                  className={`product-detail-price-card${selectedMode === "rent" ? " is-active" : ""}`}
                  onClick={() => setSelectedMode("rent")}
                  type="button"
                >
                  <span>Rent / Day</span>
                  <strong>{formatMoney(product.rent_price_per_day, product.currency)}</strong>
                </button>
              ) : null}
            </div>

            <section className="product-detail-section">
              <div className="product-detail-section-head">
                <h2>Quality</h2>
                <span>{product.quality || "Specified by EventMart"}</span>
              </div>
              <p className="product-detail-quality-copy">
                {product.quality || "A clear quality description will help shoppers understand exactly what they are buying."}
              </p>
              {qualityPoints.length ? (
                <ul className="product-detail-quality-list">
                  {qualityPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="product-detail-section">
              <div className="product-detail-section-head">
                <h2>Color</h2>
                <span>{selectedColorLabel}</span>
              </div>
              <div className="product-detail-chip-grid">
                {optionState.colors.map((colorOption) => (
                  <button
                    className={`product-detail-color-chip${colorOption.isSelected ? " is-active" : ""}`}
                    disabled={colorOption.isDisabled}
                    key={colorOption.color}
                    onClick={() => applySelection({ color: colorOption.color, size: "" })}
                    type="button"
                  >
                    <span
                      className="product-detail-color-swatch"
                      style={{ background: getColorSwatchValue(colorOption.color) }}
                    />
                    <span>{colorOption.color}</span>
                  </button>
                ))}
              </div>
            </section>

            {optionState.size_mode === "varied" ? (
              <section className="product-detail-section">
                <div className="product-detail-section-head">
                  <h2>Size</h2>
                  <span>{optionState.selectedColor ? selectedSizeLabel : "Choose color first"}</span>
                </div>
                {!optionState.selectedColor ? (
                  <p className="product-detail-one-size-copy">Select a color first to view the sizes available for that color.</p>
                ) : optionState.sizes.length ? (
                  <div className="product-detail-chip-grid product-detail-size-grid">
                    {optionState.sizes.map((sizeOption) => (
                      <button
                        className={`product-detail-size-chip${sizeOption.isSelected ? " is-active" : ""}`}
                        disabled={sizeOption.isDisabled}
                        key={sizeOption.size}
                        onClick={() => applySelection({ color: selectedColor, size: sizeOption.size })}
                        type="button"
                      >
                        {sizeOption.size}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="product-detail-one-size-copy">No sizes are currently available for {optionState.selectedColor}.</p>
                )}
              </section>
            ) : (
              <section className="product-detail-section">
                <div className="product-detail-section-head">
                  <h2>Size</h2>
                  <span>{ONE_SIZE_LABEL}</span>
                </div>
                <p className="product-detail-one-size-copy">This product is offered in one size only.</p>
              </section>
            )}

            <section className="product-detail-section">
              <div className="product-detail-section-head">
                <h2>Customize</h2>
                <span>{product.customizable ? "Optional" : "Not available"}</span>
              </div>

              {product.customizable ? (
                <div className="product-detail-upload-grid">
                  {[
                    {
                      description: "Attach a PNG or PDF mockup to show placement or rough layout.",
                      key: "mockup",
                      label: "Mockup design"
                    },
                    {
                      description: "Attach the final PNG or PDF design file your production request should use.",
                      key: "design",
                      label: "Final design file"
                    }
                  ].map((field) => (
                    <label className="product-detail-upload-card" key={field.key}>
                      <span className="product-detail-upload-title">{field.label}</span>
                      <span className="product-detail-upload-copy">{field.description}</span>
                      <input
                        accept=".png,.pdf,image/png,application/pdf"
                        onChange={(event) => handleUploadChange(field.key, event.target.files)}
                        type="file"
                      />
                      <strong>{uploads[field.key]?.name || "Choose PNG or PDF"}</strong>
                      {uploadErrors[field.key] ? (
                        <small className="product-detail-upload-error">{uploadErrors[field.key]}</small>
                      ) : uploads[field.key] ? (
                        <small>{uploads[field.key].name}</small>
                      ) : (
                        <small>Supported formats: PNG, PDF</small>
                      )}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="product-detail-one-size-copy">This item is not currently accepting custom artwork uploads.</p>
              )}
            </section>

            <section className="product-detail-purchase-card">
              <div className="product-detail-purchase-meta">
                <div>
                  <span>Item Summary</span>
                  <strong>{itemSummaryLabel}</strong>
                </div>
                <div>
                  <span>Price</span>
                  <strong>{selectedModePrice}{selectedMode === "rent" ? "/day" : ""}</strong>
                </div>
              </div>

              <div className="product-detail-stock-summary">
                <p className={`product-detail-stock-note${stockLimit > 0 ? "" : " is-out"}`}>{stockMessage}</p>
                {activeVariation?.sku ? (
                  <p className="product-detail-sku">SKU: {activeVariation.sku}</p>
                ) : null}
              </div>

              <div className="product-detail-qty-row">
                <span>Quantity</span>
                <div className="qty-stepper" aria-label="Quantity controls">
                  <button
                    className="qty-stepper-btn"
                    disabled={quantity <= 1 || isAdding}
                    onClick={() => handleQuantityChange(quantity - 1)}
                    type="button"
                  >
                    -
                  </button>
                  <span className="qty-stepper-value">{quantity}</span>
                  <button
                    className="qty-stepper-btn"
                    disabled={quantity >= Math.max(1, stockLimit) || isAdding || stockLimit <= 0}
                    onClick={() => handleQuantityChange(quantity + 1)}
                    type="button"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="product-detail-actions">
                <button
                  className="btn primary"
                  disabled={isAdding || !activeVariation || stockLimit <= 0}
                  onClick={handleAddToCart}
                  type="button"
                >
                  {isAdding ? "Adding..." : "Add to cart"}
                </button>
                <Link className="btn" to="/cart">
                  View cart
                </Link>
              </div>

              {actionMessage ? <p className={`cart-msg cart-msg-${actionTone}`}>{actionMessage}</p> : null}
            </section>

          </div>
        </section>

        {interestRecommendations.length ? (
          <section className="product-detail-interest-section" aria-labelledby="product-detail-interest-title">
            <div className="product-detail-interest-head">
              <h2 id="product-detail-interest-title">You might be also interested in:</h2>
            </div>

            <div className={`product-detail-interest-carousel${hasInterestControls ? " has-controls" : ""}`}>
              {hasInterestControls ? (
                <button
                  aria-label="Show previous products"
                  className="product-detail-interest-arrow is-left"
                  onClick={handleInterestPrev}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}

              <div className="product-detail-interest-viewport" ref={interestViewportRef}>
                <div
                  className="product-detail-interest-track"
                  style={{
                    gap: `${INTEREST_CAROUSEL_GAP}px`,
                    transform: `translateX(-${interestTrackOffset}px)`,
                    transitionDuration: `${INTEREST_CAROUSEL_MOVE_MS}ms`
                  }}
                >
                  {interestRecommendations.map((entry) => (
                    <div
                      key={entry.product.id}
                      className="product-detail-interest-slide"
                      style={interestSlideWidth ? { width: `${interestSlideWidth}px` } : undefined}
                    >
                      <ProductCard
                        product={entry.product}
                        onOpen={(nextProduct) => {
                          trackProductView(nextProduct, {
                            category: product.category,
                            eventType: activeEventType
                          });
                        }}
                        isFeatured={Boolean(entry.product.featured)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {hasInterestControls ? (
                <button
                  aria-label="Show next products"
                  className="product-detail-interest-arrow is-right"
                  onClick={handleInterestNext}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </motion.main>
  );
}

export default ProductDetailPage;
