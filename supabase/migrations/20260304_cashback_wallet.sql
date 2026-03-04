-- =============================================================================
-- Migration: Cashback Wallet System
-- Data: 2026-03-04
-- Descrição: Sistema de carteira de cashback com expiração independente (ledger)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela de transações de cashback (ledger — cada crédito expira de forma
--    independente, garantindo a lógica FIFO e expiração granular)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cashback_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    UUID        REFERENCES orders(id) ON DELETE SET NULL,

  -- 'earn' = cashback ganho após pedido confirmado
  -- 'use'  = cashback consumido num desconto de checkout
  type        TEXT        NOT NULL CHECK (type IN ('earn', 'use')),

  -- Valor total da transação
  amount      DECIMAL(10,2) NOT NULL CHECK (amount > 0),

  -- Saldo restante (apenas em transações 'earn'; decrementado pelo FIFO)
  remaining   DECIMAL(10,2) CHECK (remaining >= 0),

  -- Data de expiração (apenas em transações 'earn'; earn = 30 dias a partir da criação)
  expires_at  TIMESTAMPTZ,

  -- Estado atual da transação de cashback ganho
  -- active  = com saldo disponível
  -- partial = parte do saldo já foi usada
  -- used    = todo o saldo foi consumido
  -- expired = expirou antes de ser usado
  status      TEXT        NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'partial', 'used', 'expired')),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance nas queries mais frequentes
CREATE INDEX IF NOT EXISTS idx_cashback_user_earn
  ON cashback_transactions(user_id, created_at)
  WHERE type = 'earn' AND status IN ('active', 'partial');

CREATE INDEX IF NOT EXISTS idx_cashback_expires
  ON cashback_transactions(expires_at)
  WHERE type = 'earn' AND status = 'active';

-- -----------------------------------------------------------------------------
-- 2. Colunas adicionais na tabela de pedidos
-- -----------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashback_used    DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashback_earned  DECIMAL(10,2) DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 3. Configuração: porcentagem de cashback editável pelo painel admin
--    (0 = cashback desativado)
-- -----------------------------------------------------------------------------
INSERT INTO settings (key, value)
  VALUES ('cashback_percent', '5')
  ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
--    Todas as operações passam pelo servidor via service role —
--    clientes não acessam esta tabela diretamente.
-- -----------------------------------------------------------------------------
ALTER TABLE cashback_transactions ENABLE ROW LEVEL SECURITY;

-- Bloqueia acesso direto do cliente; apenas o service_role (backend) opera
CREATE POLICY "cashback_service_role_only" ON cashback_transactions
  USING (false);
