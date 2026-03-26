CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  product_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  quality_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  buy_enabled BOOLEAN NOT NULL DEFAULT true,
  rent_enabled BOOLEAN NOT NULL DEFAULT false,
  buy_price NUMERIC(12,2),
  rent_price_per_day NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_id TEXT;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS featured BOOLEAN;

UPDATE products
SET product_id = LPAD(id::text, 5, '0')
WHERE product_id IS NULL;

UPDATE products
SET featured = false
WHERE featured IS NULL;

ALTER TABLE products
ALTER COLUMN product_id SET NOT NULL;

ALTER TABLE products
ALTER COLUMN featured SET DEFAULT false;

ALTER TABLE products
ALTER COLUMN featured SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_product_id_key'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_product_id_key UNIQUE (product_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS product_inventory (
  product_id BIGINT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity_available INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_costs (
  product_id BIGINT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  overhead_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_images (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE product_images
ADD COLUMN IF NOT EXISTS theme_mode TEXT NOT NULL DEFAULT 'light';

UPDATE product_images
SET theme_mode = 'light'
WHERE theme_mode IS NULL OR theme_mode = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_images_theme_mode_check'
  ) THEN
    ALTER TABLE product_images
    ADD CONSTRAINT product_images_theme_mode_check
    CHECK (theme_mode IN ('light', 'dark'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  public_order_id TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  shipping_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  billing_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_estimate TEXT,
  deposit_required NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_status TEXT NOT NULL DEFAULT 'unpaid',
  deposit_paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS public_order_id TEXT;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipping_details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS billing_details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_estimate TEXT;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS deposit_required NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS deposit_paid NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS deposit_status TEXT NOT NULL DEFAULT 'unpaid';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;

UPDATE orders
SET public_order_id = CONCAT('EM-', TO_CHAR(created_at, 'YYYYMMDD'), '-', LPAD(id::text, 6, '0'))
WHERE public_order_id IS NULL OR public_order_id = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_public_order_id_key'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_public_order_id_key UNIQUE (public_order_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_deposit_status_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_deposit_status_check
    CHECK (deposit_status IN ('unpaid', 'paid', 'failed'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  type TEXT NOT NULL DEFAULT 'buy',
  rent_days INT,
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

