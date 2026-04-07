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

function mergeUniqueImageLists(...values) {
  const seen = new Set();
  const merged = [];

  values.forEach((value) => {
    normalizeImageList(value).forEach((image) => {
      if (!seen.has(image)) {
        seen.add(image);
        merged.push(image);
      }
    });
  });

  return merged;
}

function normalizeUploadList(value) {
  const list = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];

  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const uploadToken = String(item.uploadToken || item.upload_token || "").trim();
      if (!uploadToken) return null;

      return {
        uploadKind: String(item.uploadKind || item.upload_kind || "").trim(),
        uploadToken,
        originalFileName: String(item.originalFileName || item.original_file_name || "").trim()
      };
    })
    .filter(Boolean);
}

export function normalizeCartItem(item) {
  const stock = Number(item?.stock || 0);
  const rawQuantity = Math.max(1, Number(item?.quantity || 1));
  const quantity = stock > 0 ? Math.min(rawQuantity, stock) : rawQuantity;
  const rentalDays = Math.max(1, Number(item?.rental_days || item?.rentalDays || 1));
  const mode = item?.mode === "rent" ? "rent" : "buy";
  const images = mergeUniqueImageLists(
    item?.images,
    item?.light_images,
    item?.dark_images,
    item?.image_url,
    item?.image
  );
  const variationId = item?.variation_id === null || item?.variation_id === undefined || item?.variation_id === ""
    ? item?.variationId
    : item?.variation_id;
  const uploads = normalizeUploadList(item?.customization_uploads || item?.customizationUploads);

  return {
    cart_item_key: String(item?.cart_item_key ?? item?.cartItemKey ?? `${item?.id ?? ""}-${mode}`),
    package_meta:
      item?.package_meta && typeof item.package_meta === "object"
        ? item.package_meta
        : item?.packageMeta && typeof item.packageMeta === "object"
          ? item.packageMeta
          : null,
    id: String(item?.id ?? ""),
    product_id: String(item?.product_id ?? ""),
    name: String(item?.name ?? "Unnamed Item"),
    slug: String(item?.slug ?? ""),
    category: String(item?.category ?? "General"),
    subcategory: String(item?.subcategory ?? "General"),
    description: String(item?.description ?? ""),
    dark_images: images,
    image_url: images[0] || String(item?.image_url ?? item?.image ?? ""),
    images,
    light_images: images,
    mode,
    variation_id:
      variationId === null || variationId === undefined || variationId === ""
        ? null
        : String(variationId),
    selected_color: String(item?.selected_color ?? item?.selectedColor ?? ""),
    selected_size: String(item?.selected_size ?? item?.selectedSize ?? ""),
    sku: String(item?.sku ?? ""),
    customization_uploads: uploads,
    customization_requested: uploads.length > 0 || Boolean(item?.customization_requested ?? item?.customizationRequested),
    quantity,
    rental_days: mode === "rent" ? rentalDays : 1,
    unit_price: Math.max(0, Number(item?.unit_price ?? item?.price ?? 0)),
    currency: String(item?.currency || "USD"),
    stock,
    customizable: Boolean(item?.customizable),
    buy_enabled: Boolean(item?.buy_enabled ?? mode === "buy"),
    rent_enabled: Boolean(item?.rent_enabled ?? mode === "rent"),
    event_type_hint: String(item?.event_type_hint ?? item?.eventTypeHint ?? "")
  };
}
