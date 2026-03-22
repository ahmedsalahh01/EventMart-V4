import { useEffect, useState } from "react";
import { formatMoney, getMode, getModeLabel, getProductImages, getProductRating } from "../../lib/products";
import { useTheme } from "../../contexts/ThemeContext";

function ProductCard({ product, onView, onQuickAdd, isFeatured = true }) {
  const { theme } = useTheme();
  const gallery = getProductImages(product, theme);
  const buyExists = product.buy_enabled && product.buy_price !== null;
  const rentExists = product.rent_enabled && product.rent_price_per_day !== null;
  const canCart = (buyExists || rentExists) && product.quantity_available !== 0;
  const mode = getMode(product);
  const hasSlideshow = gallery.length > 1;
  const gallerySignature = gallery.join("|");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsHovered(false);
  }, [gallerySignature, product.id, theme]);

  useEffect(() => {
    if (!isHovered || !hasSlideshow) return undefined;

    const intervalId = window.setInterval(() => {
      setActiveImageIndex((current) => (current + 1) % gallery.length);
    }, 900);

    return () => window.clearInterval(intervalId);
  }, [gallery.length, hasSlideshow, isHovered]);

  function renderPrice() {
    if (buyExists && rentExists) {
      return (
        <>
          <strong>{formatMoney(product.buy_price, product.currency)}</strong>
          <span>{formatMoney(product.rent_price_per_day, product.currency)}/day</span>
        </>
      );
    }

    if (buyExists) return <strong>{formatMoney(product.buy_price, product.currency)}</strong>;
    if (rentExists) return <strong>{formatMoney(product.rent_price_per_day, product.currency)}/day</strong>;
    return <strong>Unavailable</strong>;
  }

  const shortDescription = product.description?.trim()
    ? product.description.length <= 58
      ? product.description
      : `${product.description.slice(0, 58).trim()}...`
    : "No description provided.";
  const imageSrc = gallery[activeImageIndex] || gallery[0];

  return (
    <article
      className={`product-card${isHovered && hasSlideshow ? " is-slideshow-active" : ""}`}
      onMouseEnter={() => hasSlideshow && setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setActiveImageIndex(0);
      }}
    >
      <div className="product-media">
        <img key={imageSrc} src={imageSrc} alt={product.name} />
        {hasSlideshow ? (
          <div className="product-gallery-meta" aria-hidden="true">
            <span className="product-gallery-count">
              {activeImageIndex + 1}/{gallery.length}
            </span>
            <span className="product-gallery-dots">
              {gallery.map((image, index) => (
                <span
                  className={`product-gallery-dot${index === activeImageIndex ? " is-active" : ""}`}
                  key={`${product.id}-${image}-${index}`}
                />
              ))}
            </span>
          </div>
        ) : null}
        <div className="product-badges">
          <span className="badge badge-mode">{getModeLabel(mode)}</span>
          {isFeatured ? <span className="badge badge-featured">Featured</span> : null}
        </div>
      </div>

      <div className="product-body">
        <div className="product-head">
          <h3>{product.name}</h3>
          <span className="product-rating">&#9733; {getProductRating(product)}</span>
        </div>

        <p className="product-desc">{shortDescription}</p>

        <div className="price-line">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m3 9 9-6 9 6-9 6-9-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M6 11.5v5.8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {renderPrice()}
        </div>

        <div className="product-actions">
          <button className="add-cart-btn" type="button" disabled={!canCart} onClick={() => onQuickAdd(product)}>
            Add to Cart
          </button>
          <button className="view-btn" type="button" aria-label="View details" onClick={() => onView(product)}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M2.2 12s3.4-6 9.8-6 9.8 6 9.8 6-3.4 6-9.8 6S2.2 12 2.2 12Z" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
