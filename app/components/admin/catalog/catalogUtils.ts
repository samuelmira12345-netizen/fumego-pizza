// Catalog constants and pure helper utilities
// Extracted from Catalog.tsx — no React, no side-effects

import { parseCorrectionLoss } from '@/lib/correction-factor';

// ── Category / filter config ───────────────────────────────────────────────────

export const PROD_CATEGORIES = [
  { key: 'pizza',   label: 'Pizza' },
  { key: 'calzone', label: 'Calzone' },
  { key: 'combo',   label: 'Combo' },
  { key: 'outros',  label: 'Outros' },
] as const;

export const FILTER_TABS = [
  { key: 'all',     label: 'Todos' },
  { key: 'pizza',   label: 'Pizza' },
  { key: 'calzone', label: 'Calzone' },
  { key: 'combo',   label: 'Combo' },
  { key: 'outros',  label: 'Outros' },
  { key: 'bebidas', label: 'Bebidas' },
  { key: 'upsell',  label: 'Upsell' },
] as const;

export const UNITS = ['unid', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz', 'ft', 'Bag', 'UN', 'KG'] as const;

// ── Color palette ──────────────────────────────────────────────────────────────

export const C = {
  bg: '#F4F5F7', card: '#fff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  gold: '#F2A800', success: '#10B981', danger: '#EF4444',
} as const;

// ── Formatters ─────────────────────────────────────────────────────────────────

export function fmtBRL(v: any) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCorrectionPercent(rawValue: any) {
  const loss = parseCorrectionLoss(rawValue);
  return (loss * 100).toFixed(2);
}

// ── Unit sub-conversion ────────────────────────────────────────────────────────
// base unit → { sub unit, conversion factor to base }

export const UNIT_SUB: Record<string, { sub: string; factor: number }> = {
  kg: { sub: 'g',  factor: 0.001 },
  L:  { sub: 'ml', factor: 0.001 },
};

export function toBaseQty(qty: any, recipeUnit: any, baseUnit: any) {
  if (!recipeUnit || recipeUnit === baseUnit) return parseFloat(qty) || 0;
  const conv = UNIT_SUB[baseUnit];
  if (conv && conv.sub === recipeUnit) return (parseFloat(qty) || 0) * conv.factor;
  return parseFloat(qty) || 0;
}

export function getUnitOptions(baseUnit: any): string[] {
  const conv = UNIT_SUB[baseUnit];
  if (conv) return [baseUnit, conv.sub];
  return [baseUnit];
}
