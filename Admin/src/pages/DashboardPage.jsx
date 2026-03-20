import { useEffect, useState } from "react";
import { computeDashboardMetrics, getRangeFromPreset } from "../lib/admin";

function DashboardPage({ error, isLoading, onRefresh, products }) {
  const initialRange = getRangeFromPreset("month");
  const [preset, setPreset] = useState("month");
  const [rangeStart, setRangeStart] = useState(initialRange.startInput);
  const [rangeEnd, setRangeEnd] = useState(initialRange.endInput);
  const [currentRange, setCurrentRange] = useState({
    end: initialRange.end,
    start: initialRange.start
  });

  useEffect(() => {
    if (preset === "custom") return;

    const nextRange = getRangeFromPreset(preset);
    setRangeStart(nextRange.startInput);
    setRangeEnd(nextRange.endInput);
    setCurrentRange({
      end: nextRange.end,
      start: nextRange.start
    });
  }, [preset]);

  function applyRange() {
    setPreset("custom");
    setCurrentRange({
      end: rangeEnd ? new Date(rangeEnd) : null,
      start: rangeStart ? new Date(rangeStart) : null
    });
  }

  const cards = computeDashboardMetrics(products, currentRange);

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Live business overview from the shared database.</p>
        </div>

        <div className="title-actions">
          <div className="filters-row">
            <select onChange={(event) => setPreset(event.target.value)} value={preset}>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Dates</option>
            </select>

            <input
              onChange={(event) => setRangeStart(event.target.value)}
              type="datetime-local"
              value={rangeStart}
            />
            <input
              onChange={(event) => setRangeEnd(event.target.value)}
              type="datetime-local"
              value={rangeEnd}
            />
            <button className="btn primary" onClick={applyRange} type="button">
              Apply
            </button>
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
      </div>

      <div className="section-stack">
        {error ? (
          <div className="feedback-panel error">
            <strong>Product data could not be loaded.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {isLoading ? (
          <div className="feedback-panel">
            <strong>Loading dashboard data...</strong>
            <span>The panel will update as soon as the product API responds.</span>
          </div>
        ) : null}

        <div className="dashboard-grid">
          {cards.map((card) => (
            <article className="metric-card" key={card.title}>
              <h4>{card.title}</h4>
              <div className="value">{card.value}</div>
              <div className="sub">{card.sub}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default DashboardPage;
