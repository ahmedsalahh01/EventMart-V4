import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { formatMoney, getProductImages, getProductRating } from "../../lib/products";
import { useTheme } from "../../contexts/ThemeContext";

function ProductCard({ product, onOpen, isFeatured = false }) {
  const location = useLocation();
  const { theme } = useTheme();
  const gallery = getProductImages(product, theme);
  const buyExists = product.buy_enabled && product.buy_price !== null;
  const rentExists = product.rent_enabled && product.rent_price_per_day !== null;
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
    ? product.description.length <= 72
      ? product.description
      : `${product.description.slice(0, 72).trim()}...`
    : "No description provided.";
  const imageSrc = gallery[activeImageIndex] || gallery[0];
  const colorCount = Array.isArray(product.colors) ? product.colors.length : 0;
  const sizeCount = product.size_mode === "one-size"
    ? 1
    : Array.isArray(product.sizes) ? product.sizes.length : 0;
  const colorLabel = `${colorCount} color${colorCount === 1 ? "" : "s"}`;
  const sizeLabel = `${sizeCount} size${sizeCount === 1 ? "" : "s"}`;

  return (
    <Link
      className={`product-card product-card-link${isHovered && hasSlideshow ? " is-slideshow-active" : ""}`}
      onClick={() => onOpen?.(product)}
      onMouseEnter={() => hasSlideshow && setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setActiveImageIndex(0);
      }}
      to={{
        pathname: `/shop/${encodeURIComponent(product.slug || product.id)}`,
        search: location.search || ""
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
          {isFeatured ? <span className="badge badge-featured">Featured</span> : null}
        </div>
      </div>

      <div className="product-body">
        <div className="product-head">
          <h3>{product.name}</h3>
          <span className="product-rating">&#9733; {getProductRating(product)}</span>
        </div>

        <p className="product-desc">{shortDescription}</p>

        <div className="product-meta-list">
          <span>{colorLabel}</span>
          <span>{sizeLabel}</span>
          {product.customizable ? <span>Customizable</span> : null}
        </div>

        <div className="price-line">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m3 9 9-6 9 6-9 6-9-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M6 11.5v5.8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {renderPrice()}
        </div>

        <div className="product-link-cta">
          <span>View product</span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 12h12M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default ProductCard;
