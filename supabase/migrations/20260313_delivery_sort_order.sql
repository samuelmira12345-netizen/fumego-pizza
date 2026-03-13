-- Delivery sort order: allows admins to define the delivery queue sequence per driver
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_sort_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_sort
  ON orders (delivery_person_id, delivery_sort_order)
  WHERE delivery_person_id IS NOT NULL;
