-- ==========================================
-- FUMÊGO Pizza — Campos de pagamento e unidade de saída de receita
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
