-- EventMart V4 — Demo Seed Data
-- Run against your database AFTER schema.sql:
--   psql $DATABASE_URL -f seed.sql
-- Password for demo admin: Admin123!
-- Password for demo customer: Customer123!

-- ── Users ──────────────────────────────────────────────────
INSERT INTO users (name, email, password_hash, role) VALUES
  (
    'Admin User',
    'admin@eventmart.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHi2',
    'admin'
  ),
  (
    'Demo Customer',
    'customer@eventmart.com',
    '$2a$10$8Kx1Bq4V7Rm9fSzP0dHXIeWkYQgMl3a6TuNpCoJ5hAiZ2vBwEtDyx',
    'customer'
  )
ON CONFLICT (email) DO NOTHING;

-- ── Products ───────────────────────────────────────────────
INSERT INTO products (
  product_id, name, slug, category, subcategory, description, quality,
  quality_points, colors, size_mode, sizes, customizable,
  buy_enabled, rent_enabled, buy_price, rent_price_per_day, currency,
  featured, active
) VALUES
  (
    '00001', 'RGB Stage Wash Light', 'rgb-stage-wash-light-00001',
    'Lighting', 'Stage Lights',
    'Professional RGB LED wash light ideal for stages, booths, and corporate events. Wide beam angle with 16-bit dimming.',
    'Professional Grade',
    '["16-bit smooth dimming","Wide 120° beam angle","DMX-512 compatible","IP20 rated for indoor use"]',
    '["Black","Silver"]', 'one-size', '[]',
    false, true, true, 3500.00, 120.00, 'EGP', true, true
  ),
  (
    '00002', 'Moving Head Spot 150W', 'moving-head-spot-150w-00002',
    'Lighting', 'Moving Heads',
    '150W Osram discharge lamp moving head with 13 colors, 7 gobos, and prism effect. Perfect for concerts and large events.',
    'Premium',
    '["150W Osram discharge lamp","13 dichroic colors","7 replaceable gobos","Prism & frost effects","Pan/tilt range 540°/270°"]',
    '["Black"]', 'one-size', '[]',
    false, true, true, 12000.00, 450.00, 'EGP', true, true
  ),
  (
    '00003', 'Wireless DMX Controller', 'wireless-dmx-controller-00003',
    'Lighting', 'Controllers',
    'Portable wireless DMX controller for managing up to 512 channels. 2.4GHz transmission with 100m range.',
    'Professional Grade',
    '["512 DMX channels","2.4GHz wireless, 100m range","Rechargeable battery (8h)","LCD touchscreen display"]',
    '["Black","White"]', 'one-size', '[]',
    false, true, true, 4200.00, 150.00, 'EGP', false, true
  ),
  (
    '00004', 'LED Par Can 18x15W RGBWA', 'led-par-can-18x15w-rgbwa-00004',
    'Lighting', 'Par Cans',
    'High-output LED par can with 18 x 15W RGBWA LEDs. Silent fan-less design, ideal for theaters and weddings.',
    'Professional Grade',
    '["18x15W RGBWA LEDs","Fan-less silent operation","Smooth color mixing","Lightweight aluminum housing"]',
    '["Black","White","Silver"]', 'one-size', '[]',
    true, true, true, 2800.00, 90.00, 'EGP', false, true
  ),
  (
    '00005', 'Truss Square 3m Section', 'truss-square-3m-section-00005',
    'Rigging', 'Truss',
    'Heavy-duty aluminum square truss section 290mm x 290mm, 3m length. Load capacity 800kg UDL. Compatible with standard conical connectors.',
    'Heavy Duty',
    '["290x290mm square profile","3m standard length","800kg UDL load capacity","TÜV certified","Hot-dip galvanized connectors"]',
    '["Silver","Black"]', 'one-size', '[]',
    false, true, true, 1800.00, 60.00, 'EGP', false, true
  ),
  (
    '00006', 'Line Array Speaker 12"', 'line-array-speaker-12-inch-00006',
    'Audio', 'Speakers',
    'Professional 12" line array element with 1200W peak power. Wide horizontal dispersion, suitable for outdoor concerts and conferences.',
    'Professional Grade',
    '["1200W peak / 600W RMS","12\" woofer + 1\" driver","90° horizontal dispersion","M20 rigging point"]',
    '["Black","White"]', 'one-size', '[]',
    false, true, true, 18000.00, 600.00, 'EGP', true, true
  ),
  (
    '00007', 'Stage Podium Wooden', 'stage-podium-wooden-00007',
    'Furniture', 'Stage',
    'Elegant wooden lectern with built-in reading light and cable management. Suitable for conferences, graduations, and formal events.',
    'Standard',
    '["Solid wood construction","Built-in LED reading light","Cable management channel","Adjustable height"]',
    '["Mahogany","White","Black"]', 'one-size', '[]',
    true, true, true, 3200.00, 100.00, 'EGP', false, true
  ),
  (
    '00008', 'Wireless Handheld Microphone', 'wireless-handheld-microphone-00008',
    'Audio', 'Microphones',
    'UHF wireless microphone system with 100m range. Includes receiver, microphone, and rack mount kit. Ideal for events and presentations.',
    'Professional Grade',
    '["UHF 500-900MHz band","100m operating range","100+ selectable frequencies","Anti-interference design","8h battery life"]',
    '["Black","Silver"]', 'one-size', '[]',
    false, true, true, 5500.00, 180.00, 'EGP', false, true
  )
ON CONFLICT (product_id) DO NOTHING;

-- ── Inventory ──────────────────────────────────────────────
INSERT INTO product_inventory (product_id, quantity_available, reorder_level)
SELECT p.id, inv.qty, inv.reorder
FROM (VALUES
  ('00001', 15, 3),
  ('00002', 6,  2),
  ('00003', 10, 2),
  ('00004', 20, 4),
  ('00005', 30, 5),
  ('00006', 8,  2),
  ('00007', 4,  1),
  ('00008', 12, 3)
) AS inv(pid, qty, reorder)
JOIN products p ON p.product_id = inv.pid
ON CONFLICT (product_id) DO UPDATE
  SET quantity_available = EXCLUDED.quantity_available,
      reorder_level      = EXCLUDED.reorder_level;

-- ── Costs ──────────────────────────────────────────────────
INSERT INTO product_costs (product_id, unit_cost, overhead_cost)
SELECT p.id, c.unit, c.overhead
FROM (VALUES
  ('00001', 2000.00, 200.00),
  ('00002', 7500.00, 500.00),
  ('00003', 2500.00, 150.00),
  ('00004', 1600.00, 150.00),
  ('00005',  900.00,  80.00),
  ('00006',11000.00, 800.00),
  ('00007', 1800.00, 200.00),
  ('00008', 3200.00, 250.00)
) AS c(pid, unit, overhead)
JOIN products p ON p.product_id = c.pid
ON CONFLICT (product_id) DO UPDATE
  SET unit_cost     = EXCLUDED.unit_cost,
      overhead_cost = EXCLUDED.overhead_cost;

-- ── Packages ───────────────────────────────────────────────
INSERT INTO packages (
  name, slug, description, customization_type, venue_type,
  recommended_for, fits_for_people, price, event_type, visibility, status, active
) VALUES
  (
    'Corporate Event Starter', 'corporate-event-starter',
    'Everything you need to run a polished corporate conference or product launch. Includes PA, moving heads, and a professional podium.',
    'not customizable', 'indoor',
    '["corporate","conference","product launch"]', 100,
    28000.00, 'corporate', 'public', 'active', true
  ),
  (
    'Wedding Premium Package', 'wedding-premium-package',
    'Create an unforgettable atmosphere with wash lights, wireless audio, and elegant furniture — tailored for indoor weddings.',
    'customizable', 'indoor',
    '["wedding","celebration"]', 200,
    45000.00, 'wedding', 'public', 'active', true
  ),
  (
    'Outdoor Concert Rig', 'outdoor-concert-rig',
    'Full concert setup: line array speakers, moving heads, truss system, and DMX controller. Scales from 500 to 2000 attendees.',
    'customizable', 'outdoor',
    '["concert","festival","outdoor"]', 500,
    120000.00, 'concert', 'public', 'active', true
  )
ON CONFLICT (slug) DO NOTHING;

-- ── Package Items ──────────────────────────────────────────
INSERT INTO package_items (package_id, product_id, minimum_quantity, default_quantity, is_required, sort_order)
SELECT pkg.id, p.id, pi.min_qty, pi.def_qty, pi.required, pi.sort
FROM (VALUES
  ('corporate-event-starter', '00002', 2, 4,  true,  1),
  ('corporate-event-starter', '00006', 4, 8,  true,  2),
  ('corporate-event-starter', '00007', 1, 1,  true,  3),
  ('corporate-event-starter', '00008', 2, 4,  true,  4),
  ('wedding-premium-package', '00001', 4, 8,  true,  1),
  ('wedding-premium-package', '00004', 6, 12, true,  2),
  ('wedding-premium-package', '00008', 2, 4,  true,  3),
  ('wedding-premium-package', '00007', 1, 1,  false, 4),
  ('outdoor-concert-rig',     '00002', 4, 8,  true,  1),
  ('outdoor-concert-rig',     '00005', 8, 16, true,  2),
  ('outdoor-concert-rig',     '00006', 8, 16, true,  3),
  ('outdoor-concert-rig',     '00003', 2, 2,  true,  4)
) AS pi(pkg_slug, prod_id, min_qty, def_qty, required, sort)
JOIN packages pkg ON pkg.slug     = pi.pkg_slug
JOIN products p   ON p.product_id = pi.prod_id
ON CONFLICT (package_id, product_id) DO NOTHING;
