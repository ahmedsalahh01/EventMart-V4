import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/products", label: "Products" },
  { to: "/orders", label: "Orders" },
  { to: "/packages", label: "Packages" },
  { to: "/users", label: "Users" },
  { to: "/analytics", label: "Product Analysis" }
];

function AdminLayout({ children, onLogout, adminUser }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <h1>EventMart</h1>
          <p>React Admin Panel</p>
        </div>

        <nav aria-label="Admin navigation" className="admin-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => `side-btn${isActive ? " active" : ""}`}
              end={item.end}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          {adminUser && <p className="admin-sidebar-user">{adminUser.name || adminUser.email}</p>}
          <button type="button" className="admin-logout-btn" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}

export default AdminLayout;
