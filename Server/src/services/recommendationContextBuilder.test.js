const assert = require("node:assert/strict");
const {
  buildFallbackSmartRecommendationResponse,
  normalizeSmartRecommendationRequest
} = require("./recommendationContextBuilder");

function runTest(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
}

runTest("should normalize smart recommendation requests and resolve event type aliases", () => {
  const request = normalizeSmartRecommendationRequest({
    eventType: "Corporate Events",
    viewedProductIds: ["p1", "p1", "p2"],
    viewedCategories: ["Sound Systems", "Screens"],
    modePreference: "rent",
    candidateProducts: [
      {
        id: "p10",
        name: "Presentation Screen",
        category: "Screens",
        subcategory: "LED",
        price: 180,
        inStock: true
      }
    ]
  });

  assert.equal(request.eventType, "corporate");
  assert.deepEqual(request.viewedProductIds, ["p1", "p2"]);
  assert.equal(request.candidateProducts.length, 1);
  assert.equal(request.candidateProducts[0].id, "p10");
});

runTest("should build fallback smart recommendation responses from in-stock candidates only", () => {
  const response = buildFallbackSmartRecommendationResponse({
    eventType: "birthday",
    modePreference: "buy",
    candidateProducts: [
      {
        id: "p1",
        category: "Merchandise",
        inStock: true,
        reasonHints: ["Matches birthday merch browsing."]
      },
      {
        id: "p2",
        category: "Sound Systems",
        inStock: false,
        reasonHints: ["Complements sound items already in cart."]
      }
    ]
  });

  assert.deepEqual(response.recommendedProductIds, ["p1"]);
  assert.equal(response.reasonsByProductId.p1, "Matches birthday merch browsing.");
  assert.equal(response.source, "fallback");
});
