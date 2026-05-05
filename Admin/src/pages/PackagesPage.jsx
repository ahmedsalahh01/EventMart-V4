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

const VENUE_OPTIONS = [
  { label: "Indoor", value: "indoor" },
  { label: "Outdoor", value: "outdoor" },
  { label: "Hybrid", value: "hybrid" }
];
const CUSTOMIZATION_OPTIONS = [
  { label: "Not Customizable", value: "not customizable" },
  { label: "Customizable", value: "customizable" },
  { label: "Hybrid", value: "hybrid" }
];

function createSimpleItem() {
  return { ...createEmptyPackageItem(), customizable: false, description: "", quantityPerItem: "1" };
}

function createSimpleForm() {
  const base = createEmptyPackageForm();
  return {
    ...base,
    active: true,
    contextDefaults: {
      ...base.contextDefaults,
      customizationAvailable: false,
      customizationType: "not customizable",
      guestCount: "",
      minimumPackagePrice: "0",
      packageMode: "hybrid",
      packagePrice: "",
      recommendedFor: "",
      venueType: "hybrid"
    },
    items: [createSimpleItem()],
    status: "active",
    visibility: "public"
  };
}

function loadForm(pkg) {
  const form = buildFormFromPackage(pkg);
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
    items: Array.isArray(form.items) && form.items.length
      ? form.items.map((item) => ({
          ...createSimpleItem(),
          ...item,
          customizable: Boolean(item?.customizable),
          description: String(item?.description || item?.notes || ""),
          quantityPerItem: String(item?.quantityPerItem || item?.defaultQuantity || item?.minimumQuantity || 1)
        }))
      : [createSimpleItem()],
    status: "active",
    visibility: "public"
  };
}

function resolveProduct(item, map) {
  return map.get(String(item?.productId || item?.product?.id || "")) || item?.product || null;
}

function getCurrency(form, map) {
  const p = (Array.isArray(form?.items) ? form.items : []).map((i) => resolveProduct(i, map)).find(Boolean);
  return String(p?.currency || "EGP");
}

function venueLabel(v) {
  return v === "indoor" ? "Indoor" : v === "outdoor" ? "Outdoor" : "Hybrid";
}

function customLabel(v) {
  return v === "customizable" ? "Customizable" : v === "hybrid" ? "Hybrid" : "Standard";
}

function PackagesPage({ error, isLoading, onPackagesRefresh, packages, products, productsError }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(createSimpleForm());
  const [notice, setNotice] = useState("");
  const [pageError, setPageError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");

  const safePackages = Array.isArray(packages) ? packages : [];
  const safeProducts = Array.isArray(products) ? products : [];

  const productMap = useMemo(
    () => new Map(safeProducts.map((p) => [String(p.id), p])),
    [safeProducts]
  );

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return safePackages;
    return safePackages.filter((pkg) =>
      [pkg.name, pkg.description, ...(Array.isArray(pkg.items) ? pkg.items.map((i) => i?.product?.name) : [])]
        .join(" ").toLowerCase().includes(q)
    );
  }, [safePackages, search]);

  const currency = useMemo(() => getCurrency(form, productMap), [form, productMap]);

  function reset({ clearNotice = true } = {}) {
    setEditingId(null);
    setForm(createSimpleForm());
    if (clearNotice) setNotice("");
    setPageError("");
  }

  function setField(field, value) {
    setForm((c) => ({ ...c, [field]: value }));
    setNotice(""); setPageError("");
  }

  function setCtx(field, value) {
    setForm((c) => ({
      ...c,
      contextDefaults: {
        ...c.contextDefaults,
        [field]: value,
        customizationAvailable:
          field === "customizationType" ? value !== "not customizable"
          : c.contextDefaults.customizationType !== "not customizable"
      }
    }));
    setNotice(""); setPageError("");
  }

  function setItem(idx, field, value) {
    setForm((c) => ({
      ...c,
      items: c.items.map((item, i) => i === idx ? { ...item, [field]: value } : item)
    }));
    setNotice(""); setPageError("");
  }

  function addItem() {
    setForm((c) => ({ ...c, items: [...c.items, createSimpleItem()] }));
  }

  function removeItem(idx) {
    setForm((c) => ({
      ...c,
      items: c.items.length === 1 ? [createSimpleItem()] : c.items.filter((_, i) => i !== idx)
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSaving(true); setNotice(""); setPageError("");
    try {
      await savePackage(buildPackagePayload(form), editingId);
      await onPackagesRefresh();
      reset({ clearNotice: false });
      setNotice(editingId ? "Package updated." : "Package created.");
    } catch (err) {
      setPageError(err?.message || "Unable to save package.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(pkg) {
    setEditingId(pkg.id);
    setForm(loadForm(pkg));
    setNotice(""); setPageError("");
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  async function handleDelete(pkg) {
    if (!window.confirm(`Delete "${pkg.name}"?`)) return;
    setNotice(""); setPageError("");
    try {
      await removePackage(pkg.id);
      await onPackagesRefresh();
      if (editingId === pkg.id) reset();
      setNotice("Package deleted.");
    } catch (err) {
      setPageError(err?.message || "Unable to delete package.");
    }
  }

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Packages</h2>
          <p className="muted">Build event packages from your catalog with fixed pricing and venue metadata.</p>
        </div>
        <div className="title-actions">
          <span className="pkg-count-badge">{safePackages.length} package{safePackages.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="section-stack">
        {(error || productsError || pageError) && (
          <div className="feedback-panel error">
            <strong>Something went wrong.</strong>
            <span>{error || productsError || pageError}</span>
          </div>
        )}
        {notice && (
          <div className="feedback-panel success">
            <strong>Done.</strong> <span>{notice}</span>
          </div>
        )}

        <div className="admin-packages-grid">
          {/* ── Form ─────────────────────────────────────────── */}
          <form className="panel package-editor-form" onSubmit={handleSubmit}>
            <div className="pkg-form-header">
              <h3>{editingId ? "✏️ Edit Package" : "➕ New Package"}</h3>
              <p className="helper-text">
                Set the package name, price, and event context — then add catalog items below.
              </p>
            </div>

            <div className="pkg-section-label">Basic Info</div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="pkg-name">Package Name *</label>
                <input id="pkg-name" required placeholder="Wedding Essentials" value={form.name}
                  onChange={(e) => setField("name", e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="pkg-price">Package Price *</label>
                <input id="pkg-price" type="number" min="0" step="0.01" placeholder="15499.75"
                  value={form.contextDefaults.packagePrice}
                  onChange={(e) => setCtx("packagePrice", e.target.value)} />
                <small>Exact price shown on the storefront package cards.</small>
              </div>

              <div className="field">
                <label htmlFor="pkg-guests">Fits How Many People</label>
                <input id="pkg-guests" type="number" min="1" placeholder="150"
                  value={form.contextDefaults.guestCount}
                  onChange={(e) => setCtx("guestCount", e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="pkg-venue">Venue Type</label>
                <select id="pkg-venue" value={form.contextDefaults.venueType}
                  onChange={(e) => setCtx("venueType", e.target.value)}>
                  {VENUE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="field">
                <label htmlFor="pkg-custom">Customization</label>
                <select id="pkg-custom" value={form.contextDefaults.customizationType}
                  onChange={(e) => setCtx("customizationType", e.target.value)}>
                  {CUSTOMIZATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="field package-form-span-full">
                <label htmlFor="pkg-desc">Description</label>
                <textarea id="pkg-desc" rows="3" placeholder="Describe this package and which events it suits best."
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)} />
              </div>

              <div className="field package-form-span-full">
                <label htmlFor="pkg-recommended">Recommended For</label>
                <textarea id="pkg-recommended" rows="2"
                  placeholder={"weddings\nbirthdays\nconferences"}
                  value={form.contextDefaults.recommendedFor}
                  onChange={(e) => setCtx("recommendedFor", e.target.value)} />
                <small>One event type per line, or comma-separated.</small>
              </div>
            </div>

            {/* Price preview */}
            <div className="pkg-price-preview">
              <span className="pkg-preview-price">{formatMoney(form.contextDefaults.packagePrice || 0, currency)}</span>
              <span className="pkg-preview-meta">
                {venueLabel(form.contextDefaults.venueType)} · {customLabel(form.contextDefaults.customizationType)}
                {form.contextDefaults.guestCount ? ` · Up to ${form.contextDefaults.guestCount} guests` : ""}
              </span>
            </div>

            {/* ── Items ──────────────────────────────────────── */}
            <div className="pkg-section-label" style={{ marginTop: "20px" }}>
              Catalog Items
              <button className="btn ghost pkg-add-item-btn" onClick={addItem} type="button">+ Add Item</button>
            </div>

            <div className="package-item-grid">
              {form.items.map((item, idx) => {
                const product = resolveProduct(item, productMap);
                return (
                  <div className="pkg-item-row" key={item.id}>
                    <div className="pkg-item-main">
                      <div className="field">
                        <label>Catalog Item</label>
                        <select value={item.productId}
                          onChange={(e) => setItem(idx, "productId", e.target.value)}>
                          <option value="">— Select a product —</option>
                          {safeProducts.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="pkg-item-controls">
                        <div className="field">
                          <label>Qty</label>
                          <input type="number" min="1" value={item.quantityPerItem}
                            onChange={(e) => setItem(idx, "quantityPerItem", e.target.value)} />
                        </div>
                        <label className="pkg-item-checkbox">
                          <input type="checkbox" checked={Boolean(item.customizable)}
                            onChange={(e) => setItem(idx, "customizable", e.target.checked)} />
                          <span>Customizable</span>
                        </label>
                        <button className="btn ghost pkg-remove-btn" type="button" onClick={() => removeItem(idx)}>
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="field" style={{ marginTop: "6px" }}>
                      <label>Item Note (optional)</label>
                      <input placeholder="e.g. Includes setup and teardown"
                        value={item.description}
                        onChange={(e) => setItem(idx, "description", e.target.value)} />
                    </div>
                    {product && (
                      <div className="pkg-item-chip">
                        <span>{product.category} / {product.subcategory}</span>
                        {product.buy_price ? <span>{formatMoney(product.buy_price, product.currency)}</span> : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="form-actions">
              <button className="btn primary" disabled={isSaving} type="submit">
                {isSaving ? "Saving…" : editingId ? "Update Package" : "Create Package"}
              </button>
              <button className="btn ghost" type="button" onClick={reset}>Reset</button>
            </div>
          </form>

          {/* ── Package List ──────────────────────────────────── */}
          <section className="panel">
            <div className="list-head">
              <h3>Saved Packages <span className="muted">({filteredPackages.length})</span></h3>
              <input type="search" placeholder="Search packages…" value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>

            {isLoading && (
              <div className="feedback-panel"><strong>Loading packages…</strong></div>
            )}

            <div className="package-list">
              {!isLoading && filteredPackages.length === 0 && (
                <div className="feedback-panel">
                  <strong>{search ? "No packages match your search." : "No packages yet."}</strong>
                  <span>{search ? "Try a different keyword." : "Create your first package using the form."}</span>
                </div>
              )}

              {filteredPackages.map((pkg) => {
                const f = loadForm(pkg);
                const price = formatMoney(f.contextDefaults.packagePrice || 0, getCurrency(f, productMap));
                const itemCount = Array.isArray(f.items) ? f.items.filter((i) => i.productId).length : 0;
                const recommended = String(f.contextDefaults.recommendedFor || "")
                  .split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

                return (
                  <article className="pkg-card" key={pkg.id}>
                    <div className="pkg-card-top">
                      <div>
                        <h4>{pkg.name}</h4>
                        <div className="pkg-badges">
                          <span className="pkg-badge pkg-badge--venue">{venueLabel(f.contextDefaults.venueType)}</span>
                          <span className="pkg-badge pkg-badge--custom">{customLabel(f.contextDefaults.customizationType)}</span>
                          <span className="pkg-badge pkg-badge--items">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                          {f.contextDefaults.guestCount && (
                            <span className="pkg-badge">👥 {f.contextDefaults.guestCount}</span>
                          )}
                        </div>
                      </div>
                      <span className="pkg-card-price">{price}</span>
                    </div>

                    {f.description && <p className="pkg-card-desc">{f.description}</p>}

                    {recommended.length > 0 && (
                      <div className="pkg-recommended-tags">
                        {recommended.slice(0, 4).map((tag) => (
                          <span key={tag} className="pkg-tag">{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="pkg-card-items-preview">
                      {f.items.filter((i) => i.productId).map((item) => {
                        const p = resolveProduct(item, productMap);
                        return (
                          <div key={item.id} className="pkg-card-item-chip">
                            <span>{p?.name || "Unknown"}</span>
                            <span className="pkg-item-qty">×{item.quantityPerItem || 1}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="product-actions">
                      <button className="btn primary" type="button" onClick={() => handleEdit(pkg)}>Edit</button>
                      <button className="btn ghost" type="button" onClick={() => void handleDelete(pkg)}>Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export default PackagesPage;
