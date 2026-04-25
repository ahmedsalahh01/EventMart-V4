import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HeroSlideshow from "../components/HeroSlideshow";
import SmartRecommendationBar from "../components/SmartRecommendationBar";
import { buildEventTypeShopPath, listEventTypes } from "../lib/eventTypeConfig";
import { loadProducts } from "../lib/products";
import { getSelectedEventType, trackCategoryView, trackEventTypeSelection } from "../lib/userBehavior";

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
  const [heroSearchQuery, setHeroSearchQuery] = useState("");
  const [selectedEventType, setSelectedEventType] = useState(() => getSelectedEventType() || "birthday");

  useEffect(() => {
    let cancelled = false;

    loadProducts().then((rows) => {
      if (!cancelled) {
        setProducts(rows);
      }
    });

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

        <section className="quick-categories">
          <h3 className="section-mini-title">Quick Category Strip</h3>
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

        <SmartRecommendationBar
          className="market-section"
          ctaLabel="View All Products"
          ctaTo={buildEventTypeShopPath(selectedEventType)}
          currentEventType={selectedEventType}
          limit={4}
          products={products}
          title="Recommended For You"
        />

        <section className="market-section purpose-section" aria-labelledby="purpose-title">
          <div className="section-head">
            <div>
              <h2 id="purpose-title">Shop by Event Type</h2>
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
              ["Shop or Rent Easily", "Switch between purchase and rental options instantly for each product."],
              ["Curated Event Equipment", "Only high-demand equipment categories with clear specs and pricing."],
              ["Smart Recommendations", "Discover relevant items based on what planners actually need."],
              ["Plan Faster", "Move from discovery to checkout with fewer steps and clearer product choices."]
            ].map(([title, text]) => (
              <article key={title} className="trust-card">
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
