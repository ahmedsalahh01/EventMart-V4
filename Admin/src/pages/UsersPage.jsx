import { useDeferredValue, useState } from "react";
import { formatDateTime, userMatchesSearch } from "../lib/admin";

function UsersPage({ error, isLoading, onUsersRefresh, users }) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const filteredUsers = users.filter((user) => userMatchesSearch(user, deferredSearch));

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Users</h2>
          <p className="muted">Registered accounts from the website sign-up flow.</p>
        </div>
      </div>

      <div className="section-stack">
        {error ? (
          <div className="feedback-panel error">
            <strong>User data could not be loaded.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <div className="panel">
          <div className="list-head">
            <h3>Registered Users ({filteredUsers.length})</h3>
            <div className="filters-row">
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users..."
                type="search"
                value={search}
              />
              <button
                className="btn ghost"
                disabled={isLoading}
                onClick={() => {
                  void onUsersRefresh().catch(() => {});
                }}
                type="button"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="users-list">
            {isLoading && filteredUsers.length === 0 ? (
              <div className="admin-user-card">
                <div className="admin-user-main">
                  <h4>Loading users...</h4>
                  <p>Checking the latest registrations from the API.</p>
                </div>
              </div>
            ) : null}

            {!isLoading && filteredUsers.length === 0 ? (
              <div className="admin-user-card">
                <div className="admin-user-main">
                  <h4>No users found</h4>
                  <p>Users will appear here after they register from the storefront.</p>
                </div>
              </div>
            ) : null}

            {filteredUsers.map((user) => (
              <article className="admin-user-card" key={user.id}>
                <div className="admin-user-main">
                  <h4>{user.name}</h4>
                  <p>{user.email}</p>
                </div>

                <span className="role-pill">{user.role}</span>

                <div className="admin-user-date">
                  <div>Joined: {formatDateTime(user.created_at)}</div>
                  <div>Last Login: {formatDateTime(user.last_login_at)}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default UsersPage;
