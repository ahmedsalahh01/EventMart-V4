function StatList({ emptyText, rows }) {
  if (!rows.length) {
    return (
      <div className="stat-list">
        <div className="stat-row">
          <strong>{emptyText}</strong>
          <span>Add interactions from the shop first.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="stat-list">
      {rows.map((row) => (
        <div className="stat-row" key={`${row.title}-${row.sub}`}>
          <strong>{row.title}</strong>
          <span>{row.sub}</span>
        </div>
      ))}
    </div>
  );
}

export default StatList;
