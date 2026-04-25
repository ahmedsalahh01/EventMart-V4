import assert from "node:assert/strict";
import {
  createCartItemsFromBuilderPreview,
  getPackageDisplayPrice,
  getPackageRecommendedForLabel
} from "./packages.js";

async function runTest(name, assertion) {
  await assertion();
  console.log(`PASS ${name}`);
}

await runTest("should read the stored package price from the new top-level field", () => {
  const displayPrice = getPackageDisplayPrice({
    price: 9500,
    items: [
      {
        product: {
          currency: "EGP"
        }
      }
    ]
  });

  assert.deepEqual(displayPrice, {
    amount: 9500,
    currency: "EGP",
    source: "configured"
  });
});

await runTest("should join recommended-for values for display", () => {
  assert.equal(
    getPackageRecommendedForLabel({ recommendedFor: ["weddings", "conferences"] }),
    "weddings, conferences"
  );
});

await runTest("should merge package-item customization uploads into cart items", () => {
  const uploadsByPackageItemId = new Map([
    [
      44,
      [
        {
          originalFileName: "design-1.png",
          uploadKind: "design",
          uploadToken: "pkg-upload-1"
        }
      ]
    ]
  ]);
  const items = createCartItemsFromBuilderPreview(
    {
      packageDefinition: {
        price: 7200
      },
      products: [
        {
          buyEnabled: true,
          buyPrice: 3600,
          category: "Decor",
          currency: "EGP",
          customizable: false,
          description: "Backdrop",
          id: 11,
          imageUrl: "/uploads/backdrop.png",
          name: "Backdrop",
          productId: "00011",
          rentEnabled: false,
          rentPricePerDay: null,
          slug: "backdrop",
          stock: 4,
          subcategory: "Stage"
        }
      ],
      selectedItems: [
        {
          id: 11,
          mode: "buy",
          packageMeta: {
            packageGroupId: "pkg-1",
            packageItemCustomizable: true,
            packageItemId: 44
          },
          quantity: 2
        }
      ]
    },
    {
      customizationUploadsByPackageItemId: uploadsByPackageItemId
    }
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].customization_requested, true);
  assert.equal(items[0].customization_uploads[0].uploadToken, "pkg-upload-1");
  assert.equal(items[0].package_meta.packagePrice, 7200);
});
