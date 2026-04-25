"use strict";

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------
const W_CATEGORY = 0.40;
const W_PRICE    = 0.25;
const W_RENTAL   = 0.20;
const W_HISTORY  = 0.15;

const MIN_SCORE = 0.30;
const MAX_RESULTS = 6;
const RECENT_VIEW_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

// ---------------------------------------------------------------------------
// Individual score components
// ---------------------------------------------------------------------------

// 40% — Category match
// 1.0 same category, 0.5 same subcategory only, 0 otherwise
function categoryScore(candidate, current) {
  if (candidate.category === current.category) return 1.0;
  if (candidate.subcategory && candidate.subcategory === current.subcategory) return 0.5;
  return 0;
}

// 25% — Price proximity
// Formula: 1.0 - (|p1 - p2| / max(p1, p2)), clamped to [0, 1]
function priceScore(candidate, current) {
  const p1 = Number(current.buy_price || current.rent_price_per_day || 0);
  const p2 = Number(candidate.buy_price || candidate.rent_price_per_day || 0);
  if (p1 <= 0 || p2 <= 0) return 0;
  return Math.max(0, 1.0 - Math.abs(p1 - p2) / Math.max(p1, p2));
}

// 20% — Rental patterns (popularity proxy: featured status + recency)
// Co-rental frequency is passed in as an optional pre-computed value (0–1).
function rentalScore(candidate, coRentalFrequency = 0) {
  let base = candidate.featured ? 0.7 : candidate.rent_enabled ? 0.4 : 0.1;
  const updatedDaysAgo = candidate.updated_at
    ? (Date.now() - new Date(candidate.updated_at).getTime()) / 86400000
    : 999;
  if (updatedDaysAgo < 7) base = Math.min(1.0, base + 0.2);
  else if (updatedDaysAgo < 30) base = Math.min(1.0, base + 0.1);
  // Blend with co-rental signal if available
  return coRentalFrequency > 0 ? Math.min(1.0, base * 0.6 + coRentalFrequency * 0.4) : base;
}

// 15% — User history (session category overlap)
function historyScore(candidate, session) {
  if (!session || !session.views.length) return 0;
  const recent = session.views.slice(0, 10);
  const hits = recent.filter((v) => v.category === candidate.category).length;
  return Math.min(1.0, hits * 0.35);
}

// ---------------------------------------------------------------------------
// Reason and badge builders
// ---------------------------------------------------------------------------
function buildReason(scores, candidate, current) {
  if (scores.total > 0.8) return "Best match for this product";
  const parts = [];
  if (scores.cat >= 1.0) parts.push("Same category");
  else if (scores.cat > 0) parts.push("Similar category");
  if (scores.coRental >= 0.5) parts.push("Frequently rented together");
  else if (scores.rental >= 0.7) parts.push(`Trending in ${candidate.category || "this category"}`);
  if (scores.price >= 0.8 && parts.length === 0) parts.push("Similar price");
  if (scores.history >= 0.3) parts.push("Matches your interests");
  return parts.length ? parts.join(" · ") : "Recommended for you";
}

function buildBadges(scores, matchPercent) {
  const badges = [];
  if (matchPercent >= 70) badges.push(`${matchPercent}% match`);
  if (scores.coRental >= 0.5) badges.push("Goes well with");
  else if (scores.cat >= 1.0) badges.push("Goes well with");
  if (scores.rental >= 0.7) badges.push("Trending");
  else if (scores.price >= 0.8) badges.push("Similar price");
  return badges.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------
function scoreCandidate(candidate, current, session, coRentalFrequency = 0) {
  const cat     = categoryScore(candidate, current);
  const price   = priceScore(candidate, current);
  const rental  = rentalScore(candidate, coRentalFrequency);
  const history = historyScore(candidate, session);
  const coRental = coRentalFrequency;

  const total = W_CATEGORY * cat + W_PRICE * price + W_RENTAL * rental + W_HISTORY * history;
  return { total, cat, price, rental, history, coRental };
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------
function isRecentlyViewed(candidate, session) {
  if (!session || !session.views.length) return false;
  const cutoff = Date.now() - RECENT_VIEW_WINDOW_MS;
  return session.views.some(
    (v) => v.id === String(candidate.id) && v.ts > cutoff
  );
}

// ---------------------------------------------------------------------------
// Fallback: same-category or trending when user has few views
// ---------------------------------------------------------------------------
function isFallbackUser(session) {
  return !session || session.views.length < 3;
}

function selectFallback(candidates, current, limit) {
  // Prefer same category and featured; supplement with other categories if needed
  const sameCategory = candidates
    .filter((c) => c.category === current.category)
    .sort((a, b) => Number(b.featured) - Number(a.featured));
  const other = candidates
    .filter((c) => c.category !== current.category)
    .sort((a, b) => Number(b.featured) - Number(a.featured));

  return [...sameCategory, ...other].slice(0, limit).map((c) => ({
    candidate: c,
    scores: scoreCandidate(c, current, null)
  }));
}

// ---------------------------------------------------------------------------
// Top-level scorer
// ---------------------------------------------------------------------------
function rankCandidates(candidates, current, session, coRentalMap = {}) {
  const fallback = isFallbackUser(session);

  if (fallback) {
    return selectFallback(candidates, current, MAX_RESULTS);
  }

  return candidates
    .filter((c) => !isRecentlyViewed(c, session))
    .map((c) => ({
      candidate: c,
      scores: scoreCandidate(c, current, session, coRentalMap[String(c.id)] || 0)
    }))
    .filter(({ scores }) => scores.total >= MIN_SCORE)
    .sort((a, b) => b.scores.total - a.scores.total)
    .slice(0, MAX_RESULTS);
}

// ---------------------------------------------------------------------------
// Format output
// ---------------------------------------------------------------------------
function formatRecommendation(candidate, scores) {
  const matchPercent = Math.min(99, Math.round(scores.total * 100));

  let imageUrl = "";
  try {
    const imgs = Array.isArray(candidate.images)
      ? candidate.images
      : typeof candidate.images === "string"
        ? JSON.parse(candidate.images)
        : null;
    imageUrl = Array.isArray(imgs) && imgs[0] ? String(imgs[0]) : "";
  } catch {}
  imageUrl = imageUrl || String(candidate.image_url || "").trim();

  return {
    id: candidate.id,
    productId: candidate.product_id,
    name: candidate.name,
    slug: candidate.slug,
    category: candidate.category,
    subcategory: candidate.subcategory,
    buyPrice: candidate.buy_price,
    rentPricePerDay: candidate.rent_price_per_day,
    buyEnabled: candidate.buy_enabled,
    rentEnabled: candidate.rent_enabled,
    currency: candidate.currency || "EGP",
    imageUrl,
    featured: candidate.featured,
    score: Math.round(scores.total * 1000) / 1000,
    matchPercent,
    badges: buildBadges(scores, matchPercent),
    reason: buildReason(scores, candidate)
  };
}

module.exports = { formatRecommendation, isFallbackUser, rankCandidates };
