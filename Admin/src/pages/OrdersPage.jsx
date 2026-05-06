import { useDeferredValue, useEffect, useState } from "react";
import { formatDateTime, formatMoney } from "../lib/admin";

const STATUS_OPTIONS = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "completed", "cancelled"];

function getStatusProgress(status) {
  const map = { pending: 12, confirmed: 28, processing: 50, shipped: 74, delivered: 100, completed: 100, cancelled: 100 };
  return map[String(status || "").toLowerCase()] ?? 12;
}

function OrdersPage({ error, isLoading, onRefresh, orders }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && String(o.status || "").toLowerCase() !== statusFilter) return false;
    if (!deferredSearch) return true;
    return (
      String(o.public_order_id || "").toLowerCase().includes(deferredSearch) ||
      String(o.customer_name || "").toLowerCase().includes(deferredSearch) ||
      String(o.customer_email || "").toLowerCase().includes(deferredSearch)
    );
  });

  const summary = {
    total: orders.length,
    pending: orders.filter((o) => String(o.status || "").toLowerCase() === "pending").length,
    active: orders.filter((o) => ["confirmed", "processing", "shipped"].includes(String(o.status || "").toLowerCase())).length,
    revenue: orders.reduce((s, o) => s + Number(o.total || 0), 0),
    currency: orders[0]?.currency || "EGP"
  };

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Orders</h2>
          <p className="muted">All customer orders — {orders.length} total.</p>
        </div>
        <div className="title-actions">
          <button
            className="btn ghost"
            disabled={isLoading}
            onClick={() => void onRefresh().catch(() => {})}
            type="button"
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="section-stack">
        {error && (
          <div className="feedback-panel error">
            <strong>Orders could not be loaded.</strong>
            <span>{error}</span>
          </div>
        )}

        {/* Summary strip */}
        <div className="orders-summary-strip">
          <div className="orders-summary-card">
            <span className="orders-summary-value">{summary.total}</span>
            <span className="orders-summary-label">Total Orders</span>
          </div>
          <div className="orders-summary-card">
            <span className="orders-summary-value">{summary.pending}</span>
            <span className="orders-summary-label">Pending</span>
          </div>
          <div className="orders-summary-card">
            <span className="orders-summary-value">{summary.active}</span>
            <span className="orders-summary-label">In Progress</span>
          </div>
          <div className="orders-summary-card">
            <span className="orders-summary-value">{formatMoney(summary.revenue, summary.currency)}</span>
            <span className="orders-summary-label">Total Revenue</span>
          </div>
        </div>

        {/* Filters */}
        <div className="panel">
          <div className="list-head">
            <h3>Orders ({filtered.length})</h3>
            <div className="filters-row">
              <input
                type="search"
                placeholder="Search by order ID, name, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading && filtered.length === 0 ? (
            <div className="admin-order-card">
              <p>Loading orders…</p>
            </div>
          ) : !isLoading && filtered.length === 0 ? (
            <div className="admin-order-card">
              <p>{orders.length === 0 ? "No orders placed yet." : "No orders match the current filter."}</p>
            </div>
          ) : (
            <div className="orders-list">
              {filtered.map((order) => {
                const status = String(order.status || "pending").toLowerCase();
                const progress = getStatusProgress(status);
                return (
                  <article className="admin-order-card" key={order.id}>
                    <div className="admin-order-head">
                      <div className="admin-order-id">
                        <span>{order.public_order_id || `#${order.id}`}</span>
                        <span className={`order-status-pill order-status-pill--${status}`}>{status}</span>
                      </div>
                      <strong className="admin-order-total">
                        {formatMoney(order.total, order.currency)}
                      </strong>
                    </div>

                    <div className="admin-order-meta">
                      <span>{order.customer_name || "—"}</span>
                      <span>{order.customer_email || "—"}</span>
                      <span>{Number(order.total_items || 0)} items</span>
                      <span>{formatDateTime(order.created_at)}</span>
                      {order.delivery_estimate && <span>ETA: {order.delivery_estimate}</span>}
                    </div>

                    <div className="admin-order-progress">
                      <div className="admin-order-bar" style={{ width: `${progress}%` }} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default OrdersPage;
