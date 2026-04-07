import assert from "node:assert/strict";
import { loadProductBySlug, loadProducts } from "./products.js";

function createStorage(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    }
  };
}

async function runTest(name, assertion) {
  await assertion();
  console.log(`PASS ${name}`);
}

await runTest("should return live products and clear stale product cache", async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  globalThis.localStorage = createStorage({
    eventmart_products_v1: JSON.stringify({
      baseUrl: "https://eventmart-v4-production.up.railway.app",
      products: [{ id: 999, name: "Cached product" }]
    })
  });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify([
        {
          active: true,
          buy_enabled: true,
          buy_price: 125,
          category: "Merchandise",
          id: 1,
          name: "Live Product",
          product_id: "00001",
          rent_enabled: false,
          subcategory: "Top Wear"
        }
      ])
  });

  try {
    const products = await loadProducts();

    assert.equal(products.length, 1);
    assert.equal(products[0].name, "Live Product");
    assert.equal(globalThis.localStorage.getItem("eventmart_products_v1"), null);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  }
});

await runTest("should clear cached products and return an empty list when the catalog API fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  globalThis.localStorage = createStorage({
    eventmart_products_v1: '{"products":[{"id":"1","name":"Ghost Product"}]}'
  });
  globalThis.fetch = async () => {
    throw new Error("Failed to fetch");
  };

  try {
    const products = await loadProducts();

    assert.deepEqual(products, []);
    assert.equal(globalThis.localStorage.getItem("eventmart_products_v1"), null);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  }
});

await runTest("should clear cached products instead of serving stale product details", async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  globalThis.localStorage = createStorage({
    eventmart_products_v1: '{"products":[{"id":"1","slug":"ghost-product","name":"Ghost Product"}]}'
  });
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    text: async () => JSON.stringify({ error: "Product not found." })
  });

  try {
    await assert.rejects(() => loadProductBySlug("ghost-product"), /Product not found/);
    assert.equal(globalThis.localStorage.getItem("eventmart_products_v1"), null);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  }
});
