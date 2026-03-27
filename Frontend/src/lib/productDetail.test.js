import assert from "node:assert/strict";
import {
  MAX_CUSTOMIZATION_FILE_BYTES,
  ONE_SIZE_LABEL,
  buildProductOptionState,
  getColorSwatchValue,
  materializeProductDetail,
  sortSizes,
  validateCustomizationFile
} from "./productDetail.js";

function runTest(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
}

runTest("should hide unrelated sizes until a color is selected", () => {
  const product = {
    colors: ["Red", "White"],
    size_mode: "varied",
    sizes: ["S", "M", "L"],
    variations: [
      { id: 1, color: "Red", size: "M", quantity: 5, availability_status: "in_stock" },
      { id: 2, color: "Red", size: "L", quantity: 0, availability_status: "out_of_stock" },
      { id: 3, color: "White", size: "S", quantity: 3, availability_status: "in_stock" }
    ]
  };
  const emptyState = buildProductOptionState(product, {});
  const redState = buildProductOptionState(product, { color: "Red" });
  const redLargeState = buildProductOptionState(product, { color: "Red", size: "L" });

  assert.equal(emptyState.selectedColor, "");
  assert.equal(emptyState.selectedSize, "");
  assert.equal(emptyState.sizes.length, 0);
  assert.equal(emptyState.activeVariation, null);

  assert.equal(redState.selectedColor, "Red");
  assert.equal(redState.selectedSize, "");
  assert.equal(redState.activeVariation, null);
  assert.deepEqual(redState.sizes.map((size) => size.size), ["Medium", "Large"]);

  assert.equal(redLargeState.selectedColor, "Red");
  assert.equal(redLargeState.selectedSize, "Large");
  assert.equal(redLargeState.activeVariation.id, "2");
  assert.equal(redLargeState.sizes.some((size) => size.size === "Small"), false);
  assert.equal(redLargeState.sizes.find((size) => size.size === "Large").isDisabled, true);
});

runTest("should simplify one-size products", () => {
  const detail = materializeProductDetail({
    colors: ["Black"],
    quantity_available: 4,
    size_mode: "one-size",
    variations: []
  });

  assert.deepEqual(detail.sizes, [ONE_SIZE_LABEL]);
  assert.equal(detail.variations[0].size, ONE_SIZE_LABEL);
});

runTest("should restore variations from serialized product payloads", () => {
  const detail = materializeProductDetail({
    colors: ["Blue"],
    size_mode: "varied",
    sizes: ["XS"],
    variations: JSON.stringify([
      { id: 12, color: "Blue", size: "XS", quantity: 4, availability_status: "in_stock" }
    ])
  });

  assert.equal(detail.variations.length, 1);
  assert.equal(detail.variations[0].id, "12");
  assert.equal(detail.variations[0].size, "XS");
});

runTest("should keep one-size products selectable by default", () => {
  const state = buildProductOptionState(
    {
      colors: ["Black"],
      size_mode: "one-size",
      variations: [
        { id: 7, color: "Black", size: "One Size", quantity: 4, availability_status: "in_stock" }
      ]
    }
  );

  assert.equal(state.selectedColor, "Black");
  assert.equal(state.selectedSize, ONE_SIZE_LABEL);
  assert.equal(state.activeVariation.id, "7");
});

runTest("should sort storefront sizes consistently", () => {
  assert.deepEqual(sortSizes(["4XL", "Small", "Medium", "XL", "XS"], "varied"), [
    "XS",
    "Small",
    "Medium",
    "X-Large",
    "4X-Large"
  ]);
});

runTest("should validate customization uploads", () => {
  assert.equal(
    validateCustomizationFile({ name: "mockup.png", size: 1024, type: "image/png" }),
    ""
  );
  assert.equal(
    validateCustomizationFile({ name: "design.pdf", size: 2048, type: "application/pdf" }),
    ""
  );
  assert.equal(
    validateCustomizationFile({ name: "notes.jpg", size: 512, type: "image/jpeg" }),
    "Only PNG and PDF files are supported."
  );
  assert.equal(
    validateCustomizationFile({
      name: "too-big.pdf",
      size: MAX_CUSTOMIZATION_FILE_BYTES + 1,
      type: "application/pdf"
    }),
    "Each customization file must be 10 MB or smaller."
  );
});

runTest("should resolve named color swatches", () => {
  assert.equal(getColorSwatchValue("Red"), "#dc2626");
  assert.equal(getColorSwatchValue("Custom Ink"), "#cbd5e1");
});
