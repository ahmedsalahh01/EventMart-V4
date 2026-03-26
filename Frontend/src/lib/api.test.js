import assert from "node:assert/strict";
import {
  buildApiUrl,
  resolveApiBaseUrl,
  sanitizeApiErrorMessage
} from "./api.js";

function runTest(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
}

runTest("should use an explicit VITE_API_URL when configured", () => {
  assert.equal(
    resolveApiBaseUrl({
      env: { VITE_API_URL: "https://api.example.com/" },
      location: { hostname: "event-mart-v4.vercel.app" }
    }),
    "https://api.example.com"
  );
});

runTest("should fall back to localhost during local development", () => {
  assert.equal(
    resolveApiBaseUrl({
      env: {},
      location: { hostname: "localhost" }
    }),
    "http://localhost:4000"
  );
});

runTest("should fall back to the production Railway backend on deployed hosts", () => {
  assert.equal(
    resolveApiBaseUrl({
      env: {},
      location: { hostname: "event-mart-v4.vercel.app" }
    }),
    "https://eventmart-v4-production.up.railway.app"
  );
});

runTest("should build API URLs from the resolved base URL", () => {
  assert.equal(
    buildApiUrl("/api/checkout/orders", {
      baseUrl: "https://eventmart-v4-production.up.railway.app/"
    }),
    "https://eventmart-v4-production.up.railway.app/api/checkout/orders"
  );
});

runTest("should sanitize HTML route-miss responses into readable messages", () => {
  assert.equal(
    sanitizeApiErrorMessage("<!DOCTYPE html><html><body><pre>Cannot POST /api/checkout/orders</pre></body></html>"),
    "POST /api/checkout/orders is not available right now."
  );
});
