-- =========================================================================
-- FUMÊGO Pizza — Migração: Tabelas faltantes + RLS em tabelas de estoque
--
-- Resolve:
--   1. stock_movements e compound_ingredient_items: criadas em
--      supabase_stock_migration.sql mas com RLS comentado (UNRESTRICTED).
--   2. recipe_items: tabela usada em inventory.ts/catalog.ts/orders.ts
--      para vincular ingredientes a produtos, mas sem CREATE TABLE.
--   3. ingredient_price_history: tabela usada em inventory.ts para rastrear
--      variações de custo de ingredientes, mas sem CREATE TABLE.
--
-- Execute no Supabase SQL Editor.
-- =========================================================================


-- ── 1. recipe_items ───────────────────────────────────────────────────────────
-- Liga ingredientes a produtos (receita de cada item do cardápio).
-- Usada para cálculo de custo e desconto automático de estoque por pedido.

CREATE TABLE IF NOT EXISTS recipe_items (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID          NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity      DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
  recipe_unit   TEXT          NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_product
  ON recipe_items (product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient
  ON recipe_items (ingredient_id);

ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON recipe_items;
CREATE POLICY "service role only" ON recipe_items USING (false) WITH CHECK (false);


-- ── 2. ingredient_price_history ───────────────────────────────────────────────
-- Histórico de mudanças no custo unitário de ingredientes.
-- Usada para auditoria e análise de variação de custos ao longo do tempo.

CREATE TABLE IF NOT EXISTS ingredient_price_history (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID          NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  old_price     DECIMAL(12,4) NOT NULL,
  new_price     DECIMAL(12,4) NOT NULL,
  changed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredient_price_history_ingredient
  ON ingredient_price_history (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_price_history_changed_at
  ON ingredient_price_history (changed_at);

ALTER TABLE ingredient_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON ingredient_price_history;
CREATE POLICY "service role only" ON ingredient_price_history USING (false) WITH CHECK (false);


-- ── 3. RLS em stock_movements ─────────────────────────────────────────────────
-- Tabela criada em supabase_stock_migration.sql mas com RLS comentado.
-- Acesso exclusivo via service_role (backend).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "service role only" ON stock_movements';
    EXECUTE 'CREATE POLICY "service role only" ON stock_movements USING (false) WITH CHECK (false)';
  END IF;
END;
$$;


-- ── 4. RLS em compound_ingredient_items ───────────────────────────────────────
-- Tabela criada em supabase_stock_migration.sql mas com RLS comentado.
-- Acesso exclusivo via service_role (backend).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compound_ingredient_items' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE compound_ingredient_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "service role only" ON compound_ingredient_items';
    EXECUTE 'CREATE POLICY "service role only" ON compound_ingredient_items USING (false) WITH CHECK (false)';
  END IF;
END;
$$;
