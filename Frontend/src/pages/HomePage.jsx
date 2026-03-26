import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { HOME_HERO_SHOWCASE_IMAGES } from "../lib/homeHeroShowcaseImages";

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

function HomePage() {
  function handleHeroSearchSubmit(event) {
    event.preventDefault();
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
              and build a full setup package for your event from one place.
            </p>
            <div className="hero-actions">
              <Link to="/shop" className="btn-primary">
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
                    to="/shop"
                    className="category-chip"
                    aria-hidden={index > 7 ? "true" : undefined}
                    tabIndex={index > 7 ? -1 : undefined}
                  >
                    {category}
                  </Link>
                ))}
            </div>
          </div>
        </section>

        <section className="market-section" aria-labelledby="recommended-title">
          <div className="section-head">
            <div>
              <h2 id="recommended-title">Recommended For You</h2>
            </div>
            <Link to="/shop" className="section-link">
              View All Products
            </Link>
          </div>

          <div className="product-grid">
            {[
              ["Portable Sound System Pro", "4.9 rating â€¢ 128 reviews", "$420", "or rent from $75/day"],
              ["Stage Lighting Starter Kit", "4.8 rating â€¢ 96 reviews", "$360", "or rent from $62/day"],
              ["LED Backdrop Display Panel", "4.7 rating â€¢ 84 reviews", "$590", "or rent from $95/day"],
              ["DJ Booth Performance Set", "4.9 rating â€¢ 142 reviews", "$510", "or rent from $88/day"]
            ].map(([title, , price, sub]) => (
              <article key={title} className="market-card">
                <img src="/assets/equipment-collage.jpg" alt={title} />
                <div className="market-card-body">
                  <h3>{title}</h3>
                  <p className="card-price">
                    {price} <span>{sub}</span>
                  </p>
                  <Link to="/shop" className="card-btn">
                    View Item
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="package-builder" className="package-builder" aria-labelledby="package-title">
          <div className="package-copy">
            <h2 id="package-title">Create Your Own Package Now!</h2>
            <p>
              Build a complete equipment package based on guest count, event type, venue size, and budget. EventMart
              recommends matching products so you can launch faster.
            </p>
            <div className="package-actions">
              <Link to="/shop" className="btn-primary-pack">
                <span className="cta-orbit-label">Start Building</span>
              </Link>
              <Link to="/shop" className="btn-secondary-pack">
                <span className="cta-orbit-label">Browse Packages</span>
              </Link>
            </div>
          </div>

          <div className="package-features" aria-label="Package builder highlights">
            <article>
              <h3>Smart Bundle Suggestions</h3>
              <p>Get auto-matched products for sound, lighting, stage, and accessories.</p>
            </article>
            <article>
              <h3>Flexible Budget Control</h3>
              <p>Choose rent or buy options per item without rebuilding your full setup.</p>
            </article>
            <article>
              <h3>One-Click Checkout Flow</h3>
              <p>Move from planning to secured equipment in a streamlined purchase path.</p>
            </article>
          </div>
        </section>

        <section className="market-section" aria-labelledby="deals-title">
          <div className="section-head">
            <div>
              <h2 id="deals-title">Latest Deals!</h2>
            </div>
            <Link to="/shop" className="section-link">
              See More Deals
            </Link>
          </div>

          <div className="deal-grid">
            {[
              ["-25%", "Conference Audio Package", "$390", "$520", "Buy now or rent from $70/day"],
              ["-18%", "Wedding Light Tunnel Kit", "$450", "$550", "Limited offer â€¢ 2 days left"],
              ["Rent + Buy", "Outdoor LED Screen Set", "$780", "$940", "Rent from $130/day with setup support"]
            ].map(([badge, title, price, strike, sub]) => (
              <article key={title} className="deal-card">
                <span className="deal-badge">{badge}</span>
                <img src="/assets/equipment-collage.jpg" alt={title} />
                <h3>{title}</h3>
                <p className="deal-price">
                  <strong>{price}</strong> <span>{strike}</span>
                </p>
                <p className="deal-sub">{sub}</p>
                <Link to="/shop" className="card-btn">
                  Claim Deal
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="market-section purpose-section" aria-labelledby="purpose-title">
          <div className="section-head">
            <div>
              <h2 id="purpose-title">Shop by Event Type</h2>
            </div>
          </div>

          <div className="purpose-grid">
            {[
              ["Weddings", "Elegant lighting, stage decor, and premium audio."],
              ["Birthdays", "Fun bundles with sound, LED, and party accessories."],
              ["Corporate Events", "Professional AV, podium setups, and presentation gear."],
              ["Concerts", "Performance-grade systems for live audience impact."],
              ["Outdoor Events", "Weather-ready staging and high-visibility display kits."],
              ["Private Parties", "Compact all-in-one packs for fast personal setups."]
            ].map(([title, text]) => (
              <Link key={title} to="/shop" className="purpose-card">
                <h3>{title}</h3>
                <p>{text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="market-section" aria-labelledby="rent-title">
          <div className="section-head">
            <div>
              <h2 id="rent-title">Explore Essentials.</h2>
            </div>
          </div>

          <div className="rent-grid">
            {["Stage Riser Kit", "Portable Truss + Lights", "Event Speaker Tower", "LED Booth Package"].map((title) => (
              <article key={title} className="rent-card">
                <img src="/assets/equipment-collage.jpg" alt={title} />
                <h3>{title}</h3>
                <div className="rent-pricing">
                  <p>
                    <span>Buy</span>
                    <strong>$1,250</strong>
                  </p>
                  <p>
                    <span>Rent / day</span>
                    <strong>$120</strong>
                  </p>
                </div>
                <div className="rent-actions">
                  <Link to="/shop" className="btn-primary btn-fill">
                    Buy
                  </Link>
                  <Link to="/shop" className="btn-secondary btn-fill">
                    Rent
                  </Link>
                </div>
              </article>
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
              ["Smart Recommendations", "Discover relevant items and bundles based on what planners actually need."],
              ["Build Packages Fast", "Create complete setups in a guided flow and move to checkout quickly."]
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
