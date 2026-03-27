import {
  MAX_IMAGES_PER_MODE,
  ONE_SIZE_LABEL,
  getCatalogColorOptions,
  getCatalogSizeOptions,
  getImagePreviewKey,
  resolveAssetUrl
} from "../lib/admin";

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
  function renderImageGroup(themeMode, title, description) {
    const images = form[`${themeMode}_images`] || [];
    const isAtLimit = images.length >= MAX_IMAGES_PER_MODE;

    return (
      <div className="image-upload-card">
        <div className="image-upload-head">
          <div>
            <h4>{title}</h4>
            <p>{description}</p>
          </div>
          <span className={`image-count${isAtLimit ? " limit" : ""}`}>
            {images.length}/{MAX_IMAGES_PER_MODE}
          </span>
        </div>

        <label className={`image-dropzone${isAtLimit ? " disabled" : ""}`}>
          <input
            accept="image/*"
            disabled={isSaving || isAtLimit}
            multiple
            onChange={(event) => {
              onImageSelect(themeMode, event.target.files);
              event.target.value = "";
            }}
            type="file"
          />
          <strong>Choose images from your computer</strong>
          <span>PNG, JPG, WEBP, GIF, SVG, or AVIF. Up to 10 images per mode.</span>
        </label>

        {images.length ? (
          <div className="image-preview-grid">
            {images.map((image, index) => (
              <figure
                className="image-preview-card"
                key={getImagePreviewKey(image, `${themeMode}-${index}`)}
              >
                <img
                  alt={`${title} preview ${index + 1}`}
                  loading="lazy"
                  src={resolveAssetUrl(image)}
                />
                <figcaption>
                  <span>{`${title} ${index + 1}`}</span>
                  <button
                    className="btn ghost image-remove-btn"
                    onClick={() => onImageRemove(themeMode, index)}
                    type="button"
                  >
                    Remove
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="helper-text">No {themeMode} mode images selected yet.</p>
        )}
      </div>
    );
  }

  const colorOptions = getCatalogColorOptions(form.colors);
  const sizeOptions = getCatalogSizeOptions(form.sizes, form.size_mode);

  return (
    <div className="panel">
      <h3>{isEditing ? "Edit Product" : "Add Product"}</h3>

      <form className="product-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="product_id">Product ID</label>
            <input
              id="product_id"
              inputMode="numeric"
              maxLength={5}
              name="product_id"
              onBlur={onBlur}
              onChange={onChange}
              pattern="\d{5}"
              placeholder="00001"
              required
              title="Use exactly 5 digits like 00001"
              type="text"
              value={form.product_id}
            />
          </div>

          <div className="field">
            <label htmlFor="name">Product Name</label>
            <input
              id="name"
              name="name"
              onChange={onChange}
              placeholder="Oversized Boulevard T-shirt"
              required
              type="text"
              value={form.name}
            />
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <input
              id="category"
              name="category"
              onChange={onChange}
              placeholder="Merchandise"
              required
              type="text"
              value={form.category}
            />
          </div>

          <div className="field">
            <label htmlFor="subcategory">Subcategory</label>
            <input
              id="subcategory"
              name="subcategory"
              onChange={onChange}
              placeholder="Wearables"
              required
              type="text"
              value={form.subcategory}
            />
          </div>

          <div className="field">
            <label htmlFor="currency">Currency</label>
            <input
              id="currency"
              inputMode="text"
              maxLength={3}
              name="currency"
              onBlur={onBlur}
              onChange={onChange}
              pattern="[A-Z]{3}"
              placeholder="EGP"
              required
              title="Use exactly 3 uppercase letters like EGP or USD"
              type="text"
              value={form.currency}
            />
          </div>

          <div className="field">
            <label htmlFor="buy_price">Buy Price</label>
            <input
              id="buy_price"
              name="buy_price"
              onChange={onChange}
              placeholder="350"
              step="0.01"
              type="number"
              value={form.buy_price}
            />
          </div>

          <div className="field">
            <label htmlFor="rent_price_per_day">Rent Price / Day</label>
            <input
              id="rent_price_per_day"
              name="rent_price_per_day"
              onChange={onChange}
              placeholder="120"
              step="0.01"
              type="number"
              value={form.rent_price_per_day}
            />
          </div>

          <div className="field">
            <label htmlFor="quantity_available">Quantity Available</label>
            <input
              id="quantity_available"
              name="quantity_available"
              readOnly
              placeholder="10"
              type="number"
              value={form.quantity_available}
            />
            <small className="helper-text">Calculated from the variation rows below.</small>
          </div>

          <div className="field">
            <label htmlFor="reorder_level">Reorder Level</label>
            <input
              id="reorder_level"
              name="reorder_level"
              onChange={onChange}
              placeholder="2"
              type="number"
              value={form.reorder_level}
            />
          </div>

          <div className="field">
            <label htmlFor="unit_cost">Unit Cost</label>
            <input
              id="unit_cost"
              name="unit_cost"
              onChange={onChange}
              placeholder="200"
              step="0.01"
              type="number"
              value={form.unit_cost}
            />
          </div>

          <div className="field">
            <label htmlFor="overhead_cost">Overhead Cost / Transportation</label>
            <input
              id="overhead_cost"
              name="overhead_cost"
              onChange={onChange}
              placeholder="50"
              step="0.01"
              type="number"
              value={form.overhead_cost}
            />
          </div>

          <div className="field field-wide">
            <label>Product Images</label>
            <div className="image-upload-grid">
              {renderImageGroup(
                "light",
                "Light Mode",
                "These images will be shown when the storefront is in light mode."
              )}
              {renderImageGroup(
                "dark",
                "Dark Mode",
                "These images will be shown when the storefront is in dark mode."
              )}
            </div>
          </div>

          <div className="field field-wide">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              onChange={onChange}
              placeholder="Professional RGB stage wash light for events, stages, and booths."
              rows={4}
              value={form.description}
            />
          </div>

          <div className="field">
            <label htmlFor="quality">Quality Summary</label>
            <input
              id="quality"
              name="quality"
              onChange={onChange}
              placeholder="Premium heavyweight cotton"
              type="text"
              value={form.quality}
            />
          </div>

          <div className="field field-wide">
            <label htmlFor="quality_points">Quality Points (one per line)</label>
            <textarea
              id="quality_points"
              name="quality_points"
              onChange={onChange}
              placeholder={"High brightness output\nRGB color mixing\nLow power consumption"}
              rows={5}
              value={form.quality_points}
            />
          </div>

          <div className="field field-wide">
            <label htmlFor="colors">Color Options (one per line)</label>
            <textarea
              id="colors"
              name="colors"
              onChange={onChange}
              placeholder={"Black\nWhite\nRed"}
              rows={4}
              value={form.colors}
            />
          </div>

          <div className="field">
            <label htmlFor="size_mode">Size Mode</label>
            <select id="size_mode" name="size_mode" onChange={onChange} value={form.size_mode}>
              <option value="one-size">One Size</option>
              <option value="varied">Varied Sizes</option>
            </select>
          </div>

          {form.size_mode === "varied" ? (
            <div className="field field-wide">
              <label htmlFor="sizes">Size Options (one per line)</label>
              <textarea
                id="sizes"
                name="sizes"
                onChange={onChange}
                placeholder={"XS\nSmall\nMedium\nLarge\nX-Large"}
                rows={4}
                value={form.sizes}
              />
            </div>
          ) : null}

          <div className="field field-wide">
            <label>Variation Inventory</label>
            <p className="helper-text variation-helper-text">
              Pick variation colors and sizes from the catalog lists above to keep admin and storefront data aligned.
            </p>
            <div className="variation-grid">
              {form.variations.map((variation, index) => (
                <div className="variation-row" key={`${variation.id ?? "new"}-${index}`}>
                  <select
                    disabled={isSaving || colorOptions.length === 0}
                    onChange={(event) => onVariationChange(index, "color", event.target.value)}
                    value={variation.color}
                  >
                    <option value="">
                      {colorOptions.length ? "Select color" : "Add colors above first"}
                    </option>
                    {colorOptions.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                  {form.size_mode === "varied" ? (
                    <select
                      disabled={isSaving || sizeOptions.length === 0}
                      onChange={(event) => onVariationChange(index, "size", event.target.value)}
                      value={variation.size}
                    >
                      <option value="">
                        {sizeOptions.length ? "Select size" : "Add sizes above first"}
                      </option>
                      {sizeOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input disabled type="text" value={ONE_SIZE_LABEL} />
                  )}
                  <input
                    min="0"
                    onChange={(event) => onVariationChange(index, "quantity", event.target.value)}
                    placeholder="Qty"
                    type="number"
                    value={variation.quantity}
                  />
                  <input
                    onChange={(event) => onVariationChange(index, "sku", event.target.value)}
                    placeholder="SKU (optional)"
                    type="text"
                    value={variation.sku}
                  />
                  <button className="btn ghost" onClick={() => onRemoveVariation(index)} type="button">
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button className="btn" onClick={onAddVariation} type="button">
              Add variation
            </button>
          </div>
        </div>

        <div className="checks-row">
          <label>
            <input
              checked={form.buy_enabled}
              name="buy_enabled"
              onChange={onChange}
              type="checkbox"
            />
            Buy Enabled
          </label>
          <label>
            <input
              checked={form.rent_enabled}
              name="rent_enabled"
              onChange={onChange}
              type="checkbox"
            />
            Rent Enabled
          </label>
          <label>
            <input checked={form.featured} name="featured" onChange={onChange} type="checkbox" />
            Featured Badge
          </label>
          <label>
            <input checked={form.customizable} name="customizable" onChange={onChange} type="checkbox" />
            Customizable
          </label>
          <label>
            <input checked={form.active} name="active" onChange={onChange} type="checkbox" />
            Active
          </label>
        </div>

        <div className="form-actions">
          <button className="btn primary" disabled={isSaving} type="submit">
            {isSaving ? (isEditing ? "Updating..." : "Saving...") : isEditing ? "Update Product" : "Save Product"}
          </button>
          <button className="btn ghost" disabled={isSaving} onClick={onReset} type="button">
            Clear Form
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProductForm;
