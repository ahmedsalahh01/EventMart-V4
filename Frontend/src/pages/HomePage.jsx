import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import HeroSlideshow from "../components/HeroSlideshow";
import ProductCard from "../components/shop/ProductCard";
import { buildEventTypeShopPath, listEventTypes } from "../lib/eventTypeConfig";
import { loadProducts } from "../lib/products";
import { getSelectedEventType, trackCategoryView, trackEventTypeSelection } from "../lib/userBehavior";

const TRUST_CARDS = [
  {
    title: "Shop or Rent Easily",
    text: "Switch between purchase and rental options instantly for each product.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="28" height="28">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M3 6h18" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    title: "Curated Event Equipment",
    text: "Only high-demand equipment categories with clear specs and pricing.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="28" height="28">
        <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    title: "Smart Recommendations",
    text: "Discover relevant items based on what planners actually need.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="28" height="28">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    title: "Plan Faster",
    text: "Move from discovery to checkout with fewer steps and clearer product choices.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="28" height="28">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
];

const PACKAGE_BUILDER_FEATURES = [
  {
    title: "Smart Bundle Suggestions",
    text: "Get auto-matched products for sound, lighting, stage, and accessories."
  },
  {
    title: "Flexible Budget Control",
    text: "Choose rent or buy options per item without rebuilding your full setup."
  },
  {
    title: "One-Click Checkout Flow",
    text: "Move from planning to secured equipment in a streamlined purchase path."
  }
];

function HomePage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [homeCategories, setHomeCategories] = useState(null);
  const [heroSearchQuery, setHeroSearchQuery] = useState("");
  const [selectedEventType, setSelectedEventType] = useState(() => getSelectedEventType() || "birthday");

  const featuredProducts = products.filter((p) => p.featured && p.active !== false);
  const categoryList = homeCategories || [
    "Sound Systems", "Merchandise", "Giveaways", "Lighting Systems",
    "Wireless Microphones", "Stage Uplighting", "Promo Booth Kits", "LED Accent Lights"
  ];

  useEffect(() => {
    let cancelled = false;

    loadProducts()
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {});

    apiRequest("/api/config/builder")
      .then((config) => {
        if (!cancelled && Array.isArray(config?.homeCategories)) {
          setHomeCategories(config.homeCategories);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  function handleHeroSearchSubmit() {
    navigate(
      buildEventTypeShopPath(selectedEventType, {
        search: heroSearchQuery.trim()
      })
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <main className="home-main" data-theme-scope="home">
        <HeroSlideshow
          searchQuery={heroSearchQuery}
          onSearchQueryChange={setHeroSearchQuery}
          onSearchSubmit={handleHeroSearchSubmit}
          shopPath={buildEventTypeShopPath(selectedEventType)}
        />

        {featuredProducts.length > 0 && (
          <section className="featured-section market-section" aria-labelledby="featured-title">
            <div className="section-head">
              <div>
                <p className="section-kicker">Handpicked</p>
                <h2 id="featured-title">Featured Items</h2>
              </div>
              <Link className="section-link" to="/shop">View All Products</Link>
            </div>
            <div className="featured-grid">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        <section className="quick-categories">
          <h3 className="section-mini-title">Browse by Category</h3>
          <div className="category-strip">
            <div className="category-track">
              {[
                "Sound Systems",
                "Merchandise",
                "Giveaways",
                "Lighting Systems",
                "Wireless Microphones",
                "Stage Uplighting",
                "Promo Booth Kits",
                "LED Accent Lights"
              ]
                .concat([
                  "Sound Systems",
                  "Merchandise",
                  "Giveaways",
                  "Lighting Systems",
                  "Wireless Microphones",
                  "Stage Uplighting",
                  "Promo Booth Kits",
                  "LED Accent Lights"
                ])
                .map((category, index) => (
                  <Link
                    key={`${category}-${index}`}
                    to={`/shop?category=${encodeURIComponent(category)}`}
                    className="category-chip"
                    aria-hidden={index > 7 ? "true" : undefined}
                    tabIndex={index > 7 ? -1 : undefined}
                    onClick={() => trackCategoryView(category, { source: "home-category-strip" })}
                  >
                    {category}
                  </Link>
                ))}
            </div>
          </div>
        </section>

        <section className="home-package-builder-section" aria-labelledby="package-builder-title">
          <div className="home-package-builder-content">
            <div className="home-package-builder-copy">
              <p className="section-kicker section-kicker-light">Package Builder</p>
              <h2 id="package-builder-title">Create Your Own Package Now!</h2>
              <p className="home-package-builder-text">
                Build a complete equipment package around your guest count, event type, venue size, and budget,
                then move forward with live bundle discounts, delivery guidance, and checkout-ready totals.
              </p>

              <div className="home-package-builder-actions">
                <Link className="home-package-builder-primary" to="/package-builder">
                  Start Building
                </Link>
                <Link className="home-package-builder-secondary" to="/packages">
                  Browse Packages
                </Link>
              </div>
            </div>

            <div className="home-package-builder-card-stack" aria-label="Package builder highlights">
              {PACKAGE_BUILDER_FEATURES.map((feature) => (
                <article className="home-package-builder-card" key={feature.title}>
                  <div className="home-package-builder-card-icon" aria-hidden="true" />
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="market-section purpose-section" aria-labelledby="purpose-title">
          <div className="section-head">
            <div>
              <p className="section-kicker">Browse Equipment</p>
              <h2 id="purpose-title">Shop by Event Type</h2>
              <p className="purpose-section-subtitle">
                Choose your event type to browse curated equipment — from sound and lighting to merch and staging.
              </p>
            </div>
          </div>

          <div className="purpose-grid">
            {listEventTypes().map((eventType) => (
              <Link
                key={eventType.slug}
                to={buildEventTypeShopPath(eventType.slug)}
                className="purpose-card"
                onClick={() => {
                  setSelectedEventType(eventType.slug);
                  trackEventTypeSelection(eventType.slug, { source: "home-event-card" });
                }}
              >
                <span className="purpose-card-emoji" aria-hidden="true">
                  {{ birthday: "🎂", party: "🥳", engagement: "💍", corporate: "💼", conference: "🏛️" }[eventType.slug] ?? "🎉"}
                </span>
                <h3>{eventType.label}</h3>
                <p>{eventType.cardDescription}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="trust-section" aria-labelledby="trust-title">
          <div className="section-head section-head-center">
            <div>
              <p className="section-kicker">Why EventMart</p>
              <h2 id="trust-title">Built for Faster Event Execution</h2>
            </div>
          </div>

          <div className="trust-grid">
            {[
              {
                title: "Shop or Rent Easily",
                text: "Switch between purchase and rental options instantly for each product.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="28" height="28">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                    <path d="M3 6h18" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                )
              },
              {
                title: "Curated Event Equipment",
                text: "Only high-demand equipment categories with clear specs and pricing.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="28" height="28">
                    <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )
              },
              {
                title: "Smart Recommendations",
                text: "Discover relevant items based on what planners actually need.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="28" height="28">
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                )
              },
              {
                title: "Plan Faster",
                text: "Move from discovery to checkout with fewer steps and clearer product choices.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="28" height="28">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )
              }
            ].map(({ title, text, icon }) => (
              <article key={title} className="trust-card">
                <div className="trust-card-icon" aria-hidden="true">{icon}</div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </motion.div>
  );
}

export default HomePage;
