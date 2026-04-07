const assert = require("node:assert/strict");
const { parseProductImportBuffer } = require("../utils/productImportParser");
const { mergeImportProduct } = require("./productImportService");

function runTest(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
}

runTest("should parse CSV import headers into canonical product keys", () => {
  const csv = [
    "Product Name,Buy Price,Rent Price,Category,Subcategory,Featured",
    "Portable Speaker,1200,150,Sound Systems,Audio,yes"
  ].join("\n");

  const parsed = parseProductImportBuffer({
    buffer: Buffer.from(csv, "utf8"),
    originalName: "products.csv"
  });

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].name, "Portable Speaker");
  assert.equal(parsed.rows[0].buy_price, "1200");
  assert.equal(parsed.rows[0].rent_price_per_day, "150");
  assert.equal(parsed.rows[0].featured, "yes");
});

runTest("should preserve existing optional data when an import update leaves it blank", () => {
  const merged = mergeImportProduct(
    {
      sku: "PRD-000120",
      product_id: "01020",
      name: "Updated Event Hoodie",
      category: "Merchandise",
      subcategory: "Hoodies",
      description: "",
      quality: "",
      quality_points: [],
      colors: ["White"],
      size_mode: "one-size",
      sizes: [],
      customizable: null,
      buy_enabled: null,
      rent_enabled: null,
      buy_price: 490,
      rent_price_per_day: null,
      base_price: 490,
      currency: "EGP",
      event_type: "",
      tags: [],
      customization_fee: null,
      venue_type: "",
      delivery_class: "",
      featured: null,
      active: null,
      quantity_available: 8,
      reorder_level: null,
      unit_cost: null,
      overhead_cost: null,
      images: [],
      variations: []
    },
    {
      sku: "PRD-000120",
      product_id: "01020",
      name: "Classic Event Hoodie",
      category: "Merchandise",
      subcategory: "Hoodies",
      description: "Existing description",
      quality: "Premium",
      quality_points: ["Cotton blend"],
      colors: ["Black"],
      size_mode: "one-size",
      sizes: [],
      customizable: true,
      buy_enabled: true,
      rent_enabled: false,
      buy_price: 450,
      rent_price_per_day: null,
      base_price: 450,
      currency: "EGP",
      event_type: "birthday",
      tags: ["hoodie", "custom"],
      customization_fee: 35,
      venue_type: "indoor",
      delivery_class: "standard",
      featured: true,
      active: true,
      quantity_available: 5,
      reorder_level: 2,
      unit_cost: 200,
      overhead_cost: 40,
      images: ["https://example.com/hoodie.png"],
      variations: [
        {
          color: "Black",
          size: "One Size",
          quantity: 5,
          sku: "VAR-1",
          availability_status: "in_stock"
        }
      ]
    }
  );

  assert.equal(merged.description, "Existing description");
  assert.equal(merged.customizable, true);
  assert.equal(merged.event_type, "birthday");
  assert.equal(merged.customization_fee, 35);
  assert.deepEqual(merged.images, ["https://example.com/hoodie.png"]);
  assert.equal(merged.buy_price, 490);
});
