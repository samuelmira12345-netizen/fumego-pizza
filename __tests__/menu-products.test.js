const { resolveMenuProducts } = require('../lib/menu-products');

describe('resolveMenuProducts', () => {
  test('detects featured products by slug and keeps remaining', () => {
    const products = [
      { id: 1, slug: 'calabresa', name: 'Calabresa' },
      { id: 2, slug: 'margherita-tradicional', name: 'Margherita' },
      { id: 3, slug: 'combo-classico', name: 'Combo clássico' },
      { id: 4, slug: 'especial-do-mes', name: 'Especial' },
      { id: 5, slug: 'frango-catupiry', name: 'Frango c/ catupiry' },
    ];

    const result = resolveMenuProducts(products);

    expect(result.calabresa.id).toBe(1);
    expect(result.marguerita.id).toBe(2);
    expect(result.combo.id).toBe(3);
    expect(result.especial.id).toBe(4);
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0].id).toBe(5);
  });

  test('matches featured by name when slug differs', () => {
    const products = [
      { id: 6, slug: 'pizza-001', name: 'Pizza Calabresa' },
      { id: 7, slug: 'pizza-002', name: 'Margarita da Casa' },
    ];

    const result = resolveMenuProducts(products);

    expect(result.calabresa.id).toBe(6);
    expect(result.marguerita.id).toBe(7);
    expect(result.remaining).toHaveLength(0);
  });
});
