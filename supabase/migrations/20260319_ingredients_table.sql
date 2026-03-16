-- =========================================================================
-- FUMÊGO Pizza — Migração: Tabela ingredients (definição completa)
--
-- A tabela ingredients é referenciada por múltiplas migrations (ALTER TABLE)
-- e por todo o código de gestão de estoque/receitas, mas nunca tinha um
-- CREATE TABLE rastreado. Esta migration consolida a definição completa
-- incluindo todos os campos adicionados pelas migrations anteriores.
--
-- Usa CREATE TABLE IF NOT EXISTS — seguro se a tabela já existir no banco.
--
-- Execute no Supabase SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS ingredients (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT          NOT NULL,
  unit              TEXT          NOT NULL,
  cost_per_unit     DECIMAL(12,4),

  -- Campos adicionados em supabase_stock_migration.sql
  correction_factor NUMERIC       NOT NULL DEFAULT 1.00,
  min_stock         NUMERIC       NOT NULL DEFAULT 0,
  max_stock         NUMERIC       NOT NULL DEFAULT 0,
  current_stock     NUMERIC       NOT NULL DEFAULT 0,
  purchase_origin   TEXT          NOT NULL DEFAULT '',
  ingredient_type   TEXT          NOT NULL DEFAULT 'simple',
  weight_volume     NUMERIC       NOT NULL DEFAULT 1.000,

  -- Campo adicionado em 20260315_ingredient_density.sql
  density           NUMERIC       NULL,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  ingredients IS 'Insumos/ingredientes usados em receitas de produtos.';
COMMENT ON COLUMN ingredients.correction_factor IS 'Fator de correção por perda no preparo (ex: 0.85 = 15% de perda).';
COMMENT ON COLUMN ingredients.ingredient_type   IS '''simple'' = ingrediente direto; ''compound'' = insumo composto (receita de insumo).';
COMMENT ON COLUMN ingredients.density           IS 'Densidade em g/ml. Preenchida para insumos líquidos (unit = L ou ml).';

CREATE INDEX IF NOT EXISTS idx_ingredients_name
  ON ingredients (name);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON ingredients;
CREATE POLICY "service role only" ON ingredients USING (false) WITH CHECK (false);


-- Insere cashback_max_percent em settings (limite máximo de desconto via cashback)
-- Valor padrão: 50% do total do pedido. Editável pelo painel admin.
INSERT INTO settings (key, value)
  VALUES ('cashback_max_percent', '50')
  ON CONFLICT (key) DO NOTHING;
