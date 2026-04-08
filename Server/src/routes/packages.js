const express = require("express");
const {
  applyPricingToResolvedLines,
  buildBuilderPreview,
  getBuilderCategory,
  getUnitPriceForMode,
  normalizeDiscountTiers,
  normalizePackageContext,
  normalizePackageMeta,
  resolvePackageMode,
  resolvePackageStatus,
  resolvePackageVisibility
} = require("../lib/packageBuilder");
const CATALOG_PRODUCTS_CACHE_TTL_MS = 15000;
const catalogProductsCache = {
  expiresAt: 0,
  rows: null
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value, maxLength = 240) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function slugifyValue(value) {
  return normalizeText(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "package";
}

function formatVenueTypeLabel(value) {
  const normalized = normalizeText(value, 40).toLowerCase();
  if (normalized === "indoor") return "Indoor";
  if (normalized === "outdoor") return "Outdoor";
  if (normalized === "hybrid") return "Hybrid";
  return "General";
}

function formatPackageModeLabel(value) {
  const normalized = resolvePackageMode(value);
  if (normalized === "buy") return "Buy only";
  if (normalized === "rent") return "Rent only";
  return "Hybrid";
}

function buildPackageDescriptionFromContext(contextDefaults) {
  const details = [];
  const guestCount = Math.max(0, Number(contextDefaults?.guestCount || 0));

  if (guestCount > 0) {
    details.push(`Fits up to ${guestCount} people`);
  }

  details.push(`${formatVenueTypeLabel(contextDefaults?.venueType)} setup`);
  details.push(contextDefaults?.customizationAvailable ? "Customizable items available" : "Non-customizable package");
  details.push(formatPackageModeLabel(contextDefaults?.packageMode));

  return normalizeText(details.join(". "), 400);
}

function parseWholeNumber(value, fieldLabel) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createHttpError(400, `${fieldLabel} must be a non-negative whole number.`);
  }
  return parsed;
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
            return normalizeTextList(item.value || item.label || item.name || item.items || "", maxLength);
          }

          return [];
        })
        .map((entry) => normalizeText(entry, maxLength))
        .filter(Boolean)
    )
  );
}

function readCatalogProductsCache() {
  if (Array.isArray(catalogProductsCache.rows) && catalogProductsCache.expiresAt > Date.now()) {
    return catalogProductsCache.rows;
  }

  return null;
}

function writeCatalogProductsCache(rows) {
  catalogProductsCache.rows = Array.isArray(rows) ? rows : [];
  catalogProductsCache.expiresAt = Date.now() + CATALOG_PRODUCTS_CACHE_TTL_MS;
  return catalogProductsCache.rows;
}

const PRODUCT_SELECT_SQL = `
  SELECT
    p.id,
    p.product_id,
    p.name,
    p.slug,
    p.category,
    p.subcategory,
    p.description,
    COALESCE(p.tags, '[]'::jsonb) AS tags,
    COALESCE(p.customizable, FALSE) AS customizable,
    COALESCE(p.customization_fee, 0) AS customization_fee,
    COALESCE(p.event_type, '') AS event_type,
    COALESCE(p.venue_type, '') AS venue_type,
    COALESCE(p.delivery_class, '') AS delivery_class,
    COALESCE(p.currency, 'EGP') AS currency,
    COALESCE(p.buy_enabled, TRUE) AS buy_enabled,
    COALESCE(p.rent_enabled, FALSE) AS rent_enabled,
    p.buy_price,
    p.rent_price_per_day,
    COALESCE(p.featured, FALSE) AS featured,
    COALESCE(p.active, TRUE) AS active,
    COALESCE(inv.quantity_available, 0)::INT AS quantity_available,
    COALESCE(
      (
        SELECT url
        FROM product_images img
        WHERE img.product_id = p.id
        ORDER BY img.sort_order ASC, img.id ASC
        LIMIT 1
      ),
      ''
    ) AS image_url
  FROM products p
  LEFT JOIN product_inventory inv ON inv.product_id = p.id
`;

const PACKAGE_SELECT_SQL = `
  SELECT
    pkg.id,
    pkg.name,
    pkg.slug,
    pkg.description,
    pkg.event_type,
    pkg.visibility,
    pkg.status,
    pkg.active,
    pkg.context_defaults,
    pkg.created_at,
    pkg.updated_at,
    COALESCE(item_rows.items, '[]'::json) AS items
  FROM packages pkg
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', pi.id,
            'product_id', pi.product_id,
            'minimum_quantity', pi.minimum_quantity,
            'default_quantity', pi.default_quantity,
            'is_required', pi.is_required,
            'preferred_mode', pi.preferred_mode,
            'applies_to_event_types', pi.applies_to_event_types,
            'applies_to_venue_types', pi.applies_to_venue_types,
            'discount_tiers', pi.discount_tiers,
            'notes', pi.notes,
            'sort_order', pi.sort_order,
            'product', JSON_BUILD_OBJECT(
              'id', p.id,
              'product_id', p.product_id,
              'name', p.name,
              'slug', p.slug,
              'category', p.category,
              'subcategory', p.subcategory,
              'description', p.description,
              'currency', COALESCE(p.currency, 'EGP'),
              'buy_enabled', COALESCE(p.buy_enabled, TRUE),
              'rent_enabled', COALESCE(p.rent_enabled, FALSE),
              'buy_price', p.buy_price,
              'rent_price_per_day', p.rent_price_per_day,
              'customization_fee', COALESCE(p.customization_fee, 0),
              'event_type', COALESCE(p.event_type, ''),
              'venue_type', COALESCE(p.venue_type, ''),
              'delivery_class', COALESCE(p.delivery_class, ''),
              'active', COALESCE(p.active, TRUE),
              'image_url',
              COALESCE(
                (
                  SELECT img.url
                  FROM product_images img
                  WHERE img.product_id = p.id
                  ORDER BY img.sort_order ASC, img.id ASC
                  LIMIT 1
                ),
                ''
              )
            )
          )
          ORDER BY pi.sort_order ASC, pi.id ASC
        ),
        '[]'::json
      ) AS items
    FROM package_items pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.package_id = pkg.id
  ) item_rows ON TRUE
`;

function materializeCatalogProduct(row) {
  return {
    active: row?.active !== false,
    buy_enabled: row?.buy_enabled !== false,
    buy_price: row?.buy_price === null || row?.buy_price === undefined ? null : Number(row.buy_price),
    category: normalizeText(row?.category, 120),
    currency: normalizeText(row?.currency || "EGP", 6) || "EGP",
    customizable: Boolean(row?.customizable),
    customization_fee: Number(row?.customization_fee || 0),
    delivery_class: normalizeText(row?.delivery_class, 60),
    description: normalizeText(row?.description, 260),
    event_type: normalizeText(row?.event_type, 120),
    featured: Boolean(row?.featured),
    id: Number(row?.id || 0),
    image_url: normalizeText(row?.image_url, 2048),
    name: normalizeText(row?.name, 160),
    product_id: normalizeText(row?.product_id, 20),
    quantity_available: Number(row?.quantity_available || 0),
    rent_enabled: Boolean(row?.rent_enabled),
    rent_price_per_day:
      row?.rent_price_per_day === null || row?.rent_price_per_day === undefined
        ? null
        : Number(row.rent_price_per_day),
    slug: normalizeText(row?.slug, 180),
    subcategory: normalizeText(row?.subcategory, 120),
    tags: normalizeTextList(row?.tags, 60),
    venue_type: normalizeText(row?.venue_type, 120)
  };
}

function materializePackageRow(row) {
  const items = Array.isArray(row?.items) ? row.items : [];

  return {
    active: row?.active !== false,
    contextDefaults: normalizePackageContext(row?.context_defaults || {}),
    created_at: row?.created_at || null,
    description: normalizeText(row?.description, 400),
    eventType: normalizeText(row?.event_type, 120),
    id: Number(row?.id || 0),
    items: items.map((item, index) => ({
      defaultQuantity: Math.max(1, Number(item?.default_quantity || 1)),
      discountTiers: normalizeDiscountTiers(item?.discount_tiers),
      id: Number(item?.id || 0),
      minimumQuantity: Math.max(1, Number(item?.minimum_quantity || 1)),
      notes: normalizeText(item?.notes, 240),
      preferredMode: normalizeText(item?.preferred_mode, 20),
      product: materializeCatalogProduct(item?.product || {}),
      productId: Number(item?.product_id || item?.product?.id || 0),
      required: Boolean(item?.is_required),
      sortOrder: Number(item?.sort_order ?? index),
      appliesToEventTypes: normalizeTextList(item?.applies_to_event_types, 120),
      appliesToVenueTypes: normalizeTextList(item?.applies_to_venue_types, 120)
    })),
    name: normalizeText(row?.name, 160),
    slug: normalizeText(row?.slug, 180),
    status: resolvePackageStatus(row?.status),
    updated_at: row?.updated_at || null,
    visibility: resolvePackageVisibility(row?.visibility)
  };
}

async function loadCatalogProducts(pool, { ids = null } = {}) {
  const cachedRows = readCatalogProductsCache();
  if (!ids && cachedRows) {
    return cachedRows;
  }

  if (Array.isArray(ids) && ids.length && cachedRows) {
    const allowedIds = new Set(ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0));
    return cachedRows.filter((row) => allowedIds.has(Number(row?.id || 0)));
  }

  if (Array.isArray(ids) && ids.length) {
    const result = await pool.query(`${PRODUCT_SELECT_SQL} WHERE p.id = ANY($1::BIGINT[]) ORDER BY p.id ASC`, [ids]);
    return result.rows.map(materializeCatalogProduct);
  }

  const result = await pool.query(`${PRODUCT_SELECT_SQL} ORDER BY p.id ASC`);
  return writeCatalogProductsCache(result.rows.map(materializeCatalogProduct));
}

async function listPackages(pool, { includeAll = false } = {}) {
  const whereSql = includeAll
    ? ""
    : "WHERE pkg.active = TRUE AND pkg.status = 'active' AND pkg.visibility = 'public'";
  const result = await pool.query(`${PACKAGE_SELECT_SQL} ${whereSql} ORDER BY pkg.updated_at DESC, pkg.id DESC`);
  return result.rows.map(materializePackageRow);
}

async function getPackageByIdentifier(pool, identifier, { includeAll = false } = {}) {
  const numericId = Number(identifier);
  const conditions = [];
  const values = [];

  if (Number.isInteger(numericId) && numericId > 0) {
    conditions.push(`pkg.id = $${values.length + 1}`);
    values.push(numericId);
  }

  const normalizedSlug = normalizeText(identifier, 180).toLowerCase();
  if (normalizedSlug) {
    conditions.push(`pkg.slug = $${values.length + 1}`);
    values.push(normalizedSlug);
  }

  if (!conditions.length) {
    throw createHttpError(400, "Package identifier is required.");
  }

  const scopeSql = includeAll ? "" : "AND pkg.active = TRUE AND pkg.status = 'active' AND pkg.visibility = 'public'";
  const result = await pool.query(
    `${PACKAGE_SELECT_SQL} WHERE (${conditions.join(" OR ")}) ${scopeSql} ORDER BY pkg.id DESC LIMIT 1`,
    values
  );

  return result.rows[0] ? materializePackageRow(result.rows[0]) : null;
}

async function hydratePackagesWithPreview(pool, packages, { includePreview = true } = {}) {
  if (!includePreview || !Array.isArray(packages) || packages.length === 0) {
    return Array.isArray(packages) ? packages : [];
  }

  const catalogProducts = await loadCatalogProducts(pool);

  return packages.map((pkg) => {
    const preview = buildBuilderPreview({
      catalogProducts,
      context: pkg.contextDefaults,
      packageDefinition: pkg,
      packageGroupId: `package-${pkg.id || pkg.slug || "preview"}`,
      selectedItems: pkg.items.map((item) => ({
        mode: item.preferredMode || "",
        productId: item.productId,
        quantity: item.defaultQuantity
      }))
    });

    return {
      ...pkg,
      preview
    };
  });
}

function normalizePackagePayload(body) {
  const name = normalizeText(body?.name, 160);
  const contextDefaults = normalizePackageContext(body?.contextDefaults || body?.context_defaults || {});
  const description = normalizeText(body?.description, 400) || buildPackageDescriptionFromContext(contextDefaults);
  const rows = Array.isArray(body?.items) ? body.items : [];

  if (!name) {
    throw createHttpError(400, "Package name is required.");
  }

  if (!rows.length) {
    throw createHttpError(400, "Add at least one package item.");
  }

  const seenProductIds = new Set();
  const items = rows.map((row, index) => {
    const productId = Number(row?.productId ?? row?.product_id);
    const minimumQuantity = parseWholeNumber(row?.minimumQuantity ?? row?.minimum_quantity ?? 1, `Package item ${index + 1} minimum quantity`);
    const defaultQuantity = parseWholeNumber(row?.defaultQuantity ?? row?.default_quantity ?? minimumQuantity, `Package item ${index + 1} default quantity`);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw createHttpError(400, `Package item ${index + 1} must select a product.`);
    }

    if (minimumQuantity < 1) {
      throw createHttpError(400, `Package item ${index + 1} minimum quantity must be at least 1.`);
    }

    if (defaultQuantity < 1) {
      throw createHttpError(400, `Package item ${index + 1} default quantity must be at least 1.`);
    }

    if (seenProductIds.has(productId)) {
      throw createHttpError(400, "Each product can only appear once in a package.");
    }

    seenProductIds.add(productId);

    return {
      appliesToEventTypes: normalizeTextList(row?.appliesToEventTypes ?? row?.applies_to_event_types, 120),
      appliesToVenueTypes: normalizeTextList(row?.appliesToVenueTypes ?? row?.applies_to_venue_types, 120),
      defaultQuantity,
      discountTiers: normalizeDiscountTiers(row?.discountTiers ?? row?.discount_tiers),
      minimumQuantity,
      notes: normalizeText(row?.notes, 240),
      preferredMode: normalizeText(row?.preferredMode ?? row?.preferred_mode, 20),
      productId,
      required: Boolean(row?.required ?? row?.is_required),
      sortOrder: Number(row?.sortOrder ?? row?.sort_order ?? index)
    };
  });

  return {
    active: body?.active !== false,
    contextDefaults,
    description,
    eventType: normalizeText(body?.eventType ?? body?.event_type, 120),
    items,
    name,
    status: resolvePackageStatus(body?.status),
    visibility: resolvePackageVisibility(body?.visibility)
  };
}

async function ensureUniquePackageSlug(client, name, excludeId = null) {
  const baseSlug = slugifyValue(name);
  let suffix = 1;

  while (true) {
    const candidate = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;
    const result = await client.query(
      `
      SELECT id
      FROM packages
      WHERE LOWER(slug) = LOWER($1)
        AND ($2::BIGINT IS NULL OR id <> $2)
      LIMIT 1
      `,
      [candidate, excludeId]
    );

    if (!result.rows.length) {
      return candidate;
    }

    suffix += 1;
  }
}

async function assertPackageProductsExist(client, items) {
  const ids = items.map((item) => Number(item.productId)).filter((value) => Number.isInteger(value) && value > 0);
  const result = await client.query("SELECT id FROM products WHERE id = ANY($1::BIGINT[])", [ids]);

  if (result.rows.length !== ids.length) {
    throw createHttpError(400, "One or more selected products no longer exist.");
  }
}

async function savePackageRecord(client, payload, editingId = null) {
  await assertPackageProductsExist(client, payload.items);
  const slug = await ensureUniquePackageSlug(client, payload.name, editingId);
  let packageId = Number(editingId || 0);

  if (packageId > 0) {
    await client.query(
      `
      UPDATE packages
      SET name = $2,
          slug = $3,
          description = $4,
          event_type = $5,
          visibility = $6,
          status = $7,
          active = $8,
          context_defaults = $9::jsonb,
          updated_at = NOW()
      WHERE id = $1
      `,
      [
        packageId,
        payload.name,
        slug,
        payload.description,
        payload.eventType,
        payload.visibility,
        payload.status,
        payload.active,
        JSON.stringify(payload.contextDefaults)
      ]
    );

    await client.query("DELETE FROM package_items WHERE package_id = $1", [packageId]);
  } else {
    const insert = await client.query(
      `
      INSERT INTO packages (
        name,
        slug,
        description,
        event_type,
        visibility,
        status,
        active,
        context_defaults,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
      RETURNING id
      `,
      [
        payload.name,
        slug,
        payload.description,
        payload.eventType,
        payload.visibility,
        payload.status,
        payload.active,
        JSON.stringify(payload.contextDefaults)
      ]
    );
    packageId = Number(insert.rows[0]?.id || 0);
  }

  for (const item of payload.items) {
    await client.query(
      `
      INSERT INTO package_items (
        package_id,
        product_id,
        minimum_quantity,
        default_quantity,
        is_required,
        preferred_mode,
        applies_to_event_types,
        applies_to_venue_types,
        discount_tiers,
        notes,
        sort_order,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, NOW())
      `,
      [
        packageId,
        item.productId,
        item.minimumQuantity,
        item.defaultQuantity,
        item.required,
        item.preferredMode,
        JSON.stringify(item.appliesToEventTypes),
        JSON.stringify(item.appliesToVenueTypes),
        JSON.stringify(item.discountTiers),
        item.notes,
        item.sortOrder
      ]
    );
  }

  return packageId;
}

function createPackagesRouter({ pool }) {
  const router = express.Router();

  router.get("/packages", async (req, res) => {
    try {
      const includeAll = req.query.all === "1";
      const includePreview = req.query.preview === "1";
      const packages = await listPackages(pool, { includeAll });
      const hydrated = await hydratePackagesWithPreview(pool, packages, { includePreview });
      return res.json(hydrated);
    } catch (error) {
      return res.status(error?.status || 500).json({ error: error?.message || "Unable to load packages." });
    }
  });

  router.get("/packages/:identifier", async (req, res) => {
    try {
      const includeAll = req.query.all === "1";
      const pkg = await getPackageByIdentifier(pool, req.params.identifier, { includeAll });
      if (!pkg) {
        return res.status(404).json({ error: "Package not found." });
      }

      const hydrated = await hydratePackagesWithPreview(pool, [pkg]);
      return res.json(hydrated[0]);
    } catch (error) {
      return res.status(error?.status || 500).json({ error: error?.message || "Unable to load the requested package." });
    }
  });

  router.post("/packages", async (req, res) => {
    const client = await pool.connect();

    try {
      const payload = normalizePackagePayload(req.body);
      await client.query("BEGIN");
      const packageId = await savePackageRecord(client, payload, null);
      await client.query("COMMIT");
      const saved = await getPackageByIdentifier(pool, packageId, { includeAll: true });
      const hydrated = await hydratePackagesWithPreview(pool, saved ? [saved] : []);
      return res.status(201).json(hydrated[0] || null);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(error?.status || 500).json({ error: error?.message || "Unable to create the package." });
    } finally {
      client.release();
    }
  });

  router.put("/packages/:identifier", async (req, res) => {
    const client = await pool.connect();

    try {
      const current = await getPackageByIdentifier(pool, req.params.identifier, { includeAll: true });
      if (!current) {
        throw createHttpError(404, "Package not found.");
      }

      const payload = normalizePackagePayload(req.body);
      await client.query("BEGIN");
      const packageId = await savePackageRecord(client, payload, current.id);
      await client.query("COMMIT");
      const saved = await getPackageByIdentifier(pool, packageId, { includeAll: true });
      const hydrated = await hydratePackagesWithPreview(pool, saved ? [saved] : []);
      return res.json(hydrated[0] || null);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(error?.status || 500).json({ error: error?.message || "Unable to update the package." });
    } finally {
      client.release();
    }
  });

  router.delete("/packages/:identifier", async (req, res) => {
    try {
      const current = await getPackageByIdentifier(pool, req.params.identifier, { includeAll: true });
      if (!current) {
        throw createHttpError(404, "Package not found.");
      }

      await pool.query("DELETE FROM packages WHERE id = $1", [current.id]);
      return res.status(204).send();
    } catch (error) {
      return res.status(error?.status || 500).json({ error: error?.message || "Unable to delete the package." });
    }
  });

  router.post("/packages/preview", async (req, res) => {
    try {
      const draftPackage =
        req.body?.package && typeof req.body.package === "object"
          ? normalizePackagePayload(req.body.package)
          : null;
      const savedPackage =
        draftPackage ||
        (req.body?.packageId || req.body?.packageSlug
          ? await getPackageByIdentifier(pool, req.body?.packageId || req.body?.packageSlug, { includeAll: true })
          : null);

      if (!savedPackage) {
        throw createHttpError(400, "A package or package identifier is required for preview.");
      }

      const catalogProducts = await loadCatalogProducts(pool);
      const preview = buildBuilderPreview({
        catalogProducts,
        context: req.body?.context || savedPackage.contextDefaults,
        packageDefinition: savedPackage,
        packageGroupId: normalizeText(req.body?.packageGroupId, 120) || `package-${savedPackage.id || "preview"}`,
        selectedItems:
          Array.isArray(req.body?.selectedItems) && req.body.selectedItems.length
            ? req.body.selectedItems
            : savedPackage.items.map((item) => ({
                mode: item.preferredMode || "",
                productId: item.productId,
                quantity: item.defaultQuantity
              }))
      });

      return res.json({
        package: savedPackage,
        preview
      });
    } catch (error) {
      return res.status(error?.status || 500).json({ error: error?.message || "Unable to preview the package." });
    }
  });

  router.post("/package-builder/preview", async (req, res) => {
    try {
      const packageDefinition =
        req.body?.packageId || req.body?.packageSlug
          ? await getPackageByIdentifier(pool, req.body?.packageId || req.body?.packageSlug, { includeAll: true })
          : null;
      const catalogProducts = await loadCatalogProducts(pool);
      const preview = buildBuilderPreview({
        catalogProducts,
        context: req.body?.context || {},
        packageDefinition,
        packageGroupId: normalizeText(req.body?.packageGroupId, 120) || "package-preview",
        selectedItems: Array.isArray(req.body?.selectedItems) ? req.body.selectedItems : []
      });

      return res.json(preview);
    } catch (error) {
      return res.status(error?.status || 500).json({ error: error?.message || "Unable to build the requested package preview." });
    }
  });

  router.post("/package-builder/cart-preview", async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) {
        return res.json({
          packageGroups: [],
          summary: {
            baseSubtotal: 0,
            bundleDiscount: 0,
            currency: "EGP",
            customizationFees: 0,
            deliveryEstimate: null,
            discountedItemsSubtotal: 0,
            itemCount: 0,
            itemDiscounts: 0,
            meetsMinimumPackagePrice: true,
            minimumPackagePrice: 0,
            remainingToMinimumPrice: 0,
            shipping: 0,
            subtotal: 0,
            total: 0
          }
        });
      }
      const productIds = items
        .map((item) => Number(item?.id || item?.productId || item?.product_id || 0))
        .filter((value) => Number.isInteger(value) && value > 0);
      const catalogProducts = await loadCatalogProducts(pool, { ids: productIds });
      const productMap = new Map(catalogProducts.map((product) => [Number(product.id), product]));
      const lines = items
        .map((item) => {
          const productId = Number(item?.id || item?.productId || item?.product_id || 0);
          const product = productMap.get(productId);
          if (!product) return null;

          const mode = normalizeText(item?.mode, 20) === "rent" ? "rent" : "buy";
          const unitPrice = getUnitPriceForMode(product, mode);
          if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;

          const packageMeta = item?.package_meta ? normalizePackageMeta(item.package_meta) : null;
          const quantity = Math.max(1, Number(item?.quantity || 1));
          const rentalDays = mode === "rent" ? Math.max(1, Number(item?.rental_days || item?.rentalDays || 1)) : null;
          const multiplier = mode === "rent" ? rentalDays : 1;

          return {
            builderCategory: packageMeta?.builderCategory || getBuilderCategory(product),
            category: product.category,
            currency: product.currency,
            customizationRequested:
              Boolean(item?.customization_requested || item?.customizationRequested) ||
              Boolean(packageMeta?.customizationRequested),
            deliveryClass: product.delivery_class,
            description: product.description,
            lineTotal: unitPrice * quantity * multiplier,
            mode,
            packageMeta,
            productCustomizationFee: Number(product.customization_fee || 0),
            productId,
            productName: product.name,
            quantity,
            rentalDays,
            selectedColor: normalizeText(item?.selected_color || item?.selectedColor, 60),
            selectedSize: normalizeText(item?.selected_size || item?.selectedSize, 40),
            subcategory: product.subcategory,
            unitPrice
          };
        })
        .filter(Boolean);

      const pricing = applyPricingToResolvedLines(lines);
      const currency = Array.from(new Set(pricing.lines.map((line) => String(line.currency || "EGP"))))[0] || "EGP";

      return res.json({
        packageGroups: pricing.packageGroups,
        summary: {
          bundleDiscount: pricing.discount,
          baseSubtotal: pricing.packageGroups.reduce((sum, group) => sum + Number(group.baseSubtotal || 0), 0),
          currency,
          customizationFees: pricing.packageGroups.reduce((sum, group) => sum + Number(group.customizationFees || 0), 0),
          deliveryEstimate: pricing.packageGroups[0]?.deliveryEstimate || null,
          discountedItemsSubtotal: pricing.packageGroups.reduce((sum, group) => sum + Number(group.discountedItemsSubtotal || 0), 0),
          itemCount: pricing.itemCount,
          itemDiscounts: pricing.packageGroups.reduce((sum, group) => sum + Number(group.itemDiscounts || 0), 0),
          meetsMinimumPackagePrice: pricing.packageGroups.every((group) => group.meetsMinimumPackagePrice !== false),
          minimumPackagePrice: pricing.packageGroups.reduce((sum, group) => sum + Number(group.minimumPackagePrice || 0), 0),
          remainingToMinimumPrice: pricing.packageGroups.reduce((sum, group) => sum + Number(group.remainingToMinimumPrice || 0), 0),
          shipping: pricing.shipping,
          subtotal: pricing.packageGroups.reduce((sum, group) => sum + Number(group.baseSubtotal || 0), 0),
          total: pricing.total
        }
      });
    } catch (error) {
      return res.status(error?.status || 500).json({ error: error?.message || "Unable to preview the current cart." });
    }
  });

  return router;
}

module.exports = createPackagesRouter;
