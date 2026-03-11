-- ==========================================
-- FUMÊGO Pizza — Campos de pagamento, unidade de saída de receita e status 'pronto'
-- Execute este script no Supabase SQL Editor
-- ==========================================

-- 1. Campos de pagamento na tabela orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fiscal_note   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT,
  ADD COLUMN IF NOT EXISTS cash_received NUMERIC;

-- 2. Unidade de saída na tabela compound_recipes
ALTER TABLE compound_recipes
  ADD COLUMN IF NOT EXISTS yield_unit TEXT;

-- 3. Status 'pronto' e timestamp ready_at na tabela orders
--    O campo status já aceita qualquer texto (TEXT), então não precisa alterar o tipo.
--    Apenas garantimos que o campo ready_at existe para registrar o horário.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
