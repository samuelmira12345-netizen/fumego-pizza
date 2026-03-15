-- ── Densidade de insumos líquidos ────────────────────────────────────────────
-- Adiciona coluna `density` (g/ml) para insumos com unidade L ou ml.
-- Usada para converter volume → peso ao calcular o rendimento de receitas
-- cujo insumo composto tem unidade de saída em kg ou g.
-- Exemplo: óleo de soja ≈ 0.92 g/ml → 1L de óleo = 920g

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS density numeric NULL;

COMMENT ON COLUMN ingredients.density IS
  'Densidade em g/ml. Preenchido apenas para insumos líquidos (unit = L ou ml). '
  'Permite converter volume → peso ao calcular rendimento de receitas.';
