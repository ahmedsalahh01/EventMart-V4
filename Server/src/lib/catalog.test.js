const assert = require("node:assert/strict");
const {
  ONE_SIZE_LABEL,
  buildVariationKey,
  isVariationAvailable,
  materializeProductCatalogShape,
  normalizeAvailabilityStatus,
  normalizeSizeLabel,
  normalizeSizeMode,
  slugifyProductName,
  sortSizes
} = require("./catalog");

function runTest(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
}

runTest("should normalize slugs and append the product code for stability", () => {
  assert.equal(slugifyProductName("Premium Cotton Hoodie", "00021"), "premium-cotton-hoodie-00021");
});

runTest("should normalize size labels and preserve one-size products", () => {
  assert.equal(normalizeSizeMode("varied"), "varied");
  assert.equal(normalizeSizeLabel("xl", "varied"), "X-Large");
  assert.equal(normalizeSizeLabel("whatever", "one-size"), ONE_SIZE_LABEL);
});

runTest("should sort common sizes in storefront order", () => {
  assert.deepEqual(sortSizes(["Large", "XS", "Medium", "2XL"], "varied"), [
    "XS",
    "Medium",
    "Large",
    "2X-Large"
  ]);
});

runTest("should materialize a full variation catalog shape", () => {
  const shape = materializeProductCatalogShape({
    colors: ["Red", "White"],
    quantity_available: 12,
    size_mode: "varied",
    sizes: ["M", "L"],
    variations: [
      { color: "Red", size: "M", quantity: 5, availability_status: "in_stock" },
      { color: "Red", size: "L", quantity: 7, availability_status: "in_stock" }
    ]
  });

  assert.equal(shape.quantity_available, 12);
  assert.deepEqual(shape.colors, ["Red", "White"]);
  assert.deepEqual(shape.sizes, ["Medium", "Large"]);
  assert.equal(shape.variations[0].size, "Medium");
  assert.equal(shape.variations[1].quantity, 7);
});

runTest("should create a fallback one-size variation for legacy products", () => {
  const shape = materializeProductCatalogShape({
    colors: ["Black"],
    quantity_available: 4,
    size_mode: "one-size",
    variations: []
  });

  assert.equal(shape.variations.length, 1);
  assert.equal(shape.variations[0].size, ONE_SIZE_LABEL);
  assert.equal(shape.variations[0].quantity, 4);
});

runTest("should restore variations from serialized JSON responses", () => {
  const shape = materializeProductCatalogShape({
    colors: ["Blue"],
    quantity_available: 4,
    size_mode: "varied",
    sizes: ["XS"],
    variations: JSON.stringify([
      { color: "Blue", size: "XS", quantity: 4, availability_status: "in_stock" }
    ])
  });

  assert.equal(shape.variations.length, 1);
  assert.equal(shape.variations[0].color, "Blue");
  assert.equal(shape.variations[0].size, "XS");
});

runTest("should normalize availability and variation keys", () => {
  const key = buildVariationKey("Blue", "Small");

  assert.equal(key, "blue::small");
  assert.equal(normalizeAvailabilityStatus("disabled", 5), "unavailable");
  assert.equal(normalizeAvailabilityStatus("in_stock", 0), "out_of_stock");
  assert.equal(isVariationAvailable({ availability_status: "in_stock", quantity: 3 }), true);
  assert.equal(isVariationAvailable({ availability_status: "out_of_stock", quantity: 3 }), false);
});
