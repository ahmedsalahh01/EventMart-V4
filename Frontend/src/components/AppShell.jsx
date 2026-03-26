import { useLocation } from "react-router-dom";
import AppScaleFrame from "./AppScaleFrame";
import Navbar from "./Navbar";
import Footer from "./Footer";

function AppShell({ children }) {
  const location = useLocation();
  const isCartRoute = location.pathname === "/cart";
  const isAuthRoute = location.pathname === "/auth";

  if (isAuthRoute) {
    return (
      <div className="app-shell app-shell-auth">
        <AppScaleFrame>
          {children}
          <Footer />
        </AppScaleFrame>
      </div>
    );
  }

  if (isCartRoute) {
    return (
      <div className="app-shell app-shell-cart">
        <AppScaleFrame>{children}</AppScaleFrame>
      </div>
    );
  }

  return (
    <div className="app-shell app-shell-default">
      <Navbar />
      <AppScaleFrame>
        <div className="app-body">{children}</div>
        <Footer />
      </AppScaleFrame>
    </div>
  );
}

export default AppShell;
