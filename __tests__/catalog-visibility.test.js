const { parseCatalogVisibilityOverrides, applyCatalogVisibilityOverrides } = require('../lib/catalog-visibility');

describe('catalog visibility overrides', () => {
  test('parse empty settings', () => {
    const parsed = parseCatalogVisibilityOverrides([]);
    expect(parsed).toEqual({ products: {}, drinks: {} });
  });

  test('parse valid json', () => {
    const settings = [{ key: 'catalog_visibility_overrides', value: JSON.stringify({ products: { a: { is_hidden: true } }, drinks: {} }) }];
    const parsed = parseCatalogVisibilityOverrides(settings);
    expect(parsed.products.a.is_hidden).toBe(true);
  });

  test('apply override hides product and inactivates drink', () => {
    const products = [{ id: 'p1', is_active: true, is_hidden: false }];
    const drinks = [{ id: 'd1', is_active: true, is_hidden: false }];
    const overrides = {
      products: { p1: { is_hidden: true } },
      drinks: { d1: { is_active: false } },
    };

    const merged = applyCatalogVisibilityOverrides(products, drinks, overrides);
    expect(merged.products[0].is_hidden).toBe(true);
    expect(merged.products[0].is_active).toBe(true);
    expect(merged.drinks[0].is_active).toBe(false);
    expect(merged.drinks[0].is_hidden).toBe(false);
  });
});
