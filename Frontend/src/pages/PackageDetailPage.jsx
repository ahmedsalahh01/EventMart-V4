import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import useRequireAuth from "../hooks/useRequireAuth";
import { validateCustomizationFile } from "../lib/productDetail";
import { deleteCustomizationUploads, uploadCustomizationFile } from "../lib/products";
import {
  buildPackageDescription,
  createCartItemsFromBuilderPreview,
  createPackageGroupId,
  getPackageAudienceLabel,
  getPackageCustomizationLabel,
  getPackageDisplayPrice,
  getPackageRecommendedForLabel,
  getPackageVenueLabel,
  previewPackage
} from "../lib/packages";
import "../styles/packages.css";

function PackageDetailPage() {
  const navigate = useNavigate();
  const { identifier = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");
  const [isSaving, setIsSaving] = useState(false);
  const [payload, setPayload] = useState(null);
  const [packageGroupId] = useState(() => createPackageGroupId("package-detail"));
  const [uploadsByItemId, setUploadsByItemId] = useState({});
  const [uploadErrorsByItemId, setUploadErrorsByItemId] = useState({});
  const { token } = useAuth();
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
  const displayPrice = pkg ? getPackageDisplayPrice(pkg) : { amount: 0, currency: "EGP" };
  const selectedItemMap = useMemo(
    () =>
      new Map(
        (Array.isArray(preview?.selectedItems) ? preview.selectedItems : []).map((item) => [
          Number(item?.packageMeta?.packageItemId || item?.id),
          item
        ])
      ),
    [preview?.selectedItems]
  );

  function handleUploadChange(packageItemId, fileList) {
    const files = Array.from(fileList || []);
    const validationMessage = files
      .map((file) => validateCustomizationFile(file))
      .find(Boolean) || "";

    setUploadErrorsByItemId((current) => ({
      ...current,
      [packageItemId]: validationMessage
    }));
    setUploadsByItemId((current) => ({
      ...current,
      [packageItemId]: validationMessage ? [] : files
    }));
    setMessage("");
  }

  function replacePackageCartItems(nextPreview, customizationUploadsByPackageItemId) {
    const cartItems = createCartItemsFromBuilderPreview(nextPreview, {
      customizationUploadsByPackageItemId
    });

    setItems((current) => [
      ...current.filter((item) => item?.package_meta?.packageGroupId !== packageGroupId),
      ...cartItems
    ]);
  }

  async function handlePackageSelection({ checkout = false } = {}) {
    if (!preview) return;

    const selectedUploads = Object.entries(uploadsByItemId).filter(([, files]) => Array.isArray(files) && files.length);
    const hasUploadErrors = Object.values(uploadErrorsByItemId).some(Boolean);

    if (hasUploadErrors) {
      setMessageTone("error");
      setMessage("Please fix the package customization file errors before continuing.");
      return;
    }

    if (selectedUploads.length && !token) {
      if (!requireAuth({ returnTo: `/packages/${identifier}` })) {
        return;
      }
      return;
    }

    if (checkout && !token) {
      if (!requireAuth({ returnTo: "/checkout" })) {
        return;
      }
    }

    setIsSaving(true);
    setMessage("");
    const customizationUploadsByPackageItemId = new Map();
    const uploadedTokens = [];

    try {
      for (const item of Array.isArray(pkg?.items) ? pkg.items : []) {
        const packageItemId = Number(item?.id || 0);
        const files = Array.isArray(uploadsByItemId[packageItemId]) ? uploadsByItemId[packageItemId] : [];

        if (!item?.customizable || !files.length) {
          continue;
        }

        const uploadedAssets = [];
        for (const file of files) {
          const uploaded = await uploadCustomizationFile({
            file,
            packageId: pkg.id,
            packageItemId,
            productId: item.productId,
            token,
            uploadKind: "design"
          });

          uploadedAssets.push(uploaded);
          uploadedTokens.push(uploaded.uploadToken);
        }

        customizationUploadsByPackageItemId.set(packageItemId, uploadedAssets);
      }

      replacePackageCartItems(preview, customizationUploadsByPackageItemId);
      setMessageTone("success");
      setMessage(checkout ? "Package saved to cart. Redirecting to checkout..." : "Package saved to your cart.");

      if (checkout) {
        navigate("/checkout");
        return;
      }

      navigate("/cart");
    } catch (submitError) {
      if (uploadedTokens.length && token) {
        await deleteCustomizationUploads(uploadedTokens, token).catch(() => {});
      }

      setMessageTone("error");
      setMessage(submitError?.message || "We couldn't save this package to your cart right now.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="packages-page" data-theme-scope="packages">
        <section className="package-shell-card package-state-card">
          <p className="package-eyebrow">Package Details</p>
          <h1>Loading package details...</h1>
          <p>We&apos;re preparing the included items, package info, and customization options.</p>
        </section>
      </main>
    );
  }

  if (error || !preview || !pkg) {
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
            <Link className="package-secondary-link" to="/shop">
              Browse Products
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
            <p className="package-eyebrow">View Package</p>
            <div className="package-card-head">
              <div>
                <h1>{pkg.name}</h1>
                <p className="package-copy">{buildPackageDescription(pkg)}</p>
              </div>
              <div className="package-detail-pills">
                <span className={`package-requirement-pill is-${pkg.status}`}>{pkg.status}</span>
                <span className="package-detail-event">{getPackageCustomizationLabel(pkg)}</span>
              </div>
            </div>

            <div className="package-detail-meta">
              <div>
                <strong>{displayPrice.currency} {displayPrice.amount.toFixed(2)}</strong>
                <span>Package price</span>
              </div>
              <div>
                <strong>{getPackageVenueLabel(pkg)}</strong>
                <span>Venue type</span>
              </div>
              <div>
                <strong>{getPackageAudienceLabel(pkg)}</strong>
                <span>Fits for</span>
              </div>
              <div>
                <strong>{getPackageRecommendedForLabel(pkg)}</strong>
                <span>Recommended use</span>
              </div>
              <div>
                <strong>{pkg.items.length}</strong>
                <span>Included items</span>
              </div>
            </div>

            <div className="package-list-card-actions">
              <button
                className="package-primary-button"
                disabled={isSaving}
                onClick={() => { void handlePackageSelection(); }}
                type="button"
              >
                {isSaving ? "Saving..." : "Add to cart"}
              </button>
              <button
                className="package-secondary-button"
                disabled={isSaving}
                onClick={() => { void handlePackageSelection({ checkout: true }); }}
                type="button"
              >
                Continue to checkout
              </button>
              <Link className="package-secondary-link" to="/packages">
                Back to packages
              </Link>
            </div>

            {message ? (
              <p className={messageTone === "error" ? "package-inline-error" : "package-inline-success"}>
                {message}
              </p>
            ) : null}
          </div>

          <aside className="package-shell-card package-detail-summary">
            <p className="package-eyebrow">Package Snapshot</p>
            <h2>What this package includes</h2>

            <div className="package-summary-list">
              <div className="package-summary-row">
                <span>Package price</span>
                <strong>{displayPrice.currency} {displayPrice.amount.toFixed(2)}</strong>
              </div>
              <div className="package-summary-row">
                <span>Customization type</span>
                <strong>{getPackageCustomizationLabel(pkg)}</strong>
              </div>
              <div className="package-summary-row">
                <span>Venue type</span>
                <strong>{getPackageVenueLabel(pkg)}</strong>
              </div>
              <div className="package-summary-row">
                <span>Recommended for</span>
                <strong>{getPackageRecommendedForLabel(pkg)}</strong>
              </div>
              <div className="package-summary-row">
                <span>Fits for</span>
                <strong>{getPackageAudienceLabel(pkg)}</strong>
              </div>
              <div className="package-summary-row is-total">
                <span>Items included</span>
                <strong>{pkg.items.length}</strong>
              </div>
            </div>
          </aside>
        </section>

        <section className="package-shell-card package-detail-items package-detail-items-wide">
          <div className="package-card-head">
            <div>
              <p className="package-eyebrow">Included Items</p>
              <h2>Package items</h2>
            </div>
          </div>

          <div className="package-detail-item-grid">
            {pkg.items.map((item) => {
              const selectedPreview = selectedItemMap.get(Number(item.id || item.productId));
              const selectedFiles = Array.isArray(uploadsByItemId[item.id]) ? uploadsByItemId[item.id] : [];

              return (
                <article className="package-detail-item-card" key={item.id || item.productId}>
                  <img
                    alt={item.product?.name || "Package item"}
                    className="package-detail-item-image"
                    src={item.product?.image_url || "/assets/equipment-collage.jpg"}
                  />

                  <div className="package-detail-item-copy">
                    <p className="package-card-kicker">{item.product?.category || "Event item"}</p>
                    <h3>{item.product?.name || "Package item"}</h3>

                    <p>{item.description || item.product?.description || "No description provided for this package item."}</p>

                    <div className="package-detail-item-meta">
                      <span>Qty {item.quantityPerItem || item.defaultQuantity || 1}</span>
                    </div>

                    {item.customizable ? (
                      <div className="package-detail-upload-stack">
                        <label className="package-detail-upload-card">
                          <span className="package-detail-upload-title">Customization Photos</span>
                          <span className="package-detail-upload-copy">
                            Attach one or more PNG, JPG, WEBP, or PDF files for this package item. Files will be stored under the package customization upload folder after you add the package to cart.
                          </span>
                          <input
                            accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
                            multiple
                            onChange={(event) => handleUploadChange(item.id, event.target.files)}
                            type="file"
                          />
                          <strong>{selectedFiles.length ? `${selectedFiles.length} file(s) selected` : "Choose files"}</strong>
                          {uploadErrorsByItemId[item.id] ? (
                            <small className="package-detail-upload-error">{uploadErrorsByItemId[item.id]}</small>
                          ) : selectedFiles.length ? (
                            <small>{selectedFiles.map((file) => file.name).join(", ")}</small>
                          ) : (
                            <small>Multiple files supported</small>
                          )}
                        </label>
                      </div>
                    ) : null}
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
