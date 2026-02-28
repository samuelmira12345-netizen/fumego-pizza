-- ==========================================
-- CardápioWeb Integration - Schema
-- Execute este arquivo no Supabase SQL Editor
-- APÓS ter executado o supabase-schema.sql principal
-- ==========================================

-- Tabela para armazenar pedidos recebidos do CardápioWeb
CREATE TABLE IF NOT EXISTS cardapioweb_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identificadores do CardápioWeb
  cw_order_id   INTEGER UNIQUE NOT NULL,  -- ID único do pedido no CW
  cw_display_id INTEGER,                  -- Número amigável exibido ao cliente

  -- Status e tipo
  status     TEXT NOT NULL DEFAULT 'waiting_confirmation',
  order_type TEXT,         -- delivery | takeout | onsite | closed_table

  -- Cliente
  customer_name  TEXT,
  customer_phone TEXT,

  -- Endereço de entrega (JSON conforme retornado pela API do CW)
  delivery_address JSONB,

  -- Itens do pedido (array JSON conforme API do CW)
  items    JSONB,

  -- Pagamentos (array JSON conforme API do CW)
  payments JSONB,

  -- Totais
  total        DECIMAL(10,2),
  delivery_fee DECIMAL(10,2) DEFAULT 0,

  -- Observações gerais
  observation TEXT,

  -- Payload completo (para consulta e debugging)
  raw_data JSONB,

  -- Timestamps do CardápioWeb
  cw_created_at TIMESTAMPTZ,
  cw_updated_at TIMESTAMPTZ,

  -- Timestamp de inserção local
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================

ALTER TABLE cardapioweb_orders ENABLE ROW LEVEL SECURITY;

-- Leitura e escrita apenas via service role (API routes autenticadas)
CREATE POLICY "cardapioweb_orders_service_only" ON cardapioweb_orders USING (false);

-- ==========================================
-- ÍNDICES para performance
-- ==========================================

CREATE INDEX IF NOT EXISTS cardapioweb_orders_status_idx
  ON cardapioweb_orders(status);

CREATE INDEX IF NOT EXISTS cardapioweb_orders_created_at_idx
  ON cardapioweb_orders(cw_created_at DESC);

CREATE INDEX IF NOT EXISTS cardapioweb_orders_cw_order_id_idx
  ON cardapioweb_orders(cw_order_id);
