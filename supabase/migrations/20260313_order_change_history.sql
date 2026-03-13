-- Histórico de alterações de pedidos (itens/endereço) para Kanban

CREATE TABLE IF NOT EXISTS order_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_change_history_order_created
  ON order_change_history(order_id, created_at DESC);
