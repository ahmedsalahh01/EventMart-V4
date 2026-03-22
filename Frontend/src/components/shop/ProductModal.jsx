import { useState } from "react";
import { formatMoney, getProductImage } from "../../lib/products";
import { useTheme } from "../../contexts/ThemeContext";

function ProductModal({ product, onClose, onAddToCart, onBuyNow }) {
  const { theme } = useTheme();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");

  if (!product) return null;

  const qualityPoints = Array.isArray(product.quality_points) && product.quality_points.length
    ? product.quality_points
    : ["No quality points added yet."];
  const imageSrc = getProductImage(product, theme);
  const stockLimit = product.quantity_available > 0 ? Number(product.quantity_available) : Number.POSITIVE_INFINITY;

  function decreaseQuantity() {
    setQuantity((current) => Math.max(1, current - 1));
  }

  function increaseQuantity() {
    setQuantity((current) => Math.min(stockLimit, current + 1));
  }

  function handleCart() {
    onAddToCart(product, quantity);
    setMessage(
      <>
        Added to cart: {quantity} x {product.name}. <a href="/cart">View cart</a>
      </>
    );
  }

  function handleBuy() {
    onBuyNow(product, quantity);
    setMessage(`Purchase confirmed: ${quantity} x ${product.name}`);
  }

  return (
    <div className="modal-backdrop show" aria-hidden="false" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" type="button" onClick={onClose}>
          X
        </button>

        <div className="modal-body">
          <div className="modal-media">
            <img src={imageSrc} alt="Product image" />
          </div>

          <div className="modal-info">
            <h2>{product.name}</h2>
            <p className="muted">{product.description || "No description provided."}</p>

            <h3 className="small-title">Quality</h3>
            <ul className="quality">
              {qualityPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>

            <div className="modal-prices">
              {product.buy_enabled && product.buy_price !== null ? (
                <div className="modal-price">
                  <span>
                    {formatMoney(product.buy_price, product.currency)} <small>buy</small>
                  </span>
                  <small>one-time</small>
                </div>
              ) : null}
              {product.rent_enabled && product.rent_price_per_day !== null ? (
                <div className="modal-price">
                  <span>
                    {formatMoney(product.rent_price_per_day, product.currency)} <small>/day rent</small>
                  </span>
                  <small>per day</small>
                </div>
              ) : null}
            </div>

            <div className="qty-row">
              <span className="qty-label">Quantity</span>
              <div className="qty-stepper" aria-label="Quantity controls">
                <button
                  className="qty-stepper-btn"
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= stockLimit}
                  onClick={increaseQuantity}
                >
                  +
                </button>
                <span className="qty-stepper-value" aria-live="polite">
                  {quantity}
                </span>
                <button
                  className="qty-stepper-btn"
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={decreaseQuantity}
                >
                  -
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn primary" type="button" onClick={handleBuy}>
                Buy Now
              </button>
              <button className="btn" type="button" onClick={handleCart}>
                Add to Cart
              </button>
            </div>
            <p className="cart-msg">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductModal;
