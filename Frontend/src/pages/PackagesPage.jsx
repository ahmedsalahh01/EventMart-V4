import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import {
  buildPackageDescription,
  createCartItemsFromBuilderPreview,
  createPackageGroupId,
  getPackageAudienceLabel,
  getPackageCustomizationLabel,
  getPackageDisplayPrice,
  getPackageRecommendedForLabel,
  getPackageVenueLabel,
  loadPackages,
  previewPackage
} from "../lib/packages";
import "../styles/packages.css";

function PackagesPage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState("success");
  const [activePackageId, setActivePackageId] = useState(null);
  const { setItems } = useCart();

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
        buildPackageDescription(pkg),
        getPackageAudienceLabel(pkg),
        getPackageVenueLabel(pkg),
        getPackageCustomizationLabel(pkg),
        getPackageRecommendedForLabel(pkg),
        ...(Array.isArray(pkg?.items)
          ? pkg.items.flatMap((item) => [
              item?.description,
              item?.product?.name
            ])
          : [])
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [packages, search]);

  async function handleAddToCart(pkg) {
    setActivePackageId(pkg.id);
    setActionMessage("");

    try {
      const packageGroupId = createPackageGroupId("package-list");
      const payload = await previewPackage({
        packageGroupId,
        packageSlug: pkg.slug || undefined,
        packageId: pkg.id
      });
      const cartItems = createCartItemsFromBuilderPreview(payload?.preview, {});

      setItems((current) => [...current, ...cartItems]);
      setActionTone("success");
      setActionMessage(`${pkg.name} was added to your cart.`);
    } catch (requestError) {
      setActionTone("error");
      setActionMessage(requestError?.message || "We couldn't add this package to your cart right now.");
    } finally {
      setActivePackageId(null);
    }
  }

  if (loading) {
    return (
      <main className="packages-page" data-theme-scope="packages">
        <section className="package-shell-card package-state-card">
          <p className="package-eyebrow">Browse Packages</p>
          <h1>Loading package browse...</h1>
          <p>We&apos;re preparing the latest package list, pricing, and included items.</p>
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
          <Link className="package-primary-link" to="/shop">
            Browse Products
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
            <h1>Choose a ready-made package for your event setup.</h1>
            <p className="package-copy">
              Compare package descriptions, venue fit, recommended uses, customization flexibility, and exact package pricing before adding one to cart.
            </p>
            {actionMessage ? (
              <p className={actionTone === "error" ? "package-inline-error" : "package-inline-success"}>
                {actionMessage}
              </p>
            ) : null}
          </div>

          <div className="package-list-actions">
            <Link className="package-secondary-link" to="/shop">
              Browse Products
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

        <section className="package-list-grid" aria-label="Package list">
          {filteredPackages.length ? (
            filteredPackages.map((pkg) => {
              const displayPrice = getPackageDisplayPrice(pkg);

              return (
                <article className="package-shell-card package-list-card" key={pkg.id}>
                  <div className="package-card-head">
                    <div>
                      <p className="package-card-kicker">{getPackageCustomizationLabel(pkg)}</p>
                      <h2>{pkg.name}</h2>
                    </div>
                    <span className={`package-requirement-pill is-${pkg.status}`}>{pkg.status}</span>
                  </div>

                  <p className="package-copy">{buildPackageDescription(pkg)}</p>

                  <div className="package-list-feature-grid">
                    <span className="package-list-feature-pill">{getPackageRecommendedForLabel(pkg)}</span>
                    <span className="package-list-feature-pill">{getPackageAudienceLabel(pkg)}</span>
                    <span className="package-list-feature-pill">{getPackageVenueLabel(pkg)}</span>
                    <span className="package-list-feature-pill">{pkg.items.length} items included</span>
                  </div>

                  <div className="package-list-meta">
                    <span>Package price</span>
                    <strong>
                      {displayPrice.currency} {displayPrice.amount.toFixed(2)}
                    </strong>
                  </div>

                  <div className="package-list-card-actions">
                    <button
                      className="package-primary-button"
                      disabled={activePackageId === pkg.id}
                      onClick={() => { void handleAddToCart(pkg); }}
                      type="button"
                    >
                      {activePackageId === pkg.id ? "Adding..." : "Add to cart"}
                    </button>
                    <Link className="package-secondary-link" to={`/packages/${pkg.slug || pkg.id}`}>
                      View Package
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <section className="package-shell-card package-state-card package-list-empty">
              <p className="package-eyebrow">Browse Packages</p>
              <h2>No packages match this search.</h2>
              <p>Try another keyword or explore individual products instead.</p>
              <Link className="package-primary-link" to="/shop">
                Browse Products
              </Link>
            </section>
          )}
        </section>
      </div>
    </motion.main>
  );
}

export default PackagesPage;
