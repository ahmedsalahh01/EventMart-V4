import {
  MAX_PRODUCT_IMAGES,
  ONE_SIZE_LABEL,
  getCatalogColorOptions,
  getCatalogSizeOptions,
  getImagePreviewKey,
  resolveAssetUrl
} from "../lib/admin";

function SectionHeader({ label, hint }) {
  return (
    <div className="form-section-header">
      <span className="form-section-label">{label}</span>
      {hint && <span className="form-section-hint">{hint}</span>}
    </div>
  );
}

function Toggle({ name, checked, onChange, label }) {
  return (
    <label className="toggle-pill">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}

function ProductForm({
  form,
  isEditing,
  isSaving,
  onAddVariation,
  onBlur,
  onChange,
  onImageRemove,
  onImageSelect,
  onRemoveVariation,
  onReset,
  onSubmit,
  onVariationChange
}) {
  const colorOptions = getCatalogColorOptions(form.colors);
  const sizeOptions = getCatalogSizeOptions(form.sizes, form.size_mode);
  const images = form.images || [];
  const isAtLimit = images.length >= MAX_PRODUCT_IMAGES;

  return (
    <div className="panel">
      <div className="product-form-header">
        <h3>{isEditing ? "✏️ Edit Product" : "➕ Add Product"}</h3>
        <p className="helper-text">Fill in the sections below. Images and variations are optional for draft products.</p>
      </div>

      <form className="product-form" onSubmit={onSubmit}>

        {/* ── 1. Identity ──────────────────────────────────── */}
        <SectionHeader label="1 · Identity" hint="ID, name, category" />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="product_id">Product ID</label>
            <input
              id="product_id" name="product_id" type="text"
              inputMode="numeric" maxLength={5} pattern="\d{5}"
              placeholder="00001" required
              title="Exactly 5 digits, e.g. 00042"
              value={form.product_id}
              onBlur={onBlur} onChange={onChange}
            />
            <small>Auto-generated — change only if needed.</small>
          </div>
          <div className="field">
            <label htmlFor="name">Product Name *</label>
            <input id="name" name="name" type="text" required
              placeholder="RGB Stage Wash Light" value={form.name} onChange={onChange} />
          </div>
          <div className="field">
            <label htmlFor="category">Category *</label>
            <input id="category" name="category" type="text" required
              placeholder="Lighting" value={form.category} onChange={onChange} />
          </div>
          <div className="field">
            <label htmlFor="subcategory">Subcategory *</label>
            <input id="subcategory" name="subcategory" type="text" required
              placeholder="Stage Lights" value={form.subcategory} onChange={onChange} />
          </div>
        </div>

        {/* ── 2. Pricing ───────────────────────────────────── */}
        <SectionHeader label="2 · Pricing" hint="Currency, buy / rent prices, costs" />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <input id="currency" name="currency" type="text"
              inputMode="text" maxLength={3} pattern="[A-Z]{3}"
              placeholder="EGP" required title="3 uppercase letters, e.g. EGP"
              value={form.currency} onBlur={onBlur} onChange={onChange} />
          </div>
          <div className="field">
            <label htmlFor="buy_price">Buy Price</label>
            <input id="buy_price" name="buy_price" type="number" step="0.01" min="0"
              placeholder="3500" value={form.buy_price} onChange={onChange} />
          </div>
          <div className="field">
            <label htmlFor="rent_price_per_day">Rent Price / Day</label>
            <input id="rent_price_per_day" name="rent_price_per_day" type="number" step="0.01" min="0"
              placeholder="120" value={form.rent_price_per_day} onChange={onChange} />
          </div>
          <div className="field">
            <label htmlFor="unit_cost">Unit Cost</label>
            <input id="unit_cost" name="unit_cost" type="number" step="0.01" min="0"
              placeholder="2000" value={form.unit_cost} onChange={onChange} />
          </div>
          <div className="field">
            <label htmlFor="overhead_cost">Overhead / Transport Cost</label>
            <input id="overhead_cost" name="overhead_cost" type="number" step="0.01" min="0"
              placeholder="200" value={form.overhead_cost} onChange={onChange} />
          </div>
          {(form.buy_price || form.unit_cost) && (
            <div className="field">
              <label>Margin Preview</label>
              <div className="margin-preview">
                {(() => {
                  const margin = Number(form.buy_price || 0) - Number(form.unit_cost || 0) - Number(form.overhead_cost || 0);
                  const pct = form.buy_price > 0 ? ((margin / Number(form.buy_price)) * 100).toFixed(1) : null;
                  return (
                    <>
                      <span className={`margin-value ${margin >= 0 ? "positive" : "negative"}`}>
                        {margin >= 0 ? "+" : ""}{margin.toLocaleString()} {form.currency}
                      </span>
                      {pct !== null && <span className="margin-pct">{pct}% margin</span>}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Stock ─────────────────────────────────────── */}
        <SectionHeader label="3 · Stock" hint="Available quantity and reorder threshold" />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="quantity_available">Quantity Available</label>
            <input id="quantity_available" name="quantity_available" type="number" min="0"
              placeholder="10" value={form.quantity_available} onChange={onChange} />
          </div>
          <div className="field">
            <label htmlFor="reorder_level">Reorder Level</label>
            <input id="reorder_level" name="reorder_level" type="number" min="0"
              placeholder="2" value={form.reorder_level} onChange={onChange} />
            <small>Alert shown in dashboard when stock ≤ this value.</small>
          </div>
        </div>

        {/* ── 4. Description & Quality ─────────────────────── */}
        <SectionHeader label="4 · Description & Quality" hint="Storefront text and specs" />
        <div className="form-grid">
          <div className="field field-wide">
            <label htmlFor="description">Product Description</label>
            <textarea id="description" name="description" rows={4}
              placeholder="Professional RGB stage wash light for events, stages, and booths."
              value={form.description} onChange={onChange} />
          </div>
          <div className="field">
            <label htmlFor="quality">Quality Summary</label>
            <input id="quality" name="quality" type="text"
              placeholder="Professional Grade" value={form.quality} onChange={onChange} />
          </div>
          <div className="field field-wide">
            <label htmlFor="quality_points">Quality Points (one per line)</label>
            <textarea id="quality_points" name="quality_points" rows={4}
              placeholder={"High brightness output\nRGB color mixing\nLow power consumption"}
              value={form.quality_points} onChange={onChange} />
          </div>
        </div>

        {/* ── 5. Images ────────────────────────────────────── */}
        <SectionHeader label="5 · Images" hint={`${images.length}/${MAX_PRODUCT_IMAGES} uploaded`} />
        <label className={`image-dropzone${isAtLimit ? " disabled" : ""}`}>
          <input accept="image/*" disabled={isSaving || isAtLimit} multiple type="file"
            onChange={(e) => { onImageSelect(e.target.files); e.target.value = ""; }} />
          <strong>{isAtLimit ? "Image limit reached" : "Click to choose images"}</strong>
          <span>PNG, JPG, WEBP — up to 5 MB each, max 10 total</span>
        </label>
        {images.length > 0 && (
          <div className="image-preview-grid">
            {images.map((img, idx) => (
              <figure className="image-preview-card" key={getImagePreviewKey(img, `img-${idx}`)}>
                <img alt={`Preview ${idx + 1}`} loading="lazy" src={resolveAssetUrl(img)} />
                <figcaption>
                  <span>#{idx + 1}</span>
                  <button className="btn ghost image-remove-btn" type="button" onClick={() => onImageRemove(idx)}>✕</button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {/* ── 6. Variants ──────────────────────────────────── */}
        <SectionHeader label="6 · Colors, Sizes & Variations" hint="Inventory per color/size combination" />
        <div className="form-grid">
          <div className="field field-wide">
            <label htmlFor="colors">Colors (one per line)</label>
            <textarea id="colors" name="colors" rows={3}
              placeholder={"Black\nWhite\nSilver"} value={form.colors} onChange={onChange} />
          </div>
          <div className="field">
            <label htmlFor="size_mode">Size Mode</label>
            <select id="size_mode" name="size_mode" value={form.size_mode} onChange={onChange}>
              <option value="one-size">One Size Fits All</option>
              <option value="varied">Varied Sizes</option>
            </select>
          </div>
          {form.size_mode === "varied" && (
            <div className="field field-wide">
              <label htmlFor="sizes">Sizes (one per line)</label>
              <textarea id="sizes" name="sizes" rows={3}
                placeholder={"Small\nMedium\nLarge"} value={form.sizes} onChange={onChange} />
            </div>
          )}
        </div>

        <div className="variation-grid">
          {form.variations.map((v, idx) => (
            <div className="variation-row" key={`${v.id ?? "new"}-${idx}`}>
              <select disabled={isSaving || colorOptions.length === 0}
                value={v.color} onChange={(e) => onVariationChange(idx, "color", e.target.value)}>
                <option value="">{colorOptions.length ? "Color" : "Add colors first"}</option>
                {colorOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {form.size_mode === "varied" ? (
                <select disabled={isSaving || sizeOptions.length === 0}
                  value={v.size} onChange={(e) => onVariationChange(idx, "size", e.target.value)}>
                  <option value="">{sizeOptions.length ? "Size" : "Add sizes first"}</option>
                  {sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input disabled type="text" value={ONE_SIZE_LABEL} />
              )}
              <input type="number" min="0" placeholder="Qty"
                value={v.quantity} onChange={(e) => onVariationChange(idx, "quantity", e.target.value)} />
              <input type="text" placeholder="SKU (opt.)"
                value={v.sku} onChange={(e) => onVariationChange(idx, "sku", e.target.value)} />
              <button className="btn ghost" type="button" onClick={() => onRemoveVariation(idx)}>✕</button>
            </div>
          ))}
        </div>
        <button className="btn" type="button" onClick={onAddVariation} style={{ marginTop: "8px" }}>
          + Add Variation
        </button>

        {/* ── 7. Settings ──────────────────────────────────── */}
        <SectionHeader label="7 · Settings" hint="Availability and visibility flags" />
        <div className="toggles-row">
          <Toggle name="buy_enabled"  checked={form.buy_enabled}  onChange={onChange} label="Buy Enabled" />
          <Toggle name="rent_enabled" checked={form.rent_enabled} onChange={onChange} label="Rent Enabled" />
          <Toggle name="featured"     checked={form.featured}     onChange={onChange} label="Featured on Home" />
          <Toggle name="customizable" checked={form.customizable} onChange={onChange} label="Customizable" />
          <Toggle name="active"       checked={form.active}       onChange={onChange} label="Active / Visible" />
        </div>

        <div className="form-actions">
          <button className="btn primary" disabled={isSaving} type="submit">
            {isSaving ? (isEditing ? "Updating…" : "Saving…") : isEditing ? "Update Product" : "Save Product"}
          </button>
          <button className="btn ghost" disabled={isSaving} type="button" onClick={onReset}>
            Clear Form
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProductForm;
