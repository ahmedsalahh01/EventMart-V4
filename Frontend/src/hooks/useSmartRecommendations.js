import { useEffect, useMemo, useState } from "react";
import {
  buildSmartRecommendationRequestPayload,
  getRecommendationLeadText,
  getSmartRecommendations,
  mergeSmartRecommendationResults
} from "../lib/recommendationEngine";
import { createSmartRecommendationCacheKey, requestSmartRecommendationRerank } from "../lib/smartRecommendationService";
import { readBehaviorState } from "../lib/userBehavior";

const AI_RECOMMENDATION_DEBOUNCE_MS = 650;

function createIdleAIState() {
  return {
    confidence: 0,
    inferredEventType: "",
    recommendations: null,
    source: "deterministic",
    status: "idle"
  };
}

function useSmartRecommendations({
  candidateLimit,
  cartItems = [],
  currentCategory = "",
  currentEventType = "",
  currentMode = "",
  currentProduct = null,
  limit = 6,
  products = []
} = {}) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [aiState, setAiState] = useState(createIdleAIState);
  const safeLimit = Math.max(1, Number(limit || 6));
  const safeCandidateLimit = Math.max(safeLimit, Number(candidateLimit || Math.min(20, Math.max(10, safeLimit * 2))));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function handleRefresh() {
      setRefreshVersion((value) => value + 1);
    }

    window.addEventListener("eventmart:behavior-updated", handleRefresh);
    window.addEventListener("eventmart:cart-updated", handleRefresh);

    return () => {
      window.removeEventListener("eventmart:behavior-updated", handleRefresh);
      window.removeEventListener("eventmart:cart-updated", handleRefresh);
    };
  }, []);

  const behavior = useMemo(() => readBehaviorState(), [refreshVersion]);
  const deterministicRecommendations = useMemo(
    () =>
      getSmartRecommendations({
        behavior,
        candidateLimit: safeCandidateLimit,
        cartItems,
        currentCategory,
        currentEventType,
        currentMode,
        currentProduct,
        limit: safeLimit,
        products
      }),
    [
      behavior,
      cartItems,
      currentCategory,
      currentEventType,
      currentMode,
      currentProduct,
      products,
      safeCandidateLimit,
      safeLimit
    ]
  );
  const requestDescriptor = useMemo(
    () =>
      buildSmartRecommendationRequestPayload({
        behavior,
        candidateLimit: safeCandidateLimit,
        cartItems,
        currentCategory,
        currentEventType,
        currentMode,
        currentProduct,
        limit: safeLimit,
        products
      }),
    [
      behavior,
      cartItems,
      currentCategory,
      currentEventType,
      currentMode,
      currentProduct,
      products,
      safeCandidateLimit,
      safeLimit
    ]
  );
  const requestKey = useMemo(
    () => (requestDescriptor?.body ? createSmartRecommendationCacheKey(requestDescriptor.body) : ""),
    [requestDescriptor]
  );
  const leadText = useMemo(
    () => getRecommendationLeadText({ behavior, currentEventType, currentCategory }),
    [behavior, currentCategory, currentEventType]
  );

  useEffect(() => {
    if (!requestDescriptor?.body || !requestDescriptor.hasMeaningfulSignal) {
      setAiState(createIdleAIState());
      return undefined;
    }

    let cancelled = false;
    setAiState((current) => ({
      ...current,
      recommendations: null,
      source: "deterministic",
      status: "loading"
    }));

    const timeoutId = window.setTimeout(async () => {
      try {
        const aiResult = await requestSmartRecommendationRerank(requestDescriptor.body);
        if (cancelled) return;

        const mergedRecommendations = mergeSmartRecommendationResults({
          aiResult,
          candidateEntries: requestDescriptor.candidateEntries,
          limit: safeLimit
        });

        setAiState({
          confidence: Number(aiResult?.confidence || 0),
          inferredEventType: String(aiResult?.inferredEventType || requestDescriptor.body.eventType || ""),
          recommendations: mergedRecommendations.length ? mergedRecommendations : null,
          source: String(aiResult?.source || "deterministic"),
          status: mergedRecommendations.length ? "ready" : "fallback"
        });
      } catch (_error) {
        if (!cancelled) {
          setAiState({
            confidence: 0,
            inferredEventType: String(requestDescriptor.body.eventType || ""),
            recommendations: null,
            source: "deterministic",
            status: "fallback"
          });
        }
      }
    }, AI_RECOMMENDATION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [requestDescriptor, requestKey, safeLimit]);

  return {
    aiMeta: {
      confidence: aiState.confidence,
      inferredEventType: aiState.inferredEventType,
      source: aiState.source,
      status: aiState.status
    },
    behavior,
    leadText,
    recommendations: aiState.recommendations?.length ? aiState.recommendations : deterministicRecommendations
  };
}

export default useSmartRecommendations;
