import { useDeferredValue, useMemo, useState } from "react";
import {
  buildFormFromPackage,
  buildPackagePayload,
  createEmptyPackageDiscountTier,
  createEmptyPackageForm,
  createEmptyPackageItem,
  formatMoney,
  packageMatchesSearch,
  previewPackageDraft,
  removePackage,
  savePackage
} from "../lib/admin";

const EVENT_TYPE_OPTIONS = [
  { label: "Select event type", value: "" },
  { label: "Private Party / Bachelorette", value: "private-party" },
  { label: "Birthday", value: "birthday" },
  { label: "Corporate", value: "corporate" },
  { label: "Indoor", value: "indoor" },
  { label: "Outdoor", value: "outdoor" },
  { label: "Wedding", value: "wedding" }
];

const VENUE_TYPE_OPTIONS = [
  { label: "Any venue type", value: "" },
  { label: "Indoor", value: "indoor" },
  { label: "Outdoor", value: "outdoor" },
  { label: "Hybrid", value: "hybrid" }
];

const PACKAGE_STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" }
];

const PACKAGE_VISIBILITY_OPTIONS = [
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
  { label: "Hidden", value: "hidden" }
];

const PACKAGE_MODE_OPTIONS = [
  { label: "Buy", value: "buy" },
  { label: "Rent", value: "rent" }
];

function getPreviewSubtotal(summary) {
  if (summary?.baseSubtotal !== null && summary?.baseSubtotal !== undefined) {
    return Number(summary.baseSubtotal) || 0;
  }

  return Number(summary?.subtotal || 0);
}

function PackagesPage({ error, isLoading, onPackagesRefresh, packages, products, productsError }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(createEmptyPackageForm());
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [pageError, setPageError] = useState("");
  const [previewPayload, setPreviewPayload] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const productMap = useMemo(
    () => new Map((Array.isArray(products) ? products : []).map((product) => [String(product.id), product])),
    [products]
  );

  const filteredPackages = useMemo(
    () => packages.filter((pkg) => packageMatchesSearch(pkg, deferredSearch)),
    [deferredSearch, packages]
  );

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyPackageForm());
    setPreviewPayload(null);
    setPageError("");
  }

  function updateTopLevelField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
    setNotice("");
    setPageError("");
  }

  function updateContextField(field, value) {
    setForm((current) => ({
      ...current,
      contextDefaults: {
        ...current.contextDefaults,
        [field]: value
      }
    }));
    setNotice("");
    setPageError("");
  }

  function updateItem(itemIndex, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, index) => (
        index === itemIndex
          ? {
              ...item,
              [field]: value
            }
          : item
      ))
    }));
    setNotice("");
    setPageError("");
  }

  function updateDiscountTier(itemIndex, tierIndex, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, index) => (
        index === itemIndex
          ? {
              ...item,
              discountTiers: item.discountTiers.map((tier, currentTierIndex) => (
                currentTierIndex === tierIndex
                  ? {
                      ...tier,
                      [field]: value
                    }
                  : tier
              ))
            }
          : item
      ))
    }));
    setNotice("");
    setPageError("");
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, createEmptyPackageItem()]
    }));
  }

  function removeItem(itemIndex) {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1
        ? [createEmptyPackageItem()]
        : current.items.filter((_, index) => index !== itemIndex)
    }));
  }

  function addDiscountTier(itemIndex) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, index) => (
        index === itemIndex
          ? {
              ...item,
              discountTiers: [...item.discountTiers, createEmptyPackageDiscountTier()]
            }
          : item
      ))
    }));
  }

  function removeDiscountTier(itemIndex, tierIndex) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, index) => (
        index === itemIndex
          ? {
              ...item,
              discountTiers:
                item.discountTiers.length === 1
                  ? [createEmptyPackageDiscountTier()]
                  : item.discountTiers.filter((_, currentTierIndex) => currentTierIndex !== tierIndex)
            }
          : item
      ))
    }));
  }

  async function handlePreview() {
    setIsPreviewing(true);
    setNotice("");
    setPageError("");

    try {
      const payload = buildPackagePayload(form);
      const preview = await previewPackageDraft(payload, {
        context: payload.contextDefaults
      });
      setPreviewPayload(preview);
    } catch (previewError) {
      setPreviewPayload(null);
      setPageError(previewError?.message || "Unable to preview this package right now.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setNotice("");
    setPageError("");

    try {
      const payload = buildPackagePayload(form);
      await savePackage(payload, editingId);
      await onPackagesRefresh();
      setNotice(editingId ? "Package updated successfully." : "Package created successfully.");
      setPreviewPayload(null);
      setEditingId(null);
      setForm(createEmptyPackageForm());
    } catch (submitError) {
      setPageError(submitError?.message || "Unable to save this package.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(pkg) {
    setEditingId(pkg.id);
    setForm(buildFormFromPackage(pkg));
    setPreviewPayload(pkg.preview ? { package: pkg, preview: pkg.preview } : null);
    setNotice("");
    setPageError("");
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  async function handleDelete(pkg) {
    const confirmed = window.confirm(`Delete "${pkg.name}"?`);
    if (!confirmed) return;

    setNotice("");
    setPageError("");

    try {
      await removePackage(pkg.id);
      await onPackagesRefresh();

      if (editingId === pkg.id) {
        resetForm();
      }

      setNotice("Package deleted successfully.");
    } catch (deleteError) {
      setPageError(deleteError?.message || "Unable to delete this package.");
    }
  }

  function resolveProduct(item) {
    return productMap.get(String(item?.productId || item?.product?.id || "")) || item?.product || null;
  }

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Packages</h2>
          <p className="muted">Create prebuilt packages, define package item rules, and preview bundled pricing.</p>
        </div>

        <div className="title-actions">
          <button
            className="btn ghost"
            disabled={isLoading}
            onClick={() => {
              void onPackagesRefresh().catch(() => {});
            }}
            type="button"
          >
            Refresh Packages
          </button>
        </div>
      </div>

      <div className="section-stack">
        {error ? (
          <div className="feedback-panel error">
            <strong>Package data could not be refreshed.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {productsError ? (
          <div className="feedback-panel error">
            <strong>Product data is incomplete for package editing.</strong>
            <span>{productsError}</span>
          </div>
        ) : null}

        {pageError ? (
          <div className="feedback-panel error">
            <strong>There was a problem with the last package action.</strong>
            <span>{pageError}</span>
          </div>
        ) : null}

        {notice ? (
          <div className="feedback-panel success">
            <strong>Packages updated.</strong>
            <span>{notice}</span>
          </div>
        ) : null}

        <div className="admin-packages-grid">
          <form className="panel product-form package-editor-form" onSubmit={handleSubmit}>
            <div className="package-editor-head">
              <div>
                <h3>{editingId ? "Edit Package" : "Create Package"}</h3>
                <p className="helper-text">
                  Define package defaults, required items, quantity rules, and item-level discount tiers.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="package-name">Package name</label>
                <input
                  id="package-name"
                  onChange={(event) => updateTopLevelField("name", event.target.value)}
                  placeholder="Corporate Launch Bundle"
                  value={form.name}
                />
              </div>

              <div className="field">
                <label htmlFor="package-event-type">Event type</label>
                <select
                  id="package-event-type"
                  onChange={(event) => {
                    updateTopLevelField("eventType", event.target.value);
                    updateContextField("eventType", event.target.value);
                  }}
                  value={form.eventType}
                >
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="package-status">Status</label>
                <select
                  id="package-status"
                  onChange={(event) => updateTopLevelField("status", event.target.value)}
                  value={form.status}
                >
                  {PACKAGE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="package-visibility">Visibility</label>
                <select
                  id="package-visibility"
                  onChange={(event) => updateTopLevelField("visibility", event.target.value)}
                  value={form.visibility}
                >
                  {PACKAGE_VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field field-wide">
                <label htmlFor="package-description">Description</label>
                <textarea
                  id="package-description"
                  onChange={(event) => updateTopLevelField("description", event.target.value)}
                  placeholder="Describe the event goals, included setup, and who this package is best for."
                  rows="4"
                  value={form.description}
                />
              </div>
            </div>

            <div className="checks-row package-checks-row">
              <label>
                <input
                  checked={Boolean(form.active)}
                  onChange={(event) => updateTopLevelField("active", event.target.checked)}
                  type="checkbox"
                />
                Active
              </label>
            </div>

            <div className="panel package-editor-panel">
              <div className="package-editor-panel-head">
                <h4>Context Defaults</h4>
                <p className="helper-text">These values drive the package preview and package-builder starting state.</p>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="package-context-venue-type">Venue type</label>
                  <select
                    id="package-context-venue-type"
                    onChange={(event) => updateContextField("venueType", event.target.value)}
                    value={form.contextDefaults.venueType}
                  >
                    {VENUE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value || "any"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="package-context-venue-size">Venue size</label>
                  <input
                    id="package-context-venue-size"
                    onChange={(event) => updateContextField("venueSize", event.target.value)}
                    placeholder="Ballroom, expo hall, open ground..."
                    value={form.contextDefaults.venueSize}
                  />
                </div>

                <div className="field">
                  <label htmlFor="package-context-guest-count">Guest count</label>
                  <input
                    id="package-context-guest-count"
                    min="0"
                    onChange={(event) => updateContextField("guestCount", event.target.value)}
                    type="number"
                    value={form.contextDefaults.guestCount}
                  />
                </div>

                <div className="field">
                  <label htmlFor="package-context-budget">Budget</label>
                  <input
                    id="package-context-budget"
                    min="0"
                    onChange={(event) => updateContextField("budget", event.target.value)}
                    type="number"
                    value={form.contextDefaults.budget}
                  />
                </div>

                <div className="field field-wide">
                  <label htmlFor="package-context-delivery-place">Delivery place</label>
                  <input
                    id="package-context-delivery-place"
                    onChange={(event) => updateContextField("deliveryPlace", event.target.value)}
                    placeholder="Cairo, Giza, Alexandria..."
                    value={form.contextDefaults.deliveryPlace}
                  />
                </div>
              </div>
            </div>

            <div className="panel package-editor-panel">
              <div className="package-editor-panel-head">
                <div>
                  <h4>Package Items</h4>
                  <p className="helper-text">Select products, set minimum and default quantities, then define optional tier pricing.</p>
                </div>
                <button className="btn ghost" onClick={addItem} type="button">
                  Add Item
                </button>
              </div>

              <div className="package-item-grid">
                {form.items.map((item, itemIndex) => {
                  const product = resolveProduct(item);

                  return (
                    <article className="package-item-editor" key={item.id}>
                      <div className="package-item-row">
                        <div className="field">
                          <label htmlFor={`package-item-product-${item.id}`}>Product</label>
                          <select
                            id={`package-item-product-${item.id}`}
                            onChange={(event) => updateItem(itemIndex, "productId", event.target.value)}
                            value={item.productId}
                          >
                            <option value="">Select a product</option>
                            {products.map((productOption) => (
                              <option key={productOption.id} value={productOption.id}>
                                {productOption.name} ({productOption.category})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field">
                          <label htmlFor={`package-item-min-${item.id}`}>Minimum qty</label>
                          <input
                            id={`package-item-min-${item.id}`}
                            min="1"
                            onChange={(event) => updateItem(itemIndex, "minimumQuantity", event.target.value)}
                            type="number"
                            value={item.minimumQuantity}
                          />
                        </div>

                        <button className="btn ghost" onClick={() => removeItem(itemIndex)} type="button">
                          Remove
                        </button>

                        <div className="field">
                          <label htmlFor={`package-item-default-${item.id}`}>Default qty</label>
                          <input
                            id={`package-item-default-${item.id}`}
                            min="1"
                            onChange={(event) => updateItem(itemIndex, "defaultQuantity", event.target.value)}
                            type="number"
                            value={item.defaultQuantity}
                          />
                        </div>

                        <div className="field">
                          <label htmlFor={`package-item-mode-${item.id}`}>Preferred mode</label>
                          <select
                            id={`package-item-mode-${item.id}`}
                            onChange={(event) => updateItem(itemIndex, "preferredMode", event.target.value)}
                            value={item.preferredMode}
                          >
                            {PACKAGE_MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="checks-row">
                          <label>
                            <input
                              checked={Boolean(item.required)}
                              onChange={(event) => updateItem(itemIndex, "required", event.target.checked)}
                              type="checkbox"
                            />
                            Required item
                          </label>
                        </div>
                      </div>

                      {product?.id ? (
                        <div className="package-item-preview">
                          <strong>{product.name}</strong>
                          <span>
                            {product.category} / {product.subcategory}
                            {product.buy_price !== null ? ` | Buy ${formatMoney(product.buy_price, product.currency)}` : ""}
                            {product.rent_price_per_day !== null ? ` | Rent ${formatMoney(product.rent_price_per_day, product.currency)}/day` : ""}
                          </span>
                        </div>
                      ) : (
                        <p className="package-empty-note">Select a product to preview its catalog details here.</p>
                      )}

                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor={`package-item-events-${item.id}`}>Applicable event types</label>
                          <input
                            id={`package-item-events-${item.id}`}
                            onChange={(event) => updateItem(itemIndex, "appliesToEventTypes", event.target.value)}
                            placeholder="birthday, corporate"
                            value={item.appliesToEventTypes}
                          />
                          <small>Comma or new-line separated.</small>
                        </div>

                        <div className="field">
                          <label htmlFor={`package-item-venues-${item.id}`}>Applicable venue types</label>
                          <input
                            id={`package-item-venues-${item.id}`}
                            onChange={(event) => updateItem(itemIndex, "appliesToVenueTypes", event.target.value)}
                            placeholder="indoor, outdoor"
                            value={item.appliesToVenueTypes}
                          />
                          <small>Comma or new-line separated.</small>
                        </div>

                        <div className="field field-wide">
                          <label htmlFor={`package-item-notes-${item.id}`}>Package item notes</label>
                          <textarea
                            id={`package-item-notes-${item.id}`}
                            onChange={(event) => updateItem(itemIndex, "notes", event.target.value)}
                            placeholder="Notes for package builders or admin preview."
                            rows="3"
                            value={item.notes}
                          />
                        </div>
                      </div>

                      <div className="package-tier-editor">
                        <div className="package-tier-editor-head">
                          <div>
                            <h5>Discount tiers</h5>
                            <p className="helper-text">Add quantity-based discounts or unit-price overrides for this package item.</p>
                          </div>
                          <button className="btn ghost" onClick={() => addDiscountTier(itemIndex)} type="button">
                            Add Tier
                          </button>
                        </div>

                        <div className="package-tier-grid">
                          {item.discountTiers.map((tier, tierIndex) => (
                            <div className="package-tier-row" key={tier.id}>
                              <input
                                min="1"
                                onChange={(event) => updateDiscountTier(itemIndex, tierIndex, "minQuantity", event.target.value)}
                                placeholder="Min qty"
                                type="number"
                                value={tier.minQuantity}
                              />
                              <input
                                min="1"
                                onChange={(event) => updateDiscountTier(itemIndex, tierIndex, "maxQuantity", event.target.value)}
                                placeholder="Max qty"
                                type="number"
                                value={tier.maxQuantity}
                              />
                              <input
                                min="0"
                                onChange={(event) => updateDiscountTier(itemIndex, tierIndex, "discountPercent", event.target.value)}
                                placeholder="Discount %"
                                step="0.01"
                                type="number"
                                value={tier.discountPercent}
                              />
                              <input
                                min="0"
                                onChange={(event) => updateDiscountTier(itemIndex, tierIndex, "unitPriceOverride", event.target.value)}
                                placeholder="Unit override"
                                step="0.01"
                                type="number"
                                value={tier.unitPriceOverride}
                              />
                              <input
                                onChange={(event) => updateDiscountTier(itemIndex, tierIndex, "label", event.target.value)}
                                placeholder="Tier label"
                                value={tier.label}
                              />
                              <button className="btn ghost" onClick={() => removeDiscountTier(itemIndex, tierIndex)} type="button">
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="form-actions">
              <button className="btn primary" disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : editingId ? "Update Package" : "Create Package"}
              </button>
              <button className="btn ghost" disabled={isPreviewing} onClick={() => { void handlePreview(); }} type="button">
                {isPreviewing ? "Previewing..." : "Preview Pricing"}
              </button>
              <button className="btn ghost" onClick={resetForm} type="button">
                Reset
              </button>
            </div>
          </form>

          <div className="section-stack">
            <section className="panel">
              <div className="package-editor-panel-head">
                <div>
                  <h3>Pricing Preview</h3>
                  <p className="helper-text">Use the current form state to preview package totals, discount logic, and validation outcomes.</p>
                </div>
              </div>

              {previewPayload?.preview ? (
                <div className="package-preview-grid">
                  <div className="package-preview-summary">
                    <div className="stat-row">
                      <strong>Subtotal</strong>
                      <span>{formatMoney(getPreviewSubtotal(previewPayload.preview.summary), previewPayload.preview.summary.currency || "EGP")}</span>
                    </div>
                    <div className="stat-row">
                      <strong>Item discounts</strong>
                      <span>-{formatMoney(previewPayload.preview.summary.itemDiscounts || 0, previewPayload.preview.summary.currency || "EGP")}</span>
                    </div>
                    <div className="stat-row">
                      <strong>Customization fees</strong>
                      <span>{formatMoney(previewPayload.preview.summary.customizationFees || 0, previewPayload.preview.summary.currency || "EGP")}</span>
                    </div>
                    <div className="stat-row">
                      <strong>Bundle discount</strong>
                      <span>-{formatMoney(previewPayload.preview.summary.bundleDiscount || 0, previewPayload.preview.summary.currency || "EGP")}</span>
                    </div>
                    <div className="stat-row">
                      <strong>Shipping</strong>
                      <span>{formatMoney(previewPayload.preview.summary.shipping || 0, previewPayload.preview.summary.currency || "EGP")}</span>
                    </div>
                    <div className="stat-row">
                      <strong>Final total</strong>
                      <span>{formatMoney(previewPayload.preview.summary.finalTotal || 0, previewPayload.preview.summary.currency || "EGP")}</span>
                    </div>
                  </div>

                  <div className="package-preview-validation-list">
                    {(Array.isArray(previewPayload.preview.validations) && previewPayload.preview.validations.length
                      ? previewPayload.preview.validations
                      : [{ code: "admin-preview-ready", level: "success", message: "This package preview is valid and ready to publish." }])
                      .map((issue) => (
                        <p className={`package-preview-note is-${issue.level}`} key={`${issue.code}-${issue.message}`}>
                          {issue.message}
                        </p>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="feedback-panel">
                  <strong>No preview generated yet.</strong>
                  <span>Click "Preview Pricing" to validate quantities, discounts, shipping, and bundle totals.</span>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="list-head">
                <div>
                  <h3>Saved Packages</h3>
                  <p className="helper-text">Review existing packages, then edit or delete them as needed.</p>
                </div>

                <input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search packages..."
                  type="search"
                  value={search}
                />
              </div>

              {isLoading ? (
                <div className="feedback-panel">
                  <strong>Loading packages...</strong>
                  <span>The package list will appear as soon as the API responds.</span>
                </div>
              ) : null}

              <div className="package-list">
                {filteredPackages.length ? (
                  filteredPackages.map((pkg) => (
                    <article className="package-card" key={pkg.id}>
                      <div className="package-card-main">
                        <div className="package-card-head">
                          <div>
                            <h4>{pkg.name}</h4>
                            <p className="meta">{pkg.eventType || "general"} | {pkg.visibility || "public"} | {pkg.status || "draft"}</p>
                          </div>
                          <div className="package-badge-row">
                            <span className={`role-pill${pkg.active ? "" : " is-inactive"}`}>{pkg.active ? "Active" : "Inactive"}</span>
                          </div>
                        </div>

                        <p className="muted">{pkg.description || "No description provided for this package."}</p>

                        <div className="package-card-items">
                          {pkg.items.slice(0, 3).map((item) => {
                            const product = resolveProduct(item);

                            return (
                              <div className="package-card-item" key={item.id}>
                                <img
                                  alt={product?.name || "Package item"}
                                  className="package-card-item-image"
                                  src={product?.image_url || "https://placehold.co/160x160?text=EventMart"}
                                />
                                <div className="package-card-item-copy">
                                  <strong>{product?.name || "Catalog item"}</strong>
                                  <span>Default qty {item.defaultQuantity} | Min qty {item.minimumQuantity}</span>
                                  {Array.isArray(item.discountTiers) && item.discountTiers.length ? (
                                    <p>
                                      {item.discountTiers.filter((tier) =>
                                        String(tier?.minQuantity || "").trim() ||
                                        String(tier?.discountPercent || "").trim() ||
                                        String(tier?.unitPriceOverride || "").trim()
                                      ).length || 0}
                                      {" "}tier rule(s) configured
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {pkg.preview?.summary ? (
                          <p className="price-line">
                            Preview total {formatMoney(pkg.preview.summary.finalTotal || 0, pkg.preview.summary.currency || "EGP")}
                          </p>
                        ) : null}
                      </div>

                      <div className="product-actions">
                        <button className="btn primary" onClick={() => handleEdit(pkg)} type="button">
                          Edit
                        </button>
                        <button className="btn ghost" onClick={() => { void handleDelete(pkg); }} type="button">
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="feedback-panel">
                    <strong>No packages found.</strong>
                    <span>Adjust the search term or create a new package above.</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PackagesPage;
