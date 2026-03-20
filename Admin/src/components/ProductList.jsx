import { formatMoney, getProductImage } from "../lib/admin";

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
        <h3>Products List</h3>
        <input
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search products..."
          type="search"
          value={search}
        />
      </div>

      <div className="products-list">
        {isLoading && products.length === 0 ? (
          <div className="admin-product-card admin-product-card-empty">
            <div>
              <h4>Loading products...</h4>
              <p className="meta">Pulling the latest catalog from the API.</p>
            </div>
          </div>
        ) : null}

        {!isLoading && products.length === 0 ? (
          <div className="admin-product-card admin-product-card-empty">
            <div>
              <h4>No products found</h4>
              <p className="meta">Try a different search or add your first product.</p>
            </div>
          </div>
        ) : null}

        {products.map((product) => {
          const buy = product.buy_enabled ? formatMoney(product.buy_price, product.currency) : "-";
          const rent = product.rent_enabled ? formatMoney(product.rent_price_per_day, product.currency) : "-";
          const lightCount = Array.isArray(product.light_images) ? product.light_images.length : 0;
          const darkCount = Array.isArray(product.dark_images) ? product.dark_images.length : 0;

          return (
            <article className="admin-product-card" key={product.id}>
              <img alt={product.name} src={getProductImage(product)} />

              <div>
                <h4>{product.name}</h4>
                <p className="meta">Product ID: {product.product_id || "-"}</p>
                <p className="meta">
                  {product.category} / {product.subcategory}
                </p>
                <p className="meta">
                  Qty: {product.quantity_available} | Reorder: {product.reorder_level} |{" "}
                  {product.active ? "Active" : "Inactive"}
                </p>
                <p className="meta">
                  Light images: {lightCount} | Dark images: {darkCount}
                </p>
                <p className="price-line">
                  Buy: {buy} | Rent/day: {rent}
                </p>
              </div>

              <div className="product-actions">
                <button className="btn" onClick={() => onEdit(product)} type="button">
                  Edit
                </button>
                <button className="btn ghost" onClick={() => onDelete(product)} type="button">
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default ProductList;
