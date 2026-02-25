-- ============================================
-- FUMÊGO PIZZA - SCHEMA COMPLETO DO BANCO DE DADOS
-- ============================================
-- Execute este SQL no Supabase SQL Editor (https://supabase.com/dashboard)
-- Vá em: SQL Editor > New Query > Cole tudo > Run

-- ============================================
-- 1. TABELA DE PRODUTOS
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'pizza',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_special BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. TABELA DE BEBIDAS (UPSELL)
-- ============================================
CREATE TABLE IF NOT EXISTS drinks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  size VARCHAR(20) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. TABELA DE USUÁRIOS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  cpf VARCHAR(14) UNIQUE,
  password_hash TEXT NOT NULL,
  address_street TEXT,
  address_number VARCHAR(20),
  address_complement VARCHAR(100),
  address_neighborhood VARCHAR(100),
  address_city VARCHAR(100),
  address_state VARCHAR(2),
  address_zipcode VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. TABELA DE CUPONS
-- ============================================
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_fixed DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_first_order_only BOOLEAN DEFAULT false,
  usage_limit INT DEFAULT NULL,
  times_used INT DEFAULT 0,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. TABELA DE CUPONS USADOS POR CPF
-- ============================================
CREATE TABLE IF NOT EXISTS coupon_usage (
  id SERIAL PRIMARY KEY,
  coupon_id INT REFERENCES coupons(id),
  cpf VARCHAR(14) NOT NULL,
  user_id UUID REFERENCES users(id),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(coupon_id, cpf)
);

-- ============================================
-- 6. TABELA DE PEDIDOS
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number SERIAL,
  user_id UUID REFERENCES users(id),
  
  -- Info do cliente (para pedidos sem conta)
  customer_name VARCHAR(100) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20) NOT NULL,
  customer_cpf VARCHAR(14),
  
  -- Endereço de entrega
  delivery_street TEXT NOT NULL,
  delivery_number VARCHAR(20) NOT NULL,
  delivery_complement VARCHAR(100),
  delivery_neighborhood VARCHAR(100) NOT NULL,
  delivery_city VARCHAR(100) NOT NULL DEFAULT 'Sua Cidade',
  delivery_state VARCHAR(2) NOT NULL DEFAULT 'SP',
  delivery_zipcode VARCHAR(10),
  
  -- Valores
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  
  -- Cupom
  coupon_code VARCHAR(50),
  
  -- Pagamento
  payment_method VARCHAR(20) DEFAULT 'pix',
  payment_status VARCHAR(20) DEFAULT 'pending',
  pix_payment_id VARCHAR(255),
  pix_qr_code TEXT,
  pix_qr_code_base64 TEXT,
  pix_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Status do pedido
  status VARCHAR(20) DEFAULT 'pending',
  observations TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. TABELA DE ITENS DO PEDIDO
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
  drink_id INT REFERENCES drinks(id),
  product_name VARCHAR(100) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. TABELA DE CONFIGURAÇÕES DO ADMIN
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 9. INSERIR DADOS INICIAIS
-- ============================================

-- Produtos
INSERT INTO products (name, slug, description, price, category, is_active, is_special, display_order) VALUES
('Marguerita', 'marguerita', 'Molho de tomate, mussarela, tomate e manjericão fresco', 45.00, 'pizza', true, false, 1),
('Calabresa', 'calabresa', 'Molho de tomate, mussarela, calabresa e cebola', 45.00, 'pizza', true, false, 2),
('Combo Clássico', 'combo-classico', 'Uma pizza Marguerita + Uma pizza Calabresa. O melhor dos dois mundos!', 79.90, 'combo', true, false, 3),
('Sabor Especial do Mês', 'especial-do-mes', 'Sabor exclusivo que muda todo mês! Consulte o sabor atual.', 59.90, 'pizza', true, true, 4);

-- Bebidas
INSERT INTO drinks (name, size, price, is_active, display_order) VALUES
('Refrigerante 2L', '2L', 16.00, true, 1),
('Refrigerante 600ml', '600ml', 12.00, true, 2),
('Refrigerante Lata', '350ml', 7.00, true, 3);

-- Cupom BEMVINDO
INSERT INTO coupons (code, discount_percent, is_active, is_first_order_only) VALUES
('BEMVINDO', 10.00, true, true);

-- Configurações
INSERT INTO settings (key, value) VALUES
('store_open', 'true'),
('delivery_fee', '0'),
('delivery_time', '40-60 min'),
('special_flavor_name', 'Quatro Queijos'),
('special_flavor_description', 'Mussarela, parmesão, gorgonzola e catupiry');

-- ============================================
-- 10. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 11. POLÍTICAS DE ACESSO (RLS Policies)
-- ============================================

-- PRODUCTS: Todos podem ler, só admin (service_role) pode modificar
CREATE POLICY "products_read" ON products FOR SELECT USING (true);
CREATE POLICY "products_admin" ON products FOR ALL USING (auth.role() = 'service_role');

-- DRINKS: Todos podem ler
CREATE POLICY "drinks_read" ON drinks FOR SELECT USING (true);
CREATE POLICY "drinks_admin" ON drinks FOR ALL USING (auth.role() = 'service_role');

-- USERS: Cada user vê só seus dados
CREATE POLICY "users_read_own" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (true);

-- COUPONS: Todos podem ler
CREATE POLICY "coupons_read" ON coupons FOR SELECT USING (true);
CREATE POLICY "coupons_admin" ON coupons FOR ALL USING (auth.role() = 'service_role');

-- COUPON_USAGE
CREATE POLICY "coupon_usage_all" ON coupon_usage FOR ALL USING (true);

-- ORDERS: Todos podem inserir e ler
CREATE POLICY "orders_read" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (true);

-- ORDER_ITEMS
CREATE POLICY "order_items_all" ON order_items FOR ALL USING (true);

-- SETTINGS: Todos podem ler
CREATE POLICY "settings_read" ON settings FOR SELECT USING (true);
CREATE POLICY "settings_admin" ON settings FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- FIM DO SCHEMA
-- ============================================
