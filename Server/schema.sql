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
  sku TEXT,
  name TEXT NOT NULL,
  slug TEXT,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  quality TEXT NOT NULL DEFAULT '',
  quality_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  size_mode TEXT NOT NULL DEFAULT 'one-size',
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  customizable BOOLEAN NOT NULL DEFAULT false,
  buy_enabled BOOLEAN NOT NULL DEFAULT true,
  rent_enabled BOOLEAN NOT NULL DEFAULT false,
  buy_price NUMERIC(12,2),
  rent_price_per_day NUMERIC(12,2),
  base_price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  event_type TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  customization_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  venue_type TEXT NOT NULL DEFAULT '',
  delivery_class TEXT NOT NULL DEFAULT '',
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_id TEXT;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS featured BOOLEAN;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS sku TEXT;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS quality TEXT NOT NULL DEFAULT '';

ALTER TABLE products
ADD COLUMN IF NOT EXISTS colors JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS size_mode TEXT NOT NULL DEFAULT 'one-size';

ALTER TABLE products
ADD COLUMN IF NOT EXISTS sizes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS customizable BOOLEAN NOT NULL DEFAULT false;

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

ALTER TABLE products
ADD COLUMN IF NOT EXISTS availability_note TEXT NOT NULL DEFAULT '';

UPDATE products
SET product_id = LPAD(id::text, 5, '0')
WHERE product_id IS NULL;

UPDATE products
SET slug = CONCAT(
  COALESCE(NULLIF(REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g'), ''), 'product'),
  '-',
  product_id
)
WHERE slug IS NULL OR slug = '';

UPDATE products
SET featured = false
WHERE featured IS NULL;

ALTER TABLE products
ALTER COLUMN product_id SET NOT NULL;

ALTER TABLE products
ALTER COLUMN featured SET DEFAULT false;

ALTER TABLE products
ALTER COLUMN featured SET NOT NULL;

UPDATE products
SET colors = '[]'::jsonb
WHERE colors IS NULL;

UPDATE products
SET sizes = '[]'::jsonb
WHERE sizes IS NULL;

UPDATE products
SET size_mode = 'one-size'
WHERE size_mode IS NULL OR size_mode = '';

UPDATE products
SET customizable = false
WHERE customizable IS NULL;

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

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique
ON products (sku)
WHERE sku IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_slug_key'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_size_mode_check'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_size_mode_check
    CHECK (size_mode IN ('one-size', 'varied'));
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

CREATE TABLE IF NOT EXISTS product_variations (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  sku TEXT,
  availability_status TEXT NOT NULL DEFAULT 'in_stock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, color, size)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variations_availability_status_check'
  ) THEN
    ALTER TABLE product_variations
    ADD CONSTRAINT product_variations_availability_status_check
    CHECK (availability_status IN ('in_stock', 'out_of_stock', 'unavailable'));
  END IF;
END
$$;

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

CREATE INDEX IF NOT EXISTS product_images_product_sort_idx
ON product_images (product_id, sort_order, id);

CREATE INDEX IF NOT EXISTS product_images_product_theme_sort_idx
ON product_images (product_id, theme_mode, sort_order, id);

CREATE TABLE IF NOT EXISTS packages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  customization_type TEXT NOT NULL DEFAULT 'not customizable',
  venue_type TEXT NOT NULL DEFAULT 'hybrid',
  recommended_for JSONB NOT NULL DEFAULT '[]'::jsonb,
  fits_for_people INT NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'public',
  status TEXT NOT NULL DEFAULT 'draft',
  active BOOLEAN NOT NULL DEFAULT true,
  context_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS packages_updated_at_idx
ON packages (updated_at DESC, id DESC);

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS customization_type TEXT NOT NULL DEFAULT 'not customizable';

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS venue_type TEXT NOT NULL DEFAULT 'hybrid';

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS recommended_for JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS fits_for_people INT NOT NULL DEFAULT 1;

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT '';

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS context_defaults JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE packages
SET description = ''
WHERE description IS NULL;

UPDATE packages
SET customization_type = CASE
  WHEN LOWER(
    TRIM(
      COALESCE(
        NULLIF(context_defaults->>'customizationType', ''),
        NULLIF(context_defaults->>'customization_type', ''),
        customization_type,
        ''
      )
    )
  ) IN ('customizable', 'not customizable', 'hybrid')
    THEN LOWER(
      TRIM(
        COALESCE(
          NULLIF(context_defaults->>'customizationType', ''),
          NULLIF(context_defaults->>'customization_type', ''),
          customization_type,
          ''
        )
      )
    )
  WHEN LOWER(
    TRIM(
      COALESCE(
        context_defaults->>'customizationAvailable',
        context_defaults->>'customization_available',
        ''
      )
    )
  ) IN ('true', '1', 'yes', 'on')
    THEN 'customizable'
  ELSE 'not customizable'
END;

UPDATE packages
SET venue_type = CASE
  WHEN LOWER(
    TRIM(
      COALESCE(
        NULLIF(context_defaults->>'venueType', ''),
        NULLIF(context_defaults->>'venue_type', ''),
        venue_type,
        ''
      )
    )
  ) IN ('indoor', 'outdoor', 'hybrid')
    THEN LOWER(
      TRIM(
        COALESCE(
          NULLIF(context_defaults->>'venueType', ''),
          NULLIF(context_defaults->>'venue_type', ''),
          venue_type,
          ''
        )
      )
    )
  ELSE 'hybrid'
END;

UPDATE packages
SET recommended_for = CASE
  WHEN JSONB_TYPEOF(recommended_for) = 'array' AND JSONB_ARRAY_LENGTH(recommended_for) > 0
    THEN recommended_for
  WHEN TRIM(COALESCE(event_type, '')) <> ''
    THEN TO_JSONB(ARRAY[LOWER(TRIM(event_type))])
  ELSE '[]'::jsonb
END;

UPDATE packages
SET fits_for_people = CASE
  WHEN COALESCE(context_defaults->>'guestCount', context_defaults->>'guest_count', '') ~ '^\d+$'
    THEN GREATEST((COALESCE(context_defaults->>'guestCount', context_defaults->>'guest_count'))::INT, 1)
  ELSE GREATEST(COALESCE(fits_for_people, 1), 1)
END;

UPDATE packages
SET price = CASE
  WHEN COALESCE(context_defaults->>'packagePrice', context_defaults->>'package_price', '') ~ '^\d+(\.\d+)?$'
    THEN (COALESCE(context_defaults->>'packagePrice', context_defaults->>'package_price'))::NUMERIC(12,2)
  ELSE GREATEST(COALESCE(price, 0), 0)
END;

UPDATE packages
SET event_type = ''
WHERE event_type IS NULL;

UPDATE packages
SET visibility = 'public'
WHERE visibility IS NULL OR visibility = '';

UPDATE packages
SET status = 'draft'
WHERE status IS NULL OR status = '';

UPDATE packages
SET context_defaults = '{}'::jsonb
WHERE context_defaults IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'packages_slug_key'
  ) THEN
    ALTER TABLE packages
    ADD CONSTRAINT packages_slug_key UNIQUE (slug);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'packages_customization_type_check'
  ) THEN
    ALTER TABLE packages
    ADD CONSTRAINT packages_customization_type_check
    CHECK (customization_type IN ('customizable', 'not customizable', 'hybrid'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'packages_venue_type_check'
  ) THEN
    ALTER TABLE packages
    ADD CONSTRAINT packages_venue_type_check
    CHECK (venue_type IN ('indoor', 'outdoor', 'hybrid'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'packages_fits_for_people_check'
  ) THEN
    ALTER TABLE packages
    ADD CONSTRAINT packages_fits_for_people_check
    CHECK (fits_for_people > 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'packages_price_check'
  ) THEN
    ALTER TABLE packages
    ADD CONSTRAINT packages_price_check
    CHECK (price >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'packages_visibility_check'
  ) THEN
    ALTER TABLE packages
    ADD CONSTRAINT packages_visibility_check
    CHECK (visibility IN ('public', 'private', 'hidden'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'packages_status_check'
  ) THEN
    ALTER TABLE packages
    ADD CONSTRAINT packages_status_check
    CHECK (status IN ('draft', 'active', 'inactive'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS package_items (
  id BIGSERIAL PRIMARY KEY,
  package_id BIGINT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  minimum_quantity INT NOT NULL DEFAULT 1,
  default_quantity INT NOT NULL DEFAULT 1,
  customizable BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT false,
  preferred_mode TEXT NOT NULL DEFAULT '',
  applies_to_event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  applies_to_venue_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  discount_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, product_id)
);

CREATE INDEX IF NOT EXISTS package_items_package_sort_idx
ON package_items (package_id, sort_order, id);

ALTER TABLE package_items
ADD COLUMN IF NOT EXISTS default_quantity INT NOT NULL DEFAULT 1;

ALTER TABLE package_items
ADD COLUMN IF NOT EXISTS customizable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE package_items
ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE package_items
ADD COLUMN IF NOT EXISTS preferred_mode TEXT NOT NULL DEFAULT '';

ALTER TABLE package_items
ADD COLUMN IF NOT EXISTS applies_to_event_types JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE package_items
ADD COLUMN IF NOT EXISTS applies_to_venue_types JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE package_items
ADD COLUMN IF NOT EXISTS discount_tiers JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE package_items
ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

UPDATE package_items
SET default_quantity = COALESCE(default_quantity, minimum_quantity, 1);

UPDATE package_items
SET customizable = false
WHERE customizable IS NULL;

UPDATE package_items
SET is_required = false
WHERE is_required IS NULL;

UPDATE package_items
SET preferred_mode = ''
WHERE preferred_mode IS NULL;

UPDATE package_items
SET applies_to_event_types = '[]'::jsonb
WHERE applies_to_event_types IS NULL;

UPDATE package_items
SET applies_to_venue_types = '[]'::jsonb
WHERE applies_to_venue_types IS NULL;

UPDATE package_items
SET discount_tiers = '[]'::jsonb
WHERE discount_tiers IS NULL;

UPDATE package_items
SET notes = ''
WHERE notes IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'package_items_preferred_mode_check'
  ) THEN
    ALTER TABLE package_items
    ADD CONSTRAINT package_items_preferred_mode_check
    CHECK (preferred_mode IN ('', 'buy', 'rent'));
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
  variation_id BIGINT REFERENCES product_variations(id) ON DELETE SET NULL,
  quantity INT NOT NULL,
  type TEXT NOT NULL DEFAULT 'buy',
  selected_color TEXT,
  selected_size TEXT,
  customization_requested BOOLEAN NOT NULL DEFAULT false,
  rent_days INT,
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL
);

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS variation_id BIGINT REFERENCES product_variations(id) ON DELETE SET NULL;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS selected_color TEXT;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS selected_size TEXT;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS customization_requested BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS customization_uploads (
  id BIGSERIAL PRIMARY KEY,
  upload_token TEXT UNIQUE NOT NULL,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variation_id BIGINT REFERENCES product_variations(id) ON DELETE SET NULL,
  package_id BIGINT REFERENCES packages(id) ON DELETE SET NULL,
  package_item_id BIGINT REFERENCES package_items(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  order_item_id BIGINT REFERENCES order_items(id) ON DELETE SET NULL,
  upload_kind TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customization_uploads
ADD COLUMN IF NOT EXISTS package_id BIGINT REFERENCES packages(id) ON DELETE SET NULL;

ALTER TABLE customization_uploads
ADD COLUMN IF NOT EXISTS package_item_id BIGINT REFERENCES package_items(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customization_uploads_upload_kind_check'
  ) THEN
    ALTER TABLE customization_uploads
    ADD CONSTRAINT customization_uploads_upload_kind_check
    CHECK (upload_kind IN ('mockup', 'design'));
  END IF;
END
$$;

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
