import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authRequest } from "../lib/api";
import "./../styles/profile.css";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function getInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "U";
}

function getFirstName(name) {
  return String(name || "").trim().split(/\s+/).filter(Boolean)[0] || "there";
}

function getStatusProgress(status) {
  const map = { pending: 15, confirmed: 30, processing: 50, shipped: 75, delivered: 100, completed: 100, cancelled: 100 };
  return map[String(status || "").toLowerCase()] ?? 20;
}

const STATUS_FILTERS = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "completed", "cancelled"];

function OrderSkeleton() {
  return (
    <div className="order-skeleton-list">
      {[1, 2, 3].map((i) => (
        <div key={i} className="order-skeleton-card">
          <div className="skeleton-line skeleton-line--wide" />
          <div className="skeleton-line skeleton-line--narrow" />
          <div className="skeleton-bar" />
        </div>
      ))}
    </div>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const { token, user, logout, updateSession } = useAuth();

  const [form, setForm] = useState({ fullName: "", email: "", currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [status, setStatus] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("account");

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    async function init() {
      try {
        const profilePayload = await authRequest("/api/me", token);
        if (cancelled) return;
        updateSession({ token, user: profilePayload.user });
        setForm((c) => ({ ...c, fullName: profilePayload.user.name || "", email: profilePayload.user.email || "" }));
      } catch {
        // profile fetch failure is non-blocking
      }

      try {
        setIsLoadingOrders(true);
        const ordersPayload = await authRequest("/api/me/orders", token);
        if (!cancelled) setOrders(Array.isArray(ordersPayload) ? ordersPayload : []);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setIsLoadingOrders(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [token, updateSession]);

  const filteredOrders = useMemo(
    () => (statusFilter === "all" ? orders : orders.filter((o) => String(o.status || "").toLowerCase() === statusFilter)),
    [orders, statusFilter]
  );

  const summary = useMemo(() => {
    const total = orders.length;
    const active = orders.filter((o) => !["delivered", "completed", "cancelled"].includes(String(o.status || "").toLowerCase())).length;
    const spent = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    return { total, active, spent };
  }, [orders]);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    try {
      if (form.newPassword || form.confirmNewPassword) {
        if (form.newPassword !== form.confirmNewPassword) throw new Error("Passwords do not match.");
        if (!form.currentPassword) throw new Error("Current password is required.");
      }
      const body = { name: form.fullName.trim(), email: form.email.trim().toLowerCase() };
      if (form.newPassword) { body.currentPassword = form.currentPassword; body.newPassword = form.newPassword; }
      const payload = await authRequest("/api/me", token, { method: "PUT", body });
      updateSession({ token: payload.token || token, user: payload.user });
      setForm((c) => ({ ...c, currentPassword: "", newPassword: "", confirmNewPassword: "" }));
      setStatus("success");
    } catch (err) {
      setStatus(err.message || "Failed to update.");
    }
  }

  async function refreshOrders() {
    setIsLoadingOrders(true);
    try {
      const data = await authRequest("/api/me/orders", token);
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      // keep existing
    } finally {
      setIsLoadingOrders(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <main className="profile-main" data-theme-scope="profile">

        {/* ── Header ─────────────────────────────────── */}
        <div className="profile-header">
          <div className="profile-avatar" aria-hidden="true">
            {getInitials(user?.name)}
          </div>
          <div className="profile-header-copy">
            <p className="profile-greeting">Welcome back, {getFirstName(user?.name)}</p>
            <p className="profile-email">{user?.email || ""}</p>
            <p className="profile-joined">Member since {formatDate(user?.created_at)}</p>
          </div>
          <button
            className="profile-signout-btn"
            type="button"
            onClick={() => { logout(); navigate("/auth?tab=signin"); }}
          >
            Sign Out
          </button>
        </div>

        {/* ── Stats ──────────────────────────────────── */}
        <div className="profile-stats-row">
          <div className="profile-stat">
            <strong>{summary.total}</strong>
            <span>Total Orders</span>
          </div>
          <div className="profile-stat">
            <strong>{summary.active}</strong>
            <span>Active Orders</span>
          </div>
          <div className="profile-stat">
            <strong>{formatMoney(summary.spent)}</strong>
            <span>Total Spent</span>
          </div>
          <div className="profile-stat">
            <strong>{user?.role || "customer"}</strong>
            <span>Account Role</span>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────── */}
        <div className="profile-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "account"}
            className={`profile-tab${activeTab === "account" ? " is-active" : ""}`}
            onClick={() => setActiveTab("account")}
            type="button"
          >
            Account Settings
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "orders"}
            className={`profile-tab${activeTab === "orders" ? " is-active" : ""}`}
            onClick={() => setActiveTab("orders")}
            type="button"
          >
            Orders
            {summary.total > 0 && <span className="profile-tab-badge">{summary.total}</span>}
          </button>
        </div>

        {/* ── Account Tab ────────────────────────────── */}
        {activeTab === "account" && (
          <motion.div
            key="account"
            className="profile-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="profile-panel-grid">
              <section>
                <h2>Personal Details</h2>
                <p className="profile-muted">Update your name, email, or password.</p>

                <form className="profile-form" onSubmit={handleSubmit} noValidate>
                  <div className="profile-field">
                    <label htmlFor="fullName">Full Name</label>
                    <input id="fullName" name="fullName" type="text" required
                      value={form.fullName}
                      onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} />
                  </div>

                  <div className="profile-field">
                    <label htmlFor="email">Email Address</label>
                    <input id="email" name="email" type="email" required
                      value={form.email}
                      onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} />
                  </div>

                  <div className="profile-divider"><span>Change Password</span></div>

                  <div className="profile-field-row">
                    <div className="profile-field">
                      <label htmlFor="currentPassword">Current Password</label>
                      <input id="currentPassword" name="currentPassword" type="password"
                        placeholder="Required to change password"
                        value={form.currentPassword}
                        onChange={(e) => setForm((c) => ({ ...c, currentPassword: e.target.value }))} />
                    </div>
                    <div className="profile-field">
                      <label htmlFor="newPassword">New Password</label>
                      <input id="newPassword" name="newPassword" type="password"
                        placeholder="Min 8 characters"
                        value={form.newPassword}
                        onChange={(e) => setForm((c) => ({ ...c, newPassword: e.target.value }))} />
                    </div>
                  </div>

                  <div className="profile-field" style={{ maxWidth: "360px" }}>
                    <label htmlFor="confirmNewPassword">Confirm New Password</label>
                    <input id="confirmNewPassword" name="confirmNewPassword" type="password"
                      value={form.confirmNewPassword}
                      onChange={(e) => setForm((c) => ({ ...c, confirmNewPassword: e.target.value }))} />
                  </div>

                  <div className="profile-form-footer">
                    <button className="profile-btn-primary" type="submit" disabled={status === "saving"}>
                      {status === "saving" ? "Saving…" : "Save Changes"}
                    </button>
                    {status === "success" && <p className="profile-status-ok">Changes saved.</p>}
                    {status && status !== "saving" && status !== "success" && (
                      <p className="profile-status-err">{status}</p>
                    )}
                  </div>
                </form>
              </section>

              <section>
                <h2>Account Info</h2>
                <p className="profile-muted">Your account details at a glance.</p>

                <div className="profile-info-list">
                  <div className="profile-info-row">
                    <span>Role</span>
                    <strong>{user?.role || "customer"}</strong>
                  </div>
                  <div className="profile-info-row">
                    <span>Member Since</span>
                    <strong>{formatDate(user?.created_at)}</strong>
                  </div>
                  <div className="profile-info-row">
                    <span>Last Login</span>
                    <strong>{formatDateTime(user?.last_login_at)}</strong>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        )}

        {/* ── Orders Tab ─────────────────────────────── */}
        {activeTab === "orders" && (
          <motion.div
            key="orders"
            className="profile-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="orders-toolbar">
              <h2>Your Orders</h2>
              <div className="orders-toolbar-right">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {STATUS_FILTERS.map((s) => (
                    <option key={s} value={s}>{s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
                <button className="profile-btn-ghost" type="button" onClick={refreshOrders} disabled={isLoadingOrders}>
                  {isLoadingOrders ? "Loading…" : "Refresh"}
                </button>
              </div>
            </div>

            {isLoadingOrders ? (
              <OrderSkeleton />
            ) : filteredOrders.length === 0 ? (
              <div className="orders-empty">
                {orders.length === 0
                  ? "No orders yet. Start planning your event."
                  : "No orders match the selected filter."}
              </div>
            ) : (
              <div className="orders-list">
                {filteredOrders.map((order) => {
                  const normalizedStatus = String(order.status || "pending").toLowerCase();
                  return (
                    <article key={order.id} className="order-card">
                      <div className="order-head">
                        <span className="order-id">{order.public_order_id || `Order #${order.id}`}</span>
                        <span className={`status-pill status-${normalizedStatus}`}>{normalizedStatus}</span>
                      </div>
                      <div className="order-meta">
                        <span>{formatDateTime(order.created_at)}</span>
                        <span>{Number(order.total_items || 0)} items</span>
                        <span>{formatMoney(order.total)}</span>
                        {order.delivery_estimate && <span>ETA: {order.delivery_estimate}</span>}
                      </div>
                      <div className="order-progress" role="progressbar" aria-valuenow={getStatusProgress(normalizedStatus)} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${getStatusProgress(normalizedStatus)}%` }} />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

      </main>
    </motion.div>
  );
}

export default ProfilePage;
