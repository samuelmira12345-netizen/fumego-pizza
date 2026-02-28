-- ==========================================
-- Open Delivery Integration - Schema
-- Execute APÓS supabase-schema.sql
-- ==========================================

-- Fila de eventos para o polling do CardápioWeb
-- Cada vez que um pedido é criado/atualizado aqui, inserimos um evento.
-- O CardápioWeb faz GET /v1/events:polling periodicamente e recebe esses eventos.
-- Após processar, faz POST /v1/events/acknowledgment para removê-los da fila.
CREATE TABLE IF NOT EXISTS od_events (
  id            UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      UUID      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type    TEXT      NOT NULL,  -- CREATED | CANCELLED | ORDER_CANCELLATION_REQUEST
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,       -- preenchido quando o CardápioWeb confirma
  expires_at    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS od_events_pending_idx
  ON od_events(created_at)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS od_events_order_id_idx
  ON od_events(order_id);

-- ==========================================
-- RLS — apenas o backend (service_role) acessa
-- ==========================================
ALTER TABLE od_events ENABLE ROW LEVEL SECURITY;

-- Nega acesso ao role anon/authenticated (clientes do frontend)
-- A service_role key do Supabase IGNORA o RLS automaticamente,
-- então o backend (getSupabaseAdmin) acessa sem restrições.
CREATE POLICY "od_events_deny_public"
  ON od_events
  FOR ALL
  TO anon, authenticated
  USING (false);
