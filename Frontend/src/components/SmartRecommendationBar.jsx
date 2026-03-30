import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "./shop/ProductCard";
import { getEventTypeConfig, getEventTypeLabel, resolveEventType } from "../lib/eventTypeConfig";
import { loadProducts } from "../lib/products";
import useSmartRecommendations from "../hooks/useSmartRecommendations";
import { trackProductView } from "../lib/userBehavior";

function SmartRecommendationBar({
  cartItems = [],
  className = "",
  currentCategory = "",
  currentEventType = "",
  currentMode = "",
  currentProduct = null,
  ctaLabel = "View All Products",
  ctaTo = "/shop",
  limit = 4,
  products = null,
  showReasons = false,
  subtitle = "",
  title = "Recommended For You"
}) {
  const [catalog, setCatalog] = useState(() => (Array.isArray(products) ? products : []));
  const [isLoading, setIsLoading] = useState(() => !Array.isArray(products));

  useEffect(() => {
    if (Array.isArray(products)) {
      setCatalog(products);
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);

    loadProducts()
      .then((rows) => {
        if (!cancelled) {
          setCatalog(rows);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog([]);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [products]);

  const {
    behavior,
    leadText,
    recommendations
  } = useSmartRecommendations({
    cartItems,
    currentCategory,
    currentEventType,
    currentMode,
    currentProduct,
    limit,
    products: catalog
  });
  const resolvedEventType = resolveEventType(currentEventType) || resolveEventType(behavior.selectedEventType);
  const eventConfig = getEventTypeConfig(resolvedEventType);
  const sectionTitle = eventConfig ? `${title} for ${getEventTypeLabel(resolvedEventType)}` : title;
  const sectionLeadText = subtitle || leadText;

  if (!isLoading && !recommendations.length) {
    return null;
  }

  return (
    <section className={`smart-recommendation-bar ${className}`.trim()} aria-labelledby="smart-recommendation-title">
      <div className="smart-recommendation-head">
        <div>
          <h2 id="smart-recommendation-title">{sectionTitle}</h2>
          <p className="smart-recommendation-copy">{sectionLeadText}</p>
        </div>

        <div className="smart-recommendation-actions">
          <Link to={ctaTo} className="section-link">
            {ctaLabel}
          </Link>
        </div>
      </div>

      {isLoading ? (
        <article className="smart-recommendation-empty">
          <h3>Loading recommendations...</h3>
          <p>We’re matching products to your latest browsing and cart activity.</p>
        </article>
      ) : (
        <div className="smart-recommendation-grid">
          {recommendations.map((entry) => (
            <div key={entry.product.id} className="smart-recommendation-item">
              <ProductCard
                product={entry.product}
                onOpen={(product) => {
                  trackProductView(product, {
                    category: currentCategory,
                    eventType: resolvedEventType
                  });
                }}
                isFeatured={Boolean(entry.product.featured)}
              />
              {showReasons && entry.primaryReason ? (
                <p className="smart-recommendation-why">Why this fits: {entry.primaryReason}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default SmartRecommendationBar;
