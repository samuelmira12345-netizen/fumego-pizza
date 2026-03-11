// Tokens de design — cores e constantes visuais do FUMÊGO

export const GOLD       = '#F2A800';
export const GOLD_LIGHT = '#FFD060';
export const BG         = '#080600';
export const CARD       = '#1C1500';
export const BORDER     = '#2C1E00';
export const MUTED      = '#7A6040';
export const FAINT      = '#3A2810';

/** Formata um preço numérico no padrão BRL: "xx,xx" */
export function fmt(price: number | string): string {
  return Number(price).toFixed(2).replace('.', ',');
}

/** Retorna true se o item está em promoção válida (com preço e sem validade expirada) */
export function isPromoActive(item: { promotion_active?: boolean; promotional_price?: number | string | null; promotion_ends_at?: string | null }): boolean {
  if (!item.promotion_active) return false;
  if (!item.promotional_price || Number(item.promotional_price) <= 0) return false;
  if (item.promotion_ends_at && new Date(item.promotion_ends_at) < new Date()) return false;
  return true;
}

/** Retorna o preço efetivo (promocional se ativo, senão normal) */
export function effectivePrice(item: { price: number | string; promotional_price?: number | string | null; promotion_active?: boolean; promotion_ends_at?: string | null }): number {
  if (isPromoActive(item)) return Number(item.promotional_price);
  return Number(item.price);
}

// ── Opções de personalização por produto ───────────────────────────────────────

import type { CartItemOption } from './types';

export const COMBO_CALABRESA_OPTS: CartItemOption[] = [
  { label: 'Sem cebola', extra_price: 0 },
  { label: 'Com cebola', extra_price: 2 },
];

export const COMBO_MARGUERITA_OPTS: CartItemOption[] = [
  { label: 'Sem alho',        extra_price: 0 },
  { label: 'Com alho',        extra_price: 0 },
  { label: 'Alho caprichado', extra_price: 2 },
];

export const PRODUCT_OPTIONS: Record<string, CartItemOption[]> = {
  calabresa:  COMBO_CALABRESA_OPTS,
  marguerita: COMBO_MARGUERITA_OPTS,
};
