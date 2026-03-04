-- ==========================================
-- FUMÊGO Pizza — Funções para estoque atômico
-- Execute este script no Supabase SQL Editor
-- Necessário para evitar race condition em pedidos simultâneos
-- ==========================================

-- Função: decrementa estoque de produtos e bebidas de forma atômica.
-- Usa advisory lock para garantir que apenas um pedido modifica o estoque por vez.
-- Retorna { ok: true } em caso de sucesso ou { ok: false, error: "mensagem" } em erro.
CREATE OR REPLACE FUNCTION decrement_stock_atomic(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_raw     TEXT;
  v_drink_raw     TEXT;
  v_stock_map     JSONB;
  v_drink_map     JSONB;
  v_item          JSONB;
  v_product_id    TEXT;
  v_drink_id      TEXT;
  v_entry         JSONB;
  v_qty           INT;
  v_need          INT;
BEGIN
  -- Advisory lock: garante exclusão mútua para atualizações de estoque
  -- hashtext('stock_limits') = número fixo para serializar acesso
  PERFORM pg_advisory_xact_lock(hashtext('fumego_stock_limits'));

  -- Lê o estado atual do estoque (dentro do lock)
  SELECT value INTO v_stock_raw FROM settings WHERE key = 'stock_limits';
  SELECT value INTO v_drink_raw FROM settings WHERE key = 'drink_stock_limits';

  IF v_stock_raw IS NOT NULL THEN
    v_stock_map := v_stock_raw::JSONB;

    -- Fase 1: validar disponibilidade de produtos
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_product_id := v_item->>'product_id';
      IF v_product_id IS NOT NULL AND v_product_id <> '' THEN
        v_entry := v_stock_map->v_product_id;
        IF v_entry IS NOT NULL AND (v_entry->>'enabled')::BOOLEAN IS TRUE THEN
          v_qty  := COALESCE((v_entry->>'qty')::INT, 0);
          v_need := COALESCE((v_item->>'quantity')::INT, 1);
          IF v_qty < v_need THEN
            RETURN jsonb_build_object(
              'ok', false,
              'error', '"' || COALESCE(v_item->>'product_name', v_product_id) || '" está esgotado e não pode ser pedido.'
            );
          END IF;
        END IF;
      END IF;
    END LOOP;

    -- Fase 2: decrementar produtos
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_product_id := v_item->>'product_id';
      IF v_product_id IS NOT NULL AND v_product_id <> '' THEN
        v_entry := v_stock_map->v_product_id;
        IF v_entry IS NOT NULL AND (v_entry->>'enabled')::BOOLEAN IS TRUE THEN
          v_qty  := COALESCE((v_entry->>'qty')::INT, 0);
          v_need := COALESCE((v_item->>'quantity')::INT, 1);
          v_stock_map := jsonb_set(
            v_stock_map,
            ARRAY[v_product_id, 'qty'],
            to_jsonb(GREATEST(0, v_qty - v_need))
          );
          -- Auto-desativar produto quando chegar a zero
          IF GREATEST(0, v_qty - v_need) <= 0 THEN
            UPDATE products SET is_active = false WHERE id::TEXT = v_product_id;
          END IF;
        END IF;
      END IF;
    END LOOP;

    UPDATE settings SET value = v_stock_map::TEXT, updated_at = NOW() WHERE key = 'stock_limits';
  END IF;

  IF v_drink_raw IS NOT NULL THEN
    v_drink_map := v_drink_raw::JSONB;

    -- Fase 1: validar disponibilidade de bebidas
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_drink_id := v_item->>'drink_id';
      IF v_drink_id IS NOT NULL AND v_drink_id <> '' THEN
        v_entry := v_drink_map->v_drink_id;
        IF v_entry IS NOT NULL AND (v_entry->>'enabled')::BOOLEAN IS TRUE THEN
          v_qty  := COALESCE((v_entry->>'qty')::INT, 0);
          v_need := COALESCE((v_item->>'quantity')::INT, 1);
          IF v_qty < v_need THEN
            RETURN jsonb_build_object(
              'ok', false,
              'error', '"' || COALESCE(v_item->>'product_name', v_drink_id) || '" não tem estoque suficiente.'
            );
          END IF;
        END IF;
      END IF;
    END LOOP;

    -- Fase 2: decrementar bebidas
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_drink_id := v_item->>'drink_id';
      IF v_drink_id IS NOT NULL AND v_drink_id <> '' THEN
        v_entry := v_drink_map->v_drink_id;
        IF v_entry IS NOT NULL AND (v_entry->>'enabled')::BOOLEAN IS TRUE THEN
          v_qty  := COALESCE((v_entry->>'qty')::INT, 0);
          v_need := COALESCE((v_item->>'quantity')::INT, 1);
          v_drink_map := jsonb_set(
            v_drink_map,
            ARRAY[v_drink_id, 'qty'],
            to_jsonb(GREATEST(0, v_qty - v_need))
          );
          IF GREATEST(0, v_qty - v_need) <= 0 THEN
            UPDATE drinks SET is_active = false WHERE id::TEXT = v_drink_id;
          END IF;
        END IF;
      END IF;
    END LOOP;

    UPDATE settings SET value = v_drink_map::TEXT, updated_at = NOW() WHERE key = 'drink_stock_limits';
  END IF;

  RETURN '{"ok": true}'::JSONB;
END;
$$;
