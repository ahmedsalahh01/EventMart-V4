const RAW_EVENT_TYPE_CONFIG = {
  "private-party": {
    slug: "private-party",
    label: "Private Party / Bachelorette",
    plannerLabel: "Private Party / Bachelorette",
    shopHeading: "Private Party Products",
    shopCtaLabel: "Shop Private Party Products",
    headingDescription: "Curated merch, giveaways, compact sound, and decor-friendly pieces for personal celebrations.",
    cardDescription: "Compact merch, giveaways, lighting, and audio for intimate celebrations.",
    aliases: [
      "private parties",
      "private party",
      "private party / bachelorette",
      "bachelorette",
      "bachelorette party"
    ],
    allowedCategories: ["merch", "giveaways", "sound", "lighting", "woodwork", "stage", "screen"],
    preferredCategories: ["merch", "giveaways", "sound", "lighting", "woodwork"],
    complementaryCategories: ["giveaways", "lighting", "woodwork"],
    venueCompatibility: ["indoor", "outdoor"],
    recommendedTags: ["private", "party", "bachelorette", "celebration", "giveaway", "merch", "photo booth"],
    shopQueryMapping: {
      defaultCategoryKey: "merch",
      chipCategoryKeys: ["merch", "giveaways", "sound", "lighting", "woodwork"]
    }
  },
  birthday: {
    slug: "birthday",
    label: "Birthday",
    plannerLabel: "Birthday",
    shopHeading: "Birthday Products",
    shopCtaLabel: "Shop Birthday Products",
    headingDescription: "Curated merch, giveaways, sound, and lighting picks designed for fast birthday setups.",
    cardDescription: "Fun-ready merch, giveaways, lighting, and sound for birthday celebrations.",
    aliases: ["birthdays", "birthday party"],
    allowedCategories: ["merch", "giveaways", "sound", "lighting", "woodwork", "stage", "screen"],
    preferredCategories: ["merch", "giveaways", "sound", "lighting"],
    complementaryCategories: ["giveaways", "lighting", "sound"],
    venueCompatibility: ["indoor", "outdoor"],
    recommendedTags: ["birthday", "party", "kids", "celebration", "cake", "led", "gift"],
    shopQueryMapping: {
      defaultCategoryKey: "merch",
      chipCategoryKeys: ["merch", "giveaways", "sound", "lighting", "screen"]
    }
  },
  corporate: {
    slug: "corporate",
    label: "Corporate",
    plannerLabel: "Corporate",
    shopHeading: "Corporate Event Products",
    shopCtaLabel: "Shop Corporate Products",
    headingDescription: "Curated presentation, audio, screen, and branded merch products for polished corporate events.",
    cardDescription: "Professional AV, podium-style woodwork, screens, and branded merch for business events.",
    aliases: ["corporate events", "conference", "conferences", "exhibition", "exhibitions"],
    allowedCategories: ["sound", "screen", "woodwork", "stage", "merch", "giveaways", "lighting"],
    preferredCategories: ["sound", "screen", "woodwork", "stage"],
    complementaryCategories: ["screen", "woodwork", "sound"],
    venueCompatibility: ["indoor", "outdoor"],
    recommendedTags: ["corporate", "conference", "presentation", "podium", "screen", "speaker", "brand"],
    shopQueryMapping: {
      defaultCategoryKey: "sound",
      chipCategoryKeys: ["sound", "screen", "woodwork", "stage", "merch"]
    }
  },
  outdoor: {
    slug: "outdoor",
    label: "Outdoor",
    plannerLabel: "Outdoor",
    shopHeading: "Outdoor Event Products",
    shopCtaLabel: "Shop Outdoor Products",
    headingDescription: "Curated weather-ready stage, screen, sound, and support products for open-air setups.",
    cardDescription: "Weather-ready staging, sound, lighting, and screens for open-air events.",
    aliases: ["outdoor events", "outdoor event", "concerts", "concert", "festival", "festivals"],
    allowedCategories: ["stage", "sound", "screen", "lighting", "woodwork", "merch", "giveaways"],
    preferredCategories: ["stage", "sound", "screen", "lighting"],
    complementaryCategories: ["stage", "sound", "screen"],
    venueCompatibility: ["outdoor"],
    recommendedTags: ["outdoor", "weather", "festival", "concert", "truss", "stage", "screen"],
    shopQueryMapping: {
      defaultCategoryKey: "stage",
      chipCategoryKeys: ["stage", "sound", "screen", "lighting", "woodwork"]
    }
  },
  indoor: {
    slug: "indoor",
    label: "Indoor",
    plannerLabel: "Indoor",
    shopHeading: "Indoor Event Products",
    shopCtaLabel: "Shop Indoor Products",
    headingDescription: "Curated lighting, screen, sound, and merch picks suited for ballroom, hall, and interior setups.",
    cardDescription: "Ballroom-ready lighting, sound, screens, and decor-friendly support products.",
    aliases: ["indoor events", "indoor event", "indoor party", "open hall", "hall"],
    allowedCategories: ["lighting", "sound", "screen", "woodwork", "merch", "giveaways", "stage"],
    preferredCategories: ["lighting", "sound", "screen", "woodwork"],
    complementaryCategories: ["lighting", "sound", "screen"],
    venueCompatibility: ["indoor"],
    recommendedTags: ["indoor", "ballroom", "hall", "uplight", "screen", "presentation", "ceiling"],
    shopQueryMapping: {
      defaultCategoryKey: "lighting",
      chipCategoryKeys: ["lighting", "sound", "screen", "woodwork", "merch"]
    }
  },
  wedding: {
    slug: "wedding",
    label: "Wedding",
    plannerLabel: "Wedding",
    shopHeading: "Wedding Products",
    shopCtaLabel: "Shop Wedding Products",
    headingDescription: "Curated woodwork, sound, lighting, and stage pieces for refined wedding ceremony and reception setups.",
    cardDescription: "Elegant lighting, woodwork, sound, and stage support for wedding experiences.",
    aliases: ["weddings", "wedding events", "bridal"],
    allowedCategories: ["woodwork", "lighting", "sound", "stage", "screen", "merch", "giveaways"],
    preferredCategories: ["woodwork", "lighting", "sound", "stage"],
    complementaryCategories: ["woodwork", "lighting", "sound"],
    venueCompatibility: ["indoor", "outdoor"],
    recommendedTags: ["wedding", "ceremony", "aisle", "stage", "floral", "sound", "premium"],
    shopQueryMapping: {
      defaultCategoryKey: "woodwork",
      chipCategoryKeys: ["woodwork", "lighting", "sound", "stage", "screen"]
    }
  }
};

const EVENT_TYPE_ORDER = Object.freeze(["private-party", "birthday", "corporate", "outdoor", "indoor", "wedding"]);

function normalizeLookupToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const EVENT_TYPE_CONFIG = Object.freeze(
  Object.fromEntries(
    EVENT_TYPE_ORDER.map((slug) => {
      const config = RAW_EVENT_TYPE_CONFIG[slug];

      return [
        slug,
        Object.freeze({
          ...config,
          aliases: Object.freeze(config.aliases.map((alias) => normalizeLookupToken(alias))),
          allowedCategories: Object.freeze([...config.allowedCategories]),
          preferredCategories: Object.freeze([...config.preferredCategories]),
          complementaryCategories: Object.freeze([...config.complementaryCategories]),
          venueCompatibility: Object.freeze([...config.venueCompatibility]),
          recommendedTags: Object.freeze([...config.recommendedTags]),
          shopQueryMapping: Object.freeze({
            ...config.shopQueryMapping,
            chipCategoryKeys: Object.freeze([...config.shopQueryMapping.chipCategoryKeys])
          })
        })
      ];
    })
  )
);

const EVENT_TYPE_ALIAS_MAP = Object.freeze(
  EVENT_TYPE_ORDER.reduce((map, slug) => {
    const config = EVENT_TYPE_CONFIG[slug];
    map[normalizeLookupToken(slug)] = slug;
    map[normalizeLookupToken(config.label)] = slug;
    map[normalizeLookupToken(config.plannerLabel)] = slug;

    config.aliases.forEach((alias) => {
      map[alias] = slug;
    });

    return map;
  }, {})
);

function resolveEventType(value) {
  const normalized = normalizeLookupToken(value);
  return EVENT_TYPE_ALIAS_MAP[normalized] || "";
}

function getEventTypeConfig(value) {
  const slug = resolveEventType(value);
  return slug ? EVENT_TYPE_CONFIG[slug] : null;
}

function listEventTypes() {
  return EVENT_TYPE_ORDER.map((slug) => EVENT_TYPE_CONFIG[slug]);
}

function buildEventTypeShopPath(value, { category = "", mode = "" } = {}) {
  const slug = resolveEventType(value);
  const params = new URLSearchParams();

  if (slug) {
    params.set("eventType", slug);
  }

  if (category) {
    params.set("category", category);
  }

  if (mode) {
    params.set("mode", mode);
  }

  const query = params.toString();
  return query ? `/shop?${query}` : "/shop";
}

function getEventTypeLabel(value, fallback = "Event") {
  return getEventTypeConfig(value)?.label || fallback;
}

function getEventTypeHeading(value, fallback = "Shop Equipment") {
  return getEventTypeConfig(value)?.shopHeading || fallback;
}

export {
  EVENT_TYPE_CONFIG,
  EVENT_TYPE_ORDER,
  EVENT_TYPE_ALIAS_MAP,
  buildEventTypeShopPath,
  getEventTypeConfig,
  getEventTypeHeading,
  getEventTypeLabel,
  listEventTypes,
  normalizeLookupToken,
  resolveEventType
};
