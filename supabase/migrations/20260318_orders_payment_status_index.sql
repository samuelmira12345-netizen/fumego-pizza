-- =========================================================================
-- FUMÊGO Pizza — Migração: Índice em orders.payment_status
--
-- payment_status é filtrado frequentemente:
--   • /api/cashback/earn — WHERE payment_status = 'approved'
--   • Painel admin — filtra pendentes/aprovados/falhos
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders (payment_status);
