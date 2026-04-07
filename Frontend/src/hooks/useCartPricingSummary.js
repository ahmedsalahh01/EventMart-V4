import { useEffect, useMemo, useState } from "react";
import { calculateCartSummary, roundCurrency } from "../lib/checkout";
import { previewPackageCart } from "../lib/packages";

function hasPackageMeta(items) {
  return (Array.isArray(items) ? items : []).some(
    (item) => item?.package_meta && typeof item.package_meta === "object"
  );
}

export default function useCartPricingSummary(items) {
  const fallbackSummary = useMemo(() => calculateCartSummary(items), [items]);
  const [summary, setSummary] = useState(fallbackSummary);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!hasPackageMeta(items)) {
      setSummary(fallbackSummary);
      setIsLoading(false);
      setError("");
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setError("");

    previewPackageCart(items)
      .then((payload) => {
        if (cancelled) return;

        const serverSummary = payload?.summary || {};
        const nextTotal = Number(serverSummary.total || 0);
        const nextSubtotal = Number((serverSummary.baseSubtotal ?? serverSummary.subtotal) || 0);

        setSummary({
          baseSubtotal: nextSubtotal,
          bundleDiscount: Number(serverSummary.bundleDiscount || 0),
          customizationFees: Number(serverSummary.customizationFees || 0),
          depositRequired: roundCurrency(nextTotal * 0.3),
          discount: Number(serverSummary.bundleDiscount || 0),
          deliveryEstimate: serverSummary.deliveryEstimate || null,
          itemCount: Number(serverSummary.itemCount || 0),
          itemDiscounts: Number(serverSummary.itemDiscounts || 0),
          shipping: Number(serverSummary.shipping || 0),
          subtotal: nextSubtotal,
          total: nextTotal
        });
        setIsLoading(false);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setSummary(fallbackSummary);
        setError(requestError?.message || "Unable to refresh package pricing.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackSummary, items]);

  return {
    error,
    isLoading,
    summary
  };
}
