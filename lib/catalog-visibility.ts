/**
 * Fallback de visibilidade/atividade do catálogo.
 *
 * Mantém overrides em settings (key: catalog_visibility_overrides)
 * para garantir funcionamento mesmo em bancos legados sem colunas
 * is_hidden / is_active em produtos ou bebidas.
 */

export const CATALOG_VISIBILITY_SETTING_KEY = 'catalog_visibility_overrides';

interface VisibilityOverride {
  is_active?: boolean | string | number;
  is_hidden?: boolean | string | number;
}

export interface CatalogVisibilityOverrides {
  products: Record<string, VisibilityOverride>;
  drinks:   Record<string, VisibilityOverride>;
}

interface Setting {
  key: string;
  value: string;
}

interface ItemWithVisibility {
  id: number | string;
  is_active?: boolean | string | number;
  is_hidden?: boolean | string | number;
  [key: string]: unknown;
}

function coerceBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'sim', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'nao', 'não', 'off', ''].includes(normalized)) return false;
  }
  return Boolean(value);
}

export function parseCatalogVisibilityOverrides(settings: Setting[] = []): CatalogVisibilityOverrides {
  const raw = (settings || []).find(s => s.key === CATALOG_VISIBILITY_SETTING_KEY)?.value;
  if (!raw) return { products: {}, drinks: {} };

  try {
    const parsed = JSON.parse(raw) as Partial<CatalogVisibilityOverrides>;
    return {
      products: parsed?.products && typeof parsed.products === 'object' ? parsed.products : {},
      drinks:   parsed?.drinks   && typeof parsed.drinks === 'object'   ? parsed.drinks   : {},
    };
  } catch {
    return { products: {}, drinks: {} };
  }
}

export function applyCatalogVisibilityOverrides<T extends ItemWithVisibility>(
  products: T[] = [],
  drinks: T[] = [],
  overrides: CatalogVisibilityOverrides = { products: {}, drinks: {} }
): { products: T[]; drinks: T[] } {
  const productMap = overrides?.products || {};
  const drinkMap   = overrides?.drinks   || {};

  const nextProducts = (products || []).map((p) => {
    const ov = productMap[String(p.id)] || {};
    return {
      ...p,
      is_active: ov.is_active !== undefined ? coerceBoolean(ov.is_active, coerceBoolean(p.is_active, false)) : coerceBoolean(p.is_active, false),
      is_hidden: ov.is_hidden !== undefined ? coerceBoolean(ov.is_hidden, coerceBoolean(p.is_hidden, false)) : coerceBoolean(p.is_hidden, false),
    };
  });

  const nextDrinks = (drinks || []).map((d) => {
    const ov = drinkMap[String(d.id)] || {};
    return {
      ...d,
      is_active: ov.is_active !== undefined ? coerceBoolean(ov.is_active, coerceBoolean(d.is_active, false)) : coerceBoolean(d.is_active, false),
      is_hidden: ov.is_hidden !== undefined ? coerceBoolean(ov.is_hidden, coerceBoolean(d.is_hidden, false)) : coerceBoolean(d.is_hidden, false),
    };
  });

  return { products: nextProducts, drinks: nextDrinks };
}
