-- Migração: Agendamento de pedidos + Controle de estoque
-- Execute no Supabase SQL Editor antes de ativar essas funcionalidades.

-- 1. Adicionar coluna scheduled_for na tabela orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_orders_scheduled_for
  ON orders (scheduled_for)
  WHERE scheduled_for IS NOT NULL;

-- 2. (Opcional) Comentário para documentação
COMMENT ON COLUMN orders.scheduled_for IS
  'Horário agendado para disparar o pedido à cozinha (NULL = entrega imediata).';

-- 3. Controle de estoque é armazenado na tabela settings como JSON
--    com chave "stock_limits". Não requer migração de schema adicional.
--    Formato: {"<product_uuid>": {"enabled": true, "qty": 10}, ...}
