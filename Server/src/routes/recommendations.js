"use strict";

const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { formatRecommendation, rankCandidates } = require("../services/recommendationEngine");
const { rerankSmartRecommendations } = require("../services/aiRecommendationService");
const {
  buildFallbackSmartRecommendationResponse,
  normalizeSmartRecommendationRequest
} = require("../services/recommendationContextBuilder");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "eventmart_dev_secret_change_me";

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------
function getBearerToken(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice(7).trim();
}

function getOptionalAuth(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = Number(decoded.sub);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    return { userId };
  } catch {
    return null;
  }
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)[0];
  return forwarded || String(req.ip || req.socket?.remoteAddress || "").trim() || "unknown";
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function buildAudienceContext(req) {
  const auth = getOptionalAuth(req);
  if (auth?.userId) return { key: `account:${auth.userId}`, type: "account" };
  const ua = String(req.headers["user-agent"] || "").trim();
  return { key: `ip:${hashValue(`${getClientIp(req)}|${ua}`)}`, type: "ip" };
}

function getSessionKey(req) {
  const ua = String(req.headers["user-agent"] || "").trim();
  return hashValue(`${getClientIp(req)}|${ua}`);
}

// ---------------------------------------------------------------------------
// In-memory session store (user activity tracking)
// ---------------------------------------------------------------------------
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const sessionStore = new Map();

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [key, session] of sessionStore) {
    if (session.lastAccess < cutoff) sessionStore.delete(key);
  }
}, 30 * 60 * 1000);

function getSession(key) {
  const existing = sessionStore.get(key);
  const session = existing || { views: [], clicks: [], lastAccess: Date.now() };
  session.lastAccess = Date.now();
  if (!existing) sessionStore.set(key, session);
  return session;
}

function recordProductView(sessionKey, product) {
  const session = getSession(sessionKey);
  session.views = [
    {
      id: String(product.id),
      category: String(product.category || ""),
      price: Number(product.buy_price || product.rent_price_per_day || 0),
      ts: Date.now()
    },
    ...session.views.filter((v) => v.id !== String(product.id))
  ].slice(0, 20);
}

function recordRecommendationClick(sessionKey, clickedProductId, sourceProductId) {
  const session = getSession(sessionKey);
  session.clicks = [
    { clicked: String(clickedProductId), source: String(sourceProductId), ts: Date.now() },
    ...session.clicks
  ].slice(0, 50);
}

// ---------------------------------------------------------------------------
// Co-rental frequency: how often two products appear in the same order
// Returns a map of candidateId → frequency score (0-1)
// ---------------------------------------------------------------------------
async function buildCoRentalMap(currentProductId, candidateIds) {
  if (!candidateIds.length) return {};
  try {
    const result = await pool.query(
      `SELECT oi2.product_id::text AS candidate_id,
              COUNT(DISTINCT oi1.order_id)::float AS shared_orders,
              (SELECT COUNT(DISTINCT order_id) FROM order_items WHERE product_id = $1) AS total_orders
       FROM order_items oi1
       JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi2.product_id != $1
       WHERE oi1.product_id = $1 AND oi2.product_id = ANY($2::bigint[])
       GROUP BY oi2.product_id`,
      [currentProductId, candidateIds.map(Number)]
    );
    const map = {};
    for (const row of result.rows) {
      const total = Number(row.total_orders) || 0;
      if (total > 0) {
        map[String(row.candidate_id)] = Math.min(1.0, Number(row.shared_orders) / total);
      }
    }
    return map;
  } catch {
    // order_items may not exist yet or column names may differ — degrade gracefully
    return {};
  }
}

// ---------------------------------------------------------------------------
// GET /api/recommendations/:productId
// ---------------------------------------------------------------------------
router.get("/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const sessionKey = getSessionKey(req);

    // 1. Fetch current product
    const productResult = await pool.query(
      `SELECT id, product_id, name, slug, category, subcategory,
              buy_price, rent_price_per_day, buy_enabled, rent_enabled,
              currency, images, image_url, featured, updated_at
       FROM products
       WHERE (id::text = $1 OR product_id = $1 OR slug = $1) AND active = true
       LIMIT 1`,
      [String(productId)]
    );

    if (!productResult.rows.length) {
      return res.status(404).json({ error: "Product not found." });
    }

    const current = productResult.rows[0];

    // 2. Record this page view in session
    recordProductView(sessionKey, current);
    const session = getSession(sessionKey);

    // 3. Fetch catalog (exclude current product)
    const catalogResult = await pool.query(
      `SELECT id, product_id, name, slug, category, subcategory,
              buy_price, rent_price_per_day, buy_enabled, rent_enabled,
              currency, images, image_url, featured, updated_at
       FROM products
       WHERE id != $1 AND active = true
       LIMIT 200`,
      [current.id]
    );

    const candidates = catalogResult.rows;

    // 4. Build co-rental frequency map
    const coRentalMap = await buildCoRentalMap(current.id, candidates.map((c) => c.id));

    // 5. Rank candidates using engine
    const ranked = rankCandidates(candidates, current, session, coRentalMap);

    const recommendations = ranked.map(({ candidate, scores }) =>
      formatRecommendation(candidate, scores)
    );

    return res.json({
      recommendations,
      currentProduct: { id: current.id, name: current.name }
    });
  } catch (error) {
    console.error("RECOMMENDATIONS GET ERROR:", error.message);
    return res.status(500).json({ error: "Could not load recommendations." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/recommendations/track  — click-through activity
// ---------------------------------------------------------------------------
router.post("/track", (req, res) => {
  try {
    const { type, productId, sourceProductId } = req.body || {};
    if (!type || !productId) {
      return res.status(400).json({ error: "type and productId are required." });
    }

    const sessionKey = getSessionKey(req);

    if (type === "rec_click") {
      recordRecommendationClick(sessionKey, productId, sourceProductId || "");
    } else if (type === "product_view") {
      // Can be called explicitly by the frontend for SPA navigations
      recordProductView(sessionKey, { id: productId, category: req.body.category || "", buy_price: 0 });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("TRACK ERROR:", error.message);
    return res.status(500).json({ error: "Tracking failed." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/recommendations/smart  — existing AI reranking endpoint (unchanged)
// ---------------------------------------------------------------------------
router.post("/smart", async (req, res) => {
  try {
    const recommendationRequest = normalizeSmartRecommendationRequest(req.body);
    recommendationRequest.audienceContext = buildAudienceContext(req);

    if (!recommendationRequest.candidateProducts.length) {
      return res.status(400).json({ error: "At least one candidate product is required." });
    }

    const result = await rerankSmartRecommendations(recommendationRequest);
    return res.json(result);
  } catch (error) {
    console.error("SMART RECOMMENDATION ROUTE ERROR:", error.message);
    try {
      const fallbackRequest = normalizeSmartRecommendationRequest(req.body);
      fallbackRequest.audienceContext = buildAudienceContext(req);
      if (fallbackRequest.candidateProducts.length) {
        return res.json(buildFallbackSmartRecommendationResponse(fallbackRequest));
      }
    } catch {}
    return res.status(500).json({ error: "We couldn't rerank recommendations right now." });
  }
});

module.exports = router;
