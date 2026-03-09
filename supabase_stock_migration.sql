-- ============================================================
-- FUMÊGO Pizza — Migração: Sistema de Estoque
-- Execute este arquivo no Editor SQL do Supabase
-- ============================================================

-- ── 1. Novos campos na tabela ingredients ────────────────────
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS correction_factor  NUMERIC DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS min_stock          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_stock          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_stock      NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_origin    TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS ingredient_type    TEXT    DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS weight_volume      NUMERIC DEFAULT 1.000;

-- ── 2. Receitas de insumos compostos ────────────────────────
CREATE TABLE IF NOT EXISTS compound_ingredient_items (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  compound_id   UUID    REFERENCES ingredients(id) ON DELETE CASCADE,
  ingredient_id UUID    REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity      NUMERIC NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Movimentações de estoque ──────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id   UUID    REFERENCES ingredients(id) ON DELETE CASCADE,
  movement_type   TEXT    NOT NULL, -- 'in' | 'out' | 'adjustment'
  quantity        NUMERIC NOT NULL,
  reason          TEXT    DEFAULT '', -- 'purchase' | 'order' | 'production' | 'waste' | 'manual'
  reference_id    TEXT    DEFAULT '',
  notes           TEXT    DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Inserir todos os insumos ──────────────────────────────
-- Caso já existam insumos com o mesmo nome, use ON CONFLICT DO NOTHING
-- para evitar duplicatas (requer unique constraint no campo name, se não
-- houver basta remover o ON CONFLICT e rodar apenas uma vez).

INSERT INTO ingredients (name, unit, cost_per_unit, correction_factor, weight_volume, ingredient_type)
VALUES
  ('Abacaxi',           'unid', 9.00,  1.00, 1.000, 'simple'),
  ('Alho frito',        'kg',   20.00, 1.00, 1.000, 'simple'),
  ('Alho picado',       'kg',   33.00, 1.00, 1.000, 'simple'),
  ('Atum',              'unid', 8.50,  1.00, 1.000, 'simple'),
  ('Azeitona preta',    'kg',   47.00, 1.00, 1.000, 'simple'),
  ('Bacon',             'kg',   59.00, 1.00, 1.000, 'simple'),
  ('Brócolis',          'kg',   9.00,  1.00, 1.000, 'simple'),
  ('Calabresa',         'kg',   25.50, 1.00, 1.000, 'simple'),
  ('Catupiry',          'pct',  26.60, 1.00, 1.000, 'simple'),
  ('Cebola Branca',     'kg',   4.00,  1.00, 1.000, 'simple'),
  ('Cebolinha verde',   'kg',   10.00, 1.00, 1.000, 'simple'),
  ('Champignon',        'kg',   35.00, 1.00, 1.000, 'simple'),
  ('Chocolate',         'kg',   34.00, 1.00, 1.000, 'simple'),
  ('Confit tomate cereja', 'kg', 25.00, 1.00, 1.000, 'simple'),
  ('Cream cheese',      'kg',   34.00, 1.00, 1.000, 'simple'),
  ('Doritos',           'kg',   60.00, 1.00, 1.000, 'simple'),
  ('Ervilha',           'kg',   24.00, 1.00, 1.000, 'simple'),
  ('Frango defumado',   'kg',   75.00, 1.00, 1.000, 'simple'),
  ('Frango desfiado',   'kg',   25.87, 1.00, 1.000, 'simple'),
  ('Gorgonzola',        'kg',   75.00, 1.00, 1.000, 'simple'),
  ('Lombo canadense',   'kg',   39.00, 1.00, 1.000, 'simple'),
  ('Massa',             'kg',   3.42,  1.00, 1.000, 'simple'),
  ('Milho',             'kg',   12.00, 1.00, 1.000, 'simple'),
  ('Molho de tomate',   'kg',   10.68, 1.00, 1.000, 'simple'),
  ('Mussarela',         'kg',   27.00, 1.00, 1.000, 'simple'),
  ('Ovos',              'unid', 0.80,  1.00, 1.000, 'simple'),
  ('Palmito',           'kg',   49.44, 1.00, 1.000, 'simple'),
  ('Panceta',           'kg',   92.00, 1.00, 1.000, 'simple'),
  ('Parmesão',          'kg',   70.00, 1.00, 1.000, 'simple'),
  ('Pepperoni Seara',   'kg',   56.00, 1.00, 1.000, 'simple'),
  ('Pera',              'kg',   24.00, 1.00, 1.000, 'simple'),
  ('Pimenta biquinho',  'kg',   47.00, 1.00, 1.000, 'simple'),
  ('Presunto',          'kg',   26.00, 1.00, 1.000, 'simple'),
  ('Provolone',         'kg',   45.00, 1.00, 1.000, 'simple'),
  ('Tomate',            'kg',   6.00,  1.00, 1.000, 'simple'),
  ('Tomate cereja',     'kg',   12.00, 1.00, 1.000, 'simple'),
  ('Tomate secos',      'kg',   45.00, 1.00, 1.000, 'simple');

-- ── 5. RLS: permitir leitura das novas tabelas ───────────────
-- (apenas se RLS estiver habilitado no seu projeto)
-- ALTER TABLE compound_ingredient_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Admin can do everything" ON compound_ingredient_items
--   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Admin can do everything" ON stock_movements
--   FOR ALL USING (true) WITH CHECK (true);
