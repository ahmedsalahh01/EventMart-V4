const assert = require("node:assert/strict");
const {
  applyPricingToResolvedLines,
  buildBuilderPreview,
  normalizePackageContext
} = require("./packageBuilder");

(() => {
  const context = normalizePackageContext({
    attendeesRange: "101-150",
    customizationAvailable: true,
    guestCount: "180",
    packageMode: "rent",
    packagePrice: "15499.75",
    venueType: "hybrid"
  });

  assert.deepEqual(context, {
    attendeesRange: "101-150",
    budget: 0,
    customizationAvailable: true,
    customizationType: "customizable",
    deliveryPlace: "",
    eventType: "",
    guestCount: 180,
    minimumPackagePrice: 0,
    packageMode: "rent",
    packagePrice: 15499.75,
    recommendedFor: [],
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
  assert.equal(preview.packageDefinition.price, 9800);
  assert.equal(preview.packageDefinition.customizationType, "customizable");
  assert.equal(preview.packageDefinition.venueType, "indoor");
})();

(() => {
  const pricing = applyPricingToResolvedLines([
    {
      builderCategory: "sound",
      category: "Sound",
      currency: "EGP",
      customizationRequested: false,
      deliveryClass: "standard",
      description: "Speaker set",
      lineTotal: 6000,
      mode: "buy",
      packageMeta: {
        builderCategory: "sound",
        packageGroupId: "fixed-package",
        packageId: 8,
        packageItemId: 81,
        packageName: "Fixed Price Package",
        packagePrice: 8000,
        quantityDiscountTiers: []
      },
      productCustomizationFee: 0,
      productId: 1,
      productName: "Speaker Set",
      quantity: 2,
      rentalDays: null,
      subcategory: "Audio",
      unitPrice: 3000
    },
    {
      builderCategory: "stage",
      category: "Stage",
      currency: "EGP",
      customizationRequested: false,
      deliveryClass: "standard",
      description: "Backdrop",
      lineTotal: 4000,
      mode: "buy",
      packageMeta: {
        builderCategory: "stage",
        packageGroupId: "fixed-package",
        packageId: 8,
        packageItemId: 82,
        packageName: "Fixed Price Package",
        packagePrice: 8000,
        quantityDiscountTiers: []
      },
      productCustomizationFee: 0,
      productId: 2,
      productName: "Backdrop",
      quantity: 1,
      rentalDays: null,
      subcategory: "Decor",
      unitPrice: 4000
    }
  ]);

  assert.equal(pricing.packageGroups[0].packagePrice, 8000);
  assert.equal(pricing.packageGroups[0].subtotal, 8000);
  assert.equal(pricing.lines.reduce((sum, line) => sum + Number(line.chargedLineTotal || 0), 0), 8000);
})();
