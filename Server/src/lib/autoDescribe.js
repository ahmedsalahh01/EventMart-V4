// Category-specific opening sentence templates
const CATEGORY_OPENERS = {
  sound: (name) =>
    `${name} delivers professional-grade audio for events that demand crisp, powerful sound coverage.`,
  lighting: (name) =>
    `${name} brings dynamic lighting that transforms any venue into an immersive, visually striking event space.`,
  merch: (name) =>
    `${name} is a branded merchandise item designed to elevate your event presence and leave a lasting impression on guests.`,
  giveaways: (name) =>
    `${name} makes the perfect event giveaway — memorable, practical, and easy to customize for any occasion.`,
  woodwork: (name) =>
    `${name} is a premium woodwork piece that adds polished structure and elegance to event staging and décor.`,
  stage: (name) =>
    `${name} provides solid, professional staging support to anchor your event setup from the ground up.`,
  screen: (name) =>
    `${name} delivers sharp, high-visibility display capabilities for presentations, live feeds, and event content.`,
};

// Normalize a raw category/subcategory string to a lookup key
function normalizeCatKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z]/g, "");
}

// Resolve the first matching opener by checking category then subcategory
function resolveOpener(category, subcategory) {
  const catKey = normalizeCatKey(category);
  const subKey = normalizeCatKey(subcategory);

  for (const key of Object.keys(CATEGORY_OPENERS)) {
    if (catKey.includes(key) || subKey.includes(key)) {
      return CATEGORY_OPENERS[key];
    }
  }

  return null;
}

// Format event_type slug into a readable label (e.g. "private-party" → "private parties")
function formatEventLabel(eventType) {
  if (!eventType) return null;
  return eventType
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generates a product description from its stored attributes.
 * Returns an empty string if there is not enough data to produce a meaningful sentence.
 *
 * @param {object} product - A product row from the DB (snake_case fields)
 * @returns {string}
 */
function generateAutoDescription(product) {
  const {
    name,
    category,
    subcategory,
    event_type,
    quality,
    quality_points,
    customizable,
    buy_enabled,
    rent_enabled,
    venue_type,
    tags,
  } = product;

  if (!name) return "";

  const parts = [];
  const qPoints = Array.isArray(quality_points) ? quality_points : [];
  const tagArr = Array.isArray(tags) ? tags : [];
  const eventLabel = formatEventLabel(event_type);

  // 1. Opening sentence — prefer the quality field if it's descriptive enough
  if (quality && quality.length >= 30) {
    parts.push(`${name} — ${quality.replace(/\.$/, "")}.`);
  } else {
    const openerFn = resolveOpener(category, subcategory);
    if (openerFn) {
      parts.push(openerFn(name));
    } else {
      const fallbackCat = subcategory || category || "equipment";
      parts.push(
        `${name} is a ${fallbackCat.toLowerCase()} product built for ${eventLabel ? `${eventLabel} events` : "professional events"}.`
      );
    }
  }

  // 2. Key features from quality_points (max 3)
  const meaningfulPoints = qPoints
    .map((p) => String(p).trim())
    .filter((p) => p.length > 3)
    .slice(0, 3);

  if (meaningfulPoints.length >= 2) {
    parts.push(`Key features include ${meaningfulPoints.join(", ")}.`);
  } else if (meaningfulPoints.length === 1) {
    parts.push(`Features: ${meaningfulPoints[0]}.`);
  }

  // 3. Event type targeting
  if (eventLabel) {
    parts.push(`Ideal for ${eventLabel} events.`);
  }

  // 4. Venue compatibility
  if (venue_type && venue_type !== "hybrid" && venue_type.length > 2) {
    const venueLabel = venue_type.charAt(0).toUpperCase() + venue_type.slice(1);
    parts.push(`${venueLabel}-venue compatible.`);
  }

  // 5. Availability mode
  const modes = [];
  if (buy_enabled) modes.push("purchase");
  if (rent_enabled) modes.push("rental");

  if (modes.length === 2) {
    parts.push("Available for both purchase and rental.");
  } else if (modes.length === 1) {
    parts.push(`Available for ${modes[0]}.`);
  }

  // 6. Customization
  if (customizable) {
    parts.push("Supports custom branding and personalization for your event.");
  }

  return parts.join(" ");
}

module.exports = { generateAutoDescription };
