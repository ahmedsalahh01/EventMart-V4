import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import SmartRecommendationBar from "../components/SmartRecommendationBar";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";
import useCartPricingSummary from "../hooks/useCartPricingSummary";
import useRequireAuth from "../hooks/useRequireAuth";
import { buildAuthPath, shouldShowCartIcon } from "../lib/authNavigation";
import { buildEventTypeShopPath, getEventTypeConfig } from "../lib/eventTypeConfig";
import { deleteCustomizationUploads, formatMoney, getProductImage } from "../lib/products";
import { getSelectedEventType } from "../lib/userBehavior";
import "./../styles/cart.css";

function CartPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, firstName, token } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { items, itemCount, updateQuantity, updateRentalDays, removeItem, clearCart } = useCart();
  const { requireAuth } = useRequireAuth();
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [selectedEventType, setSelectedEventType] = useState(() => getSelectedEventType() || "");

  const { error: pricingError, isLoading: pricingLoading, summary } = useCartPricingSummary(items);

  const currency = items[0]?.currency || "USD";
  const hasItems = items.length > 0;
  const authLabel = isAuthenticated && firstName ? `Hi, ${firstName}` : "Sign In";
  const cartTitle = selectedEventType ? `${getEventTypeConfig(selectedEventType)?.label || "Event"} Cart` : "Shopping Cart";
  const showCartIcon = shouldShowCartIcon(isAuthenticated);

  useEffect(() => {
    const incomingMessage = location.state?.checkoutError;
    if (typeof incomingMessage === "string" && incomingMessage.trim()) {
      setCheckoutMessage(incomingMessage);
    }
  }, [location.state]);

  function navLinkClassName({ isActive }) {
    return isActive ? "active" : undefined;
  }

  function handleCheckout() {
    if (!hasItems) {
      setCheckoutMessage("Your cart is empty. Add items before checkout.");
      return;
    }

    setCheckoutMessage("");

    if (!requireAuth({ returnTo: "/checkout" })) {
      return;
    }

    navigate("/checkout");
  }

  async function cleanupCustomizationUploadsForItems(targetItems) {
    const uploadTokens = targetItems.flatMap((item) =>
      Array.isArray(item.customization_uploads)
        ? item.customization_uploads.map((upload) => upload.uploadToken).filter(Boolean)
        : []
    );

    if (!uploadTokens.length || !token) return;
    await deleteCustomizationUploads(uploadTokens, token).catch(() => {});
  }

  return (
    <motion.div className="cart-page" data-theme-scope="cart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <header className="cart-navbar">
        <Link to="/" className="brand-link" aria-label="EventMart Home">
          <img className="brand-logo" src="/assets/eventmart-navbar-logo.png" alt="" />
        </Link>

        <nav className="center-nav" aria-label="Main navigation">
          <NavLink to="/" end className={navLinkClassName}>
            Home
          </NavLink>
          <NavLink to="/shop" className={navLinkClassName}>
            Shop
          </NavLink>
          <NavLink to="/ai-planner" className={navLinkClassName}>
            AI Planner
          </NavLink>
          <NavLink to="/about" className={navLinkClassName}>
            About
          </NavLink>
          <NavLink to="/contact" className={navLinkClassName}>
            Contact
          </NavLink>
        </nav>

        <div className="nav-actions">
          <button type="button" className="icon-btn" id="themeToggle" data-theme-toggle aria-label="Toggle interface color" onClick={toggleTheme}>
            <svg id="themeIconSun" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: theme === "dark" ? "none" : "block" }}>
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 3V5.2M12 18.8V21M3 12H5.2M18.8 12H21M5.64 5.64L7.2 7.2M16.8 16.8L18.36 18.36M18.36 5.64L16.8 7.2M7.2 16.8L5.64 18.36"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <svg id="themeIconMoon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: theme === "dark" ? "block" : "none" }}>
              <path
                d="M20 14.2A8 8 0 1 1 9.8 4 6.4 6.4 0 0 0 20 14.2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {showCartIcon ? (
            <Link to="/cart" className="icon-btn cart-btn active-cart" aria-label="Shopping cart">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 5H6L7.7 14.2A1 1 0 0 0 8.68 15H17.4A1 1 0 0 0 18.36 14.26L20 8H7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9.6" cy="19" r="1.2" fill="currentColor" />
                <circle cx="16.8" cy="19" r="1.2" fill="currentColor" />
              </svg>
              <span className="cart-badge" data-cart-count style={{ display: itemCount > 0 ? "inline-block" : "none" }}>
                {itemCount}
              </span>
            </Link>
          ) : null}

          <Link to={isAuthenticated ? "/profile" : buildAuthPath()} className="signin-link">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5 20c.9-3.2 3.72-5 7-5s6.1 1.8 7 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span id="authText">{authLabel}</span>
          </Link>
        </div>
      </header>

      <main className="cart-main">
        <section className="cart-hero">
          <h2 id="cartTitle">{cartTitle}</h2>
        </section>

        <div className="cart-layout">
          <section className="cart-panel">
            <section id="emptyState" className="empty-state" hidden={hasItems}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6.8 4h10.4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6.8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" />
                <path d="M4.8 8.2h14.4L17 5.2H7l-2.2 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M9.3 11.6a2.7 2.7 0 0 0 5.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <h2>Your cart is empty</h2>
              <p>Start adding items to create your event</p>
              <Link to="/shop" className="browse-btn">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6.8 4h10.4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6.8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M4.8 8.2h14.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span>Browse Products</span>
              </Link>
            </section>

            <section id="filledState" className="filled-state" hidden={!hasItems}>
              <div id="cartItemsList" className="cart-items-list">
                {items.map((item) => {
                  const rentalDays = Math.max(1, Number(item.rental_days || 1));
                  const total = Number(item.quantity || 0) * Number(item.unit_price || 0) * (item.mode === "rent" ? rentalDays : 1);
                  const stockLimit = Number(item.stock || 0) > 0 ? Number(item.stock) : Number.POSITIVE_INFINITY;

                  return (
                    <article key={item.cart_item_key} className="cart-item">
                      <img className="item-image" src={getProductImage(item, theme)} alt={item.name} />

                      <div className="item-body">
                        <h3 className="item-title">{item.name}</h3>
                        <p className="item-mode">
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="m3 9 9-6 9 6-9 6-9-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                            <path d="M6 11.5v5.8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          {item.mode === "rent" ? "Rent" : "Buy"}
                        </p>
                        <p className="item-mode">
                          {item.selected_color || "Standard"} / {item.selected_size || "Default"}
                        </p>
                        {item.customization_requested ? (
                          <p className="item-mode">
                            Custom files: {Array.isArray(item.customization_uploads) ? item.customization_uploads.length : 0}
                          </p>
                        ) : null}

                        <div className="item-controls">
                          <div className="qty-controls" aria-label="Quantity controls">
                            <button
                              className="qty-btn"
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() => updateQuantity(item.cart_item_key, Math.max(1, item.quantity - 1))}
                            >
                              -
                            </button>
                            <span className="qty-value">{item.quantity}</span>
                            <button
                              className="qty-btn"
                              type="button"
                              aria-label="Increase quantity"
                              disabled={item.quantity >= stockLimit}
                              onClick={() => updateQuantity(item.cart_item_key, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>

                          {item.mode === "rent" ? (
                            <div className="rental-days-controls" aria-label="Rental days controls">
                              <span className="days-label">Days:</span>
                              <button
                                className="qty-btn"
                                type="button"
                                aria-label="Decrease rental days"
                                onClick={() => updateRentalDays(item.cart_item_key, Math.max(1, rentalDays - 1))}
                              >
                                -
                              </button>
                              <span className="qty-value">{rentalDays}</span>
                              <button
                                className="qty-btn"
                                type="button"
                                aria-label="Increase rental days"
                                onClick={() => updateRentalDays(item.cart_item_key, rentalDays + 1)}
                              >
                                +
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="item-side">
                        <strong className="item-price">{formatMoney(total, item.currency)}</strong>
                        <button
                          className="remove-btn"
                          type="button"
                          aria-label="Remove item"
                          onClick={async () => {
                            await cleanupCustomizationUploadsForItems([item]);
                            removeItem(item.cart_item_key);
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M5 7h14M9 7V5h6v2M9.5 11.2v5.8M14.5 11.2v5.8M7.8 7l.8 11.2a1 1 0 0 0 1 .8h4.8a1 1 0 0 0 1-.8L16.2 7"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <button
                type="button"
                id="clearCartBtn"
                className="clear-btn"
                hidden={!hasItems}
                onClick={async () => {
                  await cleanupCustomizationUploadsForItems(items);
                  clearCart();
                }}
              >
                Clear Cart
              </button>
            </section>
          </section>

          <aside className="summary-panel">
            <h2>Order Summary</h2>
            <div className="summary-row">
              <span>Items subtotal</span>
              <strong>{formatMoney(summary.subtotal, currency)}</strong>
            </div>
            {summary.itemDiscounts ? (
              <div className="summary-row">
                <span>Item discounts</span>
                <strong>-{formatMoney(summary.itemDiscounts, currency)}</strong>
              </div>
            ) : null}
            {summary.customizationFees ? (
              <div className="summary-row">
                <span>Customization fees</span>
                <strong>{formatMoney(summary.customizationFees, currency)}</strong>
              </div>
            ) : null}
            {summary.discount ? (
              <div className="summary-row">
                <span>Bundle discount</span>
                <strong>-{formatMoney(summary.discount, currency)}</strong>
              </div>
            ) : null}
            {summary.shipping ? (
              <div className="summary-row">
                <span>Shipping</span>
                <strong>{formatMoney(summary.shipping, currency)}</strong>
              </div>
            ) : null}
            <hr />
            <div className="summary-row total-row">
              <span>Total</span>
              <strong id="summaryTotal">{formatMoney(summary.total, currency)}</strong>
            </div>
            <button
              type="button"
              id="checkoutBtn"
              className="checkout-btn"
              disabled={!hasItems}
              onClick={handleCheckout}
            >
              <span>Checkout</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
            {pricingLoading ? <p className="summary-note">Refreshing package pricing...</p> : null}
            {pricingError ? <p className="summary-note">{pricingError}</p> : null}
            {checkoutMessage ? <p className="summary-note">{checkoutMessage}</p> : null}
          </aside>
        </div>

        {hasItems ? (
          <SmartRecommendationBar
            cartItems={items}
            className="market-section"
            currentEventType={selectedEventType}
            ctaLabel="Shop Matching Products"
            ctaTo={selectedEventType ? buildEventTypeShopPath(selectedEventType) : "/shop"}
            limit={4}
            title="Recommended for Your Cart"
          />
        ) : null}
      </main>

      <Footer />
    </motion.div>
  );
}

export default CartPage;
