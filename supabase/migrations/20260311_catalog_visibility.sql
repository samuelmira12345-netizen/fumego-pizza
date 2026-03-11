-- ============================================================
-- Migration: Add is_hidden column to products and drinks
-- ============================================================
-- This column controls whether an item is visible on the storefront.
-- is_active = false → item shows as "Esgotado" (sold out)
-- is_hidden = true  → item is completely hidden from the menu

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

ALTER TABLE drinks
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
