import { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "./shop/ProductCard";

const GAP = 22;
const INTERVAL_MS = 4000;
const SLIDESHOW_MIN = 4;

function getColumns(vpWidth) {
  if (vpWidth >= 1024) return 4;
  if (vpWidth >= 640)  return 2;
  return 1;
}

function FeaturedCarousel({ products }) {
  const viewportRef = useRef(null);
  const timerRef    = useRef(null);

  const [index,  setIndex]  = useState(0);
  const [cols,   setCols]   = useState(4);
  const [paused, setPaused] = useState(false);

  const total    = products.length;
  const canSlide = total >= SLIDESHOW_MIN;
  const maxIndex = Math.max(0, total - cols);

  // Read the actual rendered slide width from DOM — no JS calculation needed
  function getStep() {
    const slide = viewportRef.current?.firstElementChild;
    return slide ? slide.offsetWidth + GAP : 0;
  }

  // Scroll viewport to a given index
  const scrollTo = useCallback((idx, smooth = true) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const left = idx * getStep();
    if (smooth) {
      vp.scrollTo({ left, behavior: "smooth" });
    } else {
      vp.scrollLeft = left;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync cols on mount and resize
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return undefined;
    function update() {
      setCols(getColumns(vp.clientWidth));
    }
    const ro = new ResizeObserver(update);
    ro.observe(vp);
    update();
    return () => ro.disconnect();
  }, []);

  // Clamp index when cols / total changes; reposition instantly
  useEffect(() => {
    setIndex((prev) => {
      const clamped = Math.min(prev, Math.max(0, total - cols));
      scrollTo(clamped, false);
      return clamped;
    });
  }, [cols, total, scrollTo]);

  // Keep dots in sync when user swipes / scrolls manually
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return undefined;
    let raf;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const step = getStep();
        if (!step) return;
        const snapped = Math.round(vp.scrollLeft / step);
        setIndex(Math.max(0, Math.min(snapped, maxIndex)));
      });
    }
    vp.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      vp.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [maxIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(() => {
    setIndex((prev) => {
      const next = prev >= maxIndex ? 0 : prev + 1;
      scrollTo(next);
      return next;
    });
  }, [maxIndex, scrollTo]);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, INTERVAL_MS);
  }, [advance]);

  useEffect(() => {
    if (!canSlide || paused) {
      clearInterval(timerRef.current);
      return undefined;
    }
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [canSlide, paused, startTimer]);

  function navigate(idx) {
    setIndex(idx);
    scrollTo(idx);
    startTimer();
  }

  if (!products.length) return null;

  if (!canSlide) {
    return (
      <div className="fc-static-grid" style={{ "--fc-cols": Math.min(total, 3) }}>
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    );
  }

  return (
    <div
      className="fc-wrapper"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        className="fc-arrow fc-arrow--left"
        aria-label="Previous featured items"
        onClick={() => navigate(index <= 0 ? maxIndex : index - 1)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/*
        .fc-viewport is now the flex container — slides are direct children.
        flex-basis % is resolved against fc-viewport's clientWidth (definite block width),
        so CSS alone handles column sizing without any JS measurement.
      */}
      <div className="fc-viewport" ref={viewportRef}>
        {products.map((p) => (
          <div key={p.id} className="fc-slide">
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="fc-arrow fc-arrow--right"
        aria-label="Next featured items"
        onClick={() => navigate(index >= maxIndex ? 0 : index + 1)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className="fc-dots" role="tablist" aria-label="Featured items navigation">
        {Array.from({ length: maxIndex + 1 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Go to position ${i + 1}`}
            className={`fc-dot${i === index ? " fc-dot--active" : ""}`}
            onClick={() => navigate(i)}
          />
        ))}
      </div>
    </div>
  );
}

export default FeaturedCarousel;
