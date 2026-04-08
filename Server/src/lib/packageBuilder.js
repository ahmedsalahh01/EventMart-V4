const { normalizeCatalogText } = require("./catalog");
const { roundCurrency } = require("./checkout");
const { resolveEventType } = require("./eventTypeConfig");

const PACKAGE_STATUS_VALUES = Object.freeze(["draft", "active", "inactive"]);
const PACKAGE_VISIBILITY_VALUES = Object.freeze(["public", "private", "hidden"]);
const PACKAGE_BUILDER_CATEGORY_ORDER = Object.freeze([
  "merch",
  "giveaways",
  "tech",
  "stage",
  "screen",
  "sound",
  "woodwork"
]);
const PACKAGE_BUILDER_CATEGORY_DEFINITIONS = Object.freeze([
  {
    key: "merch",
    label: "Merch",
    keywords: ["merch", "merchandise", "apparel", "shirt", "t-shirt", "hoodie", "cap", "hat", "wearable", "lanyard"]
  },
  {
    key: "giveaways",
    label: "Giveaways",
    keywords: ["giveaway", "gift", "souvenir", "promo", "rubber wristband", "wristband", "badge", "keychain"]
  },
  {
    key: "tech",
    label: "Tech",
    keywords: ["tech", "lighting", "uplight", "led", "electronic", "wireless", "controller", "accessory", "accessories"]
  },
  {
    key: "stage",
    label: "Stage",
    keywords: ["stage", "staging", "truss", "riser", "platform"]
  },
  {
    key: "screen",
    label: "Screen",
    keywords: ["screen", "display", "led wall", "panel", "projector", "videowall"]
  },
  {
    key: "sound",
    label: "Sound System",
    keywords: ["sound", "speaker", "audio", "microphone", "mic", "mixer", "dj", "subwoofer"]
  },
  {
    key: "woodwork",
    label: "Woodwork / Gate",
    keywords: ["woodwork", "gate", "arch", "podium", "booth", "backdrop", "counter", "display stand"]
  }
]);
const PACKAGE_BUILDER_CATEGORY_MAP = Object.freeze(
  Object.fromEntries(PACKAGE_BUILDER_CATEGORY_DEFINITIONS.map((entry) => [entry.key, entry]))
);
const DELIVERY_CLASS_FEES = Object.freeze({
  standard: 180,
  fragile: 280,
  oversized: 420
});
const PACKAGE_ITEM_DISCOUNT_RATE = 0.15;
const DELIVERY_PLACE_WINDOWS = Object.freeze({
  metro: {
    maxLeadDays: 3,
    minLeadDays: 2,
    places: ["cairo", "giza", "qalyubia"]
  },
  regional: {
    maxLeadDays: 4,
    minLeadDays: 3,
    places: ["alexandria", "dakahlia", "gharbia", "monufia", "sharqia", "suez", "ismailia"]
  },
  extended: {
    maxLeadDays: 6,
    minLeadDays: 4,
    places: []
  }
});

function normalizeText(value, maxLength = 200) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeLookupToken(value) {
  return normalizeText(value, 120)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toWholeNumber(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = normalizeLookupToken(value);
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeTextList(value, maxLength = 120) {
  const list = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];

  return Array.from(
    new Set(
      list
        .flatMap((item) => {
          if (Array.isArray(item)) return normalizeTextList(item, maxLength);
          if (typeof item === "string") {
            const trimmed = item.trim();
            if (!trimmed) return [];

            if (
              (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
              (trimmed.startsWith("{") && trimmed.endsWith("}"))
            ) {
              try {
                return normalizeTextList(JSON.parse(trimmed), maxLength);
              } catch (_error) {
                return trimmed.split(/,|\r?\n/).map((entry) => normalizeText(entry, maxLength)).filter(Boolean);
              }
            }

            return trimmed.split(/,|\r?\n/).map((entry) => normalizeText(entry, maxLength)).filter(Boolean);
          }

          if (item && typeof item === "object") {
            return normalizeTextList(
              item.value || item.label || item.name || item.values || item.items || item.options || "",
              maxLength
            );
          }

          return [];
        })
        .map((entry) => normalizeText(entry, maxLength))
        .filter(Boolean)
        .map((entry) => entry.toLowerCase())
    )
  );
}

function normalizeMode(value, product = null) {
  const normalized = normalizeLookupToken(value);
  if (normalized === "rent") return "rent";
  if (normalized === "buy") return "buy";

  if (product?.buy_enabled) return "buy";
  if (product?.rent_enabled) return "rent";
  return "buy";
}

function formatDeliveryDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getCategorySearchText(product) {
  return normalizeText(
    [
      product?.productName,
      product?.name,
      product?.description,
      product?.category,
      product?.subcategory,
      ...(Array.isArray(product?.tags) ? product.tags : [])
    ]
      .filter(Boolean)
      .join(" "),
    500
  ).toLowerCase();
}

function textIncludesKeyword(text, keyword) {
  return text.includes(normalizeText(keyword, 120).toLowerCase());
}

function getBuilderCategory(product) {
  const text = getCategorySearchText(product);

  for (const definition of PACKAGE_BUILDER_CATEGORY_DEFINITIONS) {
    if (definition.keywords.some((keyword) => textIncludesKeyword(text, keyword))) {
      return definition.key;
    }
  }

  return "tech";
}

function getBuilderCategoryLabel(categoryKey) {
  return PACKAGE_BUILDER_CATEGORY_MAP[categoryKey]?.label || "Tech";
}

function normalizeDiscountTiers(value) {
  const list = Array.isArray(value) ? value : [];

  return list
    .map((tier, index) => {
      const minQuantity = Math.max(1, toWholeNumber(tier?.minQuantity ?? tier?.min_quantity, index === 0 ? 1 : 0));
      const rawMaxQuantity = tier?.maxQuantity ?? tier?.max_quantity;
      const maxQuantity =
        rawMaxQuantity === null || rawMaxQuantity === undefined || rawMaxQuantity === ""
          ? null
          : Math.max(minQuantity, toWholeNumber(rawMaxQuantity, minQuantity));
      const discountPercent = Math.max(0, toNumber(tier?.discountPercent ?? tier?.discount_percent, 0));
      const unitPriceOverride = tier?.unitPriceOverride ?? tier?.unit_price_override;

      return {
        discountPercent: Number(discountPercent.toFixed(2)),
        label: normalizeText(tier?.label, 80),
        maxQuantity,
        minQuantity,
        unitPriceOverride:
          unitPriceOverride === null || unitPriceOverride === undefined || unitPriceOverride === ""
            ? null
            : roundCurrency(Math.max(0, toNumber(unitPriceOverride, 0)))
      };
    })
    .filter((tier) => tier.minQuantity > 0)
    .sort((left, right) => left.minQuantity - right.minQuantity || (left.maxQuantity || Number.MAX_SAFE_INTEGER) - (right.maxQuantity || Number.MAX_SAFE_INTEGER));
}

function getBuiltInDiscountTiers(product) {
  const text = getCategorySearchText(product);

  if (text.includes("rubber wristband")) {
    // The pricing engine supports the full tier table below for future reuse, but the
    // current builder quantity cap keeps rubber wristbands at 50 units max.
    return normalizeDiscountTiers([
      { minQuantity: 1, maxQuantity: 50, discountPercent: 0, label: "Basic" },
      { minQuantity: 51, maxQuantity: 100, discountPercent: 3.7 },
      { minQuantity: 101, maxQuantity: 150, discountPercent: 7.46 },
      { minQuantity: 151, maxQuantity: null, discountPercent: 11.5 }
    ]);
  }

  return [];
}

function getMatchingDiscountTier(tiers, quantity) {
  const safeQuantity = Math.max(1, toWholeNumber(quantity, 1));
  return tiers.reduce((matched, tier) => {
    const maxQuantity = tier.maxQuantity === null ? Number.POSITIVE_INFINITY : tier.maxQuantity;
    if (safeQuantity >= tier.minQuantity && safeQuantity <= maxQuantity) {
      return tier;
    }
    return matched;
  }, null);
}

function resolvePackageVisibility(value) {
  const normalized = normalizeLookupToken(value);
  return PACKAGE_VISIBILITY_VALUES.find((entry) => entry === normalized) || "public";
}

function resolvePackageStatus(value) {
  const normalized = normalizeLookupToken(value);
  return PACKAGE_STATUS_VALUES.find((entry) => entry === normalized) || "draft";
}

function resolvePackageMode(value) {
  const normalized = normalizeLookupToken(value);
  return ["buy", "rent", "hybrid"].includes(normalized) ? normalized : "hybrid";
}

function normalizePackageContext(value = {}) {
  const eventType = resolveEventType(value?.eventType || value?.event_type);
  const venueType = ["indoor", "outdoor", "hybrid"].includes(normalizeLookupToken(value?.venueType || value?.venue_type))
    ? normalizeLookupToken(value?.venueType || value?.venue_type)
    : "";

  return {
    budget: Math.max(0, toNumber(value?.budget, 0)),
    customizationAvailable: parseBoolean(
      value?.customizationAvailable ??
      value?.customization_available ??
      value?.itemsCanBeCustomized ??
      value?.items_can_be_customized,
      false
    ),
    deliveryPlace: normalizeText(value?.deliveryPlace || value?.delivery_place, 80),
    eventType,
    guestCount: Math.max(0, toWholeNumber(value?.guestCount ?? value?.guest_count, 0)),
    minimumPackagePrice: Math.max(0, toNumber(value?.minimumPackagePrice ?? value?.minimum_package_price, 0)),
    packageMode: resolvePackageMode(value?.packageMode ?? value?.package_mode),
    packagePrice: Math.max(0, toNumber(value?.packagePrice ?? value?.package_price, 0)),
    venueSize: normalizeText(value?.venueSize || value?.venue_size, 80),
    venueType
  };
}

function getEventQuantityLimit(categoryKey, eventType) {
  if (categoryKey !== "merch" && categoryKey !== "giveaways") {
    return Number.POSITIVE_INFINITY;
  }

  if (["private-party", "birthday"].includes(eventType)) {
    return 10;
  }

  if (["corporate", "indoor", "outdoor", "wedding"].includes(eventType)) {
    return 20;
  }

  return Number.POSITIVE_INFINITY;
}

function getProductQuantityLimit(product, categoryKey, eventType) {
  const limits = [getEventQuantityLimit(categoryKey, eventType)];
  const text = getCategorySearchText(product);
  const stock = Math.max(0, toWholeNumber(product?.quantity_available, 0));

  if (stock === 0) {
    return 0;
  }

  if (text.includes("rubber wristband")) {
    limits.push(50);
  }

  // Current catalog stores screens as quantity counts rather than linear meters, so
  // the 6-meter business rule is enforced as a maximum builder quantity of 6 units.
  if (categoryKey === "screen") {
    limits.push(6);
  }

  // Sound systems are modeled as unit/set counts in the current catalog.
  if (categoryKey === "sound") {
    limits.push(2);
  }

  limits.push(stock);

  return limits.reduce((smallest, value) => {
    if (!Number.isFinite(value) || value <= 0) return smallest;
    return Math.min(smallest, value);
  }, Number.POSITIVE_INFINITY);
}

function productMatchesEventType(product, eventType) {
  const productEventTypes = normalizeTextList(product?.event_type || "");
  if (!eventType || !productEventTypes.length) return true;

  return productEventTypes.some((entry) => resolveEventType(entry) === eventType);
}

function productMatchesVenueType(product, venueType) {
  const productVenueTypes = normalizeTextList(product?.venue_type || "");
  if (!venueType || !productVenueTypes.length) return true;

  return productVenueTypes.some((entry) => {
    const normalized = normalizeLookupToken(entry);
    return normalized === venueType || normalized === "both" || normalized === "indoor-outdoor";
  });
}

function getEligibility(product, context) {
  const reasons = [];

  if (product?.active === false) {
    reasons.push("This product is inactive.");
  }

  if (!productMatchesEventType(product, context.eventType)) {
    reasons.push("This product is not configured for the selected event type.");
  }

  if (!productMatchesVenueType(product, context.venueType)) {
    reasons.push("This product is not configured for the selected venue type.");
  }

  return {
    eligible: reasons.length === 0,
    reasons
  };
}

function getUnitPriceForMode(product, mode) {
  const normalizedMode = normalizeMode(mode, product);
  const buyPrice = product?.buy_price === null || product?.buy_price === undefined ? null : Number(product.buy_price);
  const rentPrice =
    product?.rent_price_per_day === null || product?.rent_price_per_day === undefined
      ? null
      : Number(product.rent_price_per_day);

  if (normalizedMode === "rent") {
    if (Number.isFinite(rentPrice) && rentPrice >= 0) return roundCurrency(rentPrice);
    if (Number.isFinite(buyPrice) && buyPrice >= 0) return roundCurrency(buyPrice);
  }

  if (Number.isFinite(buyPrice) && buyPrice >= 0) return roundCurrency(buyPrice);
  if (Number.isFinite(rentPrice) && rentPrice >= 0) return roundCurrency(rentPrice);
  return null;
}

function getCategoryRequirement(categoryKey, context) {
  const guestCount = Math.max(0, Number(context?.guestCount || 0));
  const venueType = normalizeLookupToken(context?.venueType);
  const eventType = resolveEventType(context?.eventType);

  if (categoryKey === "sound") {
    if (guestCount >= 40) {
      return { level: "required", message: "Sound coverage is required for guest counts above 40." };
    }
    if (guestCount >= 20) {
      return { level: "recommended", message: "A compact sound setup is recommended at this guest count." };
    }
  }

  if (categoryKey === "stage") {
    if (venueType === "outdoor" && guestCount >= 80) {
      return { level: "required", message: "Outdoor events at this capacity need a stage-ready setup." };
    }
    if (guestCount >= 120) {
      return { level: "recommended", message: "Consider staging support for better visibility." };
    }
  }

  if (categoryKey === "screen") {
    if (eventType === "corporate" || guestCount >= 100) {
      return { level: "required", message: "Screens are required for corporate or large-capacity plans." };
    }
    if (guestCount >= 60) {
      return { level: "recommended", message: "Screens improve visibility at this venue size." };
    }
  }

  if (categoryKey === "woodwork") {
    if (["wedding", "corporate"].includes(eventType)) {
      return { level: "recommended", message: "Branded or decorative woodwork fits this event style well." };
    }
  }

  if (categoryKey === "tech") {
    if (eventType === "corporate" || venueType === "indoor") {
      return { level: "recommended", message: "Tech accessories and lighting help complete the setup." };
    }
  }

  if (["birthday", "private-party"].includes(eventType) && (categoryKey === "merch" || categoryKey === "giveaways")) {
    return { level: "recommended", message: "Personalized merch and giveaways are strong fits for this event type." };
  }

  return { level: "optional", message: "Optional for this package." };
}

function getDeliveryEstimate(context, lines = []) {
  const deliveryPlace = normalizeLookupToken(context?.deliveryPlace);
  const totalUnits = lines.reduce((sum, line) => sum + Number(line?.quantity || 0), 0);
  const hasOversized = lines.some((line) => normalizeLookupToken(line?.deliveryClass) === "oversized");
  const placeWindow =
    Object.values(DELIVERY_PLACE_WINDOWS).find((entry) =>
      entry.places.some((place) => place === deliveryPlace)
    ) || DELIVERY_PLACE_WINDOWS.extended;
  const minLeadDays = placeWindow.minLeadDays + (hasOversized ? 1 : 0);
  const maxLeadDays = placeWindow.maxLeadDays + (totalUnits >= 12 ? 1 : 0);
  const from = addDays(new Date(), minLeadDays);
  const to = addDays(new Date(), maxLeadDays);

  return {
    label: `${formatDeliveryDate(from)} - ${formatDeliveryDate(to)}`,
    place: normalizeText(context?.deliveryPlace, 80),
    shippingWindowDays: {
      max: maxLeadDays,
      min: minLeadDays
    }
  };
}

function getShippingBaseFee(lines) {
  const fees = lines.map((line) => {
    const deliveryClass = normalizeLookupToken(line?.deliveryClass);
    return DELIVERY_CLASS_FEES[deliveryClass] || DELIVERY_CLASS_FEES.standard;
  });

  return fees.length ? Math.max(...fees) : 0;
}

function isFreeShippingEligible(lines) {
  const byCategory = lines.reduce((map, line) => {
    const categoryKey = line?.builderCategory || "tech";
    map[categoryKey] = Number(map[categoryKey] || 0) + Math.max(0, Number(line?.quantity || 0));
    return map;
  }, {});

  return Object.values(byCategory).some((count) => count >= 4);
}

function normalizePackageMeta(rawMeta = {}, fallback = {}) {
  const context = normalizePackageContext(rawMeta?.context || fallback.context || {});

  return {
    builderCategory: rawMeta?.builderCategory || fallback.builderCategory || "tech",
    customizationRequested: parseBoolean(
      rawMeta?.customizationRequested ?? rawMeta?.customization_requested,
      parseBoolean(fallback.customizationRequested, false)
    ),
    context,
    minimumPackagePrice: Math.max(
      0,
      toNumber(
        rawMeta?.minimumPackagePrice ??
        rawMeta?.minimum_package_price ??
        fallback.minimumPackagePrice ??
        context?.minimumPackagePrice,
        0
      )
    ),
    minimumQuantity: Math.max(1, toWholeNumber(rawMeta?.minimumQuantity ?? fallback.minimumQuantity, 1)),
    packageGroupId: normalizeText(rawMeta?.packageGroupId || fallback.packageGroupId, 120) || "package-preview",
    packageId: rawMeta?.packageId === null || rawMeta?.packageId === undefined || rawMeta?.packageId === ""
      ? null
      : Number(rawMeta.packageId),
    packageItemId: rawMeta?.packageItemId === null || rawMeta?.packageItemId === undefined || rawMeta?.packageItemId === ""
      ? null
      : Number(rawMeta.packageItemId),
    packageName: normalizeText(rawMeta?.packageName || fallback.packageName, 160),
    quantityDiscountTiers: normalizeDiscountTiers(rawMeta?.quantityDiscountTiers || fallback.quantityDiscountTiers || []),
    required: parseBoolean(rawMeta?.required, parseBoolean(fallback.required, false)),
    source: normalizeText(rawMeta?.source || fallback.source, 40) || "package-builder"
  };
}

function applyPricingToResolvedLines(lines = []) {
  const resultLines = [];
  const packageGroups = [];
  const standardLines = [];

  const groupedPackageLines = lines.reduce((map, line) => {
    if (!line?.packageMeta?.packageGroupId) {
      standardLines.push({
        ...line,
        chargedLineTotal: roundCurrency(Number(line?.lineTotal || 0)),
        customizationFee: 0,
        effectiveUnitPrice: roundCurrency(Number(line?.unitPrice || 0)),
        itemDiscount: 0,
        matchedTier: null
      });
      return map;
    }

    const key = line.packageMeta.packageGroupId;
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(line);
    return map;
  }, {});

  standardLines.forEach((line) => {
    resultLines.push(line);
  });

  Object.values(groupedPackageLines).forEach((groupLines) => {
    const enrichedLines = groupLines.map((line) => {
      const tiers = line.packageMeta.quantityDiscountTiers.length
        ? line.packageMeta.quantityDiscountTiers
        : getBuiltInDiscountTiers(line);
      const matchedTier = getMatchingDiscountTier(tiers, line.quantity);
      const multiplier = line.mode === "rent" ? Math.max(1, Number(line.rentalDays || 1)) : 1;
      const baseUnitPrice = roundCurrency(Number(line.unitPrice || 0));
      const tierAdjustedUnitPrice = matchedTier?.unitPriceOverride !== null && matchedTier?.unitPriceOverride !== undefined
        ? roundCurrency(Number(matchedTier.unitPriceOverride))
        : roundCurrency(baseUnitPrice * (1 - Number(matchedTier?.discountPercent || 0) / 100));
      const effectiveUnitPrice = roundCurrency(tierAdjustedUnitPrice * (1 - PACKAGE_ITEM_DISCOUNT_RATE));
      const lineBaseSubtotal = roundCurrency(baseUnitPrice * Number(line.quantity || 0) * multiplier);
      const discountedItemsSubtotal = roundCurrency(effectiveUnitPrice * Number(line.quantity || 0) * multiplier);
      const itemDiscount = roundCurrency((baseUnitPrice - effectiveUnitPrice) * Number(line.quantity || 0) * multiplier);
      const customizationFee =
        line.packageMeta.customizationRequested || line.customizationRequested
          ? roundCurrency(Number(line.productCustomizationFee || 0) * Number(line.quantity || 0))
          : 0;
      const chargedLineTotal = roundCurrency(
        discountedItemsSubtotal + customizationFee
      );

      return {
        ...line,
        chargedLineTotal,
        customizationFee,
        discountedItemsSubtotal,
        effectiveUnitPrice,
        itemDiscount,
        lineBaseSubtotal,
        matchedTier
      };
    });

    const currency = Array.from(new Set(enrichedLines.map((line) => String(line.currency || "EGP"))))[0] || "EGP";
    const subtotal = roundCurrency(enrichedLines.reduce((sum, line) => sum + Number(line.chargedLineTotal || 0), 0));
    const baseSubtotal = roundCurrency(enrichedLines.reduce((sum, line) => sum + Number(line.lineBaseSubtotal || 0), 0));
    const discountedItemsSubtotal = roundCurrency(
      enrichedLines.reduce((sum, line) => sum + Number(line.discountedItemsSubtotal || 0), 0)
    );
    const itemDiscounts = roundCurrency(enrichedLines.reduce((sum, line) => sum + Number(line.itemDiscount || 0), 0));
    const customizationFees = roundCurrency(enrichedLines.reduce((sum, line) => sum + Number(line.customizationFee || 0), 0));
    const bundleDiscount = 0;
    const freeShipping = isFreeShippingEligible(enrichedLines);
    const shipping = freeShipping ? 0 : getShippingBaseFee(enrichedLines);
    const total = roundCurrency(subtotal + shipping);
    const context = enrichedLines[0]?.packageMeta?.context || {};
    const minimumPackagePrice = Math.max(0, Number(enrichedLines[0]?.packageMeta?.minimumPackagePrice || 0));
    const remainingToMinimumPrice = roundCurrency(Math.max(0, minimumPackagePrice - discountedItemsSubtotal));

    packageGroups.push({
      baseSubtotal,
      bundleDiscount,
      currency,
      customizationFees,
      deliveryEstimate: getDeliveryEstimate(context, enrichedLines),
      discountedItemsSubtotal,
      freeShipping,
      itemCount: enrichedLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
      itemDiscounts,
      lines: enrichedLines,
      meetsMinimumPackagePrice: remainingToMinimumPrice <= 0,
      minimumPackagePrice,
      packageGroupId: enrichedLines[0]?.packageMeta?.packageGroupId || "package-preview",
      packageId: enrichedLines[0]?.packageMeta?.packageId || null,
      packageName: enrichedLines[0]?.packageMeta?.packageName || "Package",
      remainingToMinimumPrice,
      shipping,
      subtotal,
      total
    });

    enrichedLines.forEach((line) => {
      resultLines.push(line);
    });
  });

  const subtotal = roundCurrency(resultLines.reduce((sum, line) => sum + Number(line.chargedLineTotal || 0), 0));
  const shipping = roundCurrency(packageGroups.reduce((sum, group) => sum + Number(group.shipping || 0), 0));
  const discount = roundCurrency(packageGroups.reduce((sum, group) => sum + Number(group.bundleDiscount || 0), 0));
  const total = roundCurrency(subtotal + shipping - discount);

  return {
    discount,
    itemCount: resultLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
    lines: resultLines,
    packageGroups,
    shipping,
    subtotal,
    total
  };
}

function buildCartItemMeta({ context, packageDefinition, packageGroupId, packageItemConfig, product }) {
  return normalizePackageMeta(
    {
      builderCategory: getBuilderCategory(product),
      context,
      minimumPackagePrice: packageDefinition?.contextDefaults?.minimumPackagePrice ?? context?.minimumPackagePrice ?? 0,
      packageGroupId,
      packageId: packageDefinition?.id || null,
      packageItemId: packageItemConfig?.id || null,
      packageName: packageDefinition?.name || "Custom Package",
      quantityDiscountTiers: packageItemConfig?.discountTiers || [],
      required: packageItemConfig?.required,
      source: packageDefinition?.id ? "package" : "package-builder"
    },
    {
      minimumQuantity: packageItemConfig?.minimumQuantity || 1
    }
  );
}

function buildBuilderPreview({
  catalogProducts = [],
  context = {},
  packageDefinition = null,
  packageGroupId = "package-preview",
  selectedItems = []
}) {
  const normalizedContext = normalizePackageContext(context);
  const selectedMap = new Map(
    (Array.isArray(selectedItems) ? selectedItems : [])
      .map((entry) => {
        const productId = Number(entry?.productId ?? entry?.product_id);
        if (!Number.isInteger(productId) || productId <= 0) return null;

        return [
          productId,
          {
            customizationRequested: parseBoolean(
              entry?.customizationRequested ?? entry?.customization_requested,
              false
            ),
            mode: normalizeMode(entry?.mode),
            quantity: Math.max(0, toWholeNumber(entry?.quantity, 0))
          }
        ];
      })
      .filter(Boolean)
  );
  const packageItemMap = new Map(
    (Array.isArray(packageDefinition?.items) ? packageDefinition.items : []).map((item) => [
      Number(item.productId || item.product_id || item?.product?.id || 0),
      item
    ])
  );

  const productRows = catalogProducts.map((product) => {
    const builderCategory = getBuilderCategory(product);
    const selection = selectedMap.get(Number(product.id)) || null;
    const packageItemConfig = packageItemMap.get(Number(product.id)) || null;
    const eligibility = getEligibility(product, normalizedContext);
    const maxQuantity = getProductQuantityLimit(product, builderCategory, normalizedContext.eventType);
    const quantity = Math.max(
      0,
      Number(selection ? selection.quantity : packageItemConfig?.defaultQuantity ?? 0)
    );
    const defaultMode = normalizeMode(
      selection ? selection.mode : packageItemConfig?.preferredMode,
      product
    );

    return {
      active: product.active !== false,
      builderCategory,
      builderCategoryLabel: getBuilderCategoryLabel(builderCategory),
      buyEnabled: Boolean(product?.buy_enabled),
      buyPrice: product?.buy_price === null || product?.buy_price === undefined ? null : Number(product.buy_price),
      category: normalizeCatalogText(product?.category, 120),
      currency: normalizeText(product?.currency || "EGP", 6) || "EGP",
      customizable: Boolean(product?.customizable),
      customizationFee: roundCurrency(Number(product?.customization_fee || 0)),
      customizationRequested: Boolean(selection?.customizationRequested),
      defaultMode,
      deliveryClass: normalizeText(product?.delivery_class, 60),
      description: normalizeText(product?.description, 260),
      discountTiers: packageItemConfig?.discountTiers?.length
        ? packageItemConfig.discountTiers
        : getBuiltInDiscountTiers(product),
      eligibility,
      id: Number(product.id),
      imageUrl: normalizeText(product?.image_url, 2048),
      isSelected: quantity > 0,
      maxQuantity: Number.isFinite(maxQuantity) ? maxQuantity : null,
      name: normalizeText(product?.name, 160),
      packageItemConfig,
      productId: normalizeText(product?.product_id, 20),
      quantity,
      rentEnabled: Boolean(product?.rent_enabled),
      rentPricePerDay:
        product?.rent_price_per_day === null || product?.rent_price_per_day === undefined
          ? null
          : Number(product.rent_price_per_day),
      slug: normalizeText(product?.slug, 180),
      stock: Math.max(0, Number(product?.quantity_available || 0)),
      subcategory: normalizeCatalogText(product?.subcategory, 120)
    };
  });

  const selectedLines = [];
  const validationIssues = [];

  productRows.forEach((row) => {
    if (!row.isSelected) return;

    if (!row.eligibility.eligible) {
      validationIssues.push({
        code: "ineligible_item",
        level: "error",
        message: `${row.name} is not eligible for the selected event setup.`
      });
      return;
    }

    if (row.maxQuantity !== null && row.quantity > row.maxQuantity) {
      validationIssues.push({
        code: "quantity_limit",
        level: "error",
        message: `${row.name} cannot exceed ${row.maxQuantity} in this package.`
      });
      return;
    }

    const unitPrice = getUnitPriceForMode(
      {
        buy_enabled: row.buyPrice !== null,
        buy_price: row.buyPrice,
        rent_enabled: row.rentPricePerDay !== null,
        rent_price_per_day: row.rentPricePerDay
      },
      row.defaultMode
    );

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      validationIssues.push({
        code: "missing_price",
        level: "error",
        message: `${row.name} does not have a valid ${row.defaultMode} price.`
      });
      return;
    }

    const packageMeta = buildCartItemMeta({
      context: normalizedContext,
      packageDefinition,
      packageGroupId,
      packageItemConfig: row.packageItemConfig,
      product: row
    });
    packageMeta.customizationRequested = row.customizationRequested;

    selectedLines.push({
      builderCategory: row.builderCategory,
      category: row.category,
      currency: row.currency,
      customizationRequested: row.customizationRequested,
      deliveryClass: row.deliveryClass,
      description: row.description,
      lineTotal: roundCurrency(unitPrice * row.quantity),
      mode: row.defaultMode,
      packageMeta,
      productCustomizationFee: row.customizationFee,
      productId: row.id,
      productName: row.name,
      quantity: row.quantity,
      rentalDays: row.defaultMode === "rent" ? 1 : null,
      selectedColor: "Standard",
      selectedSize: "Default",
      subcategory: row.subcategory,
      unitPrice
    });

    if (row.packageItemConfig?.required && row.quantity < Math.max(1, Number(row.packageItemConfig.minimumQuantity || 1))) {
      validationIssues.push({
        code: "minimum_quantity",
        level: "error",
        message: `${row.name} must stay at or above ${row.packageItemConfig.minimumQuantity} for this package.`
      });
    }
  });

  if (selectedLines.length < 4) {
    validationIssues.push({
      code: "minimum_products",
      level: "error",
      message: "Select at least 4 products before continuing."
    });
  }

  const categorySelections = selectedLines.reduce((map, line) => {
    const categoryKey = line.builderCategory;
    if (!map[categoryKey]) {
      map[categoryKey] = {
        productCount: 0,
        quantity: 0
      };
    }
    map[categoryKey].productCount += 1;
    map[categoryKey].quantity += Number(line.quantity || 0);
    return map;
  }, {});

  const categoryRequirements = PACKAGE_BUILDER_CATEGORY_ORDER.map((categoryKey) => {
    const requirement = getCategoryRequirement(categoryKey, normalizedContext);
    const selection = categorySelections[categoryKey] || { productCount: 0, quantity: 0 };

    if (requirement.level === "required" && selection.productCount < 1) {
      validationIssues.push({
        code: `required_${categoryKey}`,
        level: "error",
        message: `${getBuilderCategoryLabel(categoryKey)} is required for this package setup.`
      });
    }

    return {
      key: categoryKey,
      label: getBuilderCategoryLabel(categoryKey),
      level: requirement.level,
      message: requirement.message,
      selectedProductCount: selection.productCount,
      selectedQuantity: selection.quantity
    };
  });

  const pricing = applyPricingToResolvedLines(selectedLines);
  const fallbackMinimumPackagePrice = Math.max(
    0,
    Number(packageDefinition?.contextDefaults?.minimumPackagePrice || normalizedContext.minimumPackagePrice || 0)
  );
  const packageSummary = pricing.packageGroups[0] || {
    baseSubtotal: 0,
    bundleDiscount: 0,
    currency: selectedLines[0]?.currency || "EGP",
    customizationFees: 0,
    deliveryEstimate: getDeliveryEstimate(normalizedContext, selectedLines),
    discountedItemsSubtotal: 0,
    freeShipping: false,
    itemCount: 0,
    itemDiscounts: 0,
    meetsMinimumPackagePrice: fallbackMinimumPackagePrice <= 0,
    minimumPackagePrice: fallbackMinimumPackagePrice,
    remainingToMinimumPrice: fallbackMinimumPackagePrice,
    shipping: 0,
    subtotal: 0,
    total: 0
  };

  if (packageSummary.minimumPackagePrice > 0 && !packageSummary.meetsMinimumPackagePrice) {
    validationIssues.push({
      code: "minimum_package_price",
      level: "error",
      message: `Add more items to reach the minimum package price of ${packageSummary.currency} ${packageSummary.minimumPackagePrice.toFixed(2)}. Add ${packageSummary.currency} ${packageSummary.remainingToMinimumPrice.toFixed(2)} more to proceed.`
    });
  }

  if (normalizedContext.budget > 0 && packageSummary.total > normalizedContext.budget) {
    validationIssues.push({
      code: "budget_overrun",
      level: "warning",
      message: `This package is ${roundCurrency(packageSummary.total - normalizedContext.budget)} over the selected budget.`
    });
  }

  return {
    canCheckout: !validationIssues.some((issue) => issue.level === "error") && pricing.lines.length >= 4,
    categories: categoryRequirements,
    context: normalizedContext,
    packageDefinition: packageDefinition
      ? {
          customizationAvailable: Boolean(packageDefinition?.contextDefaults?.customizationAvailable),
          guestCount: Math.max(0, Number(packageDefinition?.contextDefaults?.guestCount || 0)),
          id: packageDefinition.id || null,
          name: packageDefinition.name,
          packageMode: resolvePackageMode(packageDefinition?.contextDefaults?.packageMode),
          packagePrice: Math.max(0, Number(packageDefinition?.contextDefaults?.packagePrice || 0)),
          minimumPackagePrice: Math.max(0, Number(packageDefinition?.contextDefaults?.minimumPackagePrice || 0)),
          slug: packageDefinition.slug || "",
          status: packageDefinition.status || "draft",
          venueType: normalizeText(packageDefinition?.contextDefaults?.venueType, 40)
        }
      : null,
    packageGroupId,
    products: productRows,
    selectedItems: pricing.lines.map((line) => ({
      builderCategory: line.builderCategory,
      chargedLineTotal: line.chargedLineTotal,
      currency: line.currency,
      customizationFee: line.customizationFee,
      effectiveUnitPrice: line.effectiveUnitPrice,
      id: line.productId,
      itemDiscount: line.itemDiscount,
      matchedTier: line.matchedTier,
      mode: line.mode,
      name: line.productName,
      packageMeta: line.packageMeta,
      quantity: line.quantity,
      unitPrice: line.unitPrice
    })),
    summary: {
      baseSubtotal: packageSummary.baseSubtotal,
      bundleDiscount: packageSummary.bundleDiscount,
      currency: packageSummary.currency,
      customizationFees: packageSummary.customizationFees,
      deliveryEstimate: packageSummary.deliveryEstimate,
      discountedItemsSubtotal: packageSummary.discountedItemsSubtotal,
      finalTotal: packageSummary.total,
      freeShipping: packageSummary.freeShipping,
      itemDiscounts: packageSummary.itemDiscounts,
      meetsMinimumPackagePrice: packageSummary.meetsMinimumPackagePrice,
      minimumPackagePrice: packageSummary.minimumPackagePrice,
      remainingToMinimumPrice: packageSummary.remainingToMinimumPrice,
      shipping: packageSummary.shipping,
      subtotal: packageSummary.subtotal
    },
    validations: validationIssues
  };
}

module.exports = {
  PACKAGE_BUILDER_CATEGORY_DEFINITIONS,
  PACKAGE_BUILDER_CATEGORY_ORDER,
  PACKAGE_STATUS_VALUES,
  PACKAGE_VISIBILITY_VALUES,
  applyPricingToResolvedLines,
  buildBuilderPreview,
  getBuilderCategory,
  getBuilderCategoryLabel,
  getBuiltInDiscountTiers,
  getCategoryRequirement,
  getEligibility,
  getProductQuantityLimit,
  getShippingBaseFee,
  getUnitPriceForMode,
  isFreeShippingEligible,
  normalizeDiscountTiers,
  normalizePackageContext,
  normalizePackageMeta,
  resolvePackageMode,
  resolvePackageStatus,
  resolvePackageVisibility
};
