import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatMoney, getRangeFromPreset, METRICS_KEY } from "../lib/admin";

function MetricCard({ title, value, sub, accent = "default", icon }) {
  return (
    <article className={`metric-card metric-card--${accent}`}>
      <div className="metric-card-header">
        <span className="metric-icon">{icon}</span>
        <h4>{title}</h4>
      </div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </article>
  );
}

function MiniBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mini-bar-row">
      <span className="mini-bar-label">{label}</span>
      <div className="mini-bar-track">
        <div className="mini-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="mini-bar-count">{count}</span>
    </div>
  );
}

function FunnelBar({ label, value, max, pct, color, sub }) {
  return (
    <div className="funnel-row">
      <div className="funnel-row-head">
        <span className="funnel-label">{label}</span>
        <span className="funnel-value">{value.toLocaleString()}</span>
      </div>
      <div className="funnel-track">
        <div className="funnel-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {sub && <span className="funnel-sub">{sub}</span>}
    </div>
  );
}

function getMetricsMap() {
  try {
    const raw = localStorage.getItem(METRICS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function DashboardPage({ error, isLoading, onRefresh, orders = [], ordersLoading, products, users = [] }) {
  const navigate = useNavigate();
  const initialRange = getRangeFromPreset("month");
  const [preset, setPreset] = useState("month");
  const [rangeStart, setRangeStart] = useState(initialRange.startInput);
  const [rangeEnd, setRangeEnd] = useState(initialRange.endInput);
  const [currentRange, setCurrentRange] = useState({ end: initialRange.end, start: initialRange.start });

  useEffect(() => {
    if (preset === "custom") return;
    const next = getRangeFromPreset(preset);
    setRangeStart(next.startInput);
    setRangeEnd(next.endInput);
    setCurrentRange({ end: next.end, start: next.start });
  }, [preset]);

  function applyRange() {
    setPreset("custom");
    setCurrentRange({
      end: rangeEnd ? new Date(rangeEnd) : null,
      start: rangeStart ? new Date(rangeStart) : null
    });
  }

  // ── Catalog snapshot ─────────────────────────────────────────────────────
  const snap = useMemo(() => {
    if (!products.length) return null;
    const active = products.filter((p) => p.active).length;
    const buyEnabled = products.filter((p) => p.buy_enabled).length;
    const rentEnabled = products.filter((p) => p.rent_enabled).length;
    const both = products.filter((p) => p.buy_enabled && p.rent_enabled).length;
    const outOfStock = products.filter((p) => Number(p.quantity_available) === 0).length;
    const lowStockItems = products
      .filter((p) => Number(p.quantity_available) > 0 && Number(p.quantity_available) <= Number(p.reorder_level || 0))
      .sort((a, b) => Number(a.quantity_available) - Number(b.quantity_available));
    const catalogValue = products.reduce(
      (sum, p) => sum + Number(p.buy_price || 0) * Number(p.quantity_available || 0),
      0
    );
    const currency = products[0]?.currency || "EGP";
    const categoryMap = {};
    products.forEach((p) => {
      const cat = String(p.category || "").trim();
      if (cat) categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });
    const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
    return {
      active,
      both,
      buyEnabled,
      catalogValue,
      categories,
      currency,
      customizable: products.filter((p) => p.customizable).length,
      featured: products.filter((p) => p.featured).length,
      inactive: products.length - active,
      lowStockItems,
      outOfStock,
      rentEnabled,
      total: products.length
    };
  }, [products]);

  // ── Orders analytics ──────────────────────────────────────────────────────
  const orderSnap = useMemo(() => {
    if (!orders.length) return null;
    const currency = orders[0]?.currency || "EGP";
    const active = orders.filter((o) => o.status !== "cancelled");
    const totalRevenue = active.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalItems = active.reduce((s, o) => s + Number(o.total_items || 0), 0);
    const avgOrderValue = active.length ? totalRevenue / active.length : 0;
    const avgItemsPerOrder = active.length ? totalItems / active.length : 0;

    const statusCounts = {};
    orders.forEach((o) => {
      const s = String(o.status || "pending");
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    return {
      active: active.length,
      avgItemsPerOrder,
      avgOrderValue,
      currency,
      statusCounts,
      total: orders.length,
      totalItems,
      totalRevenue
    };
  }, [orders]);

  // ── Profit / expense estimates from localStorage metrics + product costs ──
  const profitSnap = useMemo(() => {
    if (!products.length) return null;
    const metrics = getMetricsMap();
    let totalProfit = 0;
    let totalCOGS = 0;
    let totalSoldUnits = 0;

    products.forEach((p) => {
      const m = metrics[p.id] || {};
      const sold = Number(m.purchase || 0);
      if (!sold) return;
      const buyPrice = Number(p.buy_price || 0);
      const unitCost = Number(p.unit_cost || 0);
      const overhead = Number(p.overhead_cost || 0);
      totalProfit += (buyPrice - unitCost - overhead) * sold;
      totalCOGS += (unitCost + overhead) * sold;
      totalSoldUnits += sold;
    });

    const currency = products[0]?.currency || "EGP";
    return { currency, totalCOGS, totalProfit, totalSoldUnits };
  }, [products]);

  // ── Customer & funnel analytics from localStorage ─────────────────────────
  const funnelSnap = useMemo(() => {
    const metrics = getMetricsMap();
    let totalVisits = 0;
    let totalAddToCart = 0;
    let totalPurchases = 0;

    Object.values(metrics).forEach((m) => {
      totalVisits += Number(m.product_view || 0);
      totalAddToCart += Number(m.add_to_cart || 0);
      totalPurchases += Number(m.purchase || 0);
    });

    const totalCustomers = users.length;
    const avgCartItems = totalCustomers > 0 ? totalAddToCart / totalCustomers : 0;
    const cartAbandoned = Math.max(0, totalAddToCart - totalPurchases);
    const conversionRate = totalAddToCart > 0 ? (totalPurchases / totalAddToCart) * 100 : 0;
    const funnelMax = Math.max(totalVisits, 1);

    return {
      avgCartItems,
      cartAbandoned,
      conversionRate,
      funnelMax,
      totalAddToCart,
      totalCustomers,
      totalPurchases,
      totalVisits
    };
  }, [users]);

  const STATUS_COLORS = {
    pending: "#fbbf24",
    confirmed: "#60a5fa",
    processing: "#a78bfa",
    shipped: "#34d399",
    delivered: "#4ade80",
    completed: "#68eabc",
    cancelled: "#f87171"
  };

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Live overview — {snap?.total ?? 0} products · {orderSnap?.total ?? 0} orders · {funnelSnap.totalCustomers} customers.</p>
        </div>
        <div className="title-actions">
          <div className="filters-row">
            <select onChange={(e) => setPreset(e.target.value)} value={preset}>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom</option>
            </select>
            <input onChange={(e) => setRangeStart(e.target.value)} type="datetime-local" value={rangeStart} />
            <input onChange={(e) => setRangeEnd(e.target.value)} type="datetime-local" value={rangeEnd} />
            <button className="btn primary" onClick={applyRange} type="button">Apply</button>
          </div>
          <button className="btn ghost" disabled={isLoading} onClick={() => void onRefresh().catch(() => {})} type="button">
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="section-stack">
        {error && (
          <div className="feedback-panel error">
            <strong>Product data could not be loaded.</strong>
            <span>{error}</span>
          </div>
        )}

        {/* ── Financial Overview ─────────────────────────────────── */}
        <p className="dash-section-label">💰 Financial Overview</p>
        <div className="dashboard-grid dashboard-grid--4">
          <MetricCard
            accent="green"
            icon="💵"
            title="Total Sales Revenue"
            value={orderSnap ? formatMoney(orderSnap.totalRevenue, orderSnap.currency) : "—"}
            sub={`${orderSnap?.active ?? 0} non-cancelled orders`}
          />
          <MetricCard
            accent="teal"
            icon="📈"
            title="Estimated Gross Profit"
            value={profitSnap ? formatMoney(profitSnap.totalProfit, profitSnap.currency) : "—"}
            sub="Revenue minus unit cost & overhead per item sold"
          />
          <MetricCard
            accent="yellow"
            icon="🏷️"
            title="Estimated Total Expenses"
            value={profitSnap ? formatMoney(profitSnap.totalCOGS, profitSnap.currency) : "—"}
            sub="Unit cost + overhead across all recorded sales"
          />
          <MetricCard
            accent="blue"
            icon="🧾"
            title="Avg Order Value"
            value={orderSnap ? formatMoney(orderSnap.avgOrderValue, orderSnap.currency) : "—"}
            sub="Across all non-cancelled orders"
          />
        </div>

        {/* ── Orders Overview ────────────────────────────────────── */}
        <p className="dash-section-label">📦 Orders Overview</p>
        <div className="dashboard-grid dashboard-grid--4">
          <MetricCard
            accent="blue"
            icon="🛍️"
            title="Total Orders"
            value={orderSnap?.total ?? (ordersLoading ? "…" : "0")}
            sub={`${orderSnap?.active ?? 0} active · ${orderSnap?.statusCounts?.cancelled ?? 0} cancelled`}
          />
          <MetricCard
            accent="green"
            icon="📦"
            title="Total Items Sold"
            value={orderSnap?.totalItems ?? "—"}
            sub="Sum of items across all non-cancelled orders"
          />
          <MetricCard
            accent="purple"
            icon="📊"
            title="Avg Items / Order"
            value={orderSnap ? orderSnap.avgItemsPerOrder.toFixed(1) : "—"}
            sub="Non-cancelled orders"
          />
          <MetricCard
            accent="teal"
            icon="🗓️"
            title="Catalog Value"
            value={snap ? formatMoney(snap.catalogValue, snap.currency) : "—"}
            sub="Buy price × available qty"
          />
        </div>

        {orderSnap && Object.keys(orderSnap.statusCounts).length > 0 && (
          <div className="panel">
            <h3>Order Status Breakdown</h3>
            <p className="muted" style={{ marginBottom: "14px" }}>Distribution of orders across all statuses.</p>
            <div className="dash-breakdown-list">
              {Object.entries(orderSnap.statusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <MiniBar
                    key={status}
                    label={status.charAt(0).toUpperCase() + status.slice(1)}
                    count={count}
                    total={orderSnap.total}
                    color={STATUS_COLORS[status]}
                  />
                ))}
            </div>
          </div>
        )}

        {/* ── Customer & Funnel Analysis ─────────────────────────── */}
        <p className="dash-section-label">📣 Marketing & Funnel Analysis</p>
        <div className="dashboard-grid dashboard-grid--4">
          <MetricCard
            accent="blue"
            icon="👥"
            title="Total Customers"
            value={funnelSnap.totalCustomers}
            sub="Registered user accounts"
          />
          <MetricCard
            accent="purple"
            icon="👁️"
            title="Website Product Views"
            value={funnelSnap.totalVisits.toLocaleString()}
            sub="Total product page visits recorded"
          />
          <MetricCard
            accent="teal"
            icon="🛒"
            title="Total Add-to-Cart Events"
            value={funnelSnap.totalAddToCart.toLocaleString()}
            sub={`Avg ${funnelSnap.avgCartItems.toFixed(1)} add-to-cart events per customer`}
          />
          <MetricCard
            accent={funnelSnap.conversionRate >= 20 ? "green" : "yellow"}
            icon="🔁"
            title="Cart Conversion Rate"
            value={`${funnelSnap.conversionRate.toFixed(1)}%`}
            sub={`${funnelSnap.totalPurchases} purchased · ${funnelSnap.cartAbandoned} abandoned cart`}
          />
        </div>

        <div className="panel dash-funnel-panel">
          <h3>Sales Funnel</h3>
          <p className="muted" style={{ marginBottom: "18px" }}>Customer journey from product view to purchase.</p>
          <div className="funnel-list">
            <FunnelBar
              label="Product Views"
              value={funnelSnap.totalVisits}
              max={funnelSnap.funnelMax}
              pct={100}
              color="rgba(96, 165, 250, 0.7)"
              sub="Top of funnel — discovered products"
            />
            <FunnelBar
              label="Added to Cart"
              value={funnelSnap.totalAddToCart}
              max={funnelSnap.funnelMax}
              pct={funnelSnap.funnelMax > 0 ? Math.round((funnelSnap.totalAddToCart / funnelSnap.funnelMax) * 100) : 0}
              color="rgba(167, 139, 250, 0.7)"
              sub={`${funnelSnap.funnelMax > 0 ? ((funnelSnap.totalAddToCart / funnelSnap.funnelMax) * 100).toFixed(1) : 0}% of views`}
            />
            <FunnelBar
              label="Placed Order"
              value={funnelSnap.totalPurchases}
              max={funnelSnap.funnelMax}
              pct={funnelSnap.funnelMax > 0 ? Math.round((funnelSnap.totalPurchases / funnelSnap.funnelMax) * 100) : 0}
              color="rgba(104, 234, 188, 0.7)"
              sub={`${funnelSnap.totalAddToCart > 0 ? ((funnelSnap.totalPurchases / funnelSnap.totalAddToCart) * 100).toFixed(1) : 0}% cart-to-purchase conversion`}
            />
            <FunnelBar
              label="Abandoned Cart"
              value={funnelSnap.cartAbandoned}
              max={funnelSnap.funnelMax}
              pct={funnelSnap.funnelMax > 0 ? Math.round((funnelSnap.cartAbandoned / funnelSnap.funnelMax) * 100) : 0}
              color="rgba(248, 113, 113, 0.6)"
              sub="Added to cart but did not place an order"
            />
          </div>
        </div>

        {/* ── Catalog Snapshot ───────────────────────────────────── */}
        <p className="dash-section-label">🗂️ Catalog Snapshot</p>
        <div className="dashboard-grid dashboard-grid--6">
          <MetricCard accent="blue" icon="📦" title="Total Products" value={snap?.total ?? "—"}
            sub={`${snap?.active ?? 0} active · ${snap?.inactive ?? 0} inactive`} />
          <MetricCard accent="green" icon="🛒" title="Buy Enabled" value={snap?.buyEnabled ?? "—"}
            sub={`${(snap?.buyEnabled ?? 0) - (snap?.both ?? 0)} buy-only · ${snap?.both ?? 0} also rent`} />
          <MetricCard accent="purple" icon="🔄" title="Rent Enabled" value={snap?.rentEnabled ?? "—"}
            sub={`${(snap?.rentEnabled ?? 0) - (snap?.both ?? 0)} rent-only · ${snap?.both ?? 0} also buy`} />
          <MetricCard accent="yellow" icon="⚠️" title="Stock Issues" value={snap ? snap.outOfStock + snap.lowStockItems.length : "—"}
            sub={`${snap?.outOfStock ?? 0} out of stock · ${snap?.lowStockItems?.length ?? 0} low`} />
          <MetricCard accent="teal" icon="💰" title="Catalog Value" value={snap ? formatMoney(snap.catalogValue, snap.currency) : "—"}
            sub="Buy price × available qty" />
          <MetricCard accent="default" icon="⭐" title="Featured / Custom" value={snap ? `${snap.featured} / ${snap.customizable}` : "—"}
            sub="Featured on home · Customizable" />
        </div>

        {snap?.categories.length > 0 && (
          <div className="panel dash-breakdown-panel">
            <h3>Category Breakdown</h3>
            <p className="muted" style={{ marginBottom: "14px" }}>Products per category across the full catalog.</p>
            <div className="dash-breakdown-list">
              {snap.categories.map(([cat, count]) => (
                <MiniBar key={cat} label={cat} count={count} total={snap.total} />
              ))}
            </div>
          </div>
        )}

        {snap?.lowStockItems.length > 0 && (
          <div className="panel dash-warning-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px", gap: "12px" }}>
              <div>
                <h3>⚠️ Low Stock Alerts</h3>
                <p className="muted">These products are at or below their reorder level.</p>
              </div>
              <button
                className="btn ghost"
                type="button"
                onClick={() => navigate("/products")}
                style={{ flexShrink: 0 }}
              >
                Manage Products →
              </button>
            </div>
            <div className="low-stock-list">
              {snap.lowStockItems.map((p) => (
                <div className="low-stock-row" key={p.id}>
                  <span className="low-stock-name">{p.name}</span>
                  <span className="low-stock-meta">{p.category} / {p.subcategory}</span>
                  <span className={`stock-badge stock-badge--${Number(p.quantity_available) === 0 ? "out" : "low"}`}>
                    {Number(p.quantity_available) === 0 ? "Out of stock" : `${p.quantity_available} left`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="feedback-panel">
            <strong>Loading dashboard data…</strong>
            <span>Metrics update as soon as the product API responds.</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default DashboardPage;
