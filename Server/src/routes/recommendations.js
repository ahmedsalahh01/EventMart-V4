const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { rerankSmartRecommendations } = require("../services/aiRecommendationService");
const {
  buildFallbackSmartRecommendationResponse,
  normalizeSmartRecommendationRequest
} = require("../services/recommendationContextBuilder");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "eventmart_dev_secret_change_me";

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
    return {
      userId
    };
  } catch (_error) {
    return null;
  }
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];

  return forwarded || String(req.ip || req.socket?.remoteAddress || "").trim() || "unknown";
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function buildAudienceContext(req) {
  const auth = getOptionalAuth(req);
  if (auth?.userId) {
    return {
      key: `account:${auth.userId}`,
      type: "account"
    };
  }

  const userAgent = String(req.headers["user-agent"] || "").trim();

  return {
    key: `ip:${hashValue(`${getClientIp(req)}|${userAgent}`)}`,
    type: "ip"
  };
}

router.post("/smart", async (req, res) => {
  try {
    const recommendationRequest = normalizeSmartRecommendationRequest(req.body);
    recommendationRequest.audienceContext = buildAudienceContext(req);

    if (!recommendationRequest.candidateProducts.length) {
      return res.status(400).json({
        error: "At least one candidate product is required."
      });
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
    } catch (_fallbackError) {
      // Ignore fallback normalization failures and return a generic error response below.
    }

    return res.status(500).json({
      error: "We couldn't rerank recommendations right now."
    });
  }
});

module.exports = router;
