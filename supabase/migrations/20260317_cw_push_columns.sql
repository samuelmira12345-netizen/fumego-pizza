-- =========================================================================
-- FUMÊGO Pizza — Migração: Colunas de integração CardápioWeb em orders
--
-- As colunas cw_push_status, cw_push_attempts e cw_push_last_error são
-- escritas em app/api/checkout/create-order/route.ts e lidas no painel
-- admin/diagnostics, mas não existiam no schema do banco.
--
-- Execute no Supabase SQL Editor.
-- =========================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cw_push_status    TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cw_push_attempts  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cw_push_last_error TEXT   DEFAULT NULL;

COMMENT ON COLUMN orders.cw_push_status IS
  'Status do envio ao CardápioWeb: NULL (não tentado), ''success'', ''failed''.';
COMMENT ON COLUMN orders.cw_push_attempts IS
  'Número de tentativas de envio ao CardápioWeb.';
COMMENT ON COLUMN orders.cw_push_last_error IS
  'Última mensagem de erro do CardápioWeb (sanitizada, máx 500 chars).';

-- Índice para facilitar re-tentativas de pedidos que falharam
CREATE INDEX IF NOT EXISTS idx_orders_cw_push_failed
  ON orders (cw_push_status)
  WHERE cw_push_status = 'failed';
