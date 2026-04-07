import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadPackages } from "../lib/packages";
import "../styles/packages.css";

const PACKAGE_ITEM_DISCOUNT_RATE = 0.15;

function getPackageListStartingPrice(pkg) {
  const items = Array.isArray(pkg?.items) ? pkg.items : [];
  let total = 0;
  let currency = "EGP";

  items.forEach((item) => {
    const quantity = Math.max(0, Number(item?.defaultQuantity || item?.minimumQuantity || 0));
    const product = item?.product || {};
    const mode = item?.preferredMode === "rent" ? "rent" : "buy";
    const unitPrice = mode === "rent"
      ? Number(product?.rent_price_per_day ?? product?.buy_price ?? 0)
      : Number(product?.buy_price ?? product?.rent_price_per_day ?? 0);

    if (Number.isFinite(unitPrice) && unitPrice > 0 && quantity > 0) {
      total += unitPrice * quantity * (1 - PACKAGE_ITEM_DISCOUNT_RATE);
      currency = String(product?.currency || currency);
    }
  });

  return {
    amount: Number(total.toFixed(2)),
    currency
  };
}

function PackagesPage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadPackages()
      .then((rows) => {
        if (cancelled) return;
        setPackages(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError?.message || "Unable to load packages right now.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPackages = useMemo(() => {
    const normalizedQuery = String(search || "").trim().toLowerCase();
    if (!normalizedQuery) return packages;

    return packages.filter((pkg) =>
      [
        pkg?.name,
        pkg?.description,
        pkg?.eventType,
        ...(Array.isArray(pkg?.items) ? pkg.items.map((item) => item?.product?.name) : [])
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [packages, search]);

  if (loading) {
    return (
      <main className="packages-page" data-theme-scope="packages">
        <section className="package-shell-card package-state-card">
          <p className="package-eyebrow">Browse Packages</p>
          <h1>Loading default packages...</h1>
          <p>We&apos;re preparing the latest package bundles and pricing previews.</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="packages-page" data-theme-scope="packages">
        <section className="package-shell-card package-state-card">
          <p className="package-eyebrow">Browse Packages</p>
          <h1>Packages are unavailable right now.</h1>
          <p>{error}</p>
          <Link className="package-primary-link" to="/package-builder">
            Start Building
          </Link>
        </section>
      </main>
    );
  }

  return (
    <motion.main
      className="packages-page"
      data-theme-scope="packages"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      <div className="packages-layout">
        <section className="package-shell-card package-list-hero">
          <div>
            <p className="package-eyebrow">Browse Packages</p>
            <h1>Choose a ready-made package or customize one further.</h1>
            <p className="package-copy">
              Compare included items, live package discounts, and recommended setups before moving straight into checkout or deeper customization.
            </p>
          </div>

          <div className="package-list-actions">
            <Link className="package-primary-link" to="/package-builder">
              Start Building
            </Link>
            <label className="package-search">
              <span className="sr-only">Search packages</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search packages..."
                type="search"
                value={search}
              />
            </label>
          </div>
        </section>

        <section className="package-list-grid" aria-label="Default package list">
          {filteredPackages.length ? (
            filteredPackages.map((pkg) => (
              (() => {
                const startingPrice = getPackageListStartingPrice(pkg);

                return (
                  <article className="package-shell-card package-list-card" key={pkg.id}>
                    <div className="package-card-head">
                      <div>
                        <p className="package-card-kicker">{pkg.eventType || "General event"}</p>
                        <h2>{pkg.name}</h2>
                      </div>
                      <span className={`package-requirement-pill is-${pkg.status}`}>{pkg.status}</span>
                    </div>

                    <p className="package-copy">{pkg.description || "No description provided for this package yet."}</p>

                    <div className="package-card-items-preview">
                      {pkg.items.slice(0, 4).map((item) => (
                        <div className="package-card-mini-item" key={item.id}>
                          <img alt={item.product?.name} src={item.product?.image_url || "/assets/equipment-collage.jpg"} />
                          <div>
                            <strong>{item.product?.name}</strong>
                            <span>Qty {item.defaultQuantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="package-list-meta">
                      <span>
                        {pkg.items.length} included items
                        {Number(pkg.contextDefaults?.minimumPackagePrice || 0) > 0
                          ? ` | Min ${startingPrice.currency} ${Number(pkg.contextDefaults?.minimumPackagePrice || 0).toFixed(2)}`
                          : ""}
                      </span>
                      <strong>
                        {startingPrice.currency} {startingPrice.amount.toFixed(2)}
                      </strong>
                    </div>

                    <div className="package-list-card-actions">
                      <Link className="package-primary-link" to={`/packages/${pkg.slug || pkg.id}`}>
                        View Details
                      </Link>
                      <Link className="package-secondary-link" to={`/package-builder?package=${encodeURIComponent(pkg.slug || pkg.id)}`}>
                        Customize
                      </Link>
                    </div>
                  </article>
                );
              })()
            ))
          ) : (
            <section className="package-shell-card package-state-card package-list-empty">
              <p className="package-eyebrow">Browse Packages</p>
              <h2>No packages match this search.</h2>
              <p>Try another keyword or start from scratch in the package builder.</p>
              <Link className="package-primary-link" to="/package-builder">
                Start Building
              </Link>
            </section>
          )}
        </section>
      </div>
    </motion.main>
  );
}

export default PackagesPage;
