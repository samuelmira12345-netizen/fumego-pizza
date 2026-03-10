-- ==========================================
-- FUMÊGO Pizza - Migração: Cupons Avançados
-- Execute no Supabase SQL Editor
-- ==========================================

-- ── 1. Novas colunas na tabela coupons ───────────────────────────────────────

-- Nome amigável do cupom (diferente do código que o cliente usa)
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS name TEXT;

-- Tipo de desconto: 'percent' | 'fixed' | 'free_delivery'
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percent';

-- Frete grátis (também pode ser definido via discount_type = 'free_delivery')
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_free_delivery BOOLEAN DEFAULT false;

-- Valor mínimo do pedido para usar o cupom
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_order_value DECIMAL(10,2) DEFAULT 0;

-- Máximo de usos por CPF (NULL = ilimitado)
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_uses_per_cpf INTEGER;

-- Disponível apenas para novos clientes (sem pedido anterior)
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS new_customers_only BOOLEAN DEFAULT false;

-- Dias da semana disponíveis (NULL = todos os dias)
-- Armazena array JSON: ["monday","tuesday","friday"] ou NULL para todos
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS available_days JSONB;

-- Formas de pagamento aceitas (NULL = todas)
-- Armazena array JSON: ["pix","cash"] ou NULL para todas
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS payment_methods JSONB;

-- ── 2. Atualizar coluna discount_type com base nos dados existentes ──────────

UPDATE coupons
SET discount_type = CASE
  WHEN is_free_delivery = true THEN 'free_delivery'
  WHEN discount_fixed > 0 THEN 'fixed'
  ELSE 'percent'
END
WHERE discount_type IS NULL OR discount_type = 'percent';

-- Preencher nome dos cupons existentes com o código (como fallback)
UPDATE coupons SET name = code WHERE name IS NULL OR name = '';

-- ── 3. Adicionar order_id e discount_amount ao coupon_usage ─────────────────

-- Referência ao pedido que usou o cupom
ALTER TABLE coupon_usage ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- Valor do desconto aplicado neste uso específico
ALTER TABLE coupon_usage ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

-- ── 4. Índices para performance ──────────────────────────────────────────────

-- Busca de uso por cupom (analytics)
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id
  ON coupon_usage (coupon_id);

-- Busca de pedidos com cupom (analytics)
CREATE INDEX IF NOT EXISTS idx_orders_coupon_code
  ON orders (coupon_code)
  WHERE coupon_code IS NOT NULL;

-- Busca de cupons ativos
CREATE INDEX IF NOT EXISTS idx_coupons_is_active
  ON coupons (is_active)
  WHERE is_active = true;

-- ── 5. RLS policies para novos campos (herdam as existentes) ─────────────────
-- As políticas existentes já cobrem as novas colunas automaticamente.
-- Nenhuma nova política necessária.

-- ── 6. Verificar resultado ───────────────────────────────────────────────────
-- Execute para confirmar que as colunas foram criadas:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'coupons' ORDER BY ordinal_position;

-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'coupon_usage' ORDER BY ordinal_position;
