import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { authRequest, apiRequest } from "../lib/api";
import {
  EGYPT_GOVERNORATES,
  PAYMENT_METHOD_OPTIONS,
  buildCheckoutPayload,
  calculateCartSummary,
  clearCheckoutDraft,
  createLocalInstapayConfirmationOrder,
  fetchEgyptLocationDetails,
  getFieldError,
  normalizeInstapayUsernameInput,
  readCheckoutDraft,
  splitFullName,
  validateCheckoutForm,
  writeCheckoutDraft,
  writeLocalOrderConfirmation
} from "../lib/checkout";
import { formatMoney } from "../lib/products";
import "../styles/checkout.css";

function CheckoutPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { items, clearCart } = useCart();
  const submittingRef = useRef(false);
  const completionRef = useRef(false);
  const [form, setForm] = useState(() => readCheckoutDraft(user?.name || ""));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoStatus, setGeoStatus] = useState("");

  const summary = useMemo(() => calculateCartSummary(items), [items]);
  const currency = items[0]?.currency || "USD";
  const isInstapayPayment = form.billing.paymentMethod === "instapay";

  useEffect(() => {
    if (completionRef.current) return;
    if (items.length > 0) return;
    navigate("/cart", {
      replace: true,
      state: { checkoutError: "Your cart is empty. Add items before checkout." }
    });
  }, [items.length, navigate]);

  useEffect(() => {
    if (!user?.name) return;
    const { firstName, lastName } = splitFullName(user.name);

    setForm((current) => ({
      ...current,
      shipping: {
        ...current.shipping,
        firstName: current.shipping.firstName || firstName,
        lastName: current.shipping.lastName || lastName
      },
      billing: {
        ...current.billing,
        fullName: current.billing.fullName || user.name
      },
      payment: {
        ...current.payment,
        cardholderName: current.payment.cardholderName || user.name,
        instapayName: current.payment.instapayName || user.name
      }
    }));
  }, [user?.name]);

  useEffect(() => {
    writeCheckoutDraft(form);
  }, [form]);

  function clearFieldError(path) {
    setErrors((current) => {
      if (!current[path]) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }

  function updateSection(section, field, value) {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value
      }
    }));
    clearFieldError(`${section}.${field}`);
    setStatus("");
  }

  async function handleUseLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("Location support is not available in this browser. Please enter the address manually.");
      return;
    }

    setIsLocating(true);
    setGeoStatus("Checking your location in Egypt...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const location = await fetchEgyptLocationDetails(
            {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            },
            {
              apiClient: apiRequest
            }
          );

          setForm((current) => {
            const nextShipmentAddress = location.addressLine || current.shipping.shipmentAddress;
            const nextCity = location.city || current.shipping.city;
            const nextGovernorate = location.governorate || current.shipping.governorate;
            const nextPostalCode = location.postalCode || current.shipping.postalCode;

            return {
              ...current,
              shipping: {
                ...current.shipping,
                shipmentAddress: nextShipmentAddress,
                city: nextCity,
                governorate: nextGovernorate,
                postalCode: nextPostalCode,
                geolocation: {
                  latitude: location.latitude,
                  longitude: location.longitude,
                  addressLine: location.addressLine || "",
                  city: location.city || "",
                  governorate: location.governorate || "",
                  postalCode: location.postalCode || ""
                }
              }
            };
          });

          [
            "shipping.shipmentAddress",
            "shipping.city",
            "shipping.governorate",
            "shipping.postalCode"
          ].forEach(clearFieldError);
          setGeoStatus("");
        } catch (error) {
          setGeoStatus(error.message || "We couldn't auto-fill your location right now. Please enter the address manually.");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoStatus("Location permission was denied. You can continue by entering the address manually.");
        } else {
          setGeoStatus("We couldn't read your location right now. Please enter the address manually.");
        }
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current) return;

    const validationErrors = validateCheckoutForm(form, items);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setStatus("Please review the highlighted fields before confirming your order.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setStatus(
      isInstapayPayment
        ? "Confirming your order request and saving your Instapay details..."
        : "Confirming your order and securing the 30% advance payment..."
    );

    try {
      if (isInstapayPayment) {
        const localOrder = createLocalInstapayConfirmationOrder({
          form,
          items,
          summary,
          currency
        });

        writeLocalOrderConfirmation(localOrder);
        clearCheckoutDraft();
        completionRef.current = true;
        clearCart();
        navigate(`/orders/${localOrder.orderId}/confirmation`, {
          replace: true,
          state: { order: localOrder }
        });
        return;
      }

      const payload = await authRequest("/api/checkout/orders", token, {
        method: "POST",
        body: buildCheckoutPayload(form, items)
      });

      clearCheckoutDraft();
      completionRef.current = true;
      clearCart();
      navigate(`/orders/${payload.order.orderId}/confirmation`, { replace: true });
    } catch (error) {
      const serverErrors = error.fieldErrors || {};
      const firstItemError = serverErrors.items || Object.entries(serverErrors).find(([key]) => key.startsWith("items."))?.[1];
      setErrors(firstItemError ? { ...serverErrors, items: firstItemError } : serverErrors);
      setStatus(error.message || "We couldn't confirm your order right now.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <motion.main
      className="checkout-page"
      data-theme-scope="checkout"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
    >
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit} noValidate>
          <section className="checkout-section">
            <div className="checkout-section-head">
              <div>
                <h2>Shipping Details</h2>
              </div>
              <button type="button" className="checkout-geo-btn" onClick={handleUseLocation} disabled={isLocating}>
                {isLocating ? "Finding location..." : "Use my location"}
              </button>
            </div>

            {geoStatus ? <p className="checkout-inline-status">{geoStatus}</p> : null}

            <div className="checkout-grid checkout-grid-shipping-two">
              <label className="checkout-field checkout-field-placeholder">
                <span className="checkout-field-title">First name</span>
                <input
                  type="text"
                  placeholder="First name"
                  autoComplete="given-name"
                  value={form.shipping.firstName}
                  onChange={(event) => updateSection("shipping", "firstName", event.target.value)}
                  aria-label="First name"
                  aria-invalid={Boolean(getFieldError(errors, "shipping.firstName"))}
                />
                {getFieldError(errors, "shipping.firstName") ? <small>{getFieldError(errors, "shipping.firstName")}</small> : null}
              </label>

              <label className="checkout-field checkout-field-placeholder">
                <span className="checkout-field-title">Last name</span>
                <input
                  type="text"
                  placeholder="Last name"
                  autoComplete="family-name"
                  value={form.shipping.lastName}
                  onChange={(event) => updateSection("shipping", "lastName", event.target.value)}
                  aria-label="Last name"
                  aria-invalid={Boolean(getFieldError(errors, "shipping.lastName"))}
                />
                {getFieldError(errors, "shipping.lastName") ? <small>{getFieldError(errors, "shipping.lastName")}</small> : null}
              </label>
            </div>

            <label className="checkout-field checkout-field-placeholder checkout-field-full">
              <span className="checkout-field-title">Address 1</span>
              <input
                type="text"
                placeholder="Address"
                autoComplete="street-address"
                value={form.shipping.shipmentAddress}
                onChange={(event) => updateSection("shipping", "shipmentAddress", event.target.value)}
                aria-label="Address"
                aria-invalid={Boolean(getFieldError(errors, "shipping.shipmentAddress"))}
              />
              {getFieldError(errors, "shipping.shipmentAddress") ? <small>{getFieldError(errors, "shipping.shipmentAddress")}</small> : null}
            </label>

            <label className="checkout-field checkout-field-placeholder checkout-field-full">
              <span className="checkout-field-title">Address 2</span>
              <input
                type="text"
                placeholder="Appartment,Event Venue,Etc"
                autoComplete="address-line2"
                value={form.shipping.apartment}
                onChange={(event) => updateSection("shipping", "apartment", event.target.value)}
                aria-label="Appartment, Event Venue, Etc"
              />
            </label>

            <div className="checkout-grid checkout-grid-shipping-three">
              <label className="checkout-field checkout-field-placeholder">
                <span className="checkout-field-title">City</span>
                <input
                  type="text"
                  placeholder="City"
                  autoComplete="address-level2"
                  value={form.shipping.city}
                  onChange={(event) => updateSection("shipping", "city", event.target.value)}
                  aria-label="City"
                  aria-invalid={Boolean(getFieldError(errors, "shipping.city"))}
                />
                {getFieldError(errors, "shipping.city") ? <small>{getFieldError(errors, "shipping.city")}</small> : null}
              </label>

              <label className="checkout-field checkout-field-placeholder">
                <span className="checkout-field-title">Governorate</span>
                <select
                  className={form.shipping.governorate ? "has-value" : undefined}
                  value={form.shipping.governorate}
                  onChange={(event) => updateSection("shipping", "governorate", event.target.value)}
                  aria-label="Governorate"
                  aria-invalid={Boolean(getFieldError(errors, "shipping.governorate"))}
                >
                  <option value="">Governorate</option>
                  {EGYPT_GOVERNORATES.map((governorate) => (
                    <option key={governorate} value={governorate}>
                      {governorate}
                    </option>
                  ))}
                </select>
                {getFieldError(errors, "shipping.governorate") ? <small>{getFieldError(errors, "shipping.governorate")}</small> : null}
              </label>

              <label className="checkout-field checkout-field-placeholder">
                <span className="checkout-field-title">Postal code</span>
                <input
                  type="text"
                  placeholder="Postal code (optional)"
                  autoComplete="postal-code"
                  value={form.shipping.postalCode}
                  onChange={(event) => updateSection("shipping", "postalCode", event.target.value)}
                  aria-label="Postal code"
                  aria-invalid={Boolean(getFieldError(errors, "shipping.postalCode"))}
                />
                {getFieldError(errors, "shipping.postalCode") ? <small>{getFieldError(errors, "shipping.postalCode")}</small> : null}
              </label>
            </div>

            <label className="checkout-field checkout-field-placeholder checkout-field-full">
              <span className="checkout-field-title">Phone</span>
              <input
                type="tel"
                placeholder="Phone"
                autoComplete="tel"
                value={form.shipping.phoneNumber}
                onChange={(event) => updateSection("shipping", "phoneNumber", event.target.value)}
                aria-label="Phone"
                aria-invalid={Boolean(getFieldError(errors, "shipping.phoneNumber"))}
              />
              {getFieldError(errors, "shipping.phoneNumber") ? <small>{getFieldError(errors, "shipping.phoneNumber")}</small> : null}
            </label>

            <label className="checkout-checkbox checkout-checkbox-shipping">
              <input
                type="checkbox"
                checked={Boolean(form.shipping.saveInformation)}
                onChange={(event) => updateSection("shipping", "saveInformation", event.target.checked)}
              />
              <span>Save this information for next time</span>
            </label>
          </section>

          <section className="checkout-section">
            <div className="checkout-section-head">
              <div>
                <h2>Billing Details</h2>
              </div>
            </div>

            <p className="checkout-notice">
              A deposit of <strong>{formatMoney(summary.depositRequired, currency)}</strong> is required now. Your order is only confirmed after this 30% advance succeeds.
            </p>

            <label className="checkout-field">
              <span>Billing Full Name</span>
              <input
                type="text"
                value={form.billing.fullName}
                onChange={(event) => updateSection("billing", "fullName", event.target.value)}
                aria-invalid={Boolean(getFieldError(errors, "billing.fullName"))}
              />
              {getFieldError(errors, "billing.fullName") ? <small>{getFieldError(errors, "billing.fullName")}</small> : null}
            </label>

            <label className="checkout-field">
              <span>Payment Method</span>
              <select
                value={form.billing.paymentMethod}
                onChange={(event) => updateSection("billing", "paymentMethod", event.target.value)}
                aria-invalid={Boolean(getFieldError(errors, "billing.paymentMethod"))}
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {getFieldError(errors, "billing.paymentMethod") ? <small>{getFieldError(errors, "billing.paymentMethod")}</small> : null}
            </label>

            {form.billing.paymentMethod === "card" ? (
              <div className="checkout-payment-card">
                <p className="checkout-payment-note">Card details are used only to authorize the required deposit and are not stored after confirmation.</p>

                <div className="checkout-grid">
                  <label className="checkout-field">
                    <span>Cardholder Name</span>
                    <input
                      type="text"
                      value={form.payment.cardholderName}
                      onChange={(event) => updateSection("payment", "cardholderName", event.target.value)}
                      aria-invalid={Boolean(getFieldError(errors, "billing.cardholderName"))}
                    />
                    {getFieldError(errors, "billing.cardholderName") ? <small>{getFieldError(errors, "billing.cardholderName")}</small> : null}
                  </label>

                  <label className="checkout-field">
                    <span>Card Number</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={form.payment.cardNumber}
                      onChange={(event) => updateSection("payment", "cardNumber", event.target.value)}
                      aria-invalid={Boolean(getFieldError(errors, "billing.cardNumber"))}
                    />
                    {getFieldError(errors, "billing.cardNumber") ? <small>{getFieldError(errors, "billing.cardNumber")}</small> : null}
                  </label>
                </div>

                <div className="checkout-grid checkout-grid-three">
                  <label className="checkout-field">
                    <span>Expiry Month</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-exp-month"
                      value={form.payment.expiryMonth}
                      onChange={(event) => updateSection("payment", "expiryMonth", event.target.value)}
                      aria-invalid={Boolean(getFieldError(errors, "billing.expiryMonth"))}
                    />
                    {getFieldError(errors, "billing.expiryMonth") ? <small>{getFieldError(errors, "billing.expiryMonth")}</small> : null}
                  </label>

                  <label className="checkout-field">
                    <span>Expiry Year</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-exp-year"
                      value={form.payment.expiryYear}
                      onChange={(event) => updateSection("payment", "expiryYear", event.target.value)}
                      aria-invalid={Boolean(getFieldError(errors, "billing.expiryYear"))}
                    />
                    {getFieldError(errors, "billing.expiryYear") ? <small>{getFieldError(errors, "billing.expiryYear")}</small> : null}
                  </label>

                  <label className="checkout-field">
                    <span>CVV</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      value={form.payment.cvv}
                      onChange={(event) => updateSection("payment", "cvv", event.target.value)}
                      aria-invalid={Boolean(getFieldError(errors, "billing.cvv"))}
                    />
                    {getFieldError(errors, "billing.cvv") ? <small>{getFieldError(errors, "billing.cvv")}</small> : null}
                  </label>
                </div>
              </div>
            ) : form.billing.paymentMethod === "instapay" ? (
              <div className="checkout-payment-card">
                <p className="checkout-payment-note">
                  Share your Instapay transfer details so our team can verify the 30% advance and confirm the order.
                </p>

                <label className="checkout-field">
                  <span>Transaction Reference Number</span>
                  <input
                    type="text"
                    value={form.payment.instapayTransactionReference}
                    onChange={(event) => updateSection("payment", "instapayTransactionReference", event.target.value)}
                    aria-invalid={Boolean(getFieldError(errors, "billing.instapayTransactionReference"))}
                  />
                  {getFieldError(errors, "billing.instapayTransactionReference") ? (
                    <small>{getFieldError(errors, "billing.instapayTransactionReference")}</small>
                  ) : null}
                </label>

                <div className="checkout-grid">
                  <label className="checkout-field">
                    <span>Name</span>
                    <input
                      type="text"
                      value={form.payment.instapayName}
                      onChange={(event) => updateSection("payment", "instapayName", event.target.value)}
                      aria-invalid={Boolean(getFieldError(errors, "billing.instapayName"))}
                    />
                    {getFieldError(errors, "billing.instapayName") ? <small>{getFieldError(errors, "billing.instapayName")}</small> : null}
                  </label>

                  <label className="checkout-field">
                    <span>Instapay Username</span>
                    <div
                      className="checkout-prefixed-input"
                      data-invalid={Boolean(getFieldError(errors, "billing.instapayUsername"))}
                    >
                      <span aria-hidden="true">@</span>
                      <input
                        type="text"
                        placeholder="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={form.payment.instapayUsername}
                        onChange={(event) =>
                          updateSection(
                            "payment",
                            "instapayUsername",
                            normalizeInstapayUsernameInput(event.target.value)
                          )
                        }
                        aria-label="Instapay Username"
                        aria-invalid={Boolean(getFieldError(errors, "billing.instapayUsername"))}
                      />
                    </div>
                    {getFieldError(errors, "billing.instapayUsername") ? <small>{getFieldError(errors, "billing.instapayUsername")}</small> : null}
                  </label>
                </div>

                <label className="checkout-field">
                  <span>Number</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.payment.instapayNumber}
                    onChange={(event) => updateSection("payment", "instapayNumber", event.target.value)}
                    aria-invalid={Boolean(getFieldError(errors, "billing.instapayNumber"))}
                  />
                  {getFieldError(errors, "billing.instapayNumber") ? <small>{getFieldError(errors, "billing.instapayNumber")}</small> : null}
                </label>
              </div>
            ) : (
              <label className="checkout-field">
                <span>{form.billing.paymentMethod === "instapay" ? "Instapay Reference" : "Payment Reference"}</span>
                <input
                  type="text"
                  value={form.payment.paymentReference}
                  onChange={(event) => updateSection("payment", "paymentReference", event.target.value)}
                  aria-invalid={Boolean(getFieldError(errors, "billing.paymentReference"))}
                />
                {getFieldError(errors, "billing.paymentReference") ? <small>{getFieldError(errors, "billing.paymentReference")}</small> : null}
              </label>
            )}

            <label className="checkout-checkbox">
              <input
                type="checkbox"
                checked={form.billing.advancePaymentNoticeAccepted}
                onChange={(event) => updateSection("billing", "advancePaymentNoticeAccepted", event.target.checked)}
              />
              <span>I understand that my order is confirmed only after the required 30% advance payment succeeds.</span>
            </label>
            {getFieldError(errors, "billing.advancePaymentNoticeAccepted") ? (
              <p className="checkout-checkbox-error">{getFieldError(errors, "billing.advancePaymentNoticeAccepted")}</p>
            ) : null}
          </section>

          {errors.items ? <p className="checkout-submit-status checkout-submit-status-error">{errors.items}</p> : null}
          {status ? <p className={`checkout-submit-status ${status.includes("Confirming") ? "" : "checkout-submit-status-error"}`}>{status}</p> : null}

          <div className="checkout-actions">
            <Link to="/cart" className="checkout-secondary-link">
              Return to cart
            </Link>
            <button type="submit" className="checkout-submit-btn" disabled={isSubmitting || !items.length}>
              {isSubmitting
                ? isInstapayPayment
                  ? "Submitting..."
                  : "Processing..."
                : isInstapayPayment
                  ? "Confirm Order & Submit Details"
                  : `Confirm Order & Pay ${formatMoney(summary.depositRequired, currency)}`}
            </button>
          </div>
        </form>

        <aside className="checkout-summary">
          <div className="checkout-summary-card">
            <p className="checkout-summary-kicker">Order Summary</p>
            <h2>What you’re confirming</h2>

            <div className="checkout-summary-list">
              {items.map((item) => {
                const multiplier = item.mode === "rent" ? Number(item.rental_days || 1) : 1;
                const lineTotal = Number(item.unit_price || 0) * Number(item.quantity || 0) * multiplier;

                return (
                  <article key={item.cart_item_key || `${item.id}-${item.mode}`} className="checkout-summary-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>
                        {item.quantity} x {item.mode === "rent" ? `${multiplier} day${multiplier === 1 ? "" : "s"} rent` : "buy"}
                      </p>
                      <p>
                        {item.selected_color || "Standard"} / {item.selected_size || "Default"}
                        {item.customization_requested ? " • Customized" : ""}
                      </p>
                    </div>
                    <span>{formatMoney(lineTotal, item.currency || currency)}</span>
                  </article>
                );
              })}
            </div>

            <div className="checkout-summary-row">
              <span>Subtotal</span>
              <strong>{formatMoney(summary.subtotal, currency)}</strong>
            </div>
            <div className="checkout-summary-row">
              <span>Advance due now</span>
              <strong>{formatMoney(summary.depositRequired, currency)}</strong>
            </div>
            <div className="checkout-summary-row checkout-summary-row-total">
              <span>Total order value</span>
              <strong>{formatMoney(summary.total, currency)}</strong>
            </div>
          </div>
        </aside>
      </div>
    </motion.main>
  );
}

export default CheckoutPage;
