import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import AIPlannerPage from "./pages/AIPlannerPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import CheckoutPage from "./pages/CheckoutPage";
import NotFoundPage from "./pages/NotFoundPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import PackageBuilderPage from "./pages/PackageBuilderPage";
import PackageDetailPage from "./pages/PackageDetailPage";
import PackagesPage from "./pages/PackagesPage";

function App() {
  const location = useLocation();

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/:slug" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/checkout"
            element={(
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/orders/:orderId/confirmation"
            element={(
              <ProtectedRoute>
                <OrderConfirmationPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/profile"
            element={(
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/ai-planner"
            element={(
              <ProtectedRoute>
                <AIPlannerPage />
              </ProtectedRoute>
            )}
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/packages/:identifier" element={<PackageDetailPage />} />
          <Route path="/package-builder" element={<PackageBuilderPage />} />
          <Route path="/signin" element={<Navigate to="/auth?tab=signin" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  );
}

export default App;
