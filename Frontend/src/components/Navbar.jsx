import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { buildAuthPath, shouldShowCartIcon } from "../lib/authNavigation";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/ai-planner", label: "AI Planner" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" }
];

function Navbar() {
  const location = useLocation();
  const [hoveredPath, setHoveredPath] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, firstName } = useAuth();
  const { itemCount } = useCart();
  const isHomeRoute = location.pathname === "/";
  const showCartIcon = shouldShowCartIcon(isAuthenticated);

  useEffect(() => {
    if (!isHomeRoute) {
      setIsScrolled(false);
      return undefined;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 36);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isHomeRoute]);

  const activePath = navItems.find((item) => item.to === location.pathname)?.to ?? null;
  const highlightedPath = hoveredPath ?? activePath;
  const navClassName = `navbar${isHomeRoute ? " navbar-home" : ""}${isHomeRoute && isScrolled ? " navbar-home-scrolled" : ""}`;

  return (
    <nav className={navClassName}>
      <NavLink to="/" className="brand-link" aria-label="EventMart Home">
        <img className="brand-logo" src="/assets/eventmart-navbar-logo.png" alt="" />
      </NavLink>

      <ul className="navlist" aria-label="Main navigation" onMouseLeave={() => setHoveredPath(null)}>
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive || highlightedPath === item.to ? "active" : undefined)}
              onMouseEnter={() => setHoveredPath(item.to)}
              onFocus={() => setHoveredPath(item.to)}
              onBlur={() => setHoveredPath(null)}
            >
              {item.label}
              {highlightedPath === item.to ? (
                <motion.span
                  layoutId="navbar-active-indicator"
                  className="navlink-indicator"
                  transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.6 }}
                />
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="nav-actions">
        <button type="button" className="icon-btn" data-theme-toggle onClick={toggleTheme} aria-label="Toggle interface color">
          <svg id="themeIconSun" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: theme === "dark" ? "none" : "block" }}>
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 3V5.2M12 18.8V21M3 12H5.2M18.8 12H21M5.64 5.64L7.2 7.2M16.8 16.8L18.36 18.36M18.36 5.64L16.8 7.2M7.2 16.8L5.64 18.36"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <svg id="themeIconMoon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: theme === "dark" ? "block" : "none" }}>
            <path
              d="M20 14.2A8 8 0 1 1 9.8 4 6.4 6.4 0 0 0 20 14.2Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {showCartIcon ? (
          <NavLink to="/cart" className="icon-btn cart-link" aria-label="Shopping cart">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 5H6L7.7 14.2A1 1 0 0 0 8.68 15H17.4A1 1 0 0 0 18.36 14.26L20 8H7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9.6" cy="19" r="1.2" fill="currentColor" />
              <circle cx="16.8" cy="19" r="1.2" fill="currentColor" />
            </svg>
            <span className="cart-badge" style={{ display: itemCount > 0 ? "inline-block" : "none" }}>
              {itemCount}
            </span>
          </NavLink>
        ) : null}

        <NavLink to={isAuthenticated ? "/profile" : buildAuthPath()} className="reg-text" title={isAuthenticated ? `Signed in as ${firstName}` : undefined}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M5 20c.9-3.2 3.72-5 7-5s6.1 1.8 7 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="auth-label">{isAuthenticated ? `Welcome ${firstName}` : "Sign In"}</span>
        </NavLink>
      </div>
    </nav>
  );
}

export default Navbar;
