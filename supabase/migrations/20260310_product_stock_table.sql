-- =========================================================================
-- FUMÊGO Pizza — Migração: Tabela product_stock e drink_stock
-- Resolve: estoque armazenado como JSON em settings sem índice nem constraint.
--
-- Execute no Supabase SQL Editor.
-- =========================================================================

-- 1. Tabela de estoque de produtos
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_stock (
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  enabled     BOOLEAN     NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_stock_enabled
  ON product_stock (enabled)
  WHERE enabled = true;

COMMENT ON TABLE  product_stock IS 'Controle de estoque de produtos (substitui settings.stock_limits JSON).';
COMMENT ON COLUMN product_stock.quantity   IS 'Quantidade disponível.';
COMMENT ON COLUMN product_stock.enabled    IS 'Se false o produto não tem controle de estoque ativo.';

ALTER TABLE product_stock ENABLE ROW LEVEL SECURITY;
-- Acesso via service role (backend) apenas
CREATE POLICY "service role only" ON product_stock USING (false) WITH CHECK (false);


-- 2. Tabela de estoque de bebidas
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drink_stock (
  drink_id    BIGINT      NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
  quantity    INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  enabled     BOOLEAN     NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (drink_id)
);

CREATE INDEX IF NOT EXISTS idx_drink_stock_enabled
  ON drink_stock (enabled)
  WHERE enabled = true;

COMMENT ON TABLE  drink_stock IS 'Controle de estoque de bebidas (substitui settings.drink_stock_limits JSON).';

ALTER TABLE drink_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON drink_stock USING (false) WITH CHECK (false);


-- 3. Migrar dados existentes do JSON de settings → novas tabelas
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_raw      TEXT;
  v_map      JSONB;
  v_key      TEXT;
  v_entry    JSONB;
BEGIN
  -- 3a. Produtos
  SELECT value INTO v_raw FROM settings WHERE key = 'stock_limits';
  IF v_raw IS NOT NULL AND v_raw <> '' AND v_raw <> 'null' THEN
    v_map := v_raw::JSONB;
    FOR v_key IN SELECT jsonb_object_keys(v_map)
    LOOP
      v_entry := v_map->v_key;
      BEGIN
        INSERT INTO product_stock (product_id, quantity, enabled, updated_at)
        VALUES (
          v_key::UUID,
          GREATEST(0, COALESCE((v_entry->>'qty')::INT, 0)),
          COALESCE((v_entry->>'enabled')::BOOLEAN, false),
          NOW()
        )
        ON CONFLICT (product_id) DO UPDATE
          SET quantity   = EXCLUDED.quantity,
              enabled    = EXCLUDED.enabled,
              updated_at = NOW();
      EXCEPTION WHEN OTHERS THEN
        -- Ignora entradas com UUID inválido ou produto inexistente
        NULL;
      END;
    END LOOP;
  END IF;

  -- 3b. Bebidas
  SELECT value INTO v_raw FROM settings WHERE key = 'drink_stock_limits';
  IF v_raw IS NOT NULL AND v_raw <> '' AND v_raw <> 'null' THEN
    v_map := v_raw::JSONB;
    FOR v_key IN SELECT jsonb_object_keys(v_map)
    LOOP
      v_entry := v_map->v_key;
      BEGIN
        INSERT INTO drink_stock (drink_id, quantity, enabled, updated_at)
        VALUES (
          v_key::BIGINT,
          GREATEST(0, COALESCE((v_entry->>'qty')::INT, 0)),
          COALESCE((v_entry->>'enabled')::BOOLEAN, false),
          NOW()
        )
        ON CONFLICT (drink_id) DO UPDATE
          SET quantity   = EXCLUDED.quantity,
              enabled    = EXCLUDED.enabled,
              updated_at = NOW();
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END IF;
END;
$$;


-- 4. Atualizar decrement_stock_atomic para usar as novas tabelas
--    Mantém advisory lock para serializar acesso concurrent.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION decrement_stock_atomic(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_item        JSONB;
  v_product_id  UUID;
  v_drink_id    BIGINT;
  v_qty         INT;
  v_need        INT;
  v_enabled     BOOLEAN;
BEGIN
  -- Advisory lock: serializa acesso concurrent ao estoque
  PERFORM pg_advisory_xact_lock(hashtext('fumego_stock_limits'));

  -- ── Fase 1: validar disponibilidade ────────────────────────────────────

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Produto
    IF (v_item->>'product_id') IS NOT NULL AND (v_item->>'product_id') <> '' THEN
      BEGIN
        v_product_id := (v_item->>'product_id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;

      SELECT quantity, enabled INTO v_qty, v_enabled
        FROM product_stock
        WHERE product_id = v_product_id;

      IF FOUND AND v_enabled THEN
        v_need := COALESCE((v_item->>'quantity')::INT, 1);
        IF v_qty < v_need THEN
          RETURN jsonb_build_object(
            'ok', false,
            'error', '"' || COALESCE(v_item->>'product_name', v_item->>'product_id') || '" está esgotado e não pode ser pedido.'
          );
        END IF;
      END IF;
    END IF;

    -- Bebida
    IF (v_item->>'drink_id') IS NOT NULL AND (v_item->>'drink_id') <> '' THEN
      BEGIN
        v_drink_id := (v_item->>'drink_id')::BIGINT;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;

      SELECT quantity, enabled INTO v_qty, v_enabled
        FROM drink_stock
        WHERE drink_id = v_drink_id;

      IF FOUND AND v_enabled THEN
        v_need := COALESCE((v_item->>'quantity')::INT, 1);
        IF v_qty < v_need THEN
          RETURN jsonb_build_object(
            'ok', false,
            'error', '"' || COALESCE(v_item->>'product_name', v_item->>'drink_id') || '" não tem estoque suficiente.'
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- ── Fase 2: decrementar ────────────────────────────────────────────────

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Produto
    IF (v_item->>'product_id') IS NOT NULL AND (v_item->>'product_id') <> '' THEN
      BEGIN
        v_product_id := (v_item->>'product_id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;

      SELECT quantity, enabled INTO v_qty, v_enabled
        FROM product_stock WHERE product_id = v_product_id;

      IF FOUND AND v_enabled THEN
        v_need := COALESCE((v_item->>'quantity')::INT, 1);
        v_qty  := GREATEST(0, v_qty - v_need);

        UPDATE product_stock
          SET quantity = v_qty, updated_at = NOW()
          WHERE product_id = v_product_id;

        -- Auto-desativar produto ao zerar
        IF v_qty = 0 THEN
          UPDATE products SET is_active = false WHERE id = v_product_id;
        END IF;
      END IF;
    END IF;

    -- Bebida
    IF (v_item->>'drink_id') IS NOT NULL AND (v_item->>'drink_id') <> '' THEN
      BEGIN
        v_drink_id := (v_item->>'drink_id')::BIGINT;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;

      SELECT quantity, enabled INTO v_qty, v_enabled
        FROM drink_stock WHERE drink_id = v_drink_id;

      IF FOUND AND v_enabled THEN
        v_need := COALESCE((v_item->>'quantity')::INT, 1);
        v_qty  := GREATEST(0, v_qty - v_need);

        UPDATE drink_stock
          SET quantity = v_qty, updated_at = NOW()
          WHERE drink_id = v_drink_id;

        IF v_qty = 0 THEN
          UPDATE drinks SET is_active = false WHERE id = v_drink_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN '{"ok": true}'::JSONB;
END;
$$;
