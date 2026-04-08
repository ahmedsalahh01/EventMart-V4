const assert = require("node:assert/strict");
const {
  buildBuilderPreview,
  normalizePackageContext
} = require("./packageBuilder");

(() => {
  const context = normalizePackageContext({
    customizationAvailable: true,
    guestCount: "180",
    packageMode: "rent",
    packagePrice: "15499.75",
    venueType: "hybrid"
  });

  assert.deepEqual(context, {
    budget: 0,
    customizationAvailable: true,
    deliveryPlace: "",
    eventType: "",
    guestCount: 180,
    minimumPackagePrice: 0,
    packageMode: "rent",
    packagePrice: 15499.75,
    venueSize: "",
    venueType: "hybrid"
  });
})();

(() => {
  const preview = buildBuilderPreview({
    catalogProducts: [],
    context: {},
    packageDefinition: {
      contextDefaults: {
        customizationAvailable: true,
        guestCount: 120,
        packageMode: "buy",
        packagePrice: 9800,
        venueType: "indoor"
      },
      id: 7,
      items: [],
      name: "Indoor Essentials",
      slug: "indoor-essentials",
      status: "active"
    },
    packageGroupId: "test-group",
    selectedItems: []
  });

  assert.equal(preview.packageDefinition.customizationAvailable, true);
  assert.equal(preview.packageDefinition.guestCount, 120);
  assert.equal(preview.packageDefinition.packageMode, "buy");
  assert.equal(preview.packageDefinition.packagePrice, 9800);
  assert.equal(preview.packageDefinition.venueType, "indoor");
})();
