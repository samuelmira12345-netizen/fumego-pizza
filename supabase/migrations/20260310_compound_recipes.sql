-- ==========================================
-- FUMÊGO Pizza — Múltiplas receitas por insumo composto
-- Execute este script no Supabase SQL Editor
-- ==========================================

-- compound_recipes: receitas nomeadas para insumos compostos
CREATE TABLE IF NOT EXISTS compound_recipes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_id    UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  yield_quantity NUMERIC NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compound_recipes_compound_id
  ON compound_recipes (compound_id);

-- compound_recipe_items: ingredientes de cada receita nomeada
CREATE TABLE IF NOT EXISTS compound_recipe_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID NOT NULL REFERENCES compound_recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity      NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_compound_recipe_items_recipe_id
  ON compound_recipe_items (recipe_id);

-- Migrar receitas existentes de compound_ingredient_items → compound_recipes
DO $$
DECLARE
  v_compound_id UUID;
  v_recipe_id   UUID;
BEGIN
  FOR v_compound_id IN
    SELECT DISTINCT compound_id FROM compound_ingredient_items
  LOOP
    -- Cria uma "Receita Principal" para cada composto existente
    INSERT INTO compound_recipes (compound_id, name, yield_quantity)
    VALUES (v_compound_id, 'Receita Principal', 1)
    RETURNING id INTO v_recipe_id;

    -- Migra os itens da receita
    INSERT INTO compound_recipe_items (recipe_id, ingredient_id, quantity)
    SELECT v_recipe_id, ingredient_id, quantity
    FROM compound_ingredient_items
    WHERE compound_id = v_compound_id;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignora erros (ex: tabela inexistente)
END;
$$;
