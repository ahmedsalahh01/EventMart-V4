import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/products", label: "Products" },
  { to: "/packages", label: "Packages" },
  { to: "/users", label: "Users" },
  { to: "/analytics", label: "Product Analysis" }
];

function AdminLayout({ children }) {
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
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}

export default AdminLayout;
