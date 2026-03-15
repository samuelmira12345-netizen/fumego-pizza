-- =========================================================================
-- FUMÊGO Pizza — Migração: Inserção atômica de pedido+itens + cupom atômico
--
-- Resolve:
--   P6: pedido podia ser criado sem itens se a segunda inserção falhasse
--   P7: contador de cupom era incrementado de forma não-atômica (race condition)
--
-- Execute no Supabase SQL Editor.
-- =========================================================================


-- ── 1. create_order_with_items ────────────────────────────────────────────────
--
-- Insere o pedido e seus itens numa única transação PostgreSQL.
-- Se a inserção dos itens falhar, o pedido é automaticamente revertido
-- pelo rollback da transação — nenhum pedido "fantasma" fica no banco.
--
-- Parâmetros:
--   p_order JSONB  — payload do pedido (mesmo formato do INSERT em orders)
--   p_items JSONB  — array de itens (mesmo formato do INSERT em order_items)
--
-- Retorna:
--   JSONB com a linha completa do pedido criado (equivalente ao SELECT após INSERT)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order JSONB,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_result   JSONB;
BEGIN
  -- ── Insere o pedido ──────────────────────────────────────────────────────
  INSERT INTO orders (
    customer_name,
    customer_phone,
    customer_email,
    customer_cpf,
    delivery_street,
    delivery_number,
    delivery_neighborhood,
    delivery_complement,
    delivery_city,
    delivery_state,
    delivery_zipcode,
    subtotal,
    delivery_fee,
    discount,
    total,
    payment_method,
    payment_status,
    status,
    coupon_code,
    observations,
    user_id,
    scheduled_for,
    cashback_used,
    idempotency_key
  ) VALUES (
    p_order->>'customer_name',
    p_order->>'customer_phone',
    p_order->>'customer_email',
    p_order->>'customer_cpf',
    p_order->>'delivery_street',
    p_order->>'delivery_number',
    p_order->>'delivery_neighborhood',
    p_order->>'delivery_complement',
    p_order->>'delivery_city',
    p_order->>'delivery_state',
    p_order->>'delivery_zipcode',
    (p_order->>'subtotal')::DECIMAL(10,2),
    COALESCE((p_order->>'delivery_fee')::DECIMAL(10,2), 0),
    COALESCE((p_order->>'discount')::DECIMAL(10,2), 0),
    (p_order->>'total')::DECIMAL(10,2),
    COALESCE(p_order->>'payment_method', 'pix'),
    COALESCE(p_order->>'payment_status', 'pending'),
    COALESCE(p_order->>'status', 'pending'),
    p_order->>'coupon_code',
    p_order->>'observations',
    -- UUID nullable: converte apenas se não for null/vazio
    CASE
      WHEN p_order->>'user_id' IS NOT NULL
       AND p_order->>'user_id' != 'null'
       AND p_order->>'user_id' != ''
      THEN (p_order->>'user_id')::UUID
      ELSE NULL
    END,
    -- TIMESTAMPTZ nullable
    CASE
      WHEN p_order->>'scheduled_for' IS NOT NULL
       AND p_order->>'scheduled_for' != 'null'
       AND p_order->>'scheduled_for' != ''
      THEN (p_order->>'scheduled_for')::TIMESTAMPTZ
      ELSE NULL
    END,
    COALESCE((p_order->>'cashback_used')::DECIMAL(10,2), 0),
    p_order->>'idempotency_key'
  )
  RETURNING id INTO v_order_id;

  -- ── Insere os itens (mesma transação) ────────────────────────────────────
  INSERT INTO order_items (
    order_id,
    product_id,
    drink_id,
    product_name,
    quantity,
    unit_price,
    total_price,
    observations
  )
  SELECT
    v_order_id,
    CASE
      WHEN item->>'product_id' IS NOT NULL
       AND item->>'product_id' != 'null'
       AND item->>'product_id' != ''
      THEN (item->>'product_id')::UUID
      ELSE NULL
    END,
    CASE
      WHEN item->>'drink_id' IS NOT NULL
       AND item->>'drink_id' != 'null'
       AND item->>'drink_id' != ''
      THEN (item->>'drink_id')::UUID
      ELSE NULL
    END,
    item->>'product_name',
    (item->>'quantity')::INTEGER,
    (item->>'unit_price')::DECIMAL(10,2),
    (item->>'total_price')::DECIMAL(10,2),
    item->>'observations'
  FROM jsonb_array_elements(p_items) AS item;

  -- ── Retorna o pedido completo ─────────────────────────────────────────────
  SELECT row_to_json(o)::JSONB
    INTO v_result
    FROM orders o
   WHERE id = v_order_id;

  RETURN v_result;
END;
$$;


-- ── 2. increment_coupon_usage ─────────────────────────────────────────────────
--
-- Incrementa times_used diretamente no banco de forma atômica.
-- Evita race condition onde dois pedidos simultâneos leem o mesmo valor
-- e ambos escrevem N+1 em vez de N+2.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_coupon_usage(p_coupon_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE coupons
     SET times_used = times_used + 1
   WHERE id = p_coupon_id;
$$;
