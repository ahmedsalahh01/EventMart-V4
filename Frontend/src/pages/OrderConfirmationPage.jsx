import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authRequest } from "../lib/api";
import { readLocalOrderConfirmation } from "../lib/checkout";
import { formatMoney } from "../lib/products";
import "../styles/order-confirmation.css";

function formatStatusLabel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Pending review";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function OrderConfirmationPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const [order, setOrder] = useState(() => location.state?.order || readLocalOrderConfirmation(orderId));
  const [status, setStatus] = useState(() => (location.state?.order || readLocalOrderConfirmation(orderId) ? "" : "Loading your confirmed order..."));
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (order) return undefined;

    let cancelled = false;

    async function loadOrder() {
      try {
        const localOrder = readLocalOrderConfirmation(orderId);
        if (localOrder) {
          if (cancelled) return;
          setOrder(localOrder);
          setStatus("");
          setIsError(false);
          return;
        }

        const payload = await authRequest(`/api/orders/${encodeURIComponent(orderId)}/confirmation`, token);
        if (cancelled) return;
        setOrder(payload.order || null);
        setStatus("");
        setIsError(false);
      } catch (error) {
        if (cancelled) return;
        setOrder(null);
        setStatus(error.message || "We couldn't load that confirmation page.");
        setIsError(true);
      }
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [order, orderId, token]);

  if (!order && !isError) {
    return (
      <main className="order-confirmation-page" data-theme-scope="order-confirmation">
        <section className="order-confirmation-card">
          <p className="order-confirmation-status">{status}</p>
        </section>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="order-confirmation-page" data-theme-scope="order-confirmation">
        <section className="order-confirmation-card order-confirmation-card-error">
          <p className="order-confirmation-kicker">Confirmation unavailable</p>
          <h1>This confirmation page does not belong to a valid confirmed order.</h1>
          <p className="order-confirmation-status">{status}</p>
          <div className="order-confirmation-actions">
            <Link to="/cart" className="order-confirmation-secondary">
              Back to cart
            </Link>
            <Link to="/profile" className="order-confirmation-primary">
              View account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const isInstapayOrder = order?.billingDetails?.paymentMethod === "instapay";
  const instapayFollowUpMessage =
    order?.billingDetails?.paymentSummary?.followUpMessage ||
    "Our team will contact you within 24 hours to confirm order details.";

  return (
    <motion.main
      className="order-confirmation-page"
      data-theme-scope="order-confirmation"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
    >
      <section className="order-confirmation-card">
        <p className="order-confirmation-kicker">{isInstapayOrder ? "Order Received" : "Order Confirmed"}</p>
        <h1>
          {isInstapayOrder
            ? "Your order request has been received."
            : "Your order has been secured with the required 30% advance payment."}
        </h1>
        <p className="order-confirmation-copy">
          {isInstapayOrder
            ? "Keep this confirmation for reference while we review your Instapay details."
            : "Keep this confirmation for reference while we prepare your shipment and delivery schedule."}
        </p>
        {isInstapayOrder ? <p className="order-confirmation-note">{instapayFollowUpMessage}</p> : null}

        <div className="order-confirmation-grid">
          <article>
            <span>Unique Order ID</span>
            <strong>{order.orderId}</strong>
          </article>
          <article>
            <span>Delivery Estimated Time</span>
            <strong>{order.deliveryEstimate}</strong>
          </article>
          <article>
            <span>Name</span>
            <strong>{order.name}</strong>
          </article>
          <article>
            <span>Phone Number</span>
            <strong>{order.phoneNumber}</strong>
          </article>
          <article className="order-confirmation-wide">
            <span>Shipment Address</span>
            <strong>{order.shipmentAddress}</strong>
          </article>
        </div>

        <div className="order-confirmation-summary">
          <div>
            <span>Deposit status</span>
            <strong>{formatStatusLabel(order.depositStatus)}</strong>
          </div>
          <div>
            <span>Advance paid</span>
            <strong>{formatMoney(order.depositPaid, order.currency)}</strong>
          </div>
          <div>
            <span>Total order value</span>
            <strong>{formatMoney(order.total, order.currency)}</strong>
          </div>
        </div>

        <section className="order-confirmation-items">
          <h2>Confirmed items</h2>
          <div className="order-confirmation-item-list">
            {order.items.map((item) => (
              <article key={item.id} className="order-confirmation-item">
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.quantity} x {item.mode === "rent" ? `${item.rentalDays} day${item.rentalDays === 1 ? "" : "s"} rent` : "buy"}
                  </p>
                  <p>
                    {item.selectedColor || "Standard"} / {item.selectedSize || "Default"}
                    {item.customizationRequested ? " • Customized" : ""}
                  </p>
                </div>
                <span>{formatMoney(item.lineTotal, order.currency)}</span>
              </article>
            ))}
          </div>
        </section>

        <div className="order-confirmation-actions">
          <Link to="/shop" className="order-confirmation-secondary">
            Continue shopping
          </Link>
          <Link to="/profile" className="order-confirmation-primary">
            View my orders
          </Link>
        </div>
      </section>
    </motion.main>
  );
}

export default OrderConfirmationPage;
