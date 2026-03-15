-- ── Tempo de entrega prometido ao cliente ────────────────────────────────────
-- Armazena o valor exibido ao cliente no checkout (ex: "40–60 min") no momento
-- em que o pedido foi criado. Isso permite comparar, nas métricas, o prazo
-- prometido com o tempo real de entrega, mesmo que a configuração mude depois.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promised_delivery_time text NULL;

COMMENT ON COLUMN orders.promised_delivery_time IS
  'Texto do prazo de entrega exibido ao cliente no checkout (ex: "40–60 min"). '
  'Capturado no momento do pedido para permitir comparação histórica justa '
  'entre prazo prometido e tempo real de entrega.';
