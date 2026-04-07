const fs = require("fs");
const path = require("path");
const { ONE_SIZE_LABEL, materializeProductCatalogShape, normalizeSizeMode, normalizeTextList, slugifyProductName, sortSizes } = require("../lib/catalog");
const { parseProductImportBuffer } = require("../utils/productImportParser");
const { buildImportProduct, normalizeImportRow, PRODUCT_ID_REGEX } = require("../utils/productImportValidator");
const { createSkuGenerator, normalizeSku } = require("../utils/skuGenerator");

const PRODUCT_ID_MAX = 99999;
const PRODUCT_IMPORT_SELECT_SQL = `
  SELECT
    p.id,
    p.product_id,
    p.sku,
    p.name,
    p.slug,
    p.category,
    p.subcategory,
    p.description,
    p.quality,
    COALESCE(p.quality_points, '[]'::jsonb) AS quality_points,
    COALESCE(p.colors, '[]'::jsonb) AS colors,
    COALESCE(p.size_mode, 'one-size') AS size_mode,
    COALESCE(p.sizes, '[]'::jsonb) AS sizes,
    COALESCE(p.customizable, FALSE) AS customizable,
    COALESCE(p.buy_enabled, TRUE) AS buy_enabled,
    COALESCE(p.rent_enabled, FALSE) AS rent_enabled,
    p.buy_price,
    p.rent_price_per_day,
    COALESCE(p.base_price, p.buy_price, p.rent_price_per_day) AS base_price,
    COALESCE(p.currency, 'EGP') AS currency,
    COALESCE(p.event_type, '') AS event_type,
    COALESCE(p.tags, '[]'::jsonb) AS tags,
    COALESCE(p.customization_fee, 0) AS customization_fee,
    COALESCE(p.venue_type, '') AS venue_type,
    COALESCE(p.delivery_class, '') AS delivery_class,
    COALESCE(p.featured, FALSE) AS featured,
    COALESCE(p.active, TRUE) AS active,
    COALESCE(inv.quantity_available, 0)::INT AS quantity_available,
    COALESCE(inv.reorder_level, 0)::INT AS reorder_level,
    COALESCE(cost.unit_cost, 0) AS unit_cost,
    COALESCE(cost.overhead_cost, 0) AS overhead_cost,
    COALESCE(var.variations, '[]'::json) AS variations,
    COALESCE(img.images, '[]'::json) AS images
  FROM products p
  LEFT JOIN product_inventory inv ON inv.product_id = p.id
  LEFT JOIN product_costs cost ON cost.product_id = p.id
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'color', pv.color,
          'size', pv.size,
          'quantity', pv.quantity,
          'sku', pv.sku,
          'availability_status', pv.availability_status
        )
        ORDER BY pv.color ASC, pv.size ASC, pv.id ASC
      ),
      '[]'::json
    ) AS variations
    FROM product_variations pv
    WHERE pv.product_id = p.id
  ) var ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      JSON_AGG(pi.url ORDER BY pi.sort_order ASC, pi.id ASC),
      '[]'::json
    ) AS images
    FROM product_images pi
    WHERE pi.product_id = p.id
  ) img ON TRUE
`;

function normalizeText(value, maxLength = 240) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeJsonTextList(value, maxLength = 120) {
  return normalizeTextList(Array.isArray(value) ? value : value || [], maxLength);
}

function materializeStoredProduct(row) {
  const catalogShape = materializeProductCatalogShape({
    colors: row?.colors,
    quantity_available: row?.quantity_available,
    size_mode: row?.size_mode,
    sizes: row?.sizes,
    variations: row?.variations
  });

  return {
    id: Number(row.id),
    product_id: String(row.product_id || ""),
    sku: normalizeText(row.sku, 80),
    name: normalizeText(row.name, 160),
    slug: normalizeText(row.slug, 180),
    category: normalizeText(row.category, 120),
    subcategory: normalizeText(row.subcategory, 120),
    description: String(row.description || ""),
    quality: normalizeText(row.quality, 160),
    quality_points: normalizeJsonTextList(row.quality_points, 140),
    colors: catalogShape.colors,
    size_mode: catalogShape.size_mode,
    sizes: catalogShape.sizes,
    customizable: Boolean(row.customizable),
    buy_enabled: Boolean(row.buy_enabled),
    rent_enabled: Boolean(row.rent_enabled),
    buy_price: toNumber(row.buy_price, null),
    rent_price_per_day: toNumber(row.rent_price_per_day, null),
    base_price: toNumber(row.base_price, null),
    currency: normalizeText(row.currency || "EGP", 3).toUpperCase(),
    event_type: normalizeText(row.event_type, 120),
    tags: normalizeJsonTextList(row.tags, 60),
    customization_fee: toNumber(row.customization_fee, 0) || 0,
    venue_type: normalizeText(row.venue_type, 120),
    delivery_class: normalizeText(row.delivery_class, 120),
    featured: Boolean(row.featured),
    active: row.active !== false,
    quantity_available: Number(row.quantity_available || 0),
    reorder_level: Number(row.reorder_level || 0),
    unit_cost: toNumber(row.unit_cost, 0) || 0,
    overhead_cost: toNumber(row.overhead_cost, 0) || 0,
    variations: catalogShape.variations,
    images: Array.isArray(row.images) ? row.images.map((entry) => normalizeText(entry, 2048)).filter(Boolean) : []
  };
}

async function createProductIdGenerator(client, usedProductIds = []) {
  const taken = new Set(
    (Array.isArray(usedProductIds) ? usedProductIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  const result = await client.query(
    `
    SELECT COALESCE(MAX(CAST(product_id AS INTEGER)), 0) AS max_number
    FROM products
    WHERE product_id ~ '^[0-9]{5}$'
    `
  );
  let cursor = Number(result.rows[0]?.max_number || 0);

  return function nextProductId() {
    do {
      cursor += 1;
      if (cursor > PRODUCT_ID_MAX) {
        throw new Error("Product ID limit reached for 5-digit identifiers.");
      }
    } while (taken.has(String(cursor).padStart(5, "0")));

    const productId = String(cursor).padStart(5, "0");
    taken.add(productId);
    return productId;
  };
}

function buildGroupKey(row) {
  if (row.variation_group) {
    return `group:${row.variation_group.toLowerCase()}`;
  }

  if (row.sku) {
    return `sku:${row.sku.toLowerCase()}`;
  }

  if (row.product_id) {
    return `product:${row.product_id}`;
  }

  return `row:${row.rowNumber}`;
}

function appendError(summary, rowNumbers, reason) {
  const list = Array.isArray(rowNumbers) ? rowNumbers : [rowNumbers];
  list.forEach((row) => {
    summary.errors.push({ row, reason });
  });
}

function mergeUniqueTextLists(...values) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
        .map((entry) => normalizeText(entry, 2048))
        .filter(Boolean)
    )
  );
}

function mergeImportProduct(imported, existing = null) {
  const base = existing || {};
  const mergedVariations = Array.isArray(imported.variations) && imported.variations.length
    ? imported.variations
    : Array.isArray(base.variations)
      ? base.variations
      : [];
  const rawSizeMode = imported.size_mode || base.size_mode || "one-size";
  const catalogShape = materializeProductCatalogShape({
    colors: imported.colors?.length ? imported.colors : base.colors || [],
    quantity_available:
      imported.quantity_available ??
      base.quantity_available ??
      mergedVariations.reduce((sum, variation) => sum + Number(variation.quantity || 0), 0),
    size_mode: rawSizeMode,
    sizes: imported.sizes?.length ? imported.sizes : base.sizes || [],
    variations: mergedVariations
  });
  const merged = {
    sku: imported.sku || base.sku || "",
    product_id: imported.product_id || base.product_id || "",
    name: imported.name || base.name || "",
    category: imported.category || base.category || "",
    subcategory: imported.subcategory || base.subcategory || "",
    description:
      imported.description !== undefined && imported.description !== null && imported.description !== ""
        ? imported.description
        : base.description || "",
    quality:
      imported.quality !== undefined && imported.quality !== null && imported.quality !== ""
        ? imported.quality
        : base.quality || "",
    quality_points:
      Array.isArray(imported.quality_points) && imported.quality_points.length
        ? imported.quality_points
        : base.quality_points || [],
    colors: catalogShape.colors,
    size_mode: catalogShape.size_mode,
    sizes: catalogShape.sizes,
    customizable:
      imported.customizable === null || imported.customizable === undefined
        ? Boolean(base.customizable)
        : Boolean(imported.customizable),
    buy_enabled:
      imported.buy_enabled === null || imported.buy_enabled === undefined
        ? base.buy_enabled
        : Boolean(imported.buy_enabled),
    rent_enabled:
      imported.rent_enabled === null || imported.rent_enabled === undefined
        ? base.rent_enabled
        : Boolean(imported.rent_enabled),
    buy_price: imported.buy_price ?? base.buy_price ?? imported.base_price ?? base.base_price ?? null,
    rent_price_per_day: imported.rent_price_per_day ?? base.rent_price_per_day ?? null,
    base_price:
      imported.base_price ??
      base.base_price ??
      imported.buy_price ??
      base.buy_price ??
      imported.rent_price_per_day ??
      base.rent_price_per_day ??
      null,
    currency: imported.currency || base.currency || "EGP",
    event_type: imported.event_type || base.event_type || "",
    tags:
      Array.isArray(imported.tags) && imported.tags.length
        ? imported.tags
        : base.tags || [],
    customization_fee:
      imported.customization_fee !== null && imported.customization_fee !== undefined
        ? Number(imported.customization_fee || 0)
        : Number(base.customization_fee || 0),
    venue_type: imported.venue_type || base.venue_type || "",
    delivery_class: imported.delivery_class || base.delivery_class || "",
    featured:
      imported.featured === null || imported.featured === undefined
        ? Boolean(base.featured)
        : Boolean(imported.featured),
    active:
      imported.active === null || imported.active === undefined
        ? base.active !== false
        : imported.active !== false,
    quantity_available: catalogShape.quantity_available,
    reorder_level: imported.reorder_level ?? base.reorder_level ?? 0,
    unit_cost: imported.unit_cost ?? base.unit_cost ?? 0,
    overhead_cost: imported.overhead_cost ?? base.overhead_cost ?? 0,
    images:
      Array.isArray(imported.images) && imported.images.length
        ? imported.images
        : Array.isArray(base.images)
          ? base.images
          : [],
    variations: catalogShape.variations
  };

  if (merged.buy_enabled === undefined || merged.buy_enabled === null) {
    merged.buy_enabled = merged.buy_price !== null || merged.rent_price_per_day === null;
  }

  if (merged.rent_enabled === undefined || merged.rent_enabled === null) {
    merged.rent_enabled = merged.rent_price_per_day !== null;
  }

  merged.slug = slugifyProductName(merged.name, merged.product_id);
  merged.currency = normalizeText(merged.currency || "EGP", 3).toUpperCase();
  merged.images = mergeUniqueTextLists(merged.images).slice(0, 10);
  merged.tags = normalizeTextList(merged.tags, 60);
  merged.quality_points = normalizeTextList(merged.quality_points, 140);
  merged.colors = normalizeTextList(merged.colors, 60);
  merged.sizes = merged.size_mode === "varied"
    ? sortSizes(merged.sizes, merged.size_mode)
    : [];

  return merged;
}

function validateMergedProduct(product) {
  const errors = [];

  if (!product.name) errors.push("Missing name.");
  if (!product.category) errors.push("Missing category.");
  if (!product.subcategory) errors.push("Missing subcategory.");
  if (!PRODUCT_ID_REGEX.test(String(product.product_id || ""))) {
    errors.push("Product ID must be exactly 5 digits like 00001.");
  }
  if (!product.sku) {
    errors.push("SKU is required.");
  }
  if (!product.buy_enabled && !product.rent_enabled) {
    errors.push("Enable at least buy or rent.");
  }
  if (!product.colors.length) {
    errors.push("At least one color is required.");
  }
  if (normalizeSizeMode(product.size_mode) === "varied" && !product.sizes.length) {
    errors.push("Varied products require at least one size.");
  }
  if (product.images.length > 10) {
    errors.push("A product can have up to 10 images.");
  }
  if (product.buy_price !== null && Number(product.buy_price) < 0) {
    errors.push("Buy price must be zero or greater.");
  }
  if (product.rent_price_per_day !== null && Number(product.rent_price_per_day) < 0) {
    errors.push("Rent price must be zero or greater.");
  }
  if (Number(product.reorder_level || 0) < 0 || !Number.isInteger(Number(product.reorder_level || 0))) {
    errors.push("Reorder level must be a non-negative whole number.");
  }

  return errors;
}

async function loadExistingIdentityMaps(client, {
  skus = [],
  productIds = []
} = {}) {
  const cleanSkus = Array.from(new Set((skus || []).map((value) => normalizeSku(value)).filter(Boolean)));
  const cleanProductIds = Array.from(new Set((productIds || []).map((value) => String(value || "").trim()).filter(Boolean)));

  if (!cleanSkus.length && !cleanProductIds.length) {
    return {
      byProductId: new Map(),
      bySku: new Map()
    };
  }

  const result = await client.query(
    `
    SELECT id, sku, product_id
    FROM products
    WHERE ($1::text[] <> '{}'::text[] AND sku = ANY($1::text[]))
       OR ($2::text[] <> '{}'::text[] AND product_id = ANY($2::text[]))
    `,
    [cleanSkus, cleanProductIds]
  );

  return result.rows.reduce((maps, row) => {
    if (row.sku) {
      maps.bySku.set(normalizeSku(row.sku), {
        id: Number(row.id),
        product_id: String(row.product_id || ""),
        sku: normalizeSku(row.sku)
      });
    }

    if (row.product_id) {
      maps.byProductId.set(String(row.product_id), {
        id: Number(row.id),
        product_id: String(row.product_id || ""),
        sku: normalizeSku(row.sku)
      });
    }

    return maps;
  }, {
    byProductId: new Map(),
    bySku: new Map()
  });
}

async function loadExistingProductsByIds(client, ids = []) {
  const cleanIds = Array.from(new Set((ids || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));
  if (!cleanIds.length) {
    return new Map();
  }

  const result = await client.query(
    `${PRODUCT_IMPORT_SELECT_SQL} WHERE p.id = ANY($1::bigint[]) ORDER BY p.id ASC`,
    [cleanIds]
  );

  return result.rows.reduce((map, row) => {
    map.set(Number(row.id), materializeStoredProduct(row));
    return map;
  }, new Map());
}

async function syncImportedProductRelations(client, productId, product) {
  await client.query(
    `
    INSERT INTO product_costs (product_id, unit_cost, overhead_cost, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (product_id)
    DO UPDATE SET
      unit_cost = EXCLUDED.unit_cost,
      overhead_cost = EXCLUDED.overhead_cost,
      updated_at = NOW()
    `,
    [productId, Number(product.unit_cost || 0), Number(product.overhead_cost || 0)]
  );

  await client.query("DELETE FROM product_variations WHERE product_id = $1", [productId]);

  for (const variation of product.variations) {
    await client.query(
      `
      INSERT INTO product_variations (
        product_id,
        color,
        size,
        quantity,
        sku,
        availability_status,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
      [
        productId,
        variation.color || "Standard",
        normalizeSizeMode(product.size_mode) === "one-size" ? ONE_SIZE_LABEL : variation.size || "Standard",
        Number(variation.quantity || 0),
        variation.sku || null,
        variation.availability_status || (Number(variation.quantity || 0) > 0 ? "in_stock" : "out_of_stock")
      ]
    );
  }

  await client.query(
    `
    INSERT INTO product_inventory (product_id, quantity_available, reorder_level, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (product_id)
    DO UPDATE SET
      quantity_available = EXCLUDED.quantity_available,
      reorder_level = EXCLUDED.reorder_level,
      updated_at = NOW()
    `,
    [productId, Number(product.quantity_available || 0), Number(product.reorder_level || 0)]
  );

  await client.query("DELETE FROM product_images WHERE product_id = $1", [productId]);

  for (let index = 0; index < product.images.length; index += 1) {
    await client.query(
      `
      INSERT INTO product_images (product_id, url, sort_order, theme_mode)
      VALUES ($1, $2, $3, 'light')
      `,
      [productId, product.images[index], index]
    );
  }
}

function buildImportGroups(parsedRows, summary) {
  const groups = [];
  const groupsByKey = new Map();
  const skuOwners = new Map();
  const productIdOwners = new Map();

  parsedRows.forEach((rawRow) => {
    const normalized = normalizeImportRow(rawRow);

    if (normalized.errors.length) {
      summary.failed += 1;
      appendError(summary, normalized.value.rowNumber, normalized.errors.join(" "));
      return;
    }

    const row = normalized.value;
    const groupKey = buildGroupKey(row);

    if (row.sku) {
      const currentOwner = skuOwners.get(row.sku);
      if (currentOwner && currentOwner !== groupKey) {
        summary.failed += 1;
        appendError(summary, row.rowNumber, `Duplicate SKU in file: ${row.sku}.`);
        return;
      }
      skuOwners.set(row.sku, groupKey);
    }

    if (row.product_id) {
      const currentOwner = productIdOwners.get(row.product_id);
      if (currentOwner && currentOwner !== groupKey) {
        summary.failed += 1;
        appendError(summary, row.rowNumber, `Duplicate product_id in file: ${row.product_id}.`);
        return;
      }
      productIdOwners.set(row.product_id, groupKey);
    }

    if (!groupsByKey.has(groupKey)) {
      const group = {
        key: groupKey,
        rowNumbers: [],
        rows: [],
        firstRowNumber: row.rowNumber,
        providedSku: row.sku || "",
        providedProductId: row.product_id || ""
      };

      groupsByKey.set(groupKey, group);
      groups.push(group);
    }

    const group = groupsByKey.get(groupKey);
    group.rows.push(row);
    group.rowNumbers.push(row.rowNumber);
    if (!group.providedSku && row.sku) {
      group.providedSku = row.sku;
    }
    if (!group.providedProductId && row.product_id) {
      group.providedProductId = row.product_id;
    }
  });

  return groups;
}

function buildSummary({ fileName, parsedRows, dryRun }) {
  return {
    success: true,
    fileName: String(fileName || ""),
    totalRows: Array.isArray(parsedRows) ? parsedRows.length : 0,
    totalProducts: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    generatedSkuCount: 0,
    generatedProductIdCount: 0,
    dryRun: Boolean(dryRun),
    errors: []
  };
}

async function importParsedRows(client, parsedRows, {
  dryRun = false,
  fileName = ""
} = {}) {
  const summary = buildSummary({ dryRun, fileName, parsedRows });
  const groups = buildImportGroups(parsedRows, summary);
  summary.totalProducts = groups.length;

  const identityMaps = await loadExistingIdentityMaps(client, {
    skus: groups.map((group) => group.providedSku),
    productIds: groups.map((group) => group.providedProductId)
  });

  const targetIds = [];

  groups.forEach((group) => {
    const bySku = group.providedSku ? identityMaps.bySku.get(group.providedSku) : null;
    const byProductId = group.providedProductId ? identityMaps.byProductId.get(group.providedProductId) : null;

    if (bySku && byProductId && Number(bySku.id) !== Number(byProductId.id)) {
      group.invalidReason = `SKU ${group.providedSku} matches a different product than product_id ${group.providedProductId}.`;
      summary.failed += 1;
      appendError(summary, group.rowNumbers, group.invalidReason);
      return;
    }

    group.targetId = Number(bySku?.id || byProductId?.id || 0) || null;

    if (group.targetId) {
      targetIds.push(group.targetId);
    }
  });

  const existingProducts = await loadExistingProductsByIds(client, targetIds);
  const nextSku = await createSkuGenerator(client, {
    usedSkus: [
      ...groups.map((group) => group.providedSku),
      ...Array.from(identityMaps.bySku.keys())
    ]
  });
  const nextProductId = await createProductIdGenerator(client, [
    ...groups.map((group) => group.providedProductId),
    ...Array.from(identityMaps.byProductId.keys())
  ]);

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (group.invalidReason) {
      continue;
    }

    const savepoint = `product_import_${index + 1}`;
    const existing = group.targetId ? existingProducts.get(group.targetId) || null : null;
    const normalizedGroup = buildImportProduct(group.rows);

    if (normalizedGroup.errors.length) {
      summary.failed += 1;
      appendError(summary, group.rowNumbers, normalizedGroup.errors.join(" "));
      continue;
    }

    const product = mergeImportProduct(normalizedGroup.value, existing);

    if (!product.sku) {
      product.sku = existing?.sku || nextSku();
      summary.generatedSkuCount += existing?.sku ? 0 : 1;
    }

    if (!product.product_id) {
      product.product_id = existing?.product_id || nextProductId();
      summary.generatedProductIdCount += existing?.product_id ? 0 : 1;
    }

    product.slug = slugifyProductName(product.name, product.product_id);

    const validationErrors = validateMergedProduct(product);
    if (validationErrors.length) {
      summary.failed += 1;
      appendError(summary, group.rowNumbers, validationErrors.join(" "));
      continue;
    }

    await client.query(`SAVEPOINT ${savepoint}`);

    try {
      let productId = group.targetId;

      if (productId) {
        await client.query(
          `
          UPDATE products
          SET product_id = $1,
              sku = $2,
              name = $3,
              slug = $4,
              category = $5,
              subcategory = $6,
              description = $7,
              quality = $8,
              quality_points = $9::jsonb,
              colors = $10::jsonb,
              size_mode = $11,
              sizes = $12::jsonb,
              customizable = $13,
              buy_enabled = $14,
              rent_enabled = $15,
              buy_price = $16,
              rent_price_per_day = $17,
              base_price = $18,
              currency = $19,
              event_type = $20,
              tags = $21::jsonb,
              customization_fee = $22,
              venue_type = $23,
              delivery_class = $24,
              featured = $25,
              active = $26,
              updated_at = NOW()
          WHERE id = $27
          `,
          [
            product.product_id,
            product.sku,
            product.name,
            product.slug,
            product.category,
            product.subcategory,
            product.description,
            product.quality,
            JSON.stringify(product.quality_points),
            JSON.stringify(product.colors),
            product.size_mode,
            JSON.stringify(product.sizes),
            product.customizable,
            product.buy_enabled,
            product.rent_enabled,
            product.buy_price,
            product.rent_price_per_day,
            product.base_price,
            product.currency,
            product.event_type,
            JSON.stringify(product.tags),
            product.customization_fee,
            product.venue_type,
            product.delivery_class,
            product.featured,
            product.active,
            productId
          ]
        );
        summary.updated += 1;
      } else {
        const insertResult = await client.query(
          `
          INSERT INTO products (
            product_id,
            sku,
            name,
            slug,
            category,
            subcategory,
            description,
            quality,
            quality_points,
            colors,
            size_mode,
            sizes,
            customizable,
            buy_enabled,
            rent_enabled,
            buy_price,
            rent_price_per_day,
            base_price,
            currency,
            event_type,
            tags,
            customization_fee,
            venue_type,
            delivery_class,
            featured,
            active,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12::jsonb, $13, $14,
            $15, $16, $17, $18, $19, $20, $21::jsonb, $22, $23, $24, $25, $26, NOW()
          )
          RETURNING id
          `,
          [
            product.product_id,
            product.sku,
            product.name,
            product.slug,
            product.category,
            product.subcategory,
            product.description,
            product.quality,
            JSON.stringify(product.quality_points),
            JSON.stringify(product.colors),
            product.size_mode,
            JSON.stringify(product.sizes),
            product.customizable,
            product.buy_enabled,
            product.rent_enabled,
            product.buy_price,
            product.rent_price_per_day,
            product.base_price,
            product.currency,
            product.event_type,
            JSON.stringify(product.tags),
            product.customization_fee,
            product.venue_type,
            product.delivery_class,
            product.featured,
            product.active
          ]
        );
        productId = Number(insertResult.rows[0]?.id);
        summary.inserted += 1;
      }

      await syncImportedProductRelations(client, productId, product);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      summary.failed += 1;
      appendError(summary, group.rowNumbers, error?.code === "23505"
        ? "Duplicate SKU, Product ID, or slug conflicts with an existing product."
        : error?.message || "Import failed for this product.");
    }
  }

  summary.success = summary.failed === 0;

  if (dryRun) {
    summary.success = summary.failed === 0;
  }

  return summary;
}

async function importProductFile(pool, {
  buffer,
  fileName,
  dryRun = false
} = {}) {
  const parsed = parseProductImportBuffer({
    buffer,
    originalName: fileName
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const summary = await importParsedRows(client, parsed.rows, {
      dryRun,
      fileName
    });

    if (dryRun) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }

    return summary;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function importProductFileFromPath(pool, filePath, options = {}) {
  const absolutePath = path.resolve(String(filePath || ""));
  const buffer = await fs.promises.readFile(absolutePath);
  return importProductFile(pool, {
    ...options,
    buffer,
    fileName: path.basename(absolutePath)
  });
}

module.exports = {
  importParsedRows,
  importProductFile,
  importProductFileFromPath,
  materializeStoredProduct,
  mergeImportProduct
};
