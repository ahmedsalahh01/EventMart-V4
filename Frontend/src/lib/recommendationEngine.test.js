import assert from "node:assert/strict";
import {
  buildSmartRecommendationRequestPayload,
  mergeSmartRecommendationResults
} from "./recommendationEngine.js";

function runTest(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
}

const baseProducts = [
  {
    id: "p1",
    name: "Portable Speaker",
    category: "Sound Systems",
    subcategory: "Audio",
    description: "Compact powered speaker for indoor and outdoor use.",
    buy_enabled: true,
    rent_enabled: true,
    buy_price: 500,
    rent_price_per_day: 70,
    currency: "USD",
    featured: true,
    customizable: false,
    quantity_available: 4
  },
  {
    id: "p2",
    name: "Conference Screen",
    category: "Screens",
    subcategory: "Display",
    description: "Presentation-ready screen for conferences and launches.",
    buy_enabled: true,
    rent_enabled: true,
    buy_price: 650,
    rent_price_per_day: 95,
    currency: "USD",
    featured: false,
    customizable: false,
    quantity_available: 2
  },
  {
    id: "p3",
    name: "Branded Welcome Kit",
    category: "Merchandise",
    subcategory: "Merch",
    description: "Customizable giveaway kit for attendees.",
    buy_enabled: true,
    rent_enabled: false,
    buy_price: 40,
    rent_price_per_day: null,
    currency: "USD",
    featured: false,
    customizable: true,
    quantity_available: 20
  }
];

runTest("should build a compact smart recommendation rerank payload", () => {
  const request = buildSmartRecommendationRequestPayload({
    behavior: {
      selectedEventType: "Corporate Events",
      viewedProducts: {
        p1: { count: 2 },
        p2: { count: 1 }
      },
      viewedCategories: {
        "Sound Systems": { count: 2 },
        Screens: { count: 1 }
      },
      modePreference: { buy: 0, rent: 3 },
      venuePreference: { indoor: 2, outdoor: 0 },
      customizablePreference: { observed: 1, selected: 1 }
    },
    cartItems: [
      {
        id: "cart-1",
        name: "Wireless Microphone",
        category: "Sound Systems",
        quantity: 1,
        mode: "rent",
        rent_enabled: true,
        rent_price_per_day: 60
      }
    ],
    currentCategory: "Sound Systems",
    currentMode: "RENT_ONLY",
    limit: 2,
    products: baseProducts
  });

  assert.equal(request.body.eventType, "corporate");
  assert.equal(request.body.modePreference, "rent");
  assert.equal(request.body.candidateProducts.length >= 2, true);
  assert.equal(request.body.candidateProducts[0].id.length > 0, true);
  assert.deepEqual(request.body.viewedProductIds, ["p1", "p2"]);
});

runTest("should merge AI reranking while ignoring unknown product ids", () => {
  const candidateEntries = baseProducts.slice(0, 3).map((product, index) => ({
    badges: [],
    primaryReason: "Deterministic match",
    product,
    reasons: ["Deterministic match"],
    score: 10 - index
  }));
  const merged = mergeSmartRecommendationResults({
    aiResult: {
      recommendedProductIds: ["p2", "unknown", "p3"],
      reasonsByProductId: {
        p2: "Pairs well with presentation-focused browsing.",
        p3: "Useful branded add-on for attendee kits."
      }
    },
    candidateEntries,
    limit: 3
  });

  assert.deepEqual(
    merged.map((entry) => entry.product.id),
    ["p2", "p3", "p1"]
  );
  assert.equal(merged[0].primaryReason, "Pairs well with presentation-focused browsing.");
});
