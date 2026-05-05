import { formatMoney, getProductImage } from "../lib/admin";

function StockBadge({ qty, reorderLevel }) {
  const q = Number(qty ?? 0);
  const r = Number(reorderLevel ?? 0);
  if (q === 0) return <span className="pl-stock-badge pl-stock-badge--out">Out of stock</span>;
  if (q <= r) return <span className="pl-stock-badge pl-stock-badge--low">{q} left — low</span>;
  return <span className="pl-stock-badge pl-stock-badge--ok">{q} in stock</span>;
}

function ProductList({
  isLoading,
  onDelete,
  onEdit,
  onSearchChange,
  products,
  search
}) {
  return (
    <div className="panel">
      <div className="list-head">
        <div className="list-head-title">
          <h3>Products</h3>
          {products.length > 0 && (
            <span className="pl-count-badge">{products.length} item{products.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <input
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, category, ID…"
          type="search"
          value={search}
          className="pl-search"
        />
      </div>

      <div className="products-list">
        {isLoading && products.length === 0 && (
          <div className="pl-empty-card">
            <span className="pl-empty-icon">⏳</span>
            <div>
              <strong>Loading products…</strong>
              <p>Pulling the latest catalog from the API.</p>
            </div>
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <div className="pl-empty-card">
            <span className="pl-empty-icon">📦</span>
            <div>
              <strong>No products found</strong>
              <p>{search ? "Try a different search term." : "Add your first product using the form above."}</p>
            </div>
          </div>
        )}

        {products.map((product) => {
          const buy = product.buy_enabled ? formatMoney(product.buy_price, product.currency) : null;
          const rent = product.rent_enabled ? formatMoney(product.rent_price_per_day, product.currency) : null;
          const imageCount = Array.isArray(product.images) ? product.images.length : 0;
          const colorCount = Array.isArray(product.colors) ? product.colors.length : 0;
          const variationCount = Array.isArray(product.variations) ? product.variations.length : 0;

          return (
            <article className="pl-card" key={product.id}>
              <div className="pl-card-image-wrap">
                <img alt={product.name} src={getProductImage(product)} className="pl-card-image" />
                {!product.active && <span className="pl-overlay-badge">Inactive</span>}
              </div>

              <div className="pl-card-body">
                <div className="pl-card-top">
                  <div className="pl-card-title-row">
                    <h4 className="pl-card-name">{product.name}</h4>
                    <div className="pl-card-flags">
                      {product.featured && <span className="pl-flag pl-flag--featured">⭐ Featured</span>}
                      {product.customizable && <span className="pl-flag pl-flag--custom">✂️ Custom</span>}
                      {product.active
                        ? <span className="pl-flag pl-flag--active">Active</span>
                        : <span className="pl-flag pl-flag--inactive">Inactive</span>}
                    </div>
                  </div>

                  <p className="pl-card-meta pl-card-id">ID: {product.product_id || "—"}</p>
                  <p className="pl-card-meta">{product.category} / {product.subcategory}</p>
                </div>

                <div className="pl-card-stats">
                  <StockBadge qty={product.quantity_available} reorderLevel={product.reorder_level} />
                  {colorCount > 0 && <span className="pl-stat-chip">{colorCount} color{colorCount !== 1 ? "s" : ""}</span>}
                  {variationCount > 0 && <span className="pl-stat-chip">{variationCount} var.</span>}
                  {imageCount > 0 && <span className="pl-stat-chip">📷 {imageCount}</span>}
                  {product.size_mode === "varied" && <span className="pl-stat-chip">Varied sizes</span>}
                </div>

                {(buy || rent) && (
                  <div className="pl-card-prices">
                    {buy && <span className="pl-price-chip pl-price-chip--buy">Buy {buy}</span>}
                    {rent && <span className="pl-price-chip pl-price-chip--rent">Rent {rent}/day</span>}
                  </div>
                )}
              </div>

              <div className="pl-card-actions">
                <button className="btn primary" onClick={() => onEdit(product)} type="button">Edit</button>
                <button className="btn ghost" onClick={() => onDelete(product)} type="button">Delete</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default ProductList;
