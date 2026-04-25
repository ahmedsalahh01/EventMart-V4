import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/shop/ProductCard";
import { resolveEventType } from "../lib/eventTypeConfig";
import { rankProductsForEventType } from "../lib/recommendationEngine";
import { trackCategoryView, trackEventTypeSelection, trackProductView } from "../lib/userBehavior";
import { bumpMetric, getMode, loadProducts, metricScore } from "../lib/products";
import "./../styles/shop.css";

const PRIMARY_CATEGORIES = ["Lighting", "Sound", "Stage", "Furniture"];
const EVENT_TYPES = ["Wedding", "Corporate", "Birthday", "Conference", "Concert", "Festival"];

function normalizeQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function tokenize(value) {
  return normalizeQuery(value).split(/\s+/).filter(Boolean);
}

function searchHaystack(product) {
  return [
    product.name,
    product.product_id,
    product.description,
    product.category,
    product.subcategory,
    Array.isArray(product.tags) ? product.tags.join(" ") : "",
    product.event_type,
    product.venue_type
  ].filter(Boolean).join(" ").toLowerCase();
}

function matchesSearch(product, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return true;
  const hay = searchHaystack(product);
  return tokens.every((token) => hay.includes(token));
}

function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeEventType = resolveEventType(searchParams.get("eventType"));

  const selectedCategory = searchParams.get("category") || "ALL";
  const selectedMode = searchParams.get("mode") || "ALL";
  const selectedEventType = searchParams.get("eventType") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const sortMode = searchParams.get("sort") || "featured";
  const searchQuery = searchParams.get("search") || "";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(searchQuery);

  useEffect(() => { setSearchInput(searchQuery); }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadProducts().then((rows) => {
      if (cancelled) return;
      setProducts(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activeEventType) trackEventTypeSelection(activeEventType, { source: "shop-query" });
  }, [activeEventType]);

  useEffect(() => {
    if (selectedCategory !== "ALL") trackCategoryView(selectedCategory, { source: "shop-filter" });
  }, [selectedCategory]);

  function updateParams(updates) {
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

  function handleSearchSubmit(event) {
    event.preventDefault();
    updateParams({ search: searchInput.trim() });
  }

  function clearAllFilters() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  const allCategories = useMemo(() => {
    const fromData = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    const merged = [...PRIMARY_CATEGORIES];
    fromData.forEach((cat) => { if (!merged.includes(cat)) merged.push(cat); });
    return merged;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const min = Number(minPrice) || 0;
    const max = Number(maxPrice) || Infinity;

    const next = products.filter((product) => {
      if (product.active === false) return false;
      if (selectedCategory !== "ALL" && product.category !== selectedCategory) return false;
      if (selectedMode !== "ALL" && getMode(product) !== selectedMode) return false;
      if (selectedEventType && product.event_type && product.event_type.toLowerCase() !== selectedEventType.toLowerCase()) return false;
      if (!matchesSearch(product, searchQuery)) return false;
      const price = Number(product.startingPrice || 0);
      if (price < min || price > max) return false;
      return true;
    });

    if (sortMode === "low") return next.sort((a, b) => a.startingPrice - b.startingPrice);
    if (sortMode === "high") return next.sort((a, b) => b.startingPrice - a.startingPrice);
    if (sortMode === "name") return next.sort((a, b) => a.name.localeCompare(b.name));

    if (activeEventType) {
      return rankProductsForEventType(next, activeEventType, { mode: selectedMode === "ALL" ? "" : selectedMode });
    }
    return next.sort((a, b) => metricScore(b.id) - metricScore(a.id) || a.name.localeCompare(b.name));
  }, [products, selectedCategory, selectedMode, selectedEventType, minPrice, maxPrice, searchQuery, sortMode, activeEventType]);

  function trackOpen(product) {
    bumpMetric(product.id, "product_view", 1);
    trackProductView(product, { category: product.category, eventType: activeEventType });
  }

  const hasActiveFilters = selectedCategory !== "ALL" || selectedMode !== "ALL" || selectedEventType
    || minPrice || maxPrice || searchQuery;

  return (
    <motion.div
      className="shop-v2"
      data-theme-scope="shop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <header className="shop-v2-header">
        <div className="shop-v2-header-inner">
          <div className="shop-v2-titleblock">
            <h1>Shop</h1>
            <p>Browse equipment for your event</p>
          </div>

          <form className="shop-v2-search" onSubmit={handleSearchSubmit} role="search">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search lighting, sound, stage..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search products"
            />
            <button type="submit" className="shop-v2-search-btn">Search</button>
          </form>
        </div>

        <nav className="shop-v2-catnav" aria-label="Browse categories">
          <button
            type="button"
            className={`shop-v2-catpill${selectedCategory === "ALL" ? " is-active" : ""}`}
            onClick={() => updateParams({ category: "ALL" })}
          >
            All
          </button>
          {allCategories.map((category) => (
            <button
              key={category}
              type="button"
              className={`shop-v2-catpill${selectedCategory === category ? " is-active" : ""}`}
              onClick={() => updateParams({ category })}
            >
              {category}
            </button>
          ))}
        </nav>
      </header>

      <div className="shop-v2-layout">
        <aside className={`shop-v2-sidebar${filtersOpen ? " is-open" : ""}`} aria-label="Filters">
          <div className="shop-v2-sidebar-head">
            <h2>Filters</h2>
            {hasActiveFilters ? (
              <button type="button" className="shop-v2-clear" onClick={clearAllFilters}>Clear all</button>
            ) : null}
          </div>

          <section className="shop-v2-filter-group">
            <h3>Category</h3>
            <div className="shop-v2-radio-list">
              <label>
                <input
                  type="radio"
                  name="category"
                  checked={selectedCategory === "ALL"}
                  onChange={() => updateParams({ category: "ALL" })}
                />
                <span>All categories</span>
              </label>
              {allCategories.map((category) => (
                <label key={category}>
                  <input
                    type="radio"
                    name="category"
                    checked={selectedCategory === category}
                    onChange={() => updateParams({ category })}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="shop-v2-filter-group">
            <h3>Price range (EGP)</h3>
            <div className="shop-v2-price-row">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Min"
                value={minPrice}
                onChange={(event) => updateParams({ minPrice: event.target.value })}
              />
              <span>-</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Max"
                value={maxPrice}
                onChange={(event) => updateParams({ maxPrice: event.target.value })}
              />
            </div>
          </section>

          <section className="shop-v2-filter-group">
            <h3>Event type</h3>
            <select
              value={selectedEventType}
              onChange={(event) => updateParams({ eventType: event.target.value })}
            >
              <option value="">Any event</option>
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type.toLowerCase()}>{type}</option>
              ))}
            </select>
          </section>

          <section className="shop-v2-filter-group">
            <h3>Mode</h3>
            <div className="shop-v2-radio-list">
              {[
                { value: "ALL", label: "Buy or rent" },
                { value: "RENT_ONLY", label: "Rent only" },
                { value: "BUY_ONLY", label: "Buy only" },
                { value: "BOTH", label: "Buy and rent" }
              ].map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="mode"
                    checked={selectedMode === option.value}
                    onChange={() => updateParams({ mode: option.value })}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="shop-v2-filter-group">
            <h3>Sort by</h3>
            <select
              value={sortMode}
              onChange={(event) => updateParams({ sort: event.target.value === "featured" ? "" : event.target.value })}
            >
              <option value="featured">Recommended</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
              <option value="name">Name: A-Z</option>
            </select>
          </section>
        </aside>

        <main className="shop-v2-main">
          <div className="shop-v2-toolbar">
            <button
              type="button"
              className="shop-v2-filter-toggle"
              onClick={() => setFiltersOpen((current) => !current)}
              aria-expanded={filtersOpen}
            >
              {filtersOpen ? "Hide filters" : "Show filters"}
            </button>
            <p className="shop-v2-results-count">
              {loading
                ? "Loading..."
                : `${filteredProducts.length} ${filteredProducts.length === 1 ? "item" : "items"}${searchQuery ? ` for "${searchQuery}"` : ""}`}
            </p>
          </div>

          {loading ? (
            <div className="shop-v2-empty">Loading products...</div>
          ) : filteredProducts.length ? (
            <div className="shop-v2-grid" aria-label="Products">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={trackOpen} />
              ))}
            </div>
          ) : (
            <div className="shop-v2-empty">
              <h3>No items match your filters</h3>
              <p>Try clearing some filters or searching for a different keyword.</p>
              {hasActiveFilters ? (
                <button type="button" className="shop-v2-clear" onClick={clearAllFilters}>Clear all filters</button>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </motion.div>
  );
}

export default ShopPage;
