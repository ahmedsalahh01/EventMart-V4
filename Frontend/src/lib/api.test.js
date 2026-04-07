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

await runTest("should default to the production Railway backend when VITE_API_URL is not set", () => {
  assert.equal(
    resolveApiBaseUrl({
      env: {},
      location: { hostname: "localhost" }
    }),
    "https://eventmart-v4-production.up.railway.app"
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

await runTest("should retry package route misses against an explicit fallback API", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ options, url: String(url) });

    if (String(url).startsWith("https://eventmart-v4-production.up.railway.app")) {
      return {
        ok: false,
        status: 404,
        text: async () => "<!DOCTYPE html><html><body><pre>Cannot GET /api/packages</pre></body></html>"
      };
    }

    return {
      ok: true,
      status: 200,
      text: async () => "[]"
    };
  };

  try {
    const payload = await apiRequest("/api/packages", {
      env: {
        VITE_FALLBACK_API_URL: "http://localhost:4000"
      },
      location: {
        hostname: "localhost",
        origin: "http://localhost:5173"
      }
    });

    assert.deepEqual(payload, []);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://eventmart-v4-production.up.railway.app/api/packages");
  assert.equal(calls[1].url, "http://localhost:4000/api/packages");
});

await runTest("should not implicitly retry package route misses against localhost when VITE_API_URL is configured", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return {
      ok: false,
      status: 404,
      text: async () => ""
    };
  };

  try {
    await assert.rejects(
      () =>
        apiRequest("/api/packages", {
          env: {
            VITE_API_URL: "https://eventmart-v4-production.up.railway.app"
          },
          location: {
            hostname: "localhost",
            origin: "http://localhost:5173"
          }
        }),
      /does not currently serve \/api\/packages/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(calls, ["https://eventmart-v4-production.up.railway.app/api/packages"]);
});
