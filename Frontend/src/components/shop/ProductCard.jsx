import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { formatMoney, getProductImages } from "../../lib/products";
import { useTheme } from "../../contexts/ThemeContext";

function ProductCard({ product, onOpen }) {
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

  const note = (product.availability_note || "").trim();
  const lowerNote = note.toLowerCase();
  const isBooked = lowerNote.startsWith("booked") || lowerNote.startsWith("unavailable");
  const availabilityLabel = note || "Available";

  function renderPrice() {
    if (rentExists) {
      return (
        <>
          <strong>{formatMoney(product.rent_price_per_day, product.currency)}</strong>
          <span>/ day</span>
        </>
      );
    }
    if (buyExists) {
      return <strong>{formatMoney(product.buy_price, product.currency)}</strong>;
    }
    return <strong>Price unavailable</strong>;
  }

  const imageSrc = gallery[activeImageIndex] || gallery[0];
  const description = (product.description || "").trim();
  const showDescription = description.length > 0;
  const shortDescription = description.length > 96
    ? `${description.slice(0, 96).trim()}...`
    : description;

  return (
    <Link
      className="pcard"
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
      <div className="pcard-media">
        <img key={imageSrc} src={imageSrc} alt={product.name} loading="lazy" />
        <span className={`pcard-availability${isBooked ? " is-booked" : " is-available"}`}>
          {availabilityLabel}
        </span>
      </div>

      <div className="pcard-body">
        <p className="pcard-category">{product.category}</p>
        <h3 className="pcard-name">{product.name}</h3>
        {showDescription ? <p className="pcard-desc">{shortDescription}</p> : null}

        <div className="pcard-price">{renderPrice()}</div>

        <span className="pcard-cta">Check availability</span>
      </div>
    </Link>
  );
}

export default ProductCard;
