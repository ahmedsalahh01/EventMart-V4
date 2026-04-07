ALTER TABLE products
ADD COLUMN IF NOT EXISTS sku TEXT;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS base_price NUMERIC(12,2);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT '';

ALTER TABLE products
ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS customization_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS venue_type TEXT NOT NULL DEFAULT '';

ALTER TABLE products
ADD COLUMN IF NOT EXISTS delivery_class TEXT NOT NULL DEFAULT '';

UPDATE products
SET tags = '[]'::jsonb
WHERE tags IS NULL;

UPDATE products
SET event_type = ''
WHERE event_type IS NULL;

UPDATE products
SET customization_fee = 0
WHERE customization_fee IS NULL;

UPDATE products
SET venue_type = ''
WHERE venue_type IS NULL;

UPDATE products
SET delivery_class = ''
WHERE delivery_class IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique
ON products (sku)
WHERE sku IS NOT NULL;
