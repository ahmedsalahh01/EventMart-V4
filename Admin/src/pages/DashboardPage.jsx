import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatMoney, getRangeFromPreset } from "../lib/admin";

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

function MiniBar({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mini-bar-row">
      <span className="mini-bar-label">{label}</span>
      <div className="mini-bar-track">
        <div className="mini-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="mini-bar-count">{count}</span>
    </div>
  );
}

function DashboardPage({ error, isLoading, onRefresh, products }) {
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

  const rangeSnap = useMemo(() => {
    if (!products.length) return null;
    const inRange = products.filter((p) => {
      const d = new Date(p.created_at || p.updated_at);
      if (isNaN(d)) return false;
      if (currentRange.start && d < currentRange.start) return false;
      if (currentRange.end && d > currentRange.end) return false;
      return true;
    });
    const avgPrice = inRange.length
      ? inRange.reduce((s, p) => s + Number(p.buy_price ?? p.rent_price_per_day ?? 0), 0) / inRange.length
      : 0;
    const lowInRange = inRange.filter(
      (p) => Number(p.quantity_available) <= Number(p.reorder_level || 0)
    ).length;
    const categories = new Set(inRange.map((p) => p.category).filter(Boolean)).size;
    return { avgPrice, categories, count: inRange.length, currency: products[0]?.currency || "EGP", lowInRange };
  }, [products, currentRange]);

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Live catalog overview — {snap?.total ?? 0} total products.</p>
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

        <p className="dash-section-label">All-Time Catalog</p>
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

        <p className="dash-section-label">Selected Range — {rangeSnap?.count ?? 0} products</p>
        <div className="dashboard-grid">
          <MetricCard accent="blue" icon="📅" title="Products In Range" value={rangeSnap?.count ?? "—"}
            sub="Created or updated within the selected period" />
          <MetricCard accent="teal" icon="📊" title="Avg Starting Price" value={rangeSnap ? formatMoney(rangeSnap.avgPrice, rangeSnap.currency) : "—"}
            sub="Buy price if available, else rent/day" />
          <MetricCard accent="default" icon="🗂️" title="Categories In Range" value={rangeSnap?.categories ?? "—"}
            sub="Unique categories in this period" />
          <MetricCard accent="yellow" icon="📉" title="Low/Out of Stock" value={rangeSnap?.lowInRange ?? "—"}
            sub="At or below reorder level in this period" />
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
