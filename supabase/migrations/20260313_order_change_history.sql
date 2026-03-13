-- Histórico de alterações manuais em pedidos (PDV/Kanban)
CREATE TABLE IF NOT EXISTS public.order_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_change_history_order_created
  ON public.order_change_history (order_id, created_at DESC);
