import { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "./shop/ProductCard";

const GAP = 22;
const INTERVAL_MS = 4000;

function getColumns(width) {
  if (width >= 1024) return 3;
  if (width >= 640)  return 2;
  return 1;
}

function FeaturedCarousel({ products }) {
  const viewportRef = useRef(null);
  const trackRef    = useRef(null);
  const timerRef    = useRef(null);

  const [index,    setIndex]    = useState(0);
  const [step,     setStep]     = useState(0);
  const [cols,     setCols]     = useState(3);
  const [paused,   setPaused]   = useState(false);

  const total    = products.length;
  const maxIndex = Math.max(0, total - cols);

  // Measure slide width from the live DOM so resize is handled correctly
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

  // Clamp index when cols / product count changes
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, total - cols)));
  }, [cols, total]);

  const go = useCallback((next) => {
    setIndex(Math.max(0, Math.min(next, maxIndex)));
  }, [maxIndex]);

  const advance = useCallback(() => {
    setIndex((i) => (i >= maxIndex ? 0 : i + 1));
  }, [maxIndex]);

  function startTimer() {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, INTERVAL_MS);
  }

  useEffect(() => {
    if (!paused) startTimer();
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [paused, advance]);

  function handlePrev() {
    go(index <= 0 ? maxIndex : index - 1);
    startTimer();
  }

  function handleNext() {
    go(index >= maxIndex ? 0 : index + 1);
    startTimer();
  }

  if (!products.length) return null;

  // If all products fit without scrolling, render a plain grid
  if (total <= cols) {
    return (
      <div className="fc-static-grid" style={{ "--fc-cols": cols }}>
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    );
  }

  const translateX = index * step;
  const slideStyle = { flexBasis: step > 0 ? `${step - GAP}px` : undefined };

  return (
    <div
      className="fc-wrapper"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Left arrow */}
      <button
        className="fc-arrow fc-arrow--left"
        aria-label="Previous"
        onClick={handlePrev}
        disabled={total <= cols}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Viewport — clips the track */}
      <div className="fc-viewport" ref={viewportRef}>
        <div
          className="fc-track"
          ref={trackRef}
          style={{ transform: `translateX(-${translateX}px)` }}
        >
          {products.map((p) => (
            <div className="fc-slide" key={p.id} style={slideStyle}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>

      {/* Right arrow */}
      <button
        className="fc-arrow fc-arrow--right"
        aria-label="Next"
        onClick={handleNext}
        disabled={total <= cols}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dot indicators */}
      <div className="fc-dots" role="tablist" aria-label="Featured items navigation">
        {Array.from({ length: maxIndex + 1 }, (_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === index}
            aria-label={`Go to slide ${i + 1}`}
            className={`fc-dot${i === index ? " fc-dot--active" : ""}`}
            onClick={() => { go(i); startTimer(); }}
          />
        ))}
      </div>
    </div>
  );
}

export default FeaturedCarousel;
