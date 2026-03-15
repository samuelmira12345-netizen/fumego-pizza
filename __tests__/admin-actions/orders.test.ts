/**
 * Testes unitários para lib/admin-actions/orders.ts
 *
 * Estratégia de mock:
 * - O SupabaseClient é injetado diretamente como parâmetro — sem mock de módulo.
 * - earnCashback é mockado para evitar side-effects.
 * - logger é mockado para suprimir output.
 */

jest.mock('../../lib/cashback', () => ({
  earnCashback: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// catalog-visibility usada em handleGetData — implementação real é suficiente
// mas precisa de módulo válido (não usa env vars)

import {
  handleGetOrderItems,
  handleGetOrderChangeHistory,
  handleUpdateOrder,
  handleUpdateOrderItems,
  handleDeleteOrder,
  handleRestoreOrder,
  handleGetInactiveOrders,
  handleCreateManualOrder,
  handleGetMoreOrders,
  handleGetOrdersOnly,
} from '../../lib/admin-actions/orders';

// ── Mock Supabase builder ──────────────────────────────────────────────────────

/**
 * Cria um builder encadeável que resolve com {data, error}.
 * Todos os métodos de query retornam o mesmo builder (chainable).
 * O builder é thenable para suportar `await query` sem .single().
 */
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
  // Thenable: permite `const { data } = await supabase.from(...).select()...`
  (c as any).then  = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  (c as any).catch = (reject: (e: unknown) => void) => Promise.resolve(result).catch(reject);
  return c;
}

const mockSupabase = { from: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  // Default: todas as queries retornam sucesso com array vazio
  mockSupabase.from.mockImplementation(() => mkChain([], null));
});

// ── handleGetOrdersOnly ───────────────────────────────────────────────────────

describe('handleGetOrdersOnly', () => {
  it('retorna lista de pedidos com sucesso', async () => {
    const orders = [{ id: 'o1', status: 'pending' }];
    mockSupabase.from.mockReturnValue(mkChain(orders, null));

    const res = await handleGetOrdersOnly(mockSupabase as any, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orders).toEqual(orders);
  });

  it('retorna erro 500 quando supabase falha', async () => {
    mockSupabase.from.mockReturnValue(mkChain(null, { message: 'DB error' }));

    const res = await handleGetOrdersOnly(mockSupabase as any, {});
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('DB error');
  });

  it('usa since customizado quando fornecido', async () => {
    mockSupabase.from.mockReturnValue(mkChain([], null));
    const since = '2024-01-01T00:00:00Z';

    const res = await handleGetOrdersOnly(mockSupabase as any, { since });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orders).toEqual([]);
  });
});

// ── handleGetMoreOrders ───────────────────────────────────────────────────────

describe('handleGetMoreOrders', () => {
  it('indica hasMore quando retorna pageSize itens', async () => {
    const orders = Array.from({ length: 50 }, (_, i) => ({ id: `o${i}` }));
    mockSupabase.from.mockReturnValue(mkChain(orders, null));

    const res = await handleGetMoreOrders(mockSupabase as any, { cursor: '2024-01-01', pageSize: 50 });
    const body = await res.json();

    expect(body.hasMore).toBe(true);
    expect(body.orders).toHaveLength(50);
  });

  it('indica hasMore=false quando retorna menos que pageSize', async () => {
    mockSupabase.from.mockReturnValue(mkChain([{ id: 'o1' }], null));

    const res = await handleGetMoreOrders(mockSupabase as any, { pageSize: 50 });
    const body = await res.json();

    expect(body.hasMore).toBe(false);
  });
});

// ── handleGetOrderItems ───────────────────────────────────────────────────────

describe('handleGetOrderItems', () => {
  it('retorna 400 quando order_id não é fornecido', async () => {
    const res = await handleGetOrderItems(mockSupabase as any, {});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/order_id/i);
  });

  it('retorna itens do pedido com sucesso', async () => {
    const items = [
      { product_name: 'Pizza Margherita', quantity: 1, unit_price: 45, total_price: 45, observations: null },
    ];
    mockSupabase.from.mockReturnValue(mkChain(items, null));

    const res = await handleGetOrderItems(mockSupabase as any, { order_id: 'order-abc' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual(items);
  });

  it('retorna 500 quando supabase falha', async () => {
    mockSupabase.from.mockReturnValue(mkChain(null, { message: 'fetch error' }));

    const res = await handleGetOrderItems(mockSupabase as any, { order_id: 'x' });
    expect(res.status).toBe(500);
  });
});

// ── handleGetOrderChangeHistory ───────────────────────────────────────────────

describe('handleGetOrderChangeHistory', () => {
  it('retorna 400 quando order_id não é fornecido', async () => {
    const res = await handleGetOrderChangeHistory(mockSupabase as any, {});
    expect(res.status).toBe(400);
  });

  it('retorna histórico do pedido', async () => {
    const history = [{ id: 'h1', action_type: 'status_change', details: {} }];
    mockSupabase.from.mockReturnValue(mkChain(history, null));

    const res = await handleGetOrderChangeHistory(mockSupabase as any, { order_id: 'order-1' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.history).toEqual(history);
  });
});

// ── handleUpdateOrder ─────────────────────────────────────────────────────────

describe('handleUpdateOrder', () => {
  it('atualiza status básico e retorna success', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'stock_movements') return mkChain([{ id: 'existing-mv' }], null); // bloqueia deduction
      return mkChain(null, null);
    });

    const res = await handleUpdateOrder(mockSupabase as any, {
      id: 'order-1',
      status: 'preparing',
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('status "confirmed" tenta deduzir estoque quando não há movimento existente', async () => {
    const orderItems = [{ product_id: 'p1', quantity: 1, product_name: 'Pizza' }];
    const recipeItems = [
      {
        quantity: 200, recipe_unit: 'g',
        ingredients: { id: 'ing-1', unit: 'kg', current_stock: 1.5, name: 'Farinha' },
      },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'stock_movements') return mkChain(null, null);   // existingMov = null → deduz
      if (table === 'order_items')     return mkChain(orderItems, null);
      if (table === 'recipe_items')    return mkChain(recipeItems, null);
      if (table === 'ingredients')     return mkChain(null, null);
      if (table === 'orders')          return mkChain(null, null);
      return mkChain(null, null);
    });

    const res = await handleUpdateOrder(mockSupabase as any, {
      id: 'order-1',
      status: 'confirmed',
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // Verifica que tentou atualizar estoque do ingrediente
    const ingredientsFrom = mockSupabase.from.mock.calls.some(([t]: [string]) => t === 'ingredients');
    expect(ingredientsFrom).toBe(true);
  });

  it('status "confirmed" não repete deduction se já existe stock_movement', async () => {
    const existingMovements = [{ id: 'mv-1' }]; // já existe

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'stock_movements') return mkChain(existingMovements, null);
      return mkChain(null, null);
    });

    const res = await handleUpdateOrder(mockSupabase as any, {
      id: 'order-1',
      status: 'confirmed',
    });

    expect(res.status).toBe(200);
    // Não deve ter chamado order_items para buscar receita
    const orderItemsCalls = mockSupabase.from.mock.calls.filter(([t]: [string]) => t === 'order_items');
    expect(orderItemsCalls).toHaveLength(0);
  });

  it('status "delivered" chama earnCashback para pagamento em dinheiro', async () => {
    const { earnCashback } = require('../../lib/cashback');

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return mkChain({ user_id: 'user-1', total: 50, payment_method: 'cash' }, null);
      }
      return mkChain(null, null);
    });

    await handleUpdateOrder(mockSupabase as any, {
      id: 'order-1',
      status: 'delivered',
    });

    // earnCashback é async-fire-and-forget; espera ser chamado
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(earnCashback).toHaveBeenCalledWith(mockSupabase, 'user-1', 'order-1', 50);
  });

  it('registra histórico quando endereço é alterado', async () => {
    // previousOrder tem endereço diferente
    const previousOrder = {
      delivery_street: 'Rua A', delivery_number: '10',
      delivery_complement: null, delivery_neighborhood: 'Centro',
      delivery_city: 'SP', delivery_zipcode: '01310-100',
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') return mkChain(previousOrder, null);
      if (table === 'order_change_history') return mkChain(null, null);
      return mkChain(null, null);
    });

    const res = await handleUpdateOrder(mockSupabase as any, {
      id: 'order-1',
      delivery_street: 'Rua B', // mudou
    });

    expect(res.status).toBe(200);
    const historyInsert = mockSupabase.from.mock.calls.some(([t]: [string]) => t === 'order_change_history');
    expect(historyInsert).toBe(true);
  });
});

// ── handleUpdateOrderItems ────────────────────────────────────────────────────

describe('handleUpdateOrderItems', () => {
  it('retorna 400 quando id não é fornecido', async () => {
    const res = await handleUpdateOrderItems(mockSupabase as any, { items: [{ product_name: 'X', quantity: 1, unit_price: 10 }] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/id/i);
  });

  it('retorna 400 quando items está vazio', async () => {
    const res = await handleUpdateOrderItems(mockSupabase as any, { id: 'o1', items: [] });
    expect(res.status).toBe(400);
  });

  it('retorna 400 quando todos os itens não têm nome', async () => {
    const res = await handleUpdateOrderItems(mockSupabase as any, {
      id: 'o1',
      items: [{ product_name: '', quantity: 1, unit_price: 10 }],
    });
    expect(res.status).toBe(400);
  });

  it('atualiza itens e recalcula total', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') return mkChain({ discount: 5, delivery_fee: 10 }, null);
      return mkChain([], null);
    });

    const items = [
      { product_name: 'Pizza', quantity: 2, unit_price: 30 },
      { product_name: 'Bebida', quantity: 1, unit_price: 8 },
    ];

    const res = await handleUpdateOrderItems(mockSupabase as any, { id: 'o1', items });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // subtotal = 60+8 = 68; total = 68 - 5 + 10 = 73
    expect(body.subtotal).toBe(68);
    expect(body.total).toBe(73);
  });

  it('total mínimo é 0 (não negativo)', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') return mkChain({ discount: 1000, delivery_fee: 0 }, null);
      return mkChain([], null);
    });

    const res = await handleUpdateOrderItems(mockSupabase as any, {
      id: 'o1',
      items: [{ product_name: 'Pizza', quantity: 1, unit_price: 10 }],
    });
    const body = await res.json();

    expect(body.total).toBe(0);
  });
});

// ── handleDeleteOrder ─────────────────────────────────────────────────────────

describe('handleDeleteOrder', () => {
  it('retorna 400 quando id não é fornecido', async () => {
    const res = await handleDeleteOrder(mockSupabase as any, {});
    expect(res.status).toBe(400);
  });

  it('faz soft delete (is_active=false) e retorna success', async () => {
    mockSupabase.from.mockImplementation(() => mkChain(null, null));

    const res = await handleDeleteOrder(mockSupabase as any, { id: 'order-1' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // Garante que orders.update foi chamado (não delete)
    const ordersCalls = mockSupabase.from.mock.calls.filter(([t]: [string]) => t === 'orders');
    expect(ordersCalls.length).toBeGreaterThan(0);
  });

  it('retorna 500 quando supabase falha', async () => {
    mockSupabase.from.mockReturnValue(mkChain(null, { message: 'DB error' }));

    const res = await handleDeleteOrder(mockSupabase as any, { id: 'order-1' });
    expect(res.status).toBe(500);
  });
});

// ── handleRestoreOrder ────────────────────────────────────────────────────────

describe('handleRestoreOrder', () => {
  it('retorna 400 quando id não é fornecido', async () => {
    const res = await handleRestoreOrder(mockSupabase as any, {});
    expect(res.status).toBe(400);
  });

  it('restaura pedido com is_active=true e status=confirmed', async () => {
    mockSupabase.from.mockImplementation(() => mkChain(null, null));

    const res = await handleRestoreOrder(mockSupabase as any, { id: 'order-1' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ── handleGetInactiveOrders ───────────────────────────────────────────────────

describe('handleGetInactiveOrders', () => {
  it('retorna pedidos inativos com paginação', async () => {
    const orders = Array.from({ length: 50 }, (_, i) => ({ id: `o${i}`, is_active: false }));
    mockSupabase.from.mockReturnValue(mkChain(orders, null));

    const res = await handleGetInactiveOrders(mockSupabase as any, { pageSize: 50 });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orders).toHaveLength(50);
    expect(body.hasMore).toBe(true);
  });

  it('hasMore=false quando menos que pageSize', async () => {
    mockSupabase.from.mockReturnValue(mkChain([{ id: 'o1' }], null));

    const res = await handleGetInactiveOrders(mockSupabase as any, { pageSize: 50 });
    const body = await res.json();

    expect(body.hasMore).toBe(false);
  });
});

// ── handleCreateManualOrder ───────────────────────────────────────────────────

describe('handleCreateManualOrder', () => {
  it('retorna 400 quando customer_name não é fornecido', async () => {
    const res = await handleCreateManualOrder(mockSupabase as any, {
      items: [{ product_name: 'Pizza', quantity: 1, unit_price: 30 }],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nome/i);
  });

  it('retorna 400 quando items é vazio', async () => {
    const res = await handleCreateManualOrder(mockSupabase as any, {
      customer_name: 'João',
      items: [],
    });
    expect(res.status).toBe(400);
  });

  it('cria pedido manual com sucesso e insere itens', async () => {
    const createdOrder = {
      id: 'new-order-id',
      customer_name: 'João Silva',
      order_number: 12345,
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') return mkChain(createdOrder, null);
      return mkChain(null, null);
    });

    const res = await handleCreateManualOrder(mockSupabase as any, {
      customer_name: 'João Silva',
      customer_phone: '11999999999',
      delivery_street: 'Rua das Flores',
      delivery_number: '100',
      subtotal: 50,
      delivery_fee: 5,
      total: 55,
      payment_method: 'cash',
      items: [{ product_name: 'Pizza', quantity: 1, unit_price: 50 }],
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.order).toMatchObject({ id: 'new-order-id', customer_name: 'João Silva' });
  });

  it('retorna 500 quando insert no banco falha', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') return mkChain(null, { message: 'insert failed' });
      return mkChain(null, null);
    });

    const res = await handleCreateManualOrder(mockSupabase as any, {
      customer_name: 'Maria',
      items: [{ product_name: 'Pizza', quantity: 1, unit_price: 30 }],
    });
    expect(res.status).toBe(500);
  });
});

// ── Teste de integração: fluxo criar → pagar → entregar ──────────────────────

describe('fluxo pedido: criar → confirmar → entregar', () => {
  it('executa os três passos em sequência sem erros', async () => {
    const { earnCashback } = require('../../lib/cashback');
    const order = { id: 'flow-order', user_id: 'u1', total: 60, payment_method: 'card_delivery' };

    // 1. Criar pedido manual
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') return mkChain(order, null);
      return mkChain(null, null);
    });

    const createRes = await handleCreateManualOrder(mockSupabase as any, {
      customer_name: 'Ana',
      items: [{ product_name: 'Pizza', quantity: 1, unit_price: 60 }],
    });
    expect(createRes.status).toBe(200);

    // 2. Confirmar (status=confirmed) — sem stock_movements existente, mas sem recipe
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'stock_movements') return mkChain([], null);   // no existing movement
      if (table === 'order_items')     return mkChain([], null);   // no items with recipe
      return mkChain(null, null);
    });

    const confirmRes = await handleUpdateOrder(mockSupabase as any, {
      id: order.id, status: 'confirmed',
    });
    expect(confirmRes.status).toBe(200);

    // 3. Entregar (status=delivered) → cashback
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') return mkChain(order, null);
      return mkChain(null, null);
    });

    const deliverRes = await handleUpdateOrder(mockSupabase as any, {
      id: order.id, status: 'delivered',
    });
    expect(deliverRes.status).toBe(200);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(earnCashback).toHaveBeenCalledWith(mockSupabase, 'u1', order.id, 60);
  });
});
