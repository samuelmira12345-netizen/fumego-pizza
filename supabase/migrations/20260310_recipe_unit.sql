-- Migração: Adiciona suporte a unidade de exibição na ficha técnica
-- Permite portionamento: ex. 300g de "Massa" (unit: kg) salvo como quantity=300, recipe_unit='g'
-- Execute no Supabase SQL Editor

ALTER TABLE recipe_items
  ADD COLUMN IF NOT EXISTS recipe_unit TEXT;

COMMENT ON COLUMN recipe_items.recipe_unit IS
  'Unidade de exibição usada na ficha técnica (ex: g, ml). NULL = usa a unidade base do ingrediente. '
  'O campo quantity armazena o valor na recipe_unit (ex: 300 para 300g), '
  'e a conversão para unidade base é feita na aplicação.';
