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

runTest("should materialize varied product options and resolve the first valid variation", () => {
  const state = buildProductOptionState(
    {
      colors: ["Red", "White"],
      size_mode: "varied",
      sizes: ["S", "M", "L"],
      variations: [
        { id: 1, color: "Red", size: "M", quantity: 5, availability_status: "in_stock" },
        { id: 2, color: "Red", size: "L", quantity: 0, availability_status: "out_of_stock" },
        { id: 3, color: "White", size: "S", quantity: 3, availability_status: "in_stock" }
      ]
    },
    { color: "Red", size: "L" }
  );

  assert.equal(state.selectedColor, "Red");
  assert.equal(state.selectedSize, "Medium");
  assert.equal(state.activeVariation.id, "1");
  assert.equal(state.sizes.find((size) => size.size === "Large").isDisabled, true);
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
