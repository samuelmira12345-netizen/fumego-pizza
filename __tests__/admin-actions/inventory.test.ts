/**
 * Testes unitários para lib/admin-actions/inventory.ts
 */

jest.mock('bcryptjs', () => ({
  hash:    jest.fn().mockResolvedValue('$2b$12$mockhash'),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  handleGetCatalogExtra,
  handleSaveIngredient,
  handleDeleteIngredient,
  handleStockMovement,
  handleGetStockMovements,
  handleSaveRecipe,
  handleSaveCompoundRecipe,
  handleGetCompoundRecipes,
  handleSaveCompoundRecipeV2,
  handleDeleteCompoundRecipe,
  handleApplyCompoundRecipe,
} from '../../lib/admin-actions/inventory';

// ── Mock builder ───────────────────────────────────────────────────────────────

function mkChain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const c: Record<string, unknown> = {};
  const self = () => c;
  [
    'select','eq','gte','lte','lt','not','order','limit','range',
    'like','in','insert','update','delete','upsert','neq','ilike',
  ].forEach((m) => { (c as any)[m] = jest.fn(self); });
  (c as any).single      = jest.fn(() => Promise.resolve(result));
  (c as any).maybeSingle = jest.fn(() => Promise.resolve(result));
  (c as any).then  = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  (c as any).catch = (reject: (e: unknown) => void) => Promise.resolve(result).catch(reject);
  return c;
}

const mockSupabase = { from: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.from.mockImplementation(() => mkChain([], null));
  delete (process.env as any).ADMIN_PASSWORD_HASH;
});

// ── handleGetCatalogExtra ─────────────────────────────────────────────────────

describe('handleGetCatalogExtra', () => {
  it('retorna ingredients, recipes, priceHistory e compoundItems', async () => {
    const ingredients = [{ id: 'i1', name: 'Farinha' }];
    const recipes     = [{ id: 'r1', product_id: 'p1' }];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'ingredients')               return mkChain(ingredients, null);
      if (table === 'recipe_items')              return mkChain(recipes, null);
      if (table === 'ingredient_price_history')  return mkChain([], null);
      if (table === 'compound_ingredient_items') return mkChain([], null);
      return mkChain([], null);
    });

    const res = await handleGetCatalogExtra(mockSupabase as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ingredients).toEqual(ingredients);
    expect(body.recipes).toEqual(recipes);
    expect(body.priceHistory).toEqual([]);
    expect(body.compoundItems).toEqual([]);
  });
});

// ── handleSaveIngredient ──────────────────────────────────────────────────────

describe('handleSaveIngredient', () => {
  it('cria novo ingrediente quando id não é fornecido', async () => {
    const inserted = { id: 'i-new', name: 'Sal', unit: 'kg', cost_per_unit: 2.5 };
    mockSupabase.from.mockReturnValue(mkChain(inserted, null));

    const res = await handleSaveIngredient(mockSupabase as any, {
      name: 'Sal', unit: 'kg', cost_per_unit: 2.5,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ingredient).toMatchObject({ id: 'i-new' });
  });

  it('atualiza ingrediente existente (id fornecido)', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'ingredients') {
        return mkChain({ id: 'i1', cost_per_unit: 3.0 }, null);
      }
      return mkChain(null, null);
    });

    const res = await handleSaveIngredient(mockSupabase as any, {
      id: 'i1', name: 'Sal', unit: 'kg', cost_per_unit: 3.0,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('registra histórico de preço quando custo muda', async () => {
    let histInsertCalled = false;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'ingredients') return mkChain({ id: 'i1', cost_per_unit: 3.0 }, null);
      if (table === 'ingredient_price_history') {
        histInsertCalled = true;
        return mkChain({ id: 'h1' }, null);
      }
      return mkChain(null, null);
    });

    await handleSaveIngredient(mockSupabase as any, {
      id: 'i1', name: 'Sal', unit: 'kg', cost_per_unit: 4.0, // preço mudou
    });

    expect(histInsertCalled).toBe(true);
  });

  it('não registra histórico de preço quando custo não muda', async () => {
    let histInsertCalled = false;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'ingredients') return mkChain({ id: 'i1', cost_per_unit: 3.0 }, null);
      if (table === 'ingredient_price_history') {
        histInsertCalled = true;
        return mkChain(null, null);
      }
      return mkChain(null, null);
    });

    await handleSaveIngredient(mockSupabase as any, {
      id: 'i1', name: 'Sal', unit: 'kg', cost_per_unit: 3.0, // mesmo preço
    });

    expect(histInsertCalled).toBe(false);
  });
});

// ── handleDeleteIngredient ────────────────────────────────────────────────────

describe('handleDeleteIngredient', () => {
  it('deleta ingrediente e retorna success', async () => {
    const res = await handleDeleteIngredient(mockSupabase as any, { id: 'i1' });
    expect((await res.json()).success).toBe(true);
  });

  it('retorna 400 quando supabase falha', async () => {
    mockSupabase.from.mockReturnValue(mkChain(null, { message: 'FK constraint' }));

    const res = await handleDeleteIngredient(mockSupabase as any, { id: 'i1' });
    expect(res.status).toBe(400);
  });
});

// ── handleStockMovement ───────────────────────────────────────────────────────

describe('handleStockMovement', () => {
  it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
    const res = await handleStockMovement(mockSupabase as any, {
      ingredient_id: 'i1', movement_type: 'in',
      // quantity ausente
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/quantity/i);
  });

  it('retorna 400 sem ingredient_id', async () => {
    const res = await handleStockMovement(mockSupabase as any, {
      movement_type: 'in', quantity: 5,
    });
    expect(res.status).toBe(400);
  });

  it('entrada (in) aumenta estoque', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'stock_movements') return mkChain(null, null);
      if (table === 'ingredients')     return mkChain({ current_stock: 10 }, null);
      return mkChain(null, null);
    });

    const res = await handleStockMovement(mockSupabase as any, {
      ingredient_id: 'i1', movement_type: 'in', quantity: 5,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.new_stock).toBe(15); // 10 + 5
  });

  it('saída (out) diminui estoque', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'stock_movements') return mkChain(null, null);
      if (table === 'ingredients')     return mkChain({ current_stock: 10 }, null);
      return mkChain(null, null);
    });

    const res = await handleStockMovement(mockSupabase as any, {
      ingredient_id: 'i1', movement_type: 'out', quantity: 3,
    });
    const body = await res.json();

    expect(body.new_stock).toBe(7); // 10 - 3
  });

  it('ajuste (adjustment) define estoque diretamente', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'stock_movements') return mkChain(null, null);
      if (table === 'ingredients')     return mkChain({ current_stock: 10 }, null);
      return mkChain(null, null);
    });

    const res = await handleStockMovement(mockSupabase as any, {
      ingredient_id: 'i1', movement_type: 'adjustment', quantity: 25,
    });
    const body = await res.json();

    expect(body.new_stock).toBe(25); // direto
  });

  it('retorna 403 quando admin_password é fornecida mas incorreta', async () => {
    const bcrypt = require('bcryptjs');
    bcrypt.compare.mockResolvedValueOnce(false); // senha incorreta

    process.env.ADMIN_PASSWORD_HASH = '$2b$12$mockhash';

    const res = await handleStockMovement(mockSupabase as any, {
      ingredient_id: 'i1', movement_type: 'adjustment', quantity: 25,
      admin_password: 'wrong_password',
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/senha/i);
  });

  it('executa movimentação quando admin_password está correta', async () => {
    const bcrypt = require('bcryptjs');
    bcrypt.compare.mockResolvedValueOnce(true); // senha correta

    process.env.ADMIN_PASSWORD_HASH = '$2b$12$mockhash';

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'stock_movements') return mkChain(null, null);
      if (table === 'ingredients')     return mkChain({ current_stock: 5 }, null);
      return mkChain(null, null);
    });

    const res = await handleStockMovement(mockSupabase as any, {
      ingredient_id: 'i1', movement_type: 'in', quantity: 10,
      admin_password: 'correct_password',
    });
    expect(res.status).toBe(200);
    expect((await res.json()).new_stock).toBe(15);
  });
});

// ── handleGetStockMovements ───────────────────────────────────────────────────

describe('handleGetStockMovements', () => {
  it('retorna movimentações de estoque', async () => {
    const movements = [{ id: 'm1', movement_type: 'in', quantity: 5 }];
    mockSupabase.from.mockReturnValue(mkChain(movements, null));

    const res = await handleGetStockMovements(mockSupabase as any, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.movements).toEqual(movements);
  });

  it('filtra por ingredient_id quando fornecido', async () => {
    mockSupabase.from.mockReturnValue(mkChain([], null));

    const res = await handleGetStockMovements(mockSupabase as any, { ingredient_id: 'i1', limit: 50 });
    expect(res.status).toBe(200);
  });
});

// ── handleSaveRecipe ──────────────────────────────────────────────────────────

describe('handleSaveRecipe', () => {
  it('salva receita com itens', async () => {
    const res = await handleSaveRecipe(mockSupabase as any, {
      product_id: 'p1',
      items: [
        { ingredient_id: 'i1', quantity: 100, recipe_unit: 'g' },
        { ingredient_id: 'i2', quantity: 50,  recipe_unit: 'ml' },
      ],
    });
    expect((await res.json()).success).toBe(true);
  });

  it('deleta receita existente antes de salvar (substitui)', async () => {
    let deleteCalled = false;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'recipe_items') {
        const chain = mkChain(null, null);
        const origDelete = (chain as any).delete;
        (chain as any).delete = (...args: unknown[]) => {
          deleteCalled = true;
          return origDelete(...args);
        };
        return chain;
      }
      return mkChain(null, null);
    });

    await handleSaveRecipe(mockSupabase as any, {
      product_id: 'p1',
      items: [{ ingredient_id: 'i1', quantity: 200, recipe_unit: 'g' }],
    });

    expect(deleteCalled).toBe(true);
  });
});

// ── handleSaveCompoundRecipe ──────────────────────────────────────────────────

describe('handleSaveCompoundRecipe', () => {
  it('retorna 400 quando compound_id está ausente', async () => {
    const res = await handleSaveCompoundRecipe(mockSupabase as any, {
      items: [{ ingredient_id: 'i1', quantity: 1 }],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/compound_id/i);
  });

  it('substitui items existentes e retorna success', async () => {
    const res = await handleSaveCompoundRecipe(mockSupabase as any, {
      compound_id: 'c1',
      items: [{ ingredient_id: 'i1', quantity: 0.5 }],
    });
    expect((await res.json()).success).toBe(true);
  });

  it('atualiza custo do compound quando computed_cost é fornecido', async () => {
    let priceHistoryCalled = false;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'compound_ingredient_items') return mkChain(null, null);
      if (table === 'ingredients') return mkChain({ id: 'c1', cost_per_unit: 5.0 }, null);
      if (table === 'ingredient_price_history') {
        priceHistoryCalled = true;
        return mkChain(null, null);
      }
      return mkChain(null, null);
    });

    await handleSaveCompoundRecipe(mockSupabase as any, {
      compound_id: 'c1',
      items: [],
      computed_cost: 8.0, // custo mudou de 5 para 8
    });

    expect(priceHistoryCalled).toBe(true);
  });
});

// ── handleGetCompoundRecipes ──────────────────────────────────────────────────

describe('handleGetCompoundRecipes', () => {
  it('retorna 400 quando compound_id está ausente', async () => {
    const res = await handleGetCompoundRecipes(mockSupabase as any, {});
    expect(res.status).toBe(400);
  });

  it('retorna receitas compostas', async () => {
    const recipes = [{ id: 'cr1', name: 'Molho Especial' }];
    mockSupabase.from.mockReturnValue(mkChain(recipes, null));

    const res = await handleGetCompoundRecipes(mockSupabase as any, { compound_id: 'c1' });
    expect((await res.json()).recipes).toEqual(recipes);
  });
});

// ── handleSaveCompoundRecipeV2 ────────────────────────────────────────────────

describe('handleSaveCompoundRecipeV2', () => {
  it('retorna 400 quando compound_id ou name estão ausentes', async () => {
    const res = await handleSaveCompoundRecipeV2(mockSupabase as any, { name: 'Molho' });
    expect(res.status).toBe(400);
  });

  it('cria nova receita composta v2', async () => {
    const inserted = { id: 'cr-new', name: 'Molho Base', compound_id: 'c1' };
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'compound_recipes')      return mkChain(inserted, null);
      if (table === 'compound_recipe_items') return mkChain(null, null);
      return mkChain(null, null);
    });

    const res = await handleSaveCompoundRecipeV2(mockSupabase as any, {
      compound_id: 'c1', name: 'Molho Base', yield_quantity: 1000, yield_unit: 'ml',
      items: [{ ingredient_id: 'i1', quantity: 500 }],
    });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

// ── handleDeleteCompoundRecipe ────────────────────────────────────────────────

describe('handleDeleteCompoundRecipe', () => {
  it('retorna 400 quando id está ausente', async () => {
    const res = await handleDeleteCompoundRecipe(mockSupabase as any, {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/id/i);
  });

  it('deleta receita e retorna success', async () => {
    const res = await handleDeleteCompoundRecipe(mockSupabase as any, { id: 'cr1' });
    expect((await res.json()).success).toBe(true);
  });
});

// ── handleApplyCompoundRecipe ─────────────────────────────────────────────────

describe('handleApplyCompoundRecipe', () => {
  it('retorna 400 quando recipe_id está ausente', async () => {
    const res = await handleApplyCompoundRecipe(mockSupabase as any, {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/recipe_id/i);
  });

  it('retorna 404 quando receita não é encontrada', async () => {
    mockSupabase.from.mockReturnValue(mkChain(null, { message: 'not found' }));

    const res = await handleApplyCompoundRecipe(mockSupabase as any, { recipe_id: 'cr-nonexistent' });
    expect(res.status).toBe(404);
  });

  it('deduz ingredientes e credita compound com rendimento bruto (sem FC)', async () => {
    const recipe = {
      id: 'cr1', name: 'Molho Base', compound_id: 'c-molho',
      yield_quantity: 1000,
      compound_recipe_items: [
        {
          ingredient_id: 'i-tomate',
          quantity: 800,
          ingredients: { name: 'Tomate', unit: 'g', current_stock: 2000 },
        },
      ],
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'compound_recipes') return mkChain(recipe, null);
      if (table === 'ingredients')      return mkChain({ current_stock: 500, correction_factor: 0 }, null);
      if (table === 'stock_movements')  return mkChain(null, null);
      return mkChain(null, null);
    });

    const res = await handleApplyCompoundRecipe(mockSupabase as any, { recipe_id: 'cr1' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // compound_stock = 500 + 1000 (yield sem FC)
    expect(body.compound_stock).toBeCloseTo(1500);
  });

  it('aplica fator de correção (FC) no rendimento líquido', async () => {
    // FC = 20% → líquido = 1000 * (1 - 0.20) = 800
    const recipe = {
      id: 'cr1', name: 'Molho Especial', compound_id: 'c-molho',
      yield_quantity: 1000,
      compound_recipe_items: [],
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'compound_recipes') return mkChain(recipe, null);
      if (table === 'ingredients')      return mkChain({ current_stock: 0, correction_factor: 20 }, null);
      if (table === 'stock_movements')  return mkChain(null, null);
      return mkChain(null, null);
    });

    const res = await handleApplyCompoundRecipe(mockSupabase as any, { recipe_id: 'cr1' });
    const body = await res.json();

    expect(res.status).toBe(200);
    // compound_stock = 0 + 1000 * (1 - 20/100) = 800
    expect(body.compound_stock).toBeCloseTo(800);
  });
});
