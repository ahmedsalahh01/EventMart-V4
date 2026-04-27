const RAW_EVENT_TYPE_CONFIG = {
  party: {
    slug: "party",
    label: "Party",
    plannerLabel: "Party",
    aliases: [
      "party",
      "parties",
      "private parties",
      "private party",
      "private-party",
      "private party / bachelorette",
      "bachelorette",
      "bachelorette party"
    ]
  },
  birthday: {
    slug: "birthday",
    label: "Birthday",
    plannerLabel: "Birthday",
    aliases: ["birthdays", "birthday party"]
  },
  corporate: {
    slug: "corporate",
    label: "Corporate",
    plannerLabel: "Corporate",
    aliases: ["corporate events", "company event", "business event", "exhibition", "exhibitions"]
  },
  engagement: {
    slug: "engagement",
    label: "Engagement",
    plannerLabel: "Engagement",
    aliases: ["engagements", "engagement party", "proposal", "proposal party"]
  },
  conference: {
    slug: "conference",
    label: "Conference",
    plannerLabel: "Conference",
    aliases: ["conferences", "summit", "summits", "seminar", "seminars"]
  },
  outdoor: {
    slug: "outdoor",
    label: "Outdoor",
    plannerLabel: "Outdoor",
    aliases: ["outdoor events", "outdoor event", "concerts", "concert", "festival", "festivals"]
  },
  indoor: {
    slug: "indoor",
    label: "Indoor",
    plannerLabel: "Indoor",
    aliases: ["indoor events", "indoor event", "indoor party", "open hall", "hall"]
  },
  wedding: {
    slug: "wedding",
    label: "Wedding",
    plannerLabel: "Wedding",
    aliases: ["weddings", "wedding events", "bridal"]
  }
};

const EVENT_TYPE_ORDER = Object.freeze(["birthday", "party", "engagement", "corporate", "conference", "wedding", "indoor", "outdoor"]);

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
          aliases: Object.freeze(config.aliases.map((alias) => normalizeLookupToken(alias)))
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

module.exports = {
  EVENT_TYPE_ORDER,
  EVENT_TYPE_CONFIG,
  EVENT_TYPE_ALIAS_MAP,
  getEventTypeConfig,
  normalizeLookupToken,
  resolveEventType
};
