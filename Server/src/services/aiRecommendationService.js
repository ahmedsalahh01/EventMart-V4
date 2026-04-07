const { resolveEventType } = require("../lib/eventTypeConfig");
const {
  buildFallbackSmartRecommendationResponse,
  buildOpenAIRecommendationPromptInput
} = require("./recommendationContextBuilder");

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getOpenAIConfig() {
  return {
    apiKey: String(process.env.OPENAI_API_KEY || "").trim(),
    baseUrl: normalizeBaseUrl(process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL),
    model: String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini"
  };
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks = [];
  const output = Array.isArray(payload?.output) ? payload.output : [];

  output.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part) => {
      if (typeof part?.text === "string" && part.text.trim()) chunks.push(part.text.trim());
      if (typeof part?.output_text === "string" && part.output_text.trim()) chunks.push(part.output_text.trim());
    });
  });

  return chunks.join("\n").trim();
}

function stripCodeFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseStructuredResponse(payload) {
  const responseText = extractResponseText(payload);

  if (responseText) {
    try {
      return JSON.parse(stripCodeFence(responseText));
    } catch (_error) {
      // Fall through to structured payload parsing below.
    }
  }

  if (payload?.output_parsed && typeof payload.output_parsed === "object") {
    return payload.output_parsed;
  }

  return null;
}

function clampConfidence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed));
}

function sanitizeReason(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

function normalizeAIRecommendationResponse(data, request) {
  if (!data || typeof data !== "object") return null;

  const allowedIds = new Set(
    request.candidateProducts
      .filter((candidate) => candidate.inStock)
      .map((candidate) => candidate.id)
  );
  const recommendedProductIds = Array.isArray(data.recommendedProductIds)
    ? data.recommendedProductIds
        .map((value) => String(value || "").trim())
        .filter((value) => value && allowedIds.has(value))
    : [];

  if (!recommendedProductIds.length) {
    return null;
  }

  const rawReasons = data.reasonsByProductId && typeof data.reasonsByProductId === "object"
    ? data.reasonsByProductId
    : {};
  const reasonsByProductId = {};

  recommendedProductIds.forEach((productId) => {
    const reason = sanitizeReason(rawReasons[productId]);
    if (reason) {
      reasonsByProductId[productId] = reason;
    }
  });

  return {
    confidence: clampConfidence(data.confidence),
    inferredEventType: resolveEventType(data.inferredEventType || request.eventType || "") || request.eventType || "",
    reasonsByProductId,
    recommendedProductIds,
    source: "openai"
  };
}

async function rerankSmartRecommendations(request) {
  const openAIConfig = getOpenAIConfig();
  if (!openAIConfig.apiKey || typeof fetch !== "function") {
    return buildFallbackSmartRecommendationResponse(request);
  }

  const promptInput = buildOpenAIRecommendationPromptInput(request);
  const systemPrompt = [
    "You rerank EventMart product recommendations.",
    "Use only the provided candidate products.",
    "Never invent new products or IDs.",
    "Prefer relevance to event type, browsing history, cart composition, preferred mode, and venue compatibility.",
    "Keep reasons concise, customer-friendly, and specific.",
    "Return valid JSON only."
  ].join(" ");

  try {
    const aiResponse = await fetch(`${openAIConfig.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIConfig.apiKey}`
      },
      body: JSON.stringify({
        model: openAIConfig.model,
        temperature: 0.2,
        max_output_tokens: 500,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(promptInput) }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "smart_recommendation_rerank",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                recommendedProductIds: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  minItems: 1,
                  maxItems: 8
                },
                reasonsByProductId: {
                  type: "object",
                  additionalProperties: {
                    type: "string"
                  }
                },
                inferredEventType: {
                  type: "string"
                },
                confidence: {
                  type: "number"
                }
              },
              required: ["recommendedProductIds", "reasonsByProductId", "inferredEventType", "confidence"]
            }
          }
        }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("SMART RECOMMENDATION OPENAI ERROR:", aiResponse.status, errorText.slice(0, 500));
      return buildFallbackSmartRecommendationResponse(request);
    }

    const payload = await aiResponse.json();
    const parsed = parseStructuredResponse(payload);
    const normalized = normalizeAIRecommendationResponse(parsed, request);

    return normalized || buildFallbackSmartRecommendationResponse(request);
  } catch (error) {
    console.error("SMART RECOMMENDATION SERVICE ERROR:", error.message);
    return buildFallbackSmartRecommendationResponse(request);
  }
}

module.exports = {
  rerankSmartRecommendations
};
