function normalizeImageList(value) {
  const list = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];

  return list
    .flatMap((item) => {
      if (Array.isArray(item)) return normalizeImageList(item);
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (!trimmed) return [];

        if (
          (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
          (trimmed.startsWith("{") && trimmed.endsWith("}"))
        ) {
          try {
            return normalizeImageList(JSON.parse(trimmed));
          } catch (_error) {
            return [trimmed];
          }
        }

        return [trimmed];
      }
      if (item && typeof item === "object") {
        return normalizeImageList(item.value || item.url || item.src || item.preview_url || "");
      }
      return [];
    });
}

export function normalizeCartItem(item) {
  const stock = Number(item?.stock || 0);
  const rawQuantity = Math.max(1, Number(item?.quantity || 1));
  const quantity = stock > 0 ? Math.min(rawQuantity, stock) : rawQuantity;
  const rentalDays = Math.max(1, Number(item?.rental_days || item?.rentalDays || 1));
  const mode = item?.mode === "rent" ? "rent" : "buy";

  return {
    id: String(item?.id ?? ""),
    product_id: String(item?.product_id ?? ""),
    name: String(item?.name ?? "Unnamed Item"),
    dark_images: normalizeImageList(item?.dark_images),
    image_url: String(item?.image_url ?? item?.image ?? ""),
    light_images: normalizeImageList(item?.light_images),
    mode,
    quantity,
    rental_days: mode === "rent" ? rentalDays : 1,
    unit_price: Math.max(0, Number(item?.unit_price ?? item?.price ?? 0)),
    currency: String(item?.currency || "USD"),
    stock
  };
}
