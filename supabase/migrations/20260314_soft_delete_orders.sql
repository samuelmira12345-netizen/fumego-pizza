-- Soft delete support for orders
-- When an admin "deletes" an order it becomes inactive (is_active = false)
-- instead of being permanently removed from the database.
-- Inactive orders are hidden from the kanban but visible in history.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Index to speed up filtering of active orders
CREATE INDEX IF NOT EXISTS idx_orders_is_active ON orders(is_active);

-- Composite index for the common query pattern (active orders by date)
CREATE INDEX IF NOT EXISTS idx_orders_is_active_created_at ON orders(is_active, created_at DESC);
