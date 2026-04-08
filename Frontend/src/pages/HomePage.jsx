import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SmartRecommendationBar from "../components/SmartRecommendationBar";
import { buildEventTypeShopPath, listEventTypes } from "../lib/eventTypeConfig";
import { HOME_HERO_SHOWCASE_IMAGES } from "../lib/homeHeroShowcaseImages";
import { loadProducts } from "../lib/products";
import { getSelectedEventType, trackCategoryView, trackEventTypeSelection } from "../lib/userBehavior";

const HERO_RIBBON_REPEAT_COUNT = 4;

function repeatHeroRibbonImages(images, repeatCount) {
  return Array.from({ length: repeatCount }, () => images).flat();
}

const TOP_HERO_RIBBON_IMAGES = repeatHeroRibbonImages(HOME_HERO_SHOWCASE_IMAGES, HERO_RIBBON_REPEAT_COUNT);
const BOTTOM_HERO_RIBBON_IMAGES = repeatHeroRibbonImages(
  [...HOME_HERO_SHOWCASE_IMAGES.slice(3), ...HOME_HERO_SHOWCASE_IMAGES.slice(0, 3)],
  HERO_RIBBON_REPEAT_COUNT
);

function buildHeroRibbonSlides(images, rowId) {
  return [...images, ...images].map((item, index) => ({
    ...item,
    renderId: `${rowId}-${item.id}-${index}`
  }));
}

const HERO_RIBBON_ROWS = [
  { id: "top", slides: buildHeroRibbonSlides(TOP_HERO_RIBBON_IMAGES, "top") },
  { id: "bottom", slides: buildHeroRibbonSlides(BOTTOM_HERO_RIBBON_IMAGES, "bottom") }
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

  function handleHeroSearchSubmit(event) {
    event.preventDefault();
    navigate(
      buildEventTypeShopPath(selectedEventType, {
        search: heroSearchQuery.trim()
      })
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <main className="home-main" data-theme-scope="home">
        <section className="market-hero">
          <form className="hero-search" role="search" aria-label="Search EventMart products" onSubmit={handleHeroSearchSubmit}>
            <div className="hero-search-shell">
              <span className="hero-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                className="hero-search-input"
                aria-label="Search event products"
                placeholder="Search speakers, lighting, staging, and more"
                value={heroSearchQuery}
                onChange={(event) => setHeroSearchQuery(event.target.value)}
              />
              <button type="submit" className="hero-search-btn">
                Search
              </button>
            </div>
          </form>

          <div className="market-hero-copy">
            <h1 id="hero-title">Get Your Event- SIMPLE.</h1>
            <p className="hero-text">
              Shop or rent curated event equipment in minutes. Compare products, discover recommendations, unlock deals,
              and discover the right setup for your event from one place.
            </p>
            <div className="hero-actions">
              <Link to={buildEventTypeShopPath(selectedEventType)} className="btn-primary">
                <span className="cta-orbit-label">Explore Shop</span>
              </Link>
              <Link to="/ai-planner" className="btn-secondary btn-secondary-ai">
                <span className="hero-planner-link-mark" aria-hidden="true">
                  <svg viewBox="0 0 48 48" fill="none">
                    <path
                      d="M24 4.5c1.2 8.2 2.8 9.8 11 11-8.2 1.2-9.8 2.8-11 11-1.2-8.2-2.8-9.8-11-11 8.2-1.2 9.8-2.8 11-11Z"
                      stroke="currentColor"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M37.5 22c.5 3.5 1.2 4.2 4.7 4.7-3.5.5-4.2 1.2-4.7 4.7-.5-3.5-1.2-4.2-4.7-4.7 3.5-.5 4.2-1.2 4.7-4.7Z"
                      fill="currentColor"
                    />
                    <circle cx="13" cy="32.5" r="2.5" fill="currentColor" />
                  </svg>
                </span>
                <span className="cta-orbit-label">Try AI Planner</span>
              </Link>
            </div>
          </div>

          <div className="market-hero-visual" aria-hidden="true">
            {HERO_RIBBON_ROWS.map((row) => (
              <div key={row.id} className={`hero-ribbon hero-ribbon-${row.id}`}>
                <div className="hero-ribbon-track">
                  {row.slides.map((slide) => (
                    <div key={slide.renderId} className="hero-ribbon-card">
                      <img className="hero-ribbon-image" src={slide.image} alt={slide.alt} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

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
