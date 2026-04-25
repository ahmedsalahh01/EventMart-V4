import { useMemo, useState } from "react";
import {
  buildFormFromPackage,
  buildPackagePayload,
  createEmptyPackageForm,
  createEmptyPackageItem,
  formatMoney,
  removePackage,
  savePackage
} from "../lib/admin";

const PACKAGE_VENUE_OPTIONS = [
  { label: "Indoor", value: "indoor" },
  { label: "Outdoor", value: "outdoor" },
  { label: "Hybrid", value: "hybrid" }
];
const PACKAGE_CUSTOMIZATION_TYPE_OPTIONS = [
  { label: "Not Customizable", value: "not customizable" },
  { label: "Customizable", value: "customizable" },
  { label: "Hybrid", value: "hybrid" }
];

function createSimplePackageItem() {
  const item = createEmptyPackageItem();

  return {
    ...item,
    customizable: false,
    description: "",
    quantityPerItem: "1"
  };
}

function createSimplePackageForm() {
  const form = createEmptyPackageForm();

  return {
    ...form,
    active: true,
    contextDefaults: {
      ...form.contextDefaults,
      customizationAvailable: false,
      customizationType: "not customizable",
      guestCount: "",
      minimumPackagePrice: "0",
      packageMode: "hybrid",
      packagePrice: "",
      recommendedFor: "",
      venueType: "hybrid"
    },
    items: [createSimplePackageItem()],
    status: "active",
    visibility: "public"
  };
}

function simplifyLoadedPackage(pkg) {
  const form = buildFormFromPackage(pkg);
  const nextItems = Array.isArray(form.items) && form.items.length
    ? form.items.map((item) => ({
        ...createSimplePackageItem(),
        ...item,
        customizable: Boolean(item?.customizable),
        description: String(item?.description || item?.notes || ""),
        quantityPerItem: String(item?.quantityPerItem || item?.defaultQuantity || item?.minimumQuantity || 1)
      }))
    : [createSimplePackageItem()];

  return {
    ...form,
    active: true,
    contextDefaults: {
      ...form.contextDefaults,
      customizationAvailable: form.contextDefaults?.customizationType !== "not customizable",
      customizationType: form.contextDefaults?.customizationType || "not customizable",
      guestCount: String(form.contextDefaults?.guestCount || ""),
      minimumPackagePrice: "0",
      packageMode: "hybrid",
      packagePrice: String(form.contextDefaults?.packagePrice || ""),
      recommendedFor: String(form.contextDefaults?.recommendedFor || ""),
      venueType: form.contextDefaults?.venueType || "hybrid"
    },
    items: nextItems,
    status: "active",
    visibility: "public"
  };
}

function resolveItemProduct(item, productMap) {
  return productMap.get(String(item?.productId || item?.product?.id || "")) || item?.product || null;
}

function getPackageCurrency(form, productMap) {
  const selectedProduct = (Array.isArray(form?.items) ? form.items : [])
    .map((item) => resolveItemProduct(item, productMap))
    .find(Boolean);

  return String(selectedProduct?.currency || "EGP");
}

function getCustomizationTypeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "customizable") return "Customizable";
  if (normalized === "hybrid") return "Hybrid";
  return "Not customizable";
}

function getVenueLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "indoor") return "Indoor";
  if (normalized === "outdoor") return "Outdoor";
  if (normalized === "hybrid") return "Hybrid";
  return "General";
}

function getRecommendedForLabel(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(", ");
}

function PackagesPage({ error, isLoading, onPackagesRefresh, packages, products, productsError }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(createSimplePackageForm());
  const [notice, setNotice] = useState("");
  const [pageError, setPageError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const safePackages = Array.isArray(packages) ? packages : [];
  const safeProducts = Array.isArray(products) ? products : [];

  const productMap = useMemo(
    () => new Map(safeProducts.map((product) => [String(product.id), product])),
    [safeProducts]
  );

  const packageCurrency = useMemo(
    () => getPackageCurrency(form, productMap),
    [form, productMap]
  );

  function resetForm({ clearNotice = true } = {}) {
    setEditingId(null);
    setForm(createSimplePackageForm());
    if (clearNotice) {
      setNotice("");
    }
    setPageError("");
  }

  function updateField(field, value) {
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
        [field]: value,
        customizationAvailable:
          field === "customizationType"
            ? value !== "not customizable"
            : current.contextDefaults.customizationType !== "not customizable"
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

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, createSimplePackageItem()]
    }));
    setNotice("");
    setPageError("");
  }

  function removeItem(itemIndex) {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1
        ? [createSimplePackageItem()]
        : current.items.filter((_, index) => index !== itemIndex)
    }));
    setNotice("");
    setPageError("");
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
      resetForm({ clearNotice: false });
      setNotice(editingId ? "Package updated successfully." : "Package created successfully.");
    } catch (submitError) {
      setPageError(submitError?.message || "Unable to save this package.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(pkg) {
    setEditingId(pkg.id);
    setForm(simplifyLoadedPackage(pkg));
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

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Packages</h2>
          <p className="muted">Create frontend-ready packages with exact package pricing, venue/customization metadata, and catalog-backed package items.</p>
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
                <p className="helper-text">Packages are saved with the exact storefront price, then expanded into their included catalog items when added to cart.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="package-name">Package Name</label>
                <input
                  id="package-name"
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Wedding Essentials Package"
                  value={form.name}
                />
              </div>

              <div className="field">
                <label htmlFor="package-price">Package Price</label>
                <input
                  id="package-price"
                  min="0"
                  onChange={(event) => updateContextField("packagePrice", event.target.value)}
                  placeholder="15499.75"
                  step="0.01"
                  type="number"
                  value={form.contextDefaults.packagePrice}
                />
                <small>
                  This is the exact price shown on the frontend package cards and details page.
                </small>
              </div>

              <div className="field">
                <label htmlFor="package-fits-for-people">Fits For People</label>
                <input
                  id="package-fits-for-people"
                  min="1"
                  onChange={(event) => updateContextField("guestCount", event.target.value)}
                  placeholder="150"
                  type="number"
                  value={form.contextDefaults.guestCount}
                />
              </div>

              <div className="field">
                <label htmlFor="package-venue-type">Venue Type</label>
                <select
                  id="package-venue-type"
                  onChange={(event) => updateContextField("venueType", event.target.value)}
                  value={form.contextDefaults.venueType}
                >
                  {PACKAGE_VENUE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="package-customization-type">Customization Type</label>
                <select
                  id="package-customization-type"
                  onChange={(event) => updateContextField("customizationType", event.target.value)}
                  value={form.contextDefaults.customizationType}
                >
                  {PACKAGE_CUSTOMIZATION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field package-form-span-full">
                <label htmlFor="package-description">Package Description</label>
                <textarea
                  id="package-description"
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Describe what makes this package useful and what event setup it is best for."
                  rows="4"
                  value={form.description}
                />
              </div>

              <div className="field package-form-span-full">
                <label htmlFor="package-recommended-for">Recommended For</label>
                <textarea
                  id="package-recommended-for"
                  onChange={(event) => updateContextField("recommendedFor", event.target.value)}
                  placeholder="weddings&#10;birthdays&#10;conferences"
                  rows="3"
                  value={form.contextDefaults.recommendedFor}
                />
                <small>
                  Enter one or more event uses, separated by commas or new lines.
                </small>
              </div>

              <div className="field">
                <label>Frontend Price Preview</label>
                <div className="package-simple-price-card">
                  <strong>{formatMoney(form.contextDefaults.packagePrice || 0, packageCurrency)}</strong>
                  <span>Stored package price shown on Browse Packages and View Package.</span>
                  <span>
                    {getVenueLabel(form.contextDefaults.venueType)} | {getCustomizationTypeLabel(form.contextDefaults.customizationType)}
                  </span>
                </div>
              </div>
            </div>

            <div className="package-editor-panel">
              <div className="package-editor-panel-head">
                <div>
                  <h4>Items From Catalog</h4>
                  <p className="helper-text">Each package item must come from the existing catalog. Set the package-specific description, fixed quantity, and whether that item accepts customization uploads.</p>
                </div>
                <button className="btn ghost" onClick={addItem} type="button">
                  Add Item
                </button>
              </div>

              <div className="package-item-grid">
                {form.items.map((item, itemIndex) => {
                  const product = resolveItemProduct(item, productMap);

                  return (
                    <div className="package-simple-item-row package-simple-item-row-wide" key={item.id}>
                      <div className="field package-item-field package-item-field-catalog">
                        <label htmlFor={`package-item-product-${item.id}`}>Catalog Item</label>
                        <select
                          id={`package-item-product-${item.id}`}
                          onChange={(event) => updateItem(itemIndex, "productId", event.target.value)}
                          value={item.productId}
                        >
                          <option value="">Select a catalog item</option>
                          {safeProducts.map((productOption) => (
                            <option key={productOption.id} value={productOption.id}>
                              {productOption.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field package-item-field package-item-field-description">
                        <label htmlFor={`package-item-description-${item.id}`}>Item Description</label>
                        <textarea
                          className="package-item-description-input"
                          id={`package-item-description-${item.id}`}
                          onChange={(event) => updateItem(itemIndex, "description", event.target.value)}
                          placeholder="Describe this item inside the package."
                          rows="1"
                          value={item.description}
                        />
                      </div>

                      <div className="field package-item-field package-item-field-quantity">
                        <label htmlFor={`package-item-quantity-${item.id}`}>Quantity Per Item</label>
                        <input
                          id={`package-item-quantity-${item.id}`}
                          min="1"
                          onChange={(event) => updateItem(itemIndex, "quantityPerItem", event.target.value)}
                          type="number"
                          value={item.quantityPerItem}
                        />
                      </div>

                      <label className="package-checkbox package-checkbox-inline package-item-toggle">
                        <input
                          checked={Boolean(item.customizable)}
                          onChange={(event) => updateItem(itemIndex, "customizable", event.target.checked)}
                          type="checkbox"
                        />
                        <span>Customizable</span>
                      </label>

                      <button className="btn ghost package-item-remove-button" onClick={() => removeItem(itemIndex)} type="button">
                        Remove
                      </button>

                      {product ? (
                        <div className="package-item-preview">
                          <strong>{product.name}</strong>
                          <span>
                            {product.category} / {product.subcategory}
                          </span>
                          <span>
                            Package quantity {item.quantityPerItem || "1"}
                          </span>
                        </div>
                      ) : (
                        <p className="package-empty-note">Choose a catalog item to include it in the package.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-actions">
              <button className="btn primary" disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : editingId ? "Update Package" : "Create Package"}
              </button>
              <button className="btn ghost" onClick={resetForm} type="button">
                Reset
              </button>
            </div>
          </form>

          <section className="panel">
            <div className="package-editor-head">
              <div>
                <h3>Saved Packages</h3>
              </div>
            </div>

            {isLoading ? (
              <div className="feedback-panel">
                <strong>Loading packages...</strong>
                <span>The package list will appear as soon as the API responds.</span>
              </div>
            ) : null}

            <div className="package-list">
              {safePackages.length ? (
                safePackages.map((pkg) => {
                  const simpleForm = simplifyLoadedPackage(pkg);
                  const displayPrice = formatMoney(
                    simpleForm.contextDefaults.packagePrice || 0,
                    getPackageCurrency(simpleForm, productMap)
                  );
                  const recommendedForLabel = getRecommendedForLabel(simpleForm.contextDefaults.recommendedFor);

                  return (
                    <article className="package-card" key={pkg.id}>
                      <div className="package-card-main">
                        <div className="package-card-head">
                          <div>
                            <h4>{pkg.name}</h4>
                            <p className="meta">
                              {getVenueLabel(simpleForm.contextDefaults.venueType)} | {getCustomizationTypeLabel(simpleForm.contextDefaults.customizationType)}
                            </p>
                          </div>
                        </div>

                        <p className="meta">
                          Fits {simpleForm.contextDefaults.guestCount || "flexible"} people
                          {recommendedForLabel ? ` | ${recommendedForLabel}` : ""}
                        </p>
                        <p className="meta">{simpleForm.description || "No description provided."}</p>
                        <p className="price-line">Overall price {displayPrice}</p>

                        <div className="package-card-items">
                          {simpleForm.items.map((item) => {
                            const product = resolveItemProduct(item, productMap);

                            return (
                              <div className="package-card-item" key={item.id}>
                              <div className="package-card-item-copy">
                                  <strong title={product?.name || "Catalog item"}>{product?.name || "Catalog item"}</strong>
                                  <span>Qty {item.quantityPerItem || item.defaultQuantity || 1}</span>
                                  <p>{item.description || product?.description || "No item description provided."}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
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
                  );
                })
              ) : (
                <div className="feedback-panel">
                  <strong>No packages found.</strong>
                  <span>Create your first package using the form on the left.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export default PackagesPage;
