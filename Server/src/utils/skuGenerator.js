const GENERATED_SKU_WIDTH = 6;
const DEFAULT_SKU_PREFIX = "PRD";
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._/-]*$/i;

function normalizeSku(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .toUpperCase();
}

function isValidSku(value) {
  const normalized = normalizeSku(value);
  return Boolean(normalized) && SKU_PATTERN.test(normalized);
}

function buildGeneratedSkuRegex(prefix = DEFAULT_SKU_PREFIX) {
  const normalizedPrefix = normalizeSku(prefix).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return `^${normalizedPrefix}-[0-9]{${GENERATED_SKU_WIDTH}}$`;
}

function formatGeneratedSku(number, prefix = DEFAULT_SKU_PREFIX) {
  const safeNumber = Math.max(1, Number(number || 0));
  return `${normalizeSku(prefix)}-${String(Math.trunc(safeNumber)).padStart(GENERATED_SKU_WIDTH, "0")}`;
}

async function readMaxGeneratedSkuNumber(client, prefix = DEFAULT_SKU_PREFIX) {
  const regex = buildGeneratedSkuRegex(prefix);
  const result = await client.query(
    `
    SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM '([0-9]+)$') AS INTEGER)), 0) AS max_number
    FROM products
    WHERE sku ~ $1
    `,
    [regex]
  );

  return Number(result.rows[0]?.max_number || 0);
}

async function generateNextSku(client, prefix = DEFAULT_SKU_PREFIX) {
  const nextNumber = (await readMaxGeneratedSkuNumber(client, prefix)) + 1;
  return formatGeneratedSku(nextNumber, prefix);
}

async function createSkuGenerator(client, {
  prefix = DEFAULT_SKU_PREFIX,
  usedSkus = []
} = {}) {
  const taken = new Set(
    (Array.isArray(usedSkus) ? usedSkus : [])
      .map((value) => normalizeSku(value))
      .filter(Boolean)
  );
  let cursor = await readMaxGeneratedSkuNumber(client, prefix);

  return function nextGeneratedSku() {
    do {
      cursor += 1;
    } while (taken.has(formatGeneratedSku(cursor, prefix)));

    const sku = formatGeneratedSku(cursor, prefix);
    taken.add(sku);
    return sku;
  };
}

module.exports = {
  DEFAULT_SKU_PREFIX,
  GENERATED_SKU_WIDTH,
  createSkuGenerator,
  formatGeneratedSku,
  generateNextSku,
  isValidSku,
  normalizeSku,
  readMaxGeneratedSkuNumber
};
