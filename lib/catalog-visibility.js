/**
 * Fallback de visibilidade/atividade do catálogo.
 *
 * Mantém overrides em settings (key: catalog_visibility_overrides)
 * para garantir funcionamento mesmo em bancos legados sem colunas
 * is_hidden / is_active em produtos ou bebidas.
 */

export const CATALOG_VISIBILITY_SETTING_KEY = 'catalog_visibility_overrides';

export function parseCatalogVisibilityOverrides(settings = []) {
  const raw = (settings || []).find(s => s.key === CATALOG_VISIBILITY_SETTING_KEY)?.value;
  if (!raw) return { products: {}, drinks: {} };

  try {
    const parsed = JSON.parse(raw);
    return {
      products: parsed?.products && typeof parsed.products === 'object' ? parsed.products : {},
      drinks:   parsed?.drinks   && typeof parsed.drinks === 'object'   ? parsed.drinks   : {},
    };
  } catch {
    return { products: {}, drinks: {} };
  }
}

export function applyCatalogVisibilityOverrides(products = [], drinks = [], overrides = { products: {}, drinks: {} }) {
  const productMap = overrides?.products || {};
  const drinkMap   = overrides?.drinks   || {};

  const nextProducts = (products || []).map((p) => {
    const ov = productMap[String(p.id)] || {};
    return {
      ...p,
      is_active: ov.is_active !== undefined ? !!ov.is_active : !!p.is_active,
      is_hidden: ov.is_hidden !== undefined ? !!ov.is_hidden : !!p.is_hidden,
    };
  });

  const nextDrinks = (drinks || []).map((d) => {
    const ov = drinkMap[String(d.id)] || {};
    return {
      ...d,
      is_active: ov.is_active !== undefined ? !!ov.is_active : !!d.is_active,
      is_hidden: ov.is_hidden !== undefined ? !!ov.is_hidden : !!d.is_hidden,
    };
  });

  return { products: nextProducts, drinks: nextDrinks };
}
