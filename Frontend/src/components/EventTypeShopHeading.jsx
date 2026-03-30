import { Link } from "react-router-dom";
import { buildEventTypeShopPath, getEventTypeConfig, resolveEventType } from "../lib/eventTypeConfig";

function EventTypeShopHeading({
  activeCategoryKey = "all",
  browseInfo = "",
  categoryChips = [],
  clearHref = "/shop",
  eventType = "",
  onCategorySelect = null,
  productCount = 0,
  shopHref = "",
  showClear = true
}) {
  const resolvedEventType = resolveEventType(eventType);
  const config = getEventTypeConfig(resolvedEventType);

  if (!config) {
    return (
      <section className="event-type-shop-heading">
        <div className="event-type-shop-heading-copy">
          <p className="event-type-shop-kicker">Shop</p>
          <h1>Shop Equipment</h1>
          <p>{browseInfo}</p>
        </div>
      </section>
    );
  }

  const primaryHref = shopHref || buildEventTypeShopPath(resolvedEventType);

  return (
    <section className="event-type-shop-heading">
      <div className="event-type-shop-heading-copy">
        <p className="event-type-shop-kicker">Event Type</p>
        <h1>{config.shopHeading}</h1>
        <p>{config.headingDescription}</p>
        <div className="event-type-shop-summary">
          <span>{productCount} matching product{productCount === 1 ? "" : "s"}</span>
          {browseInfo ? <span>{browseInfo}</span> : null}
        </div>
      </div>

      <div className="event-type-shop-actions">
        <Link to={primaryHref} className="btn-primary btn-fill">
          {config.shopCtaLabel}
        </Link>
        {showClear ? (
          <Link to={clearHref} className="btn-secondary btn-fill">
            Browse Full Shop
          </Link>
        ) : null}
      </div>

      {categoryChips.length ? (
        <div className="event-type-shop-chips" aria-label={`${config.label} category shortcuts`}>
          {categoryChips.map((chip) => (
            <button
              key={chip.key}
              className={`event-type-shop-chip${activeCategoryKey === chip.key ? " is-active" : ""}`}
              onClick={() => onCategorySelect?.(chip)}
              type="button"
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default EventTypeShopHeading;
