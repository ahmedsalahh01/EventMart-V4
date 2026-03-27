import assert from "node:assert/strict";
import {
  apiRequest,
  buildApiUrl,
  resolveApiBaseUrl,
  sanitizeApiErrorMessage
} from "./api.js";

async function runTest(name, assertion) {
  await assertion();
  console.log(`PASS ${name}`);
}

await runTest("should use an explicit VITE_API_URL when configured", () => {
  assert.equal(
    resolveApiBaseUrl({
      env: { VITE_API_URL: "https://api.example.com/" },
      location: { hostname: "event-mart-v4.vercel.app" }
    }),
    "https://api.example.com"
  );
});

await runTest("should fall back to localhost during local development", () => {
  assert.equal(
    resolveApiBaseUrl({
      env: {},
      location: { hostname: "localhost" }
    }),
    "http://localhost:4000"
  );
});

await runTest("should fall back to the production Railway backend on deployed hosts", () => {
  assert.equal(
    resolveApiBaseUrl({
      env: {},
      location: { hostname: "event-mart-v4.vercel.app" }
    }),
    "https://eventmart-v4-production.up.railway.app"
  );
});

await runTest("should build API URLs from the resolved base URL", () => {
  assert.equal(
    buildApiUrl("/api/checkout/orders", {
      baseUrl: "https://eventmart-v4-production.up.railway.app/"
    }),
    "https://eventmart-v4-production.up.railway.app/api/checkout/orders"
  );
});

await runTest("should sanitize HTML route-miss responses into readable messages", () => {
  assert.equal(
    sanitizeApiErrorMessage("<!DOCTYPE html><html><body><pre>Cannot POST /api/checkout/orders</pre></body></html>"),
    "POST /api/checkout/orders is not available right now."
  );
});

await runTest("should bypass caches for catalog reads", async () => {
  const originalFetch = globalThis.fetch;
  let capturedOptions = null;

  globalThis.fetch = async (_url, options) => {
    capturedOptions = options;
    return {
      ok: true,
      status: 200,
      text: async () => "[]"
    };
  };

  try {
    await apiRequest("/api/products", { baseUrl: "https://api.example.com" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(capturedOptions?.cache, "no-store");
});
