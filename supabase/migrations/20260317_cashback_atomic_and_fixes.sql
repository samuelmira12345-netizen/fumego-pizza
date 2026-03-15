-- =========================================================================
-- FUMÊGO Pizza — Migração: use_cashback_atomic + promised_delivery_time
--
-- Resolve:
--   • use_cashback_atomic: função RPC chamada em lib/cashback.ts não existia
--     em nenhuma migração — cashback era subtraído silenciosamente sem efeito.
--   • create_order_with_items: campo promised_delivery_time não era persistido
--     no INSERT, tornando impossível comparar prazo prometido vs. real.
--
-- Execute no Supabase SQL Editor.
-- =========================================================================


-- ── 1. use_cashback_atomic ────────────────────────────────────────────────────
--
-- Consome saldo de cashback de forma atômica usando SELECT … FOR UPDATE SKIP LOCKED
-- para serializar acessos concorrentes ao mesmo saldo, eliminando a race condition
-- onde dois requests simultâneos liam o mesmo saldo antes de qualquer um decrementar.
--
-- Parâmetros:
--   p_user_id  UUID    — usuário que está usando o cashback
--   p_order_id UUID    — pedido que está sendo pago
--   p_amount   NUMERIC — valor a consumir (≤ saldo disponível)
--
-- Retorna: NUMERIC com o valor efetivamente deduzido (pode ser menor se saldo
--          insuficiente ou transações travadas por outro request concorrente)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION use_cashback_atomic(
  p_user_id  UUID,
  p_order_id UUID,
  p_amount   NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining NUMERIC := p_amount;
  v_deducted  NUMERIC := 0;
  v_tx        RECORD;
  v_deduct    NUMERIC;
  v_new_rem   NUMERIC;
BEGIN
  FOR v_tx IN
    SELECT id, remaining
    FROM cashback_transactions
    WHERE user_id   = p_user_id
      AND type      = 'earn'
      AND status    IN ('active', 'partial')
      AND remaining > 0
      AND expires_at > now()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_deduct  := LEAST(v_remaining, v_tx.remaining);
    v_new_rem := ROUND((v_tx.remaining - v_deduct)::NUMERIC, 2);

    UPDATE cashback_transactions
       SET remaining = v_new_rem,
           status    = CASE WHEN v_new_rem <= 0 THEN 'used' ELSE 'partial' END
     WHERE id = v_tx.id;

    INSERT INTO cashback_transactions (user_id, order_id, type, amount)
    VALUES (p_user_id, p_order_id, 'use', ROUND(v_deduct::NUMERIC, 2));

    v_remaining := v_remaining - v_deduct;
    v_deducted  := v_deducted  + v_deduct;
  END LOOP;

  v_deducted := ROUND(v_deducted::NUMERIC, 2);

  IF v_deducted > 0 THEN
    UPDATE orders SET cashback_used = v_deducted WHERE id = p_order_id;
  END IF;

  RETURN v_deducted;
END;
$$;


-- ── 2. create_order_with_items (atualizado com promised_delivery_time) ────────
--
-- Recria a função para incluir o campo promised_delivery_time no INSERT,
-- permitindo comparação histórica entre prazo prometido e tempo real de entrega.
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
    idempotency_key,
    promised_delivery_time
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
    p_order->>'idempotency_key',
    -- TEXT nullable: prazo exibido ao cliente no checkout (ex: "40–60 min")
    NULLIF(p_order->>'promised_delivery_time', '')
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
