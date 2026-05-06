import { useDeferredValue, useState } from "react";
import { ADMIN_TOKEN_KEY, formatDateTime, userMatchesSearch } from "../lib/admin";

const PRODUCTION_API_URL = "https://eventmart-v4-production.up.railway.app";
function getApiBaseUrl() {
  const configured = String(import.meta.env?.VITE_API_URL || "").trim().replace(/\/+$/, "");
  return configured || PRODUCTION_API_URL;
}

function UsersPage({ adminUser, error, isLoading, onUsersRefresh, users }) {
  const [search, setSearch] = useState("");
  const [roleUpdating, setRoleUpdating] = useState(null);
  const [roleError, setRoleError] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const filteredUsers = users.filter((user) => userMatchesSearch(user, deferredSearch));

  async function handleRoleChange(user, newRole) {
    const action = newRole === "admin" ? "promote to admin" : "demote to customer";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${user.name}" (${user.email})?\n\nThis will ${newRole === "admin" ? "grant full admin access" : "remove admin access"}.`
    );
    if (!confirmed) return;

    setRoleError("");
    setRoleUpdating(user.id);

    try {
      const token = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
      const res = await fetch(`${getApiBaseUrl()}/api/users/${user.id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok) { setRoleError(data?.error || "Failed to update role."); return; }
      await onUsersRefresh();
    } catch {
      setRoleError("Could not reach the server.");
    } finally {
      setRoleUpdating(null);
    }
  }

  const selfId = String(adminUser?.id ?? "");

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Users</h2>
          <p className="muted">Registered accounts from the website sign-up flow.</p>
        </div>
      </div>

      <div className="section-stack">
        {error && (
          <div className="feedback-panel error">
            <strong>User data could not be loaded.</strong>
            <span>{error}</span>
          </div>
        )}

        {roleError && (
          <div className="feedback-panel error">
            <strong>Role update failed.</strong>
            <span>{roleError}</span>
          </div>
        )}

        <div className="panel">
          <div className="list-head">
            <h3>Registered Users ({filteredUsers.length})</h3>
            <div className="filters-row">
              <input
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                type="search"
                value={search}
              />
              <button
                className="btn ghost"
                disabled={isLoading}
                onClick={() => void onUsersRefresh().catch(() => {})}
                type="button"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="users-list">
            {isLoading && filteredUsers.length === 0 && (
              <div className="admin-user-card">
                <div className="admin-user-main">
                  <h4>Loading users…</h4>
                  <p>Checking the latest registrations from the API.</p>
                </div>
              </div>
            )}

            {!isLoading && filteredUsers.length === 0 && (
              <div className="admin-user-card">
                <div className="admin-user-main">
                  <h4>No users found</h4>
                  <p>Users will appear here after they register from the storefront.</p>
                </div>
              </div>
            )}

            {filteredUsers.map((user) => {
              const isSelf = String(user.id) === selfId;
              const isUpdating = roleUpdating === user.id;
              return (
                <article className="admin-user-card" key={user.id}>
                  <div className="admin-user-main">
                    <h4>{user.name}</h4>
                    <p>{user.email}</p>
                  </div>

                  <span className={`role-pill${user.role === "admin" ? " role-pill--admin" : ""}`}>
                    {user.role}
                  </span>

                  <div className="admin-user-date">
                    <div>Joined: {formatDateTime(user.created_at)}</div>
                    <div>Last Login: {formatDateTime(user.last_login_at)}</div>
                  </div>

                  {!isSelf && (
                    <div className="admin-user-actions">
                      {user.role === "customer" ? (
                        <button
                          className="btn ghost btn--sm"
                          disabled={isUpdating}
                          onClick={() => handleRoleChange(user, "admin")}
                          title="Promote to admin — requires confirmation"
                          type="button"
                        >
                          {isUpdating ? "Updating…" : "Promote to Admin"}
                        </button>
                      ) : (
                        <button
                          className="btn ghost btn--sm btn--warn"
                          disabled={isUpdating}
                          onClick={() => handleRoleChange(user, "customer")}
                          title="Demote to customer — requires confirmation"
                          type="button"
                        >
                          {isUpdating ? "Updating…" : "Demote to Customer"}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default UsersPage;
