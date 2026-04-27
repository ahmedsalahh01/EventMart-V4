// Attendees range options for the package builder UI
export const ATTENDEES_RANGES = Object.freeze([
  { key: "10-30", label: "10 – 30 guests" },
  { key: "31-50", label: "31 – 50 guests" },
  { key: "51-100", label: "51 – 100 guests" },
  { key: "101-150", label: "101 – 150 guests" },
  { key: "150-250", label: "150 – 250 guests" },
  { key: "300+", label: "300+ guests" }
]);

// Package sections and which builder category keys belong to each
export const PACKAGE_SECTIONS = Object.freeze({
  merch: Object.freeze({ label: "Merch", categoryKeys: Object.freeze(["merch"]) }),
  giveaways: Object.freeze({ label: "Giveaways", categoryKeys: Object.freeze(["giveaways"]) }),
  soundAndLights: Object.freeze({ label: "Sound & Lights", categoryKeys: Object.freeze(["sound", "lighting"]) }),
  screen: Object.freeze({ label: "Screen", categoryKeys: Object.freeze(["screen"]) }),
  customWorkAndStage: Object.freeze({ label: "Custom Work & Stage", categoryKeys: Object.freeze(["woodwork", "stage"]) })
});

// Reverse map: builderCategory key → section key
export const CATEGORY_TO_SECTION = Object.freeze(
  Object.entries(PACKAGE_SECTIONS).reduce((map, [sectionKey, section]) => {
    for (const categoryKey of section.categoryKeys) {
      map[categoryKey] = sectionKey;
    }
    return map;
  }, {})
);

// Event types in the birthday group (separate minimums for some ranges)
const BIRTHDAY_SLUGS = new Set(["birthday"]);

// Minimum quantity matrix per attendees range.
// For 10-30 and 31-50 the same minimums apply for all venue/event types.
// For larger ranges, three groups apply: birthday, outdoor, and other.
// Outdoor events require more sound/lighting and at least one screen for larger crowds.
const MINIMUM_MATRIX = Object.freeze({
  "10-30": Object.freeze({
    merch: 10,
    giveaways: 10,
    soundAndLights: 2,
    screen: 0,
    customWorkAndStage: 0
  }),
  "31-50": Object.freeze({
    merch: 20,
    giveaways: 20,
    soundAndLights: 3,
    screen: 0,
    customWorkAndStage: 0
  }),
  "51-100": Object.freeze({
    birthday: Object.freeze({ merch: 40, giveaways: 40, soundAndLights: 3, screen: 0, customWorkAndStage: 0 }),
    outdoor: Object.freeze({ merch: 30, giveaways: 30, soundAndLights: 6, screen: 1, customWorkAndStage: 0 }),
    other: Object.freeze({ merch: 40, giveaways: 40, soundAndLights: 5, screen: 0, customWorkAndStage: 0 })
  }),
  "101-150": Object.freeze({
    birthday: Object.freeze({ merch: 60, giveaways: 60, soundAndLights: 4, screen: 0, customWorkAndStage: 0 }),
    outdoor: Object.freeze({ merch: 40, giveaways: 40, soundAndLights: 8, screen: 1, customWorkAndStage: 1 }),
    other: Object.freeze({ merch: 60, giveaways: 60, soundAndLights: 6, screen: 0, customWorkAndStage: 0 })
  }),
  "150-250": Object.freeze({
    birthday: Object.freeze({ merch: 80, giveaways: 80, soundAndLights: 5, screen: 0, customWorkAndStage: 0 }),
    outdoor: Object.freeze({ merch: 50, giveaways: 50, soundAndLights: 10, screen: 2, customWorkAndStage: 1 }),
    other: Object.freeze({ merch: 80, giveaways: 80, soundAndLights: 7, screen: 0, customWorkAndStage: 0 })
  }),
  "300+": Object.freeze({
    birthday: Object.freeze({ merch: 100, giveaways: 100, soundAndLights: 6, screen: 0, customWorkAndStage: 0 }),
    outdoor: Object.freeze({ merch: 60, giveaways: 60, soundAndLights: 12, screen: 2, customWorkAndStage: 2 }),
    other: Object.freeze({ merch: 100, giveaways: 100, soundAndLights: 8, screen: 0, customWorkAndStage: 0 })
  })
});

/**
 * Returns minimum quantity requirements for each package section, or null
 * when the combination is incomplete or unrecognised.
 *
 * venueType: "indoor" | "outdoor" | "hybrid" — outdoor events get higher
 * soundAndLights and screen minimums for larger attendee ranges.
 */
export function getPackageMinimums(venueType, eventType, attendeesRange, matrix = MINIMUM_MATRIX) {
  if (!venueType || !eventType || !attendeesRange) return null;

  const rangeConfig = matrix[attendeesRange];
  if (!rangeConfig) return null;

  // Flat structure — same minimums for all venue/event types in this range
  if (typeof rangeConfig.merch === "number") {
    return { ...rangeConfig };
  }

  // Split structure — birthday / outdoor / other
  const isOutdoor = String(venueType).toLowerCase() === "outdoor";
  const isBirthday = BIRTHDAY_SLUGS.has(String(eventType).toLowerCase());
  const group = isBirthday ? "birthday" : isOutdoor ? "outdoor" : "other";
  return { ...rangeConfig[group] };
}

/**
 * Sums all section minimums into a single total.
 */
export function getTotalMinimum(minimums) {
  if (!minimums) return 0;
  return Object.values(minimums).reduce((sum, qty) => sum + qty, 0);
}

/**
 * Tallies the currently selected quantity per section from the products list
 * and the selections map ({ [productId]: { quantity, ... } }).
 */
export function computeSectionTotals(products, selections) {
  const totals = Object.fromEntries(Object.keys(PACKAGE_SECTIONS).map((k) => [k, 0]));

  for (const product of products) {
    const qty = Number(selections?.[product.id]?.quantity || 0);
    if (qty <= 0) continue;
    const sectionKey = CATEGORY_TO_SECTION[product.builderCategory];
    if (sectionKey !== undefined) {
      totals[sectionKey] += qty;
    }
  }

  return totals;
}

/**
 * Compares current section totals against the required minimums and returns
 * an array of violation objects for every section that falls short.
 * Sections with a minimum of 0 are always considered optional and skipped.
 */
export function validateMinimums(minimums, sectionTotals) {
  if (!minimums) return [];

  const violations = [];

  for (const [sectionKey, required] of Object.entries(minimums)) {
    if (required === 0) continue;
    const actual = Number(sectionTotals?.[sectionKey] || 0);
    if (actual < required) {
      violations.push({
        section: sectionKey,
        label: PACKAGE_SECTIONS[sectionKey]?.label || sectionKey,
        required,
        actual
      });
    }
  }

  return violations;
}
