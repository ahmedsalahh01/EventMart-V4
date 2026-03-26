import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppScaleFrame from "./components/AppScaleFrame";
import AdminLayout from "./components/AdminLayout";
import AnalyticsPage from "./pages/AnalyticsPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import UsersPage from "./pages/UsersPage";
import { METRICS_KEY, loadProducts, loadUsers } from "./lib/admin";

function App() {
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [usersError, setUsersError] = useState("");
  const [metricsRevision, setMetricsRevision] = useState(0);

  async function refreshProducts() {
    setProductsLoading(true);
    setProductsError("");

    try {
      const rows = await loadProducts();
      setProducts(rows);
      return rows;
    } catch (error) {
      setProducts([]);
      setProductsError(error?.message || "Unable to load products.");
      throw error;
    } finally {
      setProductsLoading(false);
    }
  }

  async function refreshUsers() {
    setUsersLoading(true);
    setUsersError("");

    try {
      const rows = await loadUsers();
      setUsers(rows);
      return rows;
    } catch (error) {
      setUsers([]);
      setUsersError(error?.message || "Unable to load users.");
      throw error;
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    void refreshProducts().catch(() => {});
    void refreshUsers().catch(() => {});
  }, []);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === METRICS_KEY) {
        setMetricsRevision((current) => current + 1);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <AppScaleFrame>
      <AdminLayout>
        <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                error={productsError}
                isLoading={productsLoading}
                onRefresh={refreshProducts}
                products={products}
              />
            }
          />
          <Route
            path="/products"
            element={
              <ProductsPage
                error={productsError}
                isLoading={productsLoading}
                onProductsRefresh={refreshProducts}
                products={products}
              />
            }
          />
          <Route
            path="/users"
            element={
              <UsersPage
                error={usersError}
                isLoading={usersLoading}
                onUsersRefresh={refreshUsers}
                users={users}
              />
            }
          />
          <Route
            path="/analytics"
            element={
              <AnalyticsPage
                error={productsError}
                isLoading={productsLoading}
                metricsRevision={metricsRevision}
                onRefresh={refreshProducts}
                products={products}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminLayout>
    </AppScaleFrame>
  );
}

export default App;
