-- ── Promoções nos produtos e bebidas ────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sale_price   NUMERIC,
  ADD COLUMN IF NOT EXISTS promo_active BOOLEAN DEFAULT false;

ALTER TABLE drinks
  ADD COLUMN IF NOT EXISTS sale_price   NUMERIC,
  ADD COLUMN IF NOT EXISTS promo_active BOOLEAN DEFAULT false;

-- ── Entregadores ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  vehicle_type  TEXT DEFAULT 'moto',       -- moto | carro | bicicleta
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Zonas de entrega por bairro ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_zones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood     TEXT NOT NULL,
  city             TEXT DEFAULT 'São Paulo',
  delivery_fee     NUMERIC NOT NULL DEFAULT 0,
  estimated_mins   INTEGER DEFAULT 40,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── Vincular pedido a entregador ─────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS driver_id         UUID REFERENCES drivers(id),
  ADD COLUMN IF NOT EXISTS driver_name       TEXT,
  ADD COLUMN IF NOT EXISTS driver_assigned_at TIMESTAMPTZ;

-- ── Rastreio de localização do entregador ────────────────────────────────────
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS last_lat          NUMERIC,
  ADD COLUMN IF NOT EXISTS last_lng          NUMERIC,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

-- ── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_drivers_is_active ON drivers(is_active);
