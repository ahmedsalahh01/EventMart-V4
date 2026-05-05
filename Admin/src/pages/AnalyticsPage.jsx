import StatList from "../components/StatList";
import { computeAnalyticsRows, formatMoney } from "../lib/admin";

function SummaryChip({ label, value }) {
  return (
    <div className="analytics-chip">
      <span className="analytics-chip-value">{value}</span>
      <span className="analytics-chip-label">{label}</span>
    </div>
  );
}

function buildAnalyticsRows(products) {
  const raw = computeAnalyticsRows(products);

  const topSold = raw.topSold.map((r, i) => ({
    ...r,
    badge: `${r.title.match(/\((\d+)\)/)?.[1] ?? 0} sold`,
    rawValue: Number(r.title.match(/\((\d+)\)/)?.[1] ?? 0),
    title: r.title.replace(/\s*\(\d+\)$/, "")
  }));

  const topVisited = raw.topVisited.map((r) => ({
    ...r,
    badge: r.title.match(/\((.+views)\)/)?.[1] ?? "",
    rawValue: Number(r.title.match(/\((\d+)/)?.[1] ?? 0),
    title: r.title.replace(/\s*\(\d+ views\)$/, "")
  }));

  const cartVsSuccess = raw.cartVsSuccess.map((r) => {
    const convMatch = r.sub.match(/Conversion:\s*([\d.]+)%/);
    const conv = convMatch ? parseFloat(convMatch[1]) : 0;
    return { ...r, badge: `${conv.toFixed(1)}%`, rawValue: conv };
  });

  const profitability = raw.profitability.map((r) => {
    const match = r.sub.match(/profit:\s*(.+)/i);
    return { ...r, badge: match?.[1] ?? "", rawValue: 0 };
  });

  return { cartVsSuccess, profitability, topSold, topVisited };
}

function getTotals(products) {
  if (!products.length) return null;
  let totalSold = 0, totalVisits = 0, totalAdded = 0;
  try {
    const raw = localStorage.getItem("eventmart_product_metrics_v1");
    const metrics = raw ? JSON.parse(raw) : {};
    products.forEach((p) => {
      const m = metrics[p.id] || {};
      totalSold += Number(m.purchase || 0);
      totalVisits += Number(m.product_view || 0);
      totalAdded += Number(m.add_to_cart || 0);
    });
  } catch {
    // no metrics
  }
  const overallConv = totalAdded > 0 ? ((totalSold / totalAdded) * 100).toFixed(1) : "0.0";
  return { overallConv, totalAdded, totalSold, totalVisits };
}

function AnalyticsPage({ error, isLoading, onRefresh, products }) {
  const rows = buildAnalyticsRows(products);
  const totals = getTotals(products);

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Product Analysis</h2>
          <p className="muted">Sales, visits, add-to-cart, and profitability ranked by performance.</p>
        </div>
        <button className="btn ghost" disabled={isLoading} onClick={() => void onRefresh().catch(() => {})} type="button">
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="section-stack">
        {error && (
          <div className="feedback-panel error">
            <strong>Analytics may be incomplete.</strong>
            <span>{error}</span>
          </div>
        )}

        {totals && (
          <div className="analytics-summary">
            <SummaryChip label="Total Sales" value={totals.totalSold} />
            <SummaryChip label="Total Visits" value={totals.totalVisits} />
            <SummaryChip label="Add-to-Cart" value={totals.totalAdded} />
            <SummaryChip label="Overall Conversion" value={`${totals.overallConv}%`} />
          </div>
        )}

        {isLoading && (
          <div className="feedback-panel">
            <strong>Refreshing analytics…</strong>
            <span>Metrics are recalculated after the latest product data loads.</span>
          </div>
        )}

        <div className="analysis-grid">
          <div className="panel">
            <div className="analytics-panel-head">
              <h3>🏆 Most Sold</h3>
              <span className="analytics-panel-note">Ranked by units purchased</span>
            </div>
            <StatList emptyText="No sales yet" rows={rows.topSold} />
          </div>

          <div className="panel">
            <div className="analytics-panel-head">
              <h3>👁️ Most Visited</h3>
              <span className="analytics-panel-note">Ranked by product page views</span>
            </div>
            <StatList emptyText="No visits yet" rows={rows.topVisited} />
          </div>

          <div className="panel">
            <div className="analytics-panel-head">
              <h3>🛒 Cart Conversion</h3>
              <span className="analytics-panel-note">Add-to-cart → completed purchase rate</span>
            </div>
            <StatList emptyText="No cart activity yet" rows={rows.cartVsSuccess} />
          </div>

          <div className="panel">
            <div className="analytics-panel-head">
              <h3>💹 Profitability</h3>
              <span className="analytics-panel-note">Estimated profit = (price − cost) × sold</span>
            </div>
            <StatList emptyText="No profitability data yet" rows={rows.profitability} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default AnalyticsPage;
