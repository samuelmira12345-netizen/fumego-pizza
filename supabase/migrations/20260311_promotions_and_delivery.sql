-- ============================================================
-- Migration: Promotions + Delivery Module
-- ============================================================

-- ── Promotion fields on products ────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS promotion_active   BOOLEAN   DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotional_price  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS promotion_ends_at  TIMESTAMPTZ;

-- ── Promotion fields on drinks ───────────────────────────────
ALTER TABLE drinks
  ADD COLUMN IF NOT EXISTS promotion_active   BOOLEAN   DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotional_price  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS promotion_ends_at  TIMESTAMPTZ;

-- ── Delivery persons ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_persons (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT         NOT NULL,
  phone        TEXT,
  email        TEXT         UNIQUE,
  password_hash TEXT        NOT NULL,
  is_active    BOOLEAN      DEFAULT true,
  created_at   TIMESTAMPTZ  DEFAULT now(),
  updated_at   TIMESTAMPTZ  DEFAULT now()
);

-- ── Delivery zones (neighborhood → fee) ─────────────────────
CREATE TABLE IF NOT EXISTS delivery_zones (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood    TEXT        NOT NULL,
  city            TEXT        DEFAULT '',
  fee             NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_mins  INT         DEFAULT 30,
  is_active       BOOLEAN     DEFAULT true,
  sort_order      INT         DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Add delivery tracking to orders ──────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_person_id   UUID REFERENCES delivery_persons(id),
  ADD COLUMN IF NOT EXISTS driver_collected_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_delivered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_location_lat  NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS driver_location_lng  NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS driver_location_at   TIMESTAMPTZ;

-- ── Delivery person location history ────────────────────────
CREATE TABLE IF NOT EXISTS delivery_locations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_person_id  UUID        NOT NULL REFERENCES delivery_persons(id) ON DELETE CASCADE,
  order_id            UUID        REFERENCES orders(id),
  lat                 NUMERIC(10,7) NOT NULL,
  lng                 NUMERIC(10,7) NOT NULL,
  recorded_at         TIMESTAMPTZ DEFAULT now()
);

-- ── Index for performance ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_delivery_person ON orders(delivery_person_id);
CREATE INDEX IF NOT EXISTS idx_delivery_locations_person ON delivery_locations(delivery_person_id, recorded_at DESC);

-- ── RLS: delivery persons can only see their own data ────────
ALTER TABLE delivery_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_locations ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, anon needs explicit policies
-- These tables are accessed server-side with service_role so no client policies needed
