-- =========================================================================
-- FUMÊGO Pizza — Migração: RLS em tabelas principais + coluna stock_conflict
--
-- Contexto:
--   • Habilita Row Level Security (RLS) nas tabelas que não tinham, bloqueando
--     acesso direto via anon/authenticated key. Toda leitura/escrita produtiva
--     ocorre via service_role (backend Next.js), que bypassa RLS por design.
--   • Adiciona orders.stock_conflict para sinalizar pedidos onde o lock otimista
--     do fallback de estoque falhou (possível overselling silencioso).
--
-- Execução: Supabase SQL Editor ou supabase db push.
-- =========================================================================

-- ─── 1. orders ──────────────────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- Bloqueia acesso direto de clientes. Toda operação passa pelo backend.
DROP POLICY IF EXISTS "service role only" ON orders;
CREATE POLICY "service role only" ON orders USING (false) WITH CHECK (false);

-- Coluna de alerta de conflito de estoque
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_conflict BOOLEAN DEFAULT false;
COMMENT ON COLUMN orders.stock_conflict IS
  'True quando o lock otimista do fallback de estoque falhou — possível overselling. Revisar manualmente.';

CREATE INDEX IF NOT EXISTS idx_orders_stock_conflict
  ON orders (stock_conflict)
  WHERE stock_conflict = true;


-- ─── 2. order_items ─────────────────────────────────────────────────────────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON order_items;
CREATE POLICY "service role only" ON order_items USING (false) WITH CHECK (false);


-- ─── 3. products ────────────────────────────────────────────────────────────
-- Leitura pública necessária para o cardápio (anon SELECT)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read"         ON products;
DROP POLICY IF EXISTS "service role write"  ON products;
CREATE POLICY "public read"        ON products FOR SELECT USING (true);
CREATE POLICY "service role write" ON products FOR ALL    USING (false) WITH CHECK (false);


-- ─── 4. drinks ──────────────────────────────────────────────────────────────
ALTER TABLE drinks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read"         ON drinks;
DROP POLICY IF EXISTS "service role write"  ON drinks;
CREATE POLICY "public read"        ON drinks FOR SELECT USING (true);
CREATE POLICY "service role write" ON drinks FOR ALL    USING (false) WITH CHECK (false);


-- ─── 5. settings ────────────────────────────────────────────────────────────
-- Leitura pública (logo, horários, etc.); escrita só via backend
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read"         ON settings;
DROP POLICY IF EXISTS "service role write"  ON settings;
CREATE POLICY "public read"        ON settings FOR SELECT USING (true);
CREATE POLICY "service role write" ON settings FOR ALL    USING (false) WITH CHECK (false);


-- ─── 6. delivery_zones ──────────────────────────────────────────────────────
-- Leitura pública (para cálculo de frete no front)
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read"         ON delivery_zones;
DROP POLICY IF EXISTS "service role write"  ON delivery_zones;
CREATE POLICY "public read"        ON delivery_zones FOR SELECT USING (true);
CREATE POLICY "service role write" ON delivery_zones FOR ALL    USING (false) WITH CHECK (false);


-- ─── 7. coupons ─────────────────────────────────────────────────────────────
-- Validação de cupom (código+valor) pode ser lida publicamente; dados internos não
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read"         ON coupons;
DROP POLICY IF EXISTS "service role write"  ON coupons;
CREATE POLICY "public read"        ON coupons FOR SELECT USING (true);
CREATE POLICY "service role write" ON coupons FOR ALL    USING (false) WITH CHECK (false);


-- ─── 8. coupon_usage ────────────────────────────────────────────────────────
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON coupon_usage;
CREATE POLICY "service role only" ON coupon_usage USING (false) WITH CHECK (false);


-- ─── 9. admin_users ─────────────────────────────────────────────────────────
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON admin_users;
CREATE POLICY "service role only" ON admin_users USING (false) WITH CHECK (false);


-- ─── 10. cashback_wallet (se existir) ───────────────────────────────────────
-- A tabela cashback_wallet pode não existir (o sistema usa cashback_transactions).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cashback_wallet' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE cashback_wallet ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "service role only" ON cashback_wallet';
    EXECUTE 'CREATE POLICY "service role only" ON cashback_wallet USING (false) WITH CHECK (false)';
  END IF;
END;
$$;


-- ─── 11. cashback_transactions ──────────────────────────────────────────────
ALTER TABLE cashback_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON cashback_transactions;
CREATE POLICY "service role only" ON cashback_transactions USING (false) WITH CHECK (false);


-- ─── 12. delivery_persons ───────────────────────────────────────────────────
ALTER TABLE delivery_persons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON delivery_persons;
CREATE POLICY "service role only" ON delivery_persons USING (false) WITH CHECK (false);


-- ─── 13. ingredients ────────────────────────────────────────────────────────
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON ingredients;
CREATE POLICY "service role only" ON ingredients USING (false) WITH CHECK (false);


-- ─── 14. recipes ────────────────────────────────────────────────────────────
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON recipes;
CREATE POLICY "service role only" ON recipes USING (false) WITH CHECK (false);


-- ─── 15. compound_recipes ───────────────────────────────────────────────────
ALTER TABLE compound_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON compound_recipes;
CREATE POLICY "service role only" ON compound_recipes USING (false) WITH CHECK (false);


-- ─── 16. financial_costs ────────────────────────────────────────────────────
ALTER TABLE financial_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON financial_costs;
CREATE POLICY "service role only" ON financial_costs USING (false) WITH CHECK (false);


-- ─── 17. cash_sessions ──────────────────────────────────────────────────────
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON cash_sessions;
CREATE POLICY "service role only" ON cash_sessions USING (false) WITH CHECK (false);


-- ─── 18. cash_entries ───────────────────────────────────────────────────────
ALTER TABLE cash_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON cash_entries;
CREATE POLICY "service role only" ON cash_entries USING (false) WITH CHECK (false);


-- ─── 19. order_change_history ───────────────────────────────────────────────
ALTER TABLE order_change_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON order_change_history;
CREATE POLICY "service role only" ON order_change_history USING (false) WITH CHECK (false);


-- ─── 20. cardapioweb_orders ─────────────────────────────────────────────────
ALTER TABLE cardapioweb_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON cardapioweb_orders;
CREATE POLICY "service role only" ON cardapioweb_orders USING (false) WITH CHECK (false);


-- ─── 21. rate_limits (se existir) ───────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_limits' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "service role only" ON rate_limits';
    EXECUTE 'CREATE POLICY "service role only" ON rate_limits USING (false) WITH CHECK (false)';
  END IF;
END;
$$;
