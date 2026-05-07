import { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "./shop/ProductCard";

const GAP = 22;
const INTERVAL_MS = 4000;
const SLIDESHOW_MIN = 4;

function getColumns(width) {
  if (width >= 1024) return 3;
  if (width >= 640)  return 2;
  return 1;
}

function FeaturedCarousel({ products }) {
  const viewportRef = useRef(null);
  const timerRef    = useRef(null);

  const [index,  setIndex]  = useState(0);
  const [step,   setStep]   = useState(0);
  const [cols,   setCols]   = useState(3);
  const [paused, setPaused] = useState(false);

  const total    = products.length;
  const canSlide = total >= SLIDESHOW_MIN;
  const maxIndex = Math.max(0, total - cols);

  // Measure slide width from live DOM so resize is handled correctly
  const measure = useCallback(() => {
    const vw = viewportRef.current?.offsetWidth;
    if (!vw) return;
    const c = getColumns(vw);
    setCols(c);
    setStep((vw - (c - 1) * GAP) / c + GAP);
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (viewportRef.current) ro.observe(viewportRef.current);
    measure();
    return () => ro.disconnect();
  }, [measure]);

  // Clamp index when cols or product count changes
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, total - cols)));
  }, [cols, total]);

  const advance = useCallback(() => {
    setIndex((i) => (i >= maxIndex ? 0 : i + 1));
  }, [maxIndex]);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, INTERVAL_MS);
  }, [advance]);

  // Auto-play: only when 4+ items and not paused/hovered
  useEffect(() => {
    if (!canSlide || paused) {
      clearInterval(timerRef.current);
      return undefined;
    }
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [canSlide, paused, startTimer]);

  // Use functional setter so rapid clicks never mis-read stale index
  function handlePrev() {
    setIndex((i) => (i <= 0 ? maxIndex : i - 1));
    startTimer();
  }

  function handleNext() {
    setIndex((i) => (i >= maxIndex ? 0 : i + 1));
    startTimer();
  }

  if (!products.length) return null;

  // Fewer than 4 featured items → plain grid, no carousel
  if (!canSlide) {
    return (
      <div className="fc-static-grid" style={{ "--fc-cols": Math.min(total, 3) }}>
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    );
  }

  const translateX = index * step;
  // Fallback basis before first measurement so cards aren't full-width
  const slideBasis = step > 0 ? `${step - GAP}px` : "calc(33.333% - 15px)";

  return (
    <div
      className="fc-wrapper"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Left arrow */}
      <button
        type="button"
        className="fc-arrow fc-arrow--left"
        aria-label="Previous featured items"
        onClick={handlePrev}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Viewport — clips the scrolling track */}
      <div className="fc-viewport" ref={viewportRef}>
        <div
          className="fc-track"
          style={{ transform: `translateX(-${translateX}px)` }}
        >
          {products.map((p) => (
            <div
              key={p.id}
              className="fc-slide"
              style={{ flexBasis: slideBasis }}
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>

      {/* Right arrow */}
      <button
        type="button"
        className="fc-arrow fc-arrow--right"
        aria-label="Next featured items"
        onClick={handleNext}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Progress bar auto-play indicator */}
      {!paused && (
        <div className="fc-progress" aria-hidden="true">
          <div key={`${index}-${paused}`} className="fc-progress-bar" />
        </div>
      )}

      {/* Dot indicators */}
      <div className="fc-dots" role="tablist" aria-label="Featured items navigation">
        {Array.from({ length: maxIndex + 1 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Go to position ${i + 1}`}
            className={`fc-dot${i === index ? " fc-dot--active" : ""}`}
            onClick={() => { setIndex(i); startTimer(); }}
          />
        ))}
      </div>
    </div>
  );
}

export default FeaturedCarousel;
