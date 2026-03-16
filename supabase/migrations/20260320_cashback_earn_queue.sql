-- P9: Persistent retry queue for cashback earn failures.
-- When earnCashback fails (Supabase unreachable, transient error), the
-- order is inserted here so a cron job can retry without user losing cashback.

CREATE TABLE IF NOT EXISTS cashback_earn_queue (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  order_id    UUID NOT NULL,
  order_total NUMERIC(12,2) NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT cashback_earn_queue_order_id_unique UNIQUE (order_id)
);

-- Index for the cron job: fetch unprocessed entries ordered by creation time
CREATE INDEX IF NOT EXISTS idx_cashback_earn_queue_pending
  ON cashback_earn_queue (created_at)
  WHERE processed_at IS NULL;

ALTER TABLE cashback_earn_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only" ON cashback_earn_queue;
CREATE POLICY "service role only" ON cashback_earn_queue
  USING (false) WITH CHECK (false);
