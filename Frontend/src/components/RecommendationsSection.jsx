import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, buildApiUrl } from "../lib/api";
import { formatMoney } from "../lib/products";

function resolveImage(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/")) return buildApiUrl(url);
  return url;
}

function RecCard({ rec }) {
  const price = rec.buyPrice
    ? formatMoney(rec.buyPrice, rec.currency)
    : rec.rentPricePerDay
      ? `${formatMoney(rec.rentPricePerDay, rec.currency)}/day`
      : null;

  const imageUrl = resolveImage(rec.imageUrl);

  return (
    <Link to={`/shop/${rec.slug}`} className="rec-card">
      <div className="rec-card-image">
        {imageUrl ? (
          <img src={imageUrl} alt={rec.name} loading="lazy" />
        ) : (
          <div className="rec-card-image-empty">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="m21 15-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {rec.featured && <span className="rec-card-featured">Featured</span>}
      </div>

      <div className="rec-card-body">
        {rec.badges.length > 0 && (
          <div className="rec-card-badges">
            {rec.badges.map((badge) => {
              const cls = badge.includes("match")
                ? " rec-badge-match"
                : badge === "Trending"
                  ? " rec-badge-trend"
                  : "";
              return (
                <span key={badge} className={`rec-badge${cls}`}>{badge}</span>
              );
            })}
          </div>
        )}

        <h3 className="rec-card-name">{rec.name}</h3>

        <div className="rec-card-meta">
          <span className="rec-card-category">{rec.category}</span>
          {price && <span className="rec-card-price">{price}</span>}
        </div>

        <p className="rec-card-reason">{rec.reason}</p>
      </div>
    </Link>
  );
}

function AlgorithmPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rec-algorithm">
      <button
        className="rec-algorithm-trigger"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
        aria-expanded={open}
      >
        <span>How we pick recommendations</span>
        <svg
          className={`rec-algorithm-chevron${open ? " is-open" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="rec-algorithm-body">
          <p className="rec-algorithm-intro">Our engine scores every product using four weighted signals:</p>
          <div className="rec-algorithm-factors">
            {[
              { weight: "40%", label: "Category match", detail: "Products in the same category as what you're viewing" },
              { weight: "25%", label: "Price range", detail: "Items priced similarly to the current product" },
              { weight: "20%", label: "Rental patterns", detail: "Trending and frequently rented products on EventMart" },
              { weight: "15%", label: "Your history", detail: "Based on what you've browsed in this session" }
            ].map(({ weight, label, detail }) => (
              <div key={weight} className="rec-algorithm-factor">
                <span className="rec-algorithm-weight">{weight}</span>
                <div>
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecommendationsSection({ productId, productName }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setLoaded(false);

    apiRequest(`/api/recommendations/${encodeURIComponent(productId)}`)
      .then((data) => {
        if (cancelled) return;
        setRecommendations(Array.isArray(data?.recommendations) ? data.recommendations : []);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setRecommendations([]);
        setLoaded(true);
      });

    return () => { cancelled = true; };
  }, [productId]);

  if (!loaded || !recommendations.length) return null;

  return (
    <section className="rec-section" aria-labelledby="rec-heading">
      <div className="rec-header">
        <div className="rec-header-text">
          <h2 id="rec-heading" className="rec-title">Recommended for you</h2>
          {productName && (
            <p className="rec-subtitle">
              Based on your interest in <strong>{productName}</strong>
            </p>
          )}
        </div>
        <Link to="/shop" className="rec-view-all">View all →</Link>
      </div>

      <div className="rec-grid">
        {recommendations.map((rec) => (
          <RecCard key={rec.id} rec={rec} />
        ))}
      </div>

      <AlgorithmPanel />
    </section>
  );
}
