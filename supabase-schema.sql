-- ==========================================
-- FUMÊGO Pizza - Schema Supabase v4
-- ==========================================

-- Usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  cpf TEXT,
  password_hash TEXT NOT NULL,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zipcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Produtos
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bebidas
CREATE TABLE IF NOT EXISTS drinks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  size TEXT,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number SERIAL,
  user_id UUID REFERENCES users(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  customer_cpf TEXT,
  delivery_street TEXT NOT NULL,
  delivery_number TEXT NOT NULL,
  delivery_complement TEXT,
  delivery_neighborhood TEXT NOT NULL,
  delivery_city TEXT,
  delivery_state TEXT,
  delivery_zipcode TEXT,
  subtotal DECIMAL(10,2),
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  coupon_code TEXT,
  observations TEXT,
  payment_method TEXT DEFAULT 'pix',
  payment_status TEXT DEFAULT 'pending',
  pix_payment_id TEXT,
  pix_qr_code TEXT,
  pix_qr_code_base64 TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Itens do pedido
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  drink_id UUID REFERENCES drinks(id),
  product_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cupons
CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_fixed DECIMAL(10,2) DEFAULT 0,
  valid_until TIMESTAMPTZ,
  usage_limit INTEGER,
  times_used INTEGER DEFAULT 0,
  is_first_order_only BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uso de cupons
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID REFERENCES coupons(id),
  cpf TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens de verificação de e-mail
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens de recuperação de senha
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- DADOS INICIAIS
-- ==========================================

INSERT INTO products (name, slug, description, price, sort_order) VALUES
  ('Marguerita', 'marguerita', 'Molho de tomate, mozzarella, manjericão fresco', 45.00, 1),
  ('Calabresa', 'calabresa', 'Molho de tomate, calabresa defumada, cebola', 45.00, 2),
  ('Combo Fumêgo', 'combo-classico', '1 Pizza Marguerita + 1 Pizza Calabresa + 1 Refri 2L', 79.90, 3),
  ('Especial do Mês', 'especial-do-mes', 'Sabor exclusivo que muda todo mês', 59.90, 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO drinks (name, size, price, sort_order) VALUES
  ('Refrigerante', '2L', 12.00, 1),
  ('Refrigerante', '600ml', 8.00, 2),
  ('Refrigerante', 'Lata 350ml', 6.00, 3)
ON CONFLICT DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('store_open', 'true'),
  ('delivery_fee', '10.00'),
  ('delivery_time', '40-60 min'),
  ('special_flavor_name', 'Quatro Queijos Trufada'),
  ('special_flavor_description', 'Mozzarella, gorgonzola, parmesão e provolone com azeite trufado')
ON CONFLICT (key) DO NOTHING;

INSERT INTO coupons (code, discount_percent, is_first_order_only, is_active) VALUES
  ('BEMVINDO', 10, true, true)
ON CONFLICT (code) DO NOTHING;

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas dos dados do cardápio e configurações
CREATE POLICY "products_public_read" ON products FOR SELECT USING (true);
CREATE POLICY "drinks_public_read" ON drinks FOR SELECT USING (true);
CREATE POLICY "settings_public_read" ON settings FOR SELECT USING (true);
CREATE POLICY "coupons_public_read" ON coupons FOR SELECT USING (is_active = true);

-- Pedidos: inserção pública (checkout anônimo); leitura e update APENAS via service role
-- O service role bypassa o RLS; o cliente anônimo pode inserir pedidos (checkout),
-- mas NÃO pode listar nem modificar pedidos — isso é feito via API routes autenticadas.
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_select" ON orders FOR SELECT USING (false);  -- somente service role
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (false);  -- somente service role

-- Itens de pedido: apenas inserção pública; leitura/update via service role
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_select" ON order_items FOR SELECT USING (false);  -- somente service role

-- Usuários: NUNCA permitir leitura via chave anônima; todas as operações via service role
-- (login, register e update usam service role nas API routes)
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (false);  -- somente service role
CREATE POLICY "users_select" ON users FOR SELECT USING (false);        -- somente service role
CREATE POLICY "users_update" ON users FOR UPDATE USING (false);        -- somente service role

-- Uso de cupons: inserção pública no checkout; leitura bloqueada para anon
CREATE POLICY "coupon_usage_insert" ON coupon_usage FOR INSERT WITH CHECK (true);
CREATE POLICY "coupon_usage_select" ON coupon_usage FOR SELECT USING (false); -- somente service role

-- Tokens de e-mail: somente service role (manipulados via API routes)
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_verification_tokens_all" ON email_verification_tokens USING (false);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "password_reset_tokens_all" ON password_reset_tokens USING (false);

-- Produtos, bebidas, configurações e cupons: escrita apenas via service role
CREATE POLICY "products_update" ON products FOR UPDATE USING (false);  -- somente service role
CREATE POLICY "drinks_update" ON drinks FOR UPDATE USING (false);       -- somente service role
CREATE POLICY "drinks_insert" ON drinks FOR INSERT WITH CHECK (false);  -- somente service role
CREATE POLICY "drinks_delete" ON drinks FOR DELETE USING (false);       -- somente service role
CREATE POLICY "settings_update" ON settings FOR UPDATE USING (false);  -- somente service role
CREATE POLICY "settings_insert" ON settings FOR INSERT WITH CHECK (false); -- somente service role
CREATE POLICY "coupons_update" ON coupons FOR UPDATE USING (false);    -- somente service role
CREATE POLICY "coupons_insert" ON coupons FOR INSERT WITH CHECK (false); -- somente service role
CREATE POLICY "coupons_delete" ON coupons FOR DELETE USING (false);    -- somente service role

-- ==========================================
-- STORAGE BUCKET PARA IMAGENS
-- ==========================================

INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública das imagens (necessário para exibir no cardápio)
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

-- Upload, update e delete apenas via service role (admin autenticado na API)
CREATE POLICY "product_images_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'service_role');

CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND auth.role() = 'service_role');

CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND auth.role() = 'service_role');
