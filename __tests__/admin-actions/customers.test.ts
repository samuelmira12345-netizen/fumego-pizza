/**
 * Testes unitários para lib/admin-actions/customers.ts
 */

jest.mock('../../lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  handleGetCustomers,
  handleGetCustomerProfile,
  handleSearchPhoneSuffix,
} from '../../lib/admin-actions/customers';

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
});

// ── handleGetCustomers ────────────────────────────────────────────────────────

describe('handleGetCustomers', () => {
  it('agrega pedidos por telefone (chave principal)', async () => {
    const orders = [
      { id: 'o1', customer_name: 'João',  customer_phone: '11999', total: '50', status: 'delivered', created_at: '2024-01-10T10:00:00Z', delivery_neighborhood: 'Centro', delivery_city: 'SP' },
      { id: 'o2', customer_name: 'João',  customer_phone: '11999', total: '80', status: 'delivered', created_at: '2024-01-15T10:00:00Z', delivery_neighborhood: 'Centro', delivery_city: 'SP' },
      { id: 'o3', customer_name: 'Maria', customer_phone: '11888', total: '40', status: 'delivered', created_at: '2024-01-12T10:00:00Z', delivery_neighborhood: 'Jardins', delivery_city: 'SP' },
    ];
    mockSupabase.from.mockReturnValue(mkChain(orders, null));

    const res = await handleGetCustomers(mockSupabase as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    // João aparece 2 vezes → 1 entrada
    const joao = body.customers.find((c: any) => c.phone === '11999');
    expect(joao.orders).toBe(2);
    expect(joao.total_spent).toBeCloseTo(130);
    expect(joao.avg_ticket).toBeCloseTo(65);
  });

  it('exclui pedidos cancelados do total_spent', async () => {
    const orders = [
      { id: 'o1', customer_name: 'Ana', customer_phone: '11777', total: '60', status: 'delivered', created_at: '2024-01-10T10:00:00Z', delivery_neighborhood: null, delivery_city: null },
      { id: 'o2', customer_name: 'Ana', customer_phone: '11777', total: '40', status: 'cancelled', created_at: '2024-01-11T10:00:00Z', delivery_neighborhood: null, delivery_city: null },
    ];
    mockSupabase.from.mockReturnValue(mkChain(orders, null));

    const res = await handleGetCustomers(mockSupabase as any);
    const body = await res.json();

    const ana = body.customers.find((c: any) => c.phone === '11777');
    expect(ana.orders).toBe(2);           // conta todos os pedidos
    expect(ana.total_spent).toBeCloseTo(60); // mas só o delivered conta no valor
  });

  it('ordena clientes por número de pedidos (decrescente)', async () => {
    const orders = [
      // Maria: 3 pedidos
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `m${i}`, customer_name: 'Maria', customer_phone: '11888', total: '30',
        status: 'delivered', created_at: `2024-01-${10 + i}T10:00:00Z`,
        delivery_neighborhood: null, delivery_city: null,
      })),
      // João: 1 pedido
      { id: 'j1', customer_name: 'João', customer_phone: '11999', total: '50', status: 'delivered', created_at: '2024-01-10T10:00:00Z', delivery_neighborhood: null, delivery_city: null },
    ];
    mockSupabase.from.mockReturnValue(mkChain(orders, null));

    const res = await handleGetCustomers(mockSupabase as any);
    const body = await res.json();

    expect(body.customers[0].phone).toBe('11888'); // Maria primeiro
    expect(body.customers[1].phone).toBe('11999'); // João segundo
  });

  it('usa customer_name como chave quando phone está ausente', async () => {
    const orders = [
      { id: 'o1', customer_name: 'Semfone', customer_phone: null, total: '30', status: 'delivered', created_at: '2024-01-10T10:00:00Z', delivery_neighborhood: null, delivery_city: null },
    ];
    mockSupabase.from.mockReturnValue(mkChain(orders, null));

    const res = await handleGetCustomers(mockSupabase as any);
    const body = await res.json();

    expect(body.customers[0].name).toBe('Semfone');
  });

  it('retorna 500 quando supabase falha', async () => {
    mockSupabase.from.mockReturnValue(mkChain(null, { message: 'DB error' }));

    const res = await handleGetCustomers(mockSupabase as any);
    expect(res.status).toBe(500);
  });
});

// ── handleGetCustomerProfile ──────────────────────────────────────────────────

describe('handleGetCustomerProfile', () => {
  it('retorna 400 quando phone não é fornecido', async () => {
    const res = await handleGetCustomerProfile(mockSupabase as any, {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/phone/i);
  });

  it('retorna pedidos e topItems com sucesso', async () => {
    const orders = [
      { id: 'o1', order_number: 1, total: '50', status: 'delivered', created_at: '2024-01-10T14:00:00Z', payment_method: 'cash', delivery_neighborhood: 'Centro' },
      { id: 'o2', order_number: 2, total: '30', status: 'delivered', created_at: '2024-01-11T20:00:00Z', payment_method: 'pix',  delivery_neighborhood: 'Centro' },
    ];
    const items = [
      { product_name: 'Pizza Margherita', quantity: 2 },
      { product_name: 'Pizza Margherita', quantity: 1 },
      { product_name: 'Refrigerante',     quantity: 1 },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders')      return mkChain(orders, null);
      if (table === 'order_items') return mkChain(items, null);
      return mkChain(null, null);
    });

    const res = await handleGetCustomerProfile(mockSupabase as any, { phone: '11999' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orders).toHaveLength(2);
    expect(body.topItems[0].name).toBe('Pizza Margherita');
    expect(body.topItems[0].qty).toBe(3); // 2 + 1
    expect(body.topItems[1].name).toBe('Refrigerante');
    expect(body.topItems).toHaveLength(2);
  });

  it('limita topItems a 5 produtos', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      product_name: `Produto ${i}`, quantity: 10 - i, // cada com quantidade única
    }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders')      return mkChain([{ id: 'o1', created_at: '2024-01-10T10:00:00Z' }], null);
      if (table === 'order_items') return mkChain(items, null);
      return mkChain(null, null);
    });

    const res = await handleGetCustomerProfile(mockSupabase as any, { phone: '11999' });
    const body = await res.json();

    expect(body.topItems).toHaveLength(5);
    // Primeiro deve ser o de maior quantidade
    expect(body.topItems[0].qty).toBe(10);
  });

  it('identifica peakHour corretamente', async () => {
    // Dois pedidos às 14h, um às 20h → peakHour = '14'
    const orders = [
      { id: 'o1', order_number: 1, total: '50', status: 'delivered', payment_method: 'cash', delivery_neighborhood: 'Centro',
        created_at: new Date('2024-01-10T14:30:00-03:00').toISOString() },
      { id: 'o2', order_number: 2, total: '30', status: 'delivered', payment_method: 'pix',  delivery_neighborhood: 'Centro',
        created_at: new Date('2024-01-11T14:15:00-03:00').toISOString() },
      { id: 'o3', order_number: 3, total: '25', status: 'delivered', payment_method: 'cash', delivery_neighborhood: 'Centro',
        created_at: new Date('2024-01-12T20:00:00-03:00').toISOString() },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders')      return mkChain(orders, null);
      if (table === 'order_items') return mkChain([], null);
      return mkChain(null, null);
    });

    const res = await handleGetCustomerProfile(mockSupabase as any, { phone: '11999' });
    const body = await res.json();

    expect(body.peakHour).toBe('14');
  });

  it('retorna topItems vazio quando cliente não tem pedidos anteriores', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders')      return mkChain([], null);
      if (table === 'order_items') return mkChain([], null);
      return mkChain(null, null);
    });

    const res = await handleGetCustomerProfile(mockSupabase as any, { phone: '11000000000' });
    const body = await res.json();

    expect(body.orders).toHaveLength(0);
    expect(body.topItems).toHaveLength(0);
    expect(body.peakHour).toBeNull();
  });
});

// ── handleSearchPhoneSuffix ───────────────────────────────────────────────────

describe('handleSearchPhoneSuffix', () => {
  it('retorna lista vazia quando suffix tem menos de 4 dígitos', async () => {
    const res = await handleSearchPhoneSuffix(mockSupabase as any, { suffix: '123' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.customers).toEqual([]);
    // Não deve ter chamado o banco
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('retorna lista vazia quando suffix é undefined', async () => {
    const res = await handleSearchPhoneSuffix(mockSupabase as any, {});
    expect((await res.json()).customers).toEqual([]);
  });

  it('deduplica por telefone, mantendo o mais recente', async () => {
    const rows = [
      { customer_name: 'João', customer_phone: '11999990001', delivery_neighborhood: 'Centro', delivery_city: 'SP', delivery_street: 'Rua A', delivery_number: '10', created_at: '2024-01-15T10:00:00Z' },
      { customer_name: 'João', customer_phone: '11999990001', delivery_neighborhood: 'Centro', delivery_city: 'SP', delivery_street: 'Rua B', delivery_number: '20', created_at: '2024-01-10T10:00:00Z' },
      { customer_name: 'Maria', customer_phone: '11888880001', delivery_neighborhood: 'Jardins', delivery_city: 'SP', delivery_street: 'Av C', delivery_number: '5', created_at: '2024-01-14T10:00:00Z' },
    ];
    mockSupabase.from.mockReturnValue(mkChain(rows, null));

    const res = await handleSearchPhoneSuffix(mockSupabase as any, { suffix: '0001' });
    const body = await res.json();

    expect(res.status).toBe(200);
    // João aparece 2x mas é deduplicado → 2 clientes únicos
    expect(body.customers).toHaveLength(2);
  });

  it('retorna no máximo 8 resultados', async () => {
    // 10 clientes diferentes
    const rows = Array.from({ length: 10 }, (_, i) => ({
      customer_name: `Cliente ${i}`,
      customer_phone: `1199999${String(i).padStart(4, '0')}`,
      delivery_neighborhood: null, delivery_city: null,
      delivery_street: null, delivery_number: null,
      created_at: `2024-01-${10 + i}T10:00:00Z`,
    }));
    mockSupabase.from.mockReturnValue(mkChain(rows, null));

    const res = await handleSearchPhoneSuffix(mockSupabase as any, { suffix: '9999' });
    const body = await res.json();

    expect(body.customers.length).toBeLessThanOrEqual(8);
  });

  it('retorna 500 quando supabase falha', async () => {
    mockSupabase.from.mockReturnValue(mkChain(null, { message: 'DB error' }));

    const res = await handleSearchPhoneSuffix(mockSupabase as any, { suffix: '9999' });
    expect(res.status).toBe(500);
  });
});
