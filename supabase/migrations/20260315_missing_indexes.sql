-- =========================================================================
-- FUMÊGO Pizza — Migração: Índices faltando
--
-- orders(user_id)                    — consultas de pedidos por usuário
-- cashback_transactions(user_id, status) — queries FIFO de cashback
--
-- Execução: Supabase SQL Editor (sem downtime — CREATE INDEX CONCURRENTLY
-- pode ser usado em produção com alta carga; IF NOT EXISTS é idempotente).
-- =========================================================================

-- Pedidos de um usuário específico (histórico, cashback earn)
CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON orders (user_id)
  WHERE user_id IS NOT NULL;

-- Cashback FIFO: busca transações ativas/parciais de um usuário, ordenadas
-- por created_at para consumo na ordem correta
CREATE INDEX IF NOT EXISTS idx_cashback_user_status
  ON cashback_transactions (user_id, status, created_at)
  WHERE type = 'earn' AND status IN ('active', 'partial');
