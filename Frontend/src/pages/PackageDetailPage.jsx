import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import useRequireAuth from "../hooks/useRequireAuth";
import {
  createCartItemsFromBuilderPreview,
  createPackageGroupId,
  previewPackage
} from "../lib/packages";
import "../styles/packages.css";

function formatQuantityTierLabel(tier) {
  const minQuantity = Number(tier?.minQuantity || 0);
  const maxQuantity = tier?.maxQuantity;

  if (!minQuantity) {
    return "";
  }

  if (maxQuantity === null || maxQuantity === undefined || maxQuantity === "") {
    return `${minQuantity}+`;
  }

  return `${minQuantity}-${Number(maxQuantity)}`;
}

function PackageDetailPage() {
  const navigate = useNavigate();
  const { identifier = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState(null);
  const [packageGroupId] = useState(() => createPackageGroupId("package-detail"));
  const { requireAuth } = useRequireAuth();
  const { setItems } = useCart();

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    previewPackage({
      packageGroupId,
      packageSlug: identifier
    })
      .then((response) => {
        if (cancelled) return;
        setPayload(response);
        setLoading(false);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError?.message || "Unable to load this package right now.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [identifier, packageGroupId]);

  const preview = payload?.preview || null;
  const pkg = payload?.package || null;
  const summary = preview?.summary || null;

  const selectedItemMap = useMemo(
    () => new Map((Array.isArray(preview?.selectedItems) ? preview.selectedItems : []).map((item) => [Number(item.id), item])),
    [preview?.selectedItems]
  );

  function replacePackageCartItems(nextPreview) {
    const cartItems = createCartItemsFromBuilderPreview(nextPreview);

    setItems((current) => [
      ...current.filter((item) => item?.package_meta?.packageGroupId !== packageGroupId),
      ...cartItems
    ]);
  }

  function handlePackageSelection({ checkout = false } = {}) {
    if (!preview?.canCheckout) return;

    replacePackageCartItems(preview);
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

  if (loading) {
    return (
      <main className="packages-page" data-theme-scope="packages">
        <section className="package-shell-card package-state-card">
          <p className="package-eyebrow">Package Details</p>
          <h1>Loading package details...</h1>
          <p>We&apos;re preparing the included items, discounts, and delivery guidance.</p>
        </section>
      </main>
    );
  }

  if (error || !preview || !pkg || !summary) {
    return (
      <main className="packages-page" data-theme-scope="packages">
        <section className="package-shell-card package-state-card">
          <p className="package-eyebrow">Package Details</p>
          <h1>This package is unavailable right now.</h1>
          <p>{error || "We couldn&apos;t load the requested package."}</p>
          <div className="package-state-actions">
            <Link className="package-primary-link" to="/packages">
              Browse Packages
            </Link>
            <Link className="package-secondary-link" to="/package-builder">
              Start Building
            </Link>
          </div>
        </section>
      </main>
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
      <div className="packages-layout package-detail-layout">
        <section className="package-shell-card package-detail-hero">
          <div className="package-detail-copy">
            <p className="package-eyebrow">Package Details</p>
            <div className="package-card-head">
              <div>
                <h1>{pkg.name}</h1>
                <p className="package-copy">
                  {pkg.description || "A ready-made package with bundled pricing and editable quantities for your event."}
                </p>
              </div>
              <div className="package-detail-pills">
                <span className={`package-requirement-pill is-${pkg.status}`}>{pkg.status}</span>
                <span className="package-detail-event">{pkg.eventType || "General event"}</span>
              </div>
            </div>

            <div className="package-detail-meta">
              <div>
                <strong>{preview.selectedItems.length}</strong>
                <span>Included items</span>
              </div>
              <div>
                <strong>
                  {Number(summary.minimumPackagePrice || 0) > 0
                    ? `${summary.currency} ${Number(summary.minimumPackagePrice || 0).toFixed(2)}`
                    : "No minimum"}
                </strong>
                <span>Minimum package price</span>
              </div>
              <div>
                <strong>{summary.freeShipping ? "Unlocked" : "Eligible at 4+"}</strong>
                <span>Shipping rule</span>
              </div>
              <div>
                <strong>{summary.deliveryEstimate?.label || "Based on delivery place"}</strong>
                <span>Estimated delivery</span>
              </div>
            </div>

            <div className="package-list-card-actions">
              <button
                className="package-primary-button"
                disabled={!preview.canCheckout}
                onClick={() => handlePackageSelection({ checkout: true })}
                type="button"
              >
                Continue to Checkout
              </button>
              <button
                className="package-secondary-button"
                disabled={!preview.canCheckout}
                onClick={() => handlePackageSelection()}
                type="button"
              >
                Add Package to Cart
              </button>
              <Link className="package-secondary-link" to={`/package-builder?package=${encodeURIComponent(pkg.slug || pkg.id)}`}>
                Customize Package
              </Link>
            </div>

            {message ? <p className="package-inline-success">{message}</p> : null}
          </div>

          <aside className="package-shell-card package-detail-summary">
            <p className="package-eyebrow">Pricing Snapshot</p>
            <h2>Package pricing</h2>

            <div className="package-summary-list">
              <div className="package-summary-row">
                <span>Subtotal</span>
                <strong>{summary.currency} {Number((summary.baseSubtotal ?? summary.subtotal) || 0).toFixed(2)}</strong>
              </div>
              <div className="package-summary-row">
                <span>Item discounts</span>
                <strong>-{summary.currency} {Number(summary.itemDiscounts || 0).toFixed(2)}</strong>
              </div>
              <div className="package-summary-row">
                <span>Customization fees</span>
                <strong>{summary.currency} {Number(summary.customizationFees || 0).toFixed(2)}</strong>
              </div>
              {Number(summary.minimumPackagePrice || 0) > 0 ? (
                <div className="package-summary-row">
                  <span>Minimum package price</span>
                  <strong>{summary.currency} {Number(summary.minimumPackagePrice || 0).toFixed(2)}</strong>
                </div>
              ) : null}
              {Number(summary.bundleDiscount || 0) > 0 ? (
                <div className="package-summary-row">
                  <span>Bundle discount</span>
                  <strong>-{summary.currency} {Number(summary.bundleDiscount || 0).toFixed(2)}</strong>
                </div>
              ) : null}
              <div className="package-summary-row">
                <span>Shipping</span>
                <strong>{summary.currency} {Number(summary.shipping || 0).toFixed(2)}</strong>
              </div>
              <div className="package-summary-row is-total">
                <span>Final total</span>
                <strong>{summary.currency} {Number(summary.finalTotal || 0).toFixed(2)}</strong>
              </div>
            </div>

            <div className="package-validation-list">
              {(Array.isArray(preview.validations) && preview.validations.length
                ? preview.validations
                : [{ code: "package-ready", level: "success", message: "This package is ready to continue or customize." }])
                .map((issue) => (
                  <p className={`package-validation is-${issue.level}`} key={`${issue.code}-${issue.message}`}>
                    {issue.message}
                  </p>
                ))}
            </div>
          </aside>
        </section>

        <section className="package-shell-card package-detail-items">
          <div className="package-card-head">
            <div>
              <p className="package-eyebrow">Included Items</p>
              <h2>What comes inside this package</h2>
            </div>
          </div>

          <div className="package-detail-item-list">
            {pkg.items.map((item) => {
              const selectedPreview = selectedItemMap.get(Number(item.productId));

              return (
                <article className="package-detail-item" key={item.id || item.productId}>
                  <img
                    alt={item.product?.name || "Package item"}
                    className="package-detail-item-image"
                    src={item.product?.image_url || "/assets/equipment-collage.jpg"}
                  />

                  <div className="package-detail-item-copy">
                    <div className="package-card-head">
                      <div>
                        <p className="package-card-kicker">{item.product?.category || "Event equipment"}</p>
                        <h3>{item.product?.name || "Package item"}</h3>
                      </div>
                      <span className={`package-requirement-pill is-${item.required ? "required" : "optional"}`}>
                        {item.required ? "required" : "optional"}
                      </span>
                    </div>

                    <p>
                      {item.product?.description || "Configured as part of the default package setup."}
                    </p>

                    <div className="package-detail-item-meta">
                      <span>Minimum qty {item.minimumQuantity}</span>
                      <span>Default qty {item.defaultQuantity}</span>
                      <span>{item.preferredMode === "rent" ? "Rent preferred" : "Buy preferred"}</span>
                      {selectedPreview?.matchedTier ? (
                        <span>{Number(selectedPreview.matchedTier.discountPercent || 0).toFixed(2)}% tier active</span>
                      ) : null}
                    </div>

                    {Array.isArray(item.discountTiers) && item.discountTiers.length ? (
                      <div className="package-tier-list" aria-label={`${item.product?.name || "Package item"} discount tiers`}>
                        {item.discountTiers.map((tier, tierIndex) => (
                          <div className="package-tier-chip" key={`${item.id || item.productId}-tier-${tierIndex}`}>
                            <strong>{formatQuantityTierLabel(tier)}</strong>
                            <span>{Number(tier.discountPercent || 0).toFixed(2)}% off</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {item.notes ? <p className="package-inline-note">{item.notes}</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </motion.main>
  );
}

export default PackageDetailPage;
