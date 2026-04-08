import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EventTypeShopHeading from "../components/EventTypeShopHeading";
import ProductCard from "../components/shop/ProductCard";
import { buildEventTypeShopPath, getEventTypeConfig, resolveEventType } from "../lib/eventTypeConfig";
import { matchCategoryLabelToKey, getCategoryKey } from "../lib/productRuleEngine";
import { rankProductsForEventType } from "../lib/recommendationEngine";
import { trackCategoryView, trackEventTypeSelection, trackProductView } from "../lib/userBehavior";
import {
  bumpMetric,
  getMode,
  loadProducts,
  metricScore
} from "../lib/products";
import "./../styles/shop.css";

const FEATURED_RAIL_CYCLE_MS = 2000;
const FEATURED_RAIL_SCROLL_MS = 650;
const FEATURED_RAIL_MAX_ITEMS = 8;
const FEATURED_RAIL_AUTOPLAY_MIN_PRODUCTS = 5;
const RELATED_RESULTS_LIMIT = 6;

function getFeaturedRailVisibleCount(width) {
  const safeWidth = Number(width || 0);

  if (safeWidth >= 1760) return 5;
  if (safeWidth >= 1440) return 4;
  if (safeWidth >= 1080) return 3;
  if (safeWidth >= 720) return 2;
  return 1;
}

function normalizeSearchQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function tokenizeSearchQuery(value) {
  return normalizeSearchQuery(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function extractSearchWords(value) {
  return normalizeSearchQuery(value)
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function getProductSearchProfile(product) {
  const name = normalizeSearchQuery(product?.name);
  const productId = normalizeSearchQuery(product?.product_id);
  const description = normalizeSearchQuery(product?.description);
  const category = normalizeSearchQuery(product?.category);
  const subcategory = normalizeSearchQuery(product?.subcategory);
  const tags = normalizeSearchQuery(Array.isArray(product?.tags) ? product.tags.join(" ") : "");
  const eventType = normalizeSearchQuery(product?.event_type);
  const venueType = normalizeSearchQuery(product?.venue_type);
  const deliveryClass = normalizeSearchQuery(product?.delivery_class);

  return {
    category,
    categoryWords: extractSearchWords(category),
    deliveryClass,
    description,
    eventType,
    haystack: [name, productId, description, category, subcategory, tags, eventType, venueType, deliveryClass].filter(Boolean).join(" "),
    name,
    nameWords: extractSearchWords(name),
    productId,
    subcategory,
    subcategoryWords: extractSearchWords(subcategory),
    tags,
    tagsWords: extractSearchWords(tags),
    venueType
  };
}

function matchesProductSearch(product, query) {
  const tokens = tokenizeSearchQuery(query);
  if (!tokens.length) return true;

  const profile = getProductSearchProfile(product);
  return tokens.every((token) => profile.haystack.includes(token));
}

function scoreRelatedProduct(product, query) {
  const normalizedQuery = normalizeSearchQuery(query);
  const tokens = tokenizeSearchQuery(query);

  if (!normalizedQuery || !tokens.length) {
    return 0;
  }

  const profile = getProductSearchProfile(product);
  let score = 0;

  if (profile.name === normalizedQuery) score += 220;
  if (profile.name.includes(normalizedQuery)) score += 120;
  if (profile.subcategory.includes(normalizedQuery)) score += 88;
  if (profile.category.includes(normalizedQuery)) score += 82;
  if (profile.tags.includes(normalizedQuery)) score += 76;
  if (profile.description.includes(normalizedQuery)) score += 34;

  tokens.forEach((token) => {
    if (profile.productId.includes(token)) score += 48;
    if (profile.nameWords.some((word) => word === token)) score += 44;
    else if (profile.nameWords.some((word) => word.startsWith(token))) score += 34;
    else if (profile.name.includes(token)) score += 24;

    if (profile.subcategoryWords.some((word) => word === token)) score += 22;
    else if (profile.subcategory.includes(token)) score += 16;

    if (profile.categoryWords.some((word) => word === token)) score += 20;
    else if (profile.category.includes(token)) score += 14;

    if (profile.tagsWords.some((word) => word === token)) score += 20;
    else if (profile.tags.includes(token)) score += 14;

    if (profile.eventType.includes(token)) score += 10;
    if (profile.venueType.includes(token)) score += 8;
    if (profile.deliveryClass.includes(token)) score += 8;
    if (profile.description.includes(token)) score += 6;
  });

  return score;
}

function buildCategoryChips(categories, eventType) {
  const config = getEventTypeConfig(eventType);
  if (!config) return [];

  return (config.shopQueryMapping?.chipCategoryKeys || [])
    .map((categoryKey) => {
      const matchedLabel = categories.find((label) => matchCategoryLabelToKey(label, categoryKey));
      return matchedLabel
        ? {
            key: categoryKey,
            label: matchedLabel
          }
        : null;
    })
    .filter(Boolean);
}

function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedMode, setSelectedMode] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [rentSearchQuery, setRentSearchQuery] = useState("");
  const [rentSelectedCategory, setRentSelectedCategory] = useState("ALL");
  const [sortMode, setSortMode] = useState("featured");
  const [featuredRailIndex, setFeaturedRailIndex] = useState(0);
  const [featuredRailVisibleCount, setFeaturedRailVisibleCount] = useState(1);
  const featuredRailViewportRef = useRef(null);
  const featuredRailSlideRefs = useRef([]);
  const featuredRailResetTimeoutRef = useRef(null);
  const featuredRailSkipAnimationRef = useRef(false);

  const activeEventType = resolveEventType(searchParams.get("eventType"));
  const requestedSearch = searchParams.get("search") || "";

  useEffect(() => {
    let cancelled = false;

    loadProducts().then((rows) => {
      if (cancelled) return;
      setProducts(rows);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const requestedCategory = searchParams.get("category");
    const requestedMode = searchParams.get("mode");

    if (requestedCategory && products.some((product) => product.category === requestedCategory)) {
      setSelectedCategory(requestedCategory);
    } else {
      setSelectedCategory("ALL");
    }

    if (requestedMode && ["BUY_ONLY", "RENT_ONLY", "BOTH"].includes(requestedMode)) {
      setSelectedMode(requestedMode);
    } else {
      setSelectedMode("ALL");
    }
  }, [products, searchParams]);

  useEffect(() => {
    setSearchQuery(requestedSearch);
  }, [requestedSearch]);

  useEffect(() => {
    if (activeEventType) {
      trackEventTypeSelection(activeEventType, { source: "shop-query" });
    }
  }, [activeEventType]);

  useEffect(() => {
    if (selectedCategory !== "ALL") {
      trackCategoryView(selectedCategory, { source: "shop-filter" });
    }
  }, [selectedCategory]);

  const categories = useMemo(
    () => Array.from(new Set(products.filter((product) => product.active !== false).map((product) => product.category))).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const categoryChips = useMemo(() => buildCategoryChips(categories, activeEventType), [activeEventType, categories]);
  const activeEventConfig = getEventTypeConfig(activeEventType);

  function updateQueryParams(updates) {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "" || value === "ALL") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, { replace: true });
  }

  function handleCategoryChange(nextCategory) {
    setSelectedCategory(nextCategory);
    updateQueryParams({ category: nextCategory });
  }

  function handleModeChange(nextMode) {
    setSelectedMode(nextMode);
    updateQueryParams({ mode: nextMode });
  }

  function handleSearchChange(nextSearch) {
    setSearchQuery(nextSearch);
    updateQueryParams({ search: nextSearch });
  }

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
      const categoryOk = selectedCategory === "ALL" || product.category === selectedCategory;
      const modeOk = selectedMode === "ALL" || getMode(product) === selectedMode;
      const searchOk = matchesProductSearch(product, searchQuery);

      return product.active !== false && categoryOk && modeOk && searchOk;
      }),
    [products, searchQuery, selectedCategory, selectedMode]
  );

  const filteredProducts = useMemo(() => {
    const next = [...visibleProducts];

    if (sortMode === "low") {
      return next.sort((a, b) => a.startingPrice - b.startingPrice);
    }

    if (sortMode === "high") {
      return next.sort((a, b) => b.startingPrice - a.startingPrice);
    }

    if (sortMode === "name") {
      return next.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (activeEventType) {
      return rankProductsForEventType(next, activeEventType, { mode: selectedMode === "ALL" ? "" : selectedMode });
    }

    return next.sort((a, b) => Number(b.featured) - Number(a.featured) || metricScore(b.id) - metricScore(a.id));
  }, [activeEventType, selectedMode, sortMode, visibleProducts]);

  const relatedProducts = useMemo(() => {
    const normalizedQuery = normalizeSearchQuery(searchQuery);
    if (!normalizedQuery || visibleProducts.length > 0) {
      return [];
    }

    const rankedProducts = products
      .filter((product) => product.active !== false)
      .map((product) => ({
        product,
        score: scoreRelatedProduct(product, normalizedQuery)
      }))
      .sort((left, right) => (
        right.score - left.score
        || Number(right.product.featured) - Number(left.product.featured)
        || metricScore(right.product.id) - metricScore(left.product.id)
        || left.product.name.localeCompare(right.product.name)
      ));

    const scoredProducts = rankedProducts.filter((entry) => entry.score > 0);
    const fallbackProducts = rankedProducts.filter((entry) => entry.score === 0);
    const nextEntries = scoredProducts.length
      ? scoredProducts.slice(0, RELATED_RESULTS_LIMIT)
      : fallbackProducts.slice(0, RELATED_RESULTS_LIMIT);

    return nextEntries.map((entry) => entry.product);
  }, [products, searchQuery, visibleProducts.length]);

  const featuredRailProducts = useMemo(
    () =>
      visibleProducts
        .filter((product) => product.featured)
        .sort((left, right) => metricScore(right.id) - metricScore(left.id) || left.name.localeCompare(right.name))
        .slice(0, FEATURED_RAIL_MAX_ITEMS),
    [visibleProducts]
  );
  const featuredRailCount = featuredRailProducts.length;
  const featuredRailMaxIndex = Math.max(0, featuredRailCount - featuredRailVisibleCount);
  const shouldUseFeaturedCarousel =
    featuredRailCount >= FEATURED_RAIL_AUTOPLAY_MIN_PRODUCTS &&
    featuredRailMaxIndex > 0;
  const featuredRailStartIndex = shouldUseFeaturedCarousel ? featuredRailVisibleCount : 0;
  const featuredRailLoopProducts = useMemo(() => {
    if (!shouldUseFeaturedCarousel) {
      return featuredRailProducts;
    }

    return [
      ...featuredRailProducts.slice(-featuredRailVisibleCount),
      ...featuredRailProducts,
      ...featuredRailProducts.slice(0, featuredRailVisibleCount)
    ];
  }, [featuredRailProducts, featuredRailVisibleCount, shouldUseFeaturedCarousel]);

  const sellableProducts = useMemo(
    () => filteredProducts.filter((product) => product.buy_enabled),
    [filteredProducts]
  );

  const rentableProducts = useMemo(
    () => filteredProducts.filter((product) => product.rent_enabled),
    [filteredProducts]
  );

  const rentableCategories = useMemo(
    () => Array.from(new Set(rentableProducts.map((product) => product.category))).sort((a, b) => a.localeCompare(b)),
    [rentableProducts]
  );

  useEffect(() => {
    if (rentSelectedCategory === "ALL") return;
    if (rentableCategories.includes(rentSelectedCategory)) return;
    setRentSelectedCategory("ALL");
  }, [rentSelectedCategory, rentableCategories]);

  useEffect(() => {
    function updateFeaturedRailLayout() {
      const widthBasis = typeof window !== "undefined" ? window.innerWidth : 0;
      setFeaturedRailVisibleCount(getFeaturedRailVisibleCount(widthBasis));
    }

    updateFeaturedRailLayout();

    window.addEventListener("resize", updateFeaturedRailLayout);

    return () => {
      window.removeEventListener("resize", updateFeaturedRailLayout);
    };
  }, []);

  useEffect(() => {
    if (!shouldUseFeaturedCarousel) {
      window.clearTimeout(featuredRailResetTimeoutRef.current);
      featuredRailSkipAnimationRef.current = true;
      setFeaturedRailIndex(0);
      if (featuredRailViewportRef.current) {
        featuredRailViewportRef.current.scrollTo({ left: 0, behavior: "auto" });
      }
    } else {
      featuredRailSkipAnimationRef.current = true;
      setFeaturedRailIndex((current) => {
        if (current < featuredRailVisibleCount || current >= featuredRailCount + featuredRailVisibleCount) {
          return featuredRailStartIndex;
        }

        return current;
      });
    }
  }, [featuredRailCount, featuredRailMaxIndex, featuredRailStartIndex, featuredRailVisibleCount, shouldUseFeaturedCarousel]);

  useEffect(() => {
    featuredRailSlideRefs.current = [];
    featuredRailSkipAnimationRef.current = true;
    setFeaturedRailIndex(shouldUseFeaturedCarousel ? featuredRailStartIndex : 0);
  }, [featuredRailProducts, featuredRailStartIndex, shouldUseFeaturedCarousel]);

  useEffect(() => {
    if (!shouldUseFeaturedCarousel) return undefined;

    const intervalId = window.setInterval(() => {
      setFeaturedRailIndex((current) => current + 1);
    }, FEATURED_RAIL_CYCLE_MS);

    return () => window.clearInterval(intervalId);
  }, [shouldUseFeaturedCarousel]);

  useEffect(() => {
    const viewport = featuredRailViewportRef.current;
    const slide = featuredRailSlideRefs.current[featuredRailIndex];

    if (!viewport || !slide) return undefined;

    viewport.scrollTo({
      left: slide.offsetLeft,
      behavior: featuredRailSkipAnimationRef.current ? "auto" : "smooth"
    });
    featuredRailSkipAnimationRef.current = false;

    window.clearTimeout(featuredRailResetTimeoutRef.current);

    if (!shouldUseFeaturedCarousel) {
      return undefined;
    }

    if (featuredRailIndex >= featuredRailCount + featuredRailVisibleCount) {
      featuredRailResetTimeoutRef.current = window.setTimeout(() => {
        featuredRailSkipAnimationRef.current = true;
        setFeaturedRailIndex(featuredRailStartIndex);
      }, FEATURED_RAIL_SCROLL_MS);
    } else if (featuredRailIndex < featuredRailVisibleCount) {
      featuredRailResetTimeoutRef.current = window.setTimeout(() => {
        featuredRailSkipAnimationRef.current = true;
        setFeaturedRailIndex(featuredRailIndex + featuredRailCount);
      }, FEATURED_RAIL_SCROLL_MS);
    }

    return () => window.clearTimeout(featuredRailResetTimeoutRef.current);
  }, [featuredRailCount, featuredRailIndex, featuredRailStartIndex, featuredRailVisibleCount, shouldUseFeaturedCarousel]);

  const filteredRentableProducts = useMemo(() => {
    const next = rentableProducts.filter((product) => {
      const categoryOk = rentSelectedCategory === "ALL" || product.category === rentSelectedCategory;
      const searchOk = matchesProductSearch(product, rentSearchQuery);
      return categoryOk && searchOk;
    });

    return activeEventType && sortMode === "featured" ? rankProductsForEventType(next, activeEventType, { mode: "rent" }) : next;
  }, [activeEventType, rentSearchQuery, rentSelectedCategory, rentableProducts, sortMode]);

  const hasVisibleProducts = sellableProducts.length > 0 || rentableProducts.length > 0;
  const browseInfo = `Browse ${products.length} products across ${categories.length} categories`;

  function trackOpen(product) {
    bumpMetric(product.id, "product_view", 1);
    trackProductView(product, {
      category: selectedCategory === "ALL" ? product.category : selectedCategory,
      eventType: activeEventType
    });
  }

  function handleFeaturedRailPrev() {
    if (!shouldUseFeaturedCarousel) return;
    setFeaturedRailIndex((current) => current - 1);
  }

  function handleFeaturedRailNext() {
    if (!shouldUseFeaturedCarousel) return;
    setFeaturedRailIndex((current) => current + 1);
  }

  return (
    <motion.div className="shop-page-shell" data-theme-scope="shop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <main className="shop-page">
        <section className="shop-header">
          <EventTypeShopHeading
            activeCategoryKey={selectedCategory === "ALL" ? "all" : getCategoryKey(selectedCategory)}
            browseInfo={browseInfo}
            categoryChips={categoryChips}
            clearHref="/shop"
            eventType={activeEventType}
            onCategorySelect={(chip) => handleCategoryChange(chip.label)}
            productCount={filteredProducts.length}
            shopHref={buildEventTypeShopPath(activeEventType)}
            showClear={Boolean(activeEventType)}
          />
        </section>

        <section className="shop-filters" aria-label="Product filters">
          <label className="search-wrap" htmlFor="searchInput">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input id="searchInput" type="search" placeholder="Search products..." value={searchQuery} onChange={(event) => handleSearchChange(event.target.value)} />
          </label>

          <div className="filter-selects">
            <select value={selectedCategory} aria-label="Filter by category" onChange={(event) => handleCategoryChange(event.target.value)}>
              <option value="ALL">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select value={selectedMode} aria-label="Filter by mode" onChange={(event) => handleModeChange(event.target.value)}>
              <option value="ALL">All</option>
              <option value="BUY_ONLY">Buy Only</option>
              <option value="RENT_ONLY">Rent Only</option>
              <option value="BOTH">Buy / Rent</option>
            </select>

            <select value={sortMode} aria-label="Sort products" onChange={(event) => setSortMode(event.target.value)}>
              <option value="featured">{activeEventType ? "Best Event Match" : "Featured"}</option>
              <option value="name">Name: A - Z</option>
              <option value="low">Price: Low to High</option>
              <option value="high">Price: High to Low</option>
            </select>
          </div>
        </section>

        {featuredRailProducts.length ? (
          <section className="smart-recommendation-bar shop-smart-rail" aria-labelledby="shop-featured-products-title">
            <div className="smart-recommendation-head">
              <div>
                <h2 id="shop-featured-products-title">
                  {activeEventConfig ? `Featured Products for ${activeEventConfig.label}` : "Featured Products"}
                </h2>
                <p className="smart-recommendation-copy">
                  {activeEventConfig
                    ? `Featured catalog picks for ${activeEventConfig.label}.`
                    : "Highlighted products from the catalog right now."}
                </p>
              </div>
            </div>

            <div
              className={`shop-smart-rail-carousel${shouldUseFeaturedCarousel ? " has-controls" : ""}`}
              style={{ "--shop-smart-rail-columns": Math.max(1, featuredRailVisibleCount) }}
            >
              {shouldUseFeaturedCarousel ? (
                <button
                  aria-label="Show previous featured products"
                  className="shop-smart-rail-arrow is-left"
                  onClick={handleFeaturedRailPrev}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}

              <div className={`shop-smart-rail-viewport${shouldUseFeaturedCarousel ? "" : " is-static"}`} ref={featuredRailViewportRef}>
                <div className={`shop-smart-rail-window${shouldUseFeaturedCarousel ? "" : " is-static"}`}>
                  {featuredRailLoopProducts.map((product, index) => (
                    <div
                      key={`${product.id}-${index}`}
                      className="shop-smart-rail-slide"
                      ref={(node) => {
                        featuredRailSlideRefs.current[index] = node;
                      }}
                    >
                      <ProductCard
                        product={product}
                        onOpen={trackOpen}
                        isFeatured
                      />
                    </div>
                  ))}
                </div>
              </div>

              {shouldUseFeaturedCarousel ? (
                <button
                  aria-label="Show next featured products"
                  className="shop-smart-rail-arrow is-right"
                  onClick={handleFeaturedRailNext}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <p className="results-text">
          {searchQuery.trim()
            ? `${filteredProducts.length} result${filteredProducts.length === 1 ? "" : "s"} for "${searchQuery.trim()}"`
            : `${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"} found`}
        </p>
        {hasVisibleProducts ? (
          <>
            {sellableProducts.length ? (
              <section className="products-grid" aria-label="Sellable products list">
                {sellableProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpen={trackOpen}
                    isFeatured={Boolean(product.featured)}
                  />
                ))}
              </section>
            ) : null}

            {rentableProducts.length ? (
              <section className="shop-products-section" aria-labelledby="rentable-products-heading">
                <div className="shop-products-section-head">
                  <div className="shop-products-section-copy">
                    <h2 id="rentable-products-heading">Short use, Rent Now.</h2>
                    <p>
                      {filteredRentableProducts.length} rentable item{filteredRentableProducts.length === 1 ? "" : "s"} available
                    </p>
                  </div>

                  <div className="shop-products-section-tools">
                    <div className="filter-selects shop-section-filters">
                      <select
                        value={rentSelectedCategory}
                        aria-label="Filter rentable items by category"
                        onChange={(event) => setRentSelectedCategory(event.target.value)}
                      >
                        <option value="ALL">All Rent Categories</option>
                        {rentableCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="search-wrap shop-section-search" htmlFor="rentSearchInput">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                        <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      <input
                        id="rentSearchInput"
                        type="search"
                        placeholder="Search rentable items..."
                        value={rentSearchQuery}
                        onChange={(event) => setRentSearchQuery(event.target.value)}
                      />
                    </label>
                  </div>
                </div>

                {filteredRentableProducts.length ? (
                  <div className="products-grid" aria-label="Rentable products list">
                    {filteredRentableProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onOpen={trackOpen}
                        isFeatured={Boolean(product.featured)}
                      />
                    ))}
                  </div>
                ) : (
                  <article className="empty-card">
                    <h3>No rentable items found</h3>
                    <p>Try a different search or rent category.</p>
                  </article>
                )}
              </section>
            ) : null}
          </>
        ) : (
          <>
            <article className="empty-card">
              <h3>{searchQuery.trim() ? `Item not found for "${searchQuery.trim()}"` : "No products found"}</h3>
              <p>
                {searchQuery.trim()
                  ? "Try another keyword, or browse the related items below from the current catalog."
                  : "Try changing filters, or add products from the Admin page."}
              </p>
            </article>

            {searchQuery.trim() && relatedProducts.length ? (
              <section className="shop-related-results" aria-labelledby="related-results-heading">
                <div className="shop-related-results-head">
                  <h2 id="related-results-heading">Related items</h2>
                </div>

                <div className="products-grid" aria-label="Related products list">
                  {relatedProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpen={trackOpen}
                      isFeatured={Boolean(product.featured)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </motion.div>
  );
}

export default ShopPage;
