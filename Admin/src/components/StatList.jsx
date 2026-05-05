function StatList({ emptyText, rows, maxValue }) {
  if (!rows.length) {
    return (
      <div className="stat-list">
        <div className="stat-row stat-row--empty">
          <strong>{emptyText}</strong>
          <span>Add interactions from the shop to see data here.</span>
        </div>
      </div>
    );
  }

  const top = maxValue ?? Math.max(...rows.map((r) => r.rawValue ?? 0), 1);

  return (
    <div className="stat-list">
      {rows.map((row, index) => {
        const pct = top > 0 && row.rawValue != null ? Math.round((row.rawValue / top) * 100) : null;
        return (
          <div className="stat-row" key={`${row.title}-${index}`}>
            <span className="stat-rank">#{index + 1}</span>
            <div className="stat-content">
              <div className="stat-title-row">
                <strong>{row.title}</strong>
                {row.badge != null && <span className="stat-badge">{row.badge}</span>}
              </div>
              <span className="stat-sub">{row.sub}</span>
              {pct != null && (
                <div className="stat-bar-track">
                  <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default StatList;
