import StatList from "../components/StatList";
import { computeAnalyticsRows } from "../lib/admin";

function AnalyticsPage({ error, isLoading, onRefresh, products }) {
  const analytics = computeAnalyticsRows(products);

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Product Analysis</h2>
          <p className="muted">Sales, visits, add-to-cart, and profitability analysis.</p>
        </div>

        <button
          className="btn ghost"
          disabled={isLoading}
          onClick={() => {
            void onRefresh().catch(() => {});
          }}
          type="button"
        >
          Refresh Products
        </button>
      </div>

      <div className="section-stack">
        {error ? (
          <div className="feedback-panel error">
            <strong>Analytics may be incomplete.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {isLoading ? (
          <div className="feedback-panel">
            <strong>Refreshing analytics inputs...</strong>
            <span>Metrics are recalculated after the latest product data is loaded.</span>
          </div>
        ) : null}

        <div className="analysis-grid">
          <div className="panel">
            <h3>Most Sold Products</h3>
            <StatList emptyText="No sales yet" rows={analytics.topSold} />
          </div>

          <div className="panel">
            <h3>Most Visited Products</h3>
            <StatList emptyText="No visits yet" rows={analytics.topVisited} />
          </div>

          <div className="panel">
            <h3>Add to Cart vs Success</h3>
            <StatList emptyText="No cart activity yet" rows={analytics.cartVsSuccess} />
          </div>

          <div className="panel">
            <h3>Profitability</h3>
            <StatList emptyText="No profitability data yet" rows={analytics.profitability} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default AnalyticsPage;
