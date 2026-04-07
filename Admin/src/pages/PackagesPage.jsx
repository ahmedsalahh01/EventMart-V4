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

const PACKAGE_SPECIALITY_OPTIONS = [
  { label: "Indoor", value: "indoor" },
  { label: "Outdoor", value: "outdoor" },
  { label: "Hybrid", value: "hybrid" }
];
const PACKAGE_ITEM_DISCOUNT_RATE = 0.15;

function createSimplePackageItem() {
  const item = createEmptyPackageItem();

  return {
    ...item,
    appliesToEventTypes: "",
    appliesToVenueTypes: "",
    defaultQuantity: "1",
    discountTiers: [],
    minimumQuantity: "1",
    notes: "",
    preferredMode: "buy",
    required: true
  };
}

function createSimplePackageForm() {
  const form = createEmptyPackageForm();

  return {
    ...form,
    active: true,
    contextDefaults: {
      ...form.contextDefaults,
      minimumPackagePrice: "",
      venueType: "indoor"
    },
    items: [createSimplePackageItem()],
    status: "active",
    visibility: "public"
  };
}

function simplifyLoadedPackage(pkg) {
  const form = buildFormFromPackage(pkg);

  return {
    ...form,
    active: true,
    contextDefaults: {
      ...form.contextDefaults,
      minimumPackagePrice: form.contextDefaults?.minimumPackagePrice || "",
      venueType: form.contextDefaults?.venueType || "indoor"
    },
    items: Array.isArray(form.items) && form.items.length
      ? form.items.map((item) => ({
          ...createSimplePackageItem(),
          ...item,
          defaultQuantity: String(item.minimumQuantity || item.defaultQuantity || 1),
          minimumQuantity: String(item.minimumQuantity || 1),
          preferredMode: item.preferredMode === "rent" ? "rent" : "buy"
        }))
      : [createSimplePackageItem()],
    status: "active",
    visibility: "public"
  };
}

function resolveItemProduct(item, productMap) {
  return productMap.get(String(item?.productId || item?.product?.id || "")) || item?.product || null;
}

function getUnitPrice(product, mode) {
  if (!product) return 0;

  if (mode === "rent") {
    if (Number.isFinite(Number(product.rent_price_per_day))) {
      return Number(product.rent_price_per_day);
    }

    return Number(product.buy_price || 0);
  }

  if (Number.isFinite(Number(product.buy_price))) {
    return Number(product.buy_price);
  }

  return Number(product.rent_price_per_day || 0);
}

function getAvailableModes(product) {
  if (!product) {
    return [
      { label: "Buy", value: "buy" },
      { label: "Rent", value: "rent" }
    ];
  }

  const options = [];

  if (product.buy_enabled !== false && Number.isFinite(Number(product.buy_price))) {
    options.push({ label: "Buy", value: "buy" });
  }

  if (product.rent_enabled && Number.isFinite(Number(product.rent_price_per_day))) {
    options.push({ label: "Rent", value: "rent" });
  }

  return options.length ? options : [{ label: "Buy", value: "buy" }];
}

function buildPackageStartingSummary(form, productMap) {
  const rows = Array.isArray(form?.items) ? form.items : [];
  let subtotal = 0;
  let currency = "EGP";

  rows.forEach((item) => {
    const product = resolveItemProduct(item, productMap);
    if (!product) return;

    const minimumQuantity = Math.max(0, Number(item?.minimumQuantity || 0));
    const mode = item?.preferredMode === "rent" ? "rent" : "buy";
    const unitPrice = getUnitPrice(product, mode);

    if (Number.isFinite(unitPrice) && unitPrice > 0 && minimumQuantity > 0) {
      subtotal += unitPrice * minimumQuantity;
      currency = String(product.currency || currency);
    }
  });

  const discount = subtotal * PACKAGE_ITEM_DISCOUNT_RATE;
  const startingPrice = subtotal - discount;

  return {
    currency,
    discount,
    startingPrice,
    subtotal
  };
}

function buildSimplePackagePayload(form) {
  return buildPackagePayload({
    ...form,
    active: true,
    items: (Array.isArray(form.items) ? form.items : []).map((item) => ({
      ...item,
      appliesToEventTypes: "",
      appliesToVenueTypes: "",
      defaultQuantity: String(Math.max(1, Number(item.minimumQuantity || 1))),
      discountTiers: [],
      notes: "",
      required: true
    })),
    status: "active",
    visibility: "public"
  });
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

  const startingSummary = useMemo(
    () => buildPackageStartingSummary(form, productMap),
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

  function updateSpeciality(value) {
    setForm((current) => ({
      ...current,
      contextDefaults: {
        ...current.contextDefaults,
        venueType: value
      }
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

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, createSimplePackageItem()]
    }));
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
      const payload = buildSimplePackagePayload(form);
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
          <p className="muted">Simple package setup with name, speciality, minimum package price, starting price, and catalog items.</p>
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
                <p className="helper-text">Only the essentials: name, speciality, minimum package price, starting price, and items.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="package-name">Package Name</label>
                <input
                  id="package-name"
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Indoor Starter Bundle"
                  value={form.name}
                />
              </div>

              <div className="field">
                <label htmlFor="package-speciality">Package Speciality</label>
                <select
                  id="package-speciality"
                  onChange={(event) => updateSpeciality(event.target.value)}
                  value={form.contextDefaults.venueType}
                >
                  {PACKAGE_SPECIALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="package-minimum-price">Minimum Package Price</label>
                <input
                  id="package-minimum-price"
                  min="0"
                  onChange={(event) => updateContextField("minimumPackagePrice", event.target.value)}
                  placeholder="5000"
                  type="number"
                  value={form.contextDefaults.minimumPackagePrice}
                />
                <small>The customer must reach this discounted item total before continuing.</small>
              </div>

              <div className="field">
                <label>Package Starting Price</label>
                <div className="package-simple-price-card">
                  <strong>{formatMoney(startingSummary.startingPrice, startingSummary.currency)}</strong>
                  <span>
                    Subtotal {formatMoney(startingSummary.subtotal, startingSummary.currency)}
                    {" "}with item discounts of {formatMoney(startingSummary.discount, startingSummary.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="package-editor-panel">
              <div className="package-editor-panel-head">
                <div>
                  <h4>Items From Shop Catalog</h4>
                  <p className="helper-text">Each row includes item name, minimum quantity, and whether it is buy or rent.</p>
                </div>
                <button className="btn ghost" onClick={addItem} type="button">
                  Add Item
                </button>
              </div>

              <div className="package-item-grid">
                {form.items.map((item, itemIndex) => {
                  const product = resolveItemProduct(item, productMap);
                  const availableModes = getAvailableModes(product);
                  const unitPrice = getUnitPrice(product, item.preferredMode);
                  const itemTotal = unitPrice * Math.max(0, Number(item.minimumQuantity || 0));
                  const itemDiscount = itemTotal * PACKAGE_ITEM_DISCOUNT_RATE;
                  const discountedItemTotal = itemTotal - itemDiscount;

                  return (
                    <div className="package-simple-item-row" key={item.id}>
                      <div className="field">
                        <label htmlFor={`package-item-product-${item.id}`}>Item Name</label>
                        <select
                          id={`package-item-product-${item.id}`}
                          onChange={(event) => {
                            const nextProduct = productMap.get(String(event.target.value));
                            const nextModes = getAvailableModes(nextProduct);

                            setForm((current) => ({
                              ...current,
                              items: current.items.map((currentItem, index) => (
                                index === itemIndex
                                  ? {
                                      ...currentItem,
                                      preferredMode: nextModes[0]?.value || "buy",
                                      productId: event.target.value
                                    }
                                  : currentItem
                              ))
                            }));
                            setNotice("");
                            setPageError("");
                          }}
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

                      <div className="field">
                        <label htmlFor={`package-item-min-${item.id}`}>Item Min Qty</label>
                        <input
                          id={`package-item-min-${item.id}`}
                          min="1"
                          onChange={(event) => updateItem(itemIndex, "minimumQuantity", event.target.value)}
                          type="number"
                          value={item.minimumQuantity}
                        />
                      </div>

                      <div className="field">
                        <label htmlFor={`package-item-mode-${item.id}`}>Buy / Rent</label>
                        <select
                          id={`package-item-mode-${item.id}`}
                          onChange={(event) => updateItem(itemIndex, "preferredMode", event.target.value)}
                          value={item.preferredMode}
                        >
                          {availableModes.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button className="btn ghost" onClick={() => removeItem(itemIndex)} type="button">
                        Remove
                      </button>

                      {product ? (
                        <div className="package-item-preview">
                          <strong>{product.name}</strong>
                          <span>
                            {product.category} / {product.subcategory}
                            {" | "}
                            Unit {formatMoney(unitPrice, product.currency || "EGP")}
                            {" | "}
                            Item discount {formatMoney(itemDiscount, product.currency || "EGP")}
                            {" | "}
                            Line total {formatMoney(discountedItemTotal, product.currency || "EGP")}
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
                <p className="helper-text">Simple overview of each saved package.</p>
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
                  const summary = buildPackageStartingSummary(simpleForm, productMap);

                  return (
                    <article className="package-card" key={pkg.id}>
                      <div className="package-card-main">
                        <div className="package-card-head">
                          <div>
                            <h4>{pkg.name}</h4>
                            <p className="meta">Speciality: {simpleForm.contextDefaults.venueType || "indoor"}</p>
                          </div>
                        </div>

                        <p className="price-line">Starting price {formatMoney(summary.startingPrice, summary.currency)}</p>
                        <p className="meta">
                          Minimum package price{" "}
                          {formatMoney(Number(simpleForm.contextDefaults.minimumPackagePrice || 0), summary.currency)}
                        </p>

                        <div className="package-card-items">
                          {simpleForm.items.map((item) => {
                            const product = resolveItemProduct(item, productMap);
                            return (
                              <div className="package-card-item" key={item.id}>
                                <div className="package-card-item-copy">
                                  <strong>{product?.name || "Catalog item"}</strong>
                                  <span>
                                    Min qty {item.minimumQuantity}
                                    {" | "}
                                    {item.preferredMode === "rent" ? "Rent" : "Buy"}
                                  </span>
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
                  <span>Create your first package using the simple form on the left.</span>
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
