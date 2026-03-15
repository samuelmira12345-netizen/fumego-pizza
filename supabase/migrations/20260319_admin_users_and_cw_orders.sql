-- =========================================================================
-- FUMÊGO Pizza — Migração: admin_users + cardapioweb_orders
--
-- Resolve:
--   • admin_users: tabela usada em lib/admin-actions/sub-admins.ts e
--     app/api/admin/session/route.ts para autenticação e gestão de admins,
--     mas nunca havia sido criada em nenhuma migration.
--   • cardapioweb_orders: tabela usada em app/api/cardapioweb/webhook e
--     app/api/cardapioweb/orders para armazenar pedidos vindos do CardápioWeb,
--     mas nunca havia sido criada em nenhuma migration.
--
-- Execute no Supabase SQL Editor.
-- =========================================================================


-- ── 1. admin_users ────────────────────────────────────────────────────────────
--
-- Armazena credenciais de acesso ao painel administrativo.
-- 'master' tem acesso total; 'sub' tem acesso apenas às abas em allowed_tabs.
-- A autenticação ocorre no backend via bcrypt + JWT — nunca exposta ao cliente.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,
  role           TEXT        NOT NULL DEFAULT 'sub'
                             CHECK (role IN ('master', 'sub')),
  allowed_tabs   TEXT[]      NOT NULL DEFAULT '{}',
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at  TIMESTAMPTZ
);

COMMENT ON TABLE  admin_users IS 'Usuários do painel admin. Autenticação via bcrypt+JWT no backend.';
COMMENT ON COLUMN admin_users.role IS '''master'' tem acesso total; ''sub'' tem acesso apenas às abas em allowed_tabs.';
COMMENT ON COLUMN admin_users.allowed_tabs IS 'Lista de slugs de abas permitidas para sub-admins (ex: ["orders","cashback"]).';

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON admin_users;
CREATE POLICY "service role only" ON admin_users USING (false) WITH CHECK (false);


-- ── 2. cardapioweb_orders ─────────────────────────────────────────────────────
--
-- Cache local de pedidos recebidos via CardápioWeb (webhook + sync manual).
-- Permite consultar/gerenciar pedidos externos mesmo sem chamar a API do CW.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cardapioweb_orders (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação do pedido no CardápioWeb
  cw_order_id      TEXT          NOT NULL UNIQUE,
  cw_display_id    TEXT,

  -- Status e tipo
  status           TEXT,
  order_type       TEXT,

  -- Cliente
  customer_name    TEXT,
  customer_phone   TEXT,

  -- Entrega e valores
  delivery_address JSONB,
  items            JSONB         NOT NULL DEFAULT '[]',
  payments         JSONB         NOT NULL DEFAULT '[]',
  total            DECIMAL(10,2),
  delivery_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
  observation      TEXT,

  -- Dados brutos para auditoria/debug
  raw_data         JSONB,

  -- Timestamps do CardápioWeb
  cw_created_at    TIMESTAMPTZ,
  cw_updated_at    TIMESTAMPTZ,

  -- Timestamp local de inserção
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cardapioweb_orders IS 'Cache local de pedidos do CardápioWeb. Populado via webhook e sync manual.';

CREATE INDEX IF NOT EXISTS idx_cw_orders_status
  ON cardapioweb_orders (status);
CREATE INDEX IF NOT EXISTS idx_cw_orders_created
  ON cardapioweb_orders (cw_created_at DESC);

ALTER TABLE cardapioweb_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON cardapioweb_orders;
CREATE POLICY "service role only" ON cardapioweb_orders USING (false) WITH CHECK (false);
