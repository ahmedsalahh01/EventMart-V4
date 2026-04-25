import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const AUTO_ADVANCE_MS = 5000;

function HeroSlideshow({ searchQuery, onSearchQueryChange, onSearchSubmit, shopPath }) {
  const navigate = useNavigate();
  const slides = [
    {
      id: "rent",
      eyebrow: "EventMart Marketplace",
      headline: "Rent premium event equipment",
      subheadline: "Sound, staging, lighting, and more — delivered to your venue without the hassle.",
      image: "/assets/hero-event.jpg",
      align: "center",
      variant: "search"
    },
    {
      id: "lighting",
      eyebrow: "Featured Category",
      headline: "Professional lighting for any event",
      subheadline: "Concerts, weddings, corporate stages — find fixtures, controllers, and trusses in one place.",
      image: "/assets/equipment-collage.jpg",
      align: "left",
      variant: "cta",
      ctaLabel: "Browse lights",
      ctaTo: "/shop?category=Lighting+Systems"
    },
    {
      id: "delivery",
      eyebrow: "Cairo & Greater Cairo",
      headline: "Same-day delivery in Cairo",
      subheadline: "Order before noon and we deliver the same day — setup support available on request.",
      image: "/assets/Group.jpeg",
      align: "right",
      variant: "cta",
      ctaLabel: "Learn more",
      ctaTo: "/about"
    }
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const goTo = useCallback(
    (index) => {
      const next = (index + slides.length) % slides.length;
      setActiveIndex(next);
    },
    [slides.length]
  );

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (isPaused) {
      return undefined;
    }
    timerRef.current = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [activeIndex, isPaused, slides.length]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    onSearchSubmit?.();
  }

  return (
    <section
      className="hero-slideshow"
      aria-roledescription="carousel"
      aria-label="EventMart highlights"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="hero-slideshow-track">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <article
              key={slide.id}
              className={`hero-slide hero-slide-align-${slide.align}${isActive ? " is-active" : ""}`}
              aria-hidden={!isActive}
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}`}
              style={{ backgroundImage: `url(${slide.image})` }}
            >
              <div className="hero-slide-overlay" />
              <div className="hero-slide-content">
                <p className="hero-slide-eyebrow">{slide.eyebrow}</p>
                <h1 className="hero-slide-headline">{slide.headline}</h1>
                <p className="hero-slide-subheadline">{slide.subheadline}</p>

                {slide.variant === "search" ? (
                  <form
                    className="hero-slide-search"
                    role="search"
                    aria-label="Search EventMart products"
                    onSubmit={handleSearchSubmit}
                  >
                    <div className="hero-slide-search-shell">
                      <span className="hero-slide-search-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </span>
                      <input
                        type="search"
                        className="hero-slide-search-input"
                        aria-label="Search event products"
                        placeholder="Search speakers, lighting, staging, and more"
                        value={searchQuery}
                        onChange={(event) => onSearchQueryChange?.(event.target.value)}
                        tabIndex={isActive ? 0 : -1}
                      />
                      <button type="submit" className="hero-slide-search-btn" tabIndex={isActive ? 0 : -1}>
                        Search
                      </button>
                    </div>
                    {shopPath ? (
                      <button
                        type="button"
                        className="hero-slide-secondary-link"
                        onClick={() => navigate(shopPath)}
                        tabIndex={isActive ? 0 : -1}
                      >
                        Browse the full catalog →
                      </button>
                    ) : null}
                  </form>
                ) : (
                  <div className="hero-slide-actions">
                    <Link to={slide.ctaTo} className="hero-slide-cta" tabIndex={isActive ? 0 : -1}>
                      {slide.ctaLabel}
                    </Link>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        className="hero-slideshow-arrow hero-slideshow-arrow-prev"
        onClick={goPrev}
        aria-label="Previous slide"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        className="hero-slideshow-arrow hero-slideshow-arrow-next"
        onClick={goNext}
        aria-label="Next slide"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="hero-slideshow-dots" role="tablist" aria-label="Slide navigation">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Go to slide ${index + 1}`}
            className={`hero-slideshow-dot${index === activeIndex ? " is-active" : ""}`}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </section>
  );
}

export default HeroSlideshow;
