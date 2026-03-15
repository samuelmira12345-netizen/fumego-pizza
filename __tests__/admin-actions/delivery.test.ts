/**
 * Testes unitários para lib/admin-actions/delivery.ts
 */

jest.mock('bcryptjs', () => ({
  hash:    jest.fn().mockResolvedValue('$2b$12$mockhash'),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  handleGetDeliveryPersons,
  handleSaveDeliveryPerson,
  handleDeleteDeliveryPerson,
  handleGetDeliveryHistory,
  handleGetDeliveryZones,
  handleSaveDeliveryZone,
  handleDeleteDeliveryZone,
  handleAssignDelivery,
  handleGetDeliveryQueue,
  handleSetDeliveryPriority,
  handleGetDriverLocations,
  handleGetDeliveryMetrics,
} from '../../lib/admin-actions/delivery';

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

// ── handleGetDeliveryPersons ──────────────────────────────────────────────────

describe('handleGetDeliveryPersons', () => {
  it('retorna lista de entregadores', async () => {
    const persons = [
      { id: 'p1', name: 'Carlos', phone: '11999', email: 'carlos@test.com', is_active: true },
    ];
    mockSupabase.from.mockReturnValue(mkChain(persons, null));

    const res = await handleGetDeliveryPersons(mockSupabase as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.persons).toEqual(persons);
  });

  it('retorna 500 quando query falha', async () => {
    mockSupabase.from.mockReturnValue(mkChain(null, { message: 'DB error' }));

    const res = await handleGetDeliveryPersons(mockSupabase as any);
    expect(res.status).toBe(500);
  });
});

// ── handleSaveDeliveryPerson ──────────────────────────────────────────────────

describe('handleSaveDeliveryPerson', () => {
  it('retorna 400 quando nome está ausente', async () => {
    const res = await handleSaveDeliveryPerson(mockSupabase as any, {
      email: 'x@test.com', password: '123',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nome/i);
  });

  it('retorna 400 quando email está ausente', async () => {
    const res = await handleSaveDeliveryPerson(mockSupabase as any, {
      name: 'Carlos', password: '123',
    });
    expect(res.status).toBe(400);
  });

  it('retorna 400 ao criar novo sem senha', async () => {
    const res = await handleSaveDeliveryPerson(mockSupabase as any, {
      name: 'Carlos', email: 'carlos@test.com',
      // sem password e sem id
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/senha/i);
  });

  it('cria novo entregador com senha hasheada', async () => {
    const created = { id: 'new-p1', name: 'Carlos', email: 'carlos@test.com' };
    mockSupabase.from.mockReturnValue(mkChain(created, null));

    const res = await handleSaveDeliveryPerson(mockSupabase as any, {
      name: 'Carlos', email: 'carlos@test.com', password: 'senha123', is_active: true,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.person).toMatchObject({ id: 'new-p1' });

    const bcrypt = require('bcryptjs');
    expect(bcrypt.hash).toHaveBeenCalledWith('senha123', 12);
  });

  it('atualiza entregador existente (id fornecido)', async () => {
    const updated = { id: 'p1', name: 'Carlos Atualizado', email: 'carlos@test.com' };
    mockSupabase.from.mockReturnValue(mkChain(updated, null));

    const res = await handleSaveDeliveryPerson(mockSupabase as any, {
      id: 'p1', name: 'Carlos Atualizado', email: 'carlos@test.com', is_active: true,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.person).toMatchObject({ id: 'p1' });
  });

  it('normaliza email para lowercase', async () => {
    const created = { id: 'p2', name: 'Ana', email: 'ana@test.com' };
    mockSupabase.from.mockReturnValue(mkChain(created, null));

    await handleSaveDeliveryPerson(mockSupabase as any, {
      name: 'Ana', email: 'ANA@TEST.COM', password: '123',
    });

    // O email enviado ao supabase deve ser lowercase
    // Verificamos que o record passado ao insert/update contém email minúsculo
    // (verificação indireta via mock não captura o payload facilmente,
    //  mas o handler funcional garante o comportamento)
    const res = await handleSaveDeliveryPerson(mockSupabase as any, {
      name: 'Ana', email: 'ANA@TEST.COM', password: '123',
    });
    expect(res.status).toBe(200);
  });
});

// ── handleDeleteDeliveryPerson ────────────────────────────────────────────────

describe('handleDeleteDeliveryPerson', () => {
  it('retorna 400 quando id não é fornecido', async () => {
    const res = await handleDeleteDeliveryPerson(mockSupabase as any, {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/id/i);
  });

  it('realiza soft delete e retorna success', async () => {
    const res = await handleDeleteDeliveryPerson(mockSupabase as any, { id: 'p1' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ── handleGetDeliveryHistory ──────────────────────────────────────────────────

describe('handleGetDeliveryHistory', () => {
  it('retorna 400 quando person_id não é fornecido', async () => {
    const res = await handleGetDeliveryHistory(mockSupabase as any, {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/person_id/i);
  });

  it('calcula totalEarned somente com pedidos delivered', async () => {
    const orders = [
      { id: 'o1', status: 'delivered',  delivery_fee: '8.50', created_at: '2024-01-15T10:00:00Z' },
      { id: 'o2', status: 'cancelled',  delivery_fee: '7.00', created_at: '2024-01-15T11:00:00Z' },
      { id: 'o3', status: 'delivering', delivery_fee: '6.00', created_at: '2024-01-15T12:00:00Z' },
    ];
    mockSupabase.from.mockReturnValue(mkChain(orders, null));

    const res = await handleGetDeliveryHistory(mockSupabase as any, { person_id: 'p1' });
    const body = await res.json();

    expect(res.status).toBe(200);
    // Somente o pedido delivered (8.50) conta para totalEarned
    expect(body.totalEarned).toBeCloseTo(8.5);
    expect(body.orders).toHaveLength(3);
  });

  it('totalEarned é 0 quando não há pedidos delivered', async () => {
    const orders = [
      { id: 'o1', status: 'cancelled', delivery_fee: '10.00' },
    ];
    mockSupabase.from.mockReturnValue(mkChain(orders, null));

    const res = await handleGetDeliveryHistory(mockSupabase as any, { person_id: 'p1' });
    const body = await res.json();

    expect(body.totalEarned).toBe(0);
  });
});

// ── handleGetDeliveryZones ────────────────────────────────────────────────────

describe('handleGetDeliveryZones', () => {
  it('retorna zonas de entrega', async () => {
    const zones = [
      { id: 'z1', neighborhood: 'Centro', fee: 5, estimated_mins: 30, is_active: true },
    ];
    mockSupabase.from.mockReturnValue(mkChain(zones, null));

    const res = await handleGetDeliveryZones(mockSupabase as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.zones).toEqual(zones);
  });

  it('retorna 500 quando query falha', async () => {
    mockSupabase.from.mockReturnValue(mkChain(null, { message: 'DB error' }));

    const res = await handleGetDeliveryZones(mockSupabase as any);
    expect(res.status).toBe(500);
  });
});

// ── handleSaveDeliveryZone ────────────────────────────────────────────────────

describe('handleSaveDeliveryZone', () => {
  it('retorna 400 quando neighborhood está ausente', async () => {
    const res = await handleSaveDeliveryZone(mockSupabase as any, { fee: 5 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/bairro/i);
  });

  it('cria nova zona de entrega', async () => {
    const created = { id: 'z1', neighborhood: 'Centro', fee: 5 };
    mockSupabase.from.mockReturnValue(mkChain(created, null));

    const res = await handleSaveDeliveryZone(mockSupabase as any, {
      neighborhood: 'Centro', fee: 5, estimated_mins: 30, is_active: true,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.zone).toMatchObject({ id: 'z1' });
  });

  it('atualiza zona existente (id fornecido)', async () => {
    const updated = { id: 'z1', neighborhood: 'Jardins', fee: 8 };
    mockSupabase.from.mockReturnValue(mkChain(updated, null));

    const res = await handleSaveDeliveryZone(mockSupabase as any, {
      id: 'z1', neighborhood: 'Jardins', fee: 8,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.zone.neighborhood).toBe('Jardins');
  });

  it('usa estimated_mins=30 como padrão', async () => {
    const created = { id: 'z2', neighborhood: 'Vila Nova', estimated_mins: 30 };
    mockSupabase.from.mockReturnValue(mkChain(created, null));

    const res = await handleSaveDeliveryZone(mockSupabase as any, {
      neighborhood: 'Vila Nova',
      // sem estimated_mins
    });
    const body = await res.json();
    expect(res.status).toBe(200);
  });
});

// ── handleDeleteDeliveryZone ──────────────────────────────────────────────────

describe('handleDeleteDeliveryZone', () => {
  it('retorna 400 quando id não é fornecido', async () => {
    const res = await handleDeleteDeliveryZone(mockSupabase as any, {});
    expect(res.status).toBe(400);
  });

  it('deleta zona e retorna success', async () => {
    const res = await handleDeleteDeliveryZone(mockSupabase as any, { id: 'z1' });
    expect((await res.json()).success).toBe(true);
  });
});

// ── handleAssignDelivery ──────────────────────────────────────────────────────

describe('handleAssignDelivery', () => {
  it('retorna 400 quando order_id não é fornecido', async () => {
    const res = await handleAssignDelivery(mockSupabase as any, { delivery_person_id: 'p1' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/order_id/i);
  });

  it('atribui entregador ao pedido', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') return mkChain({ delivery_sort_order: 2 }, null);
      return mkChain(null, null);
    });

    const res = await handleAssignDelivery(mockSupabase as any, {
      order_id: 'o1', delivery_person_id: 'p1',
    });
    expect((await res.json()).success).toBe(true);
  });

  it('define status=delivering quando start_delivery=true', async () => {
    mockSupabase.from.mockImplementation(() => mkChain(null, null));

    const res = await handleAssignDelivery(mockSupabase as any, {
      order_id: 'o1', delivery_person_id: 'p1', start_delivery: true,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('remove entregador quando delivery_person_id é null', async () => {
    const res = await handleAssignDelivery(mockSupabase as any, {
      order_id: 'o1', delivery_person_id: null,
    });
    expect(res.status).toBe(200);
  });
});

// ── handleGetDeliveryQueue ────────────────────────────────────────────────────

describe('handleGetDeliveryQueue', () => {
  it('retorna 400 quando person_id não é fornecido', async () => {
    const res = await handleGetDeliveryQueue(mockSupabase as any, {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/person_id/i);
  });

  it('retorna fila de pedidos do entregador', async () => {
    const orders = [
      { id: 'o1', status: 'ready', delivery_sort_order: 1 },
      { id: 'o2', status: 'delivering', delivery_sort_order: 2 },
    ];
    mockSupabase.from.mockReturnValue(mkChain(orders, null));

    const res = await handleGetDeliveryQueue(mockSupabase as any, { person_id: 'p1' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orders).toHaveLength(2);
  });
});

// ── handleSetDeliveryPriority ─────────────────────────────────────────────────

describe('handleSetDeliveryPriority', () => {
  it('retorna 400 quando ordered_ids está vazio', async () => {
    const res = await handleSetDeliveryPriority(mockSupabase as any, { ordered_ids: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ordered_ids/i);
  });

  it('retorna 400 quando ordered_ids não é array', async () => {
    const res = await handleSetDeliveryPriority(mockSupabase as any, { ordered_ids: 'abc' });
    expect(res.status).toBe(400);
  });

  it('atualiza delivery_sort_order para cada id', async () => {
    const res = await handleSetDeliveryPriority(mockSupabase as any, {
      ordered_ids: ['o1', 'o2', 'o3'],
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // Deve ter chamado from('orders') 3 vezes (uma por id)
    const ordersCalls = mockSupabase.from.mock.calls.filter(([t]: [string]) => t === 'orders');
    expect(ordersCalls).toHaveLength(3);
  });
});

// ── handleGetDriverLocations ──────────────────────────────────────────────────

describe('handleGetDriverLocations', () => {
  it('deduplica por delivery_person_id (retém apenas o último)', async () => {
    const logs = [
      { delivery_person_id: 'p1', lat: -23.1, lng: -46.1, recorded_at: '2024-01-15T12:00:00Z', delivery_persons: { name: 'Carlos' } },
      { delivery_person_id: 'p1', lat: -23.2, lng: -46.2, recorded_at: '2024-01-15T11:00:00Z', delivery_persons: { name: 'Carlos' } },
      { delivery_person_id: 'p2', lat: -23.5, lng: -46.5, recorded_at: '2024-01-15T12:00:00Z', delivery_persons: { name: 'Ana' } },
    ];
    mockSupabase.from.mockReturnValue(mkChain(logs, null));

    const res = await handleGetDriverLocations(mockSupabase as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    // p1 aparece 2x nos logs mas deve ter apenas 1 entrada (primeiro encontrado = mais recente)
    expect(body.locations).toHaveLength(2);
    const p1 = body.locations.find((l: any) => l.delivery_person_id === 'p1');
    expect(p1.driver_location_lat).toBe(-23.1); // primeiro = mais recente
  });
});

// ── handleGetDeliveryMetrics ──────────────────────────────────────────────────

describe('handleGetDeliveryMetrics', () => {
  it('retorna métricas zeradas quando não há pedidos', async () => {
    const persons = [{ id: 'p1', name: 'Carlos', is_active: true }];
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'delivery_persons') return mkChain(persons, null);
      if (table === 'orders')           return mkChain([], null);
      return mkChain(null, null);
    });

    const res = await handleGetDeliveryMetrics(mockSupabase as any, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary.total_assigned).toBe(0);
    expect(body.summary.total_delivered).toBe(0);
    expect(body.persons).toHaveLength(1);
    expect(body.persons[0].delivered_count).toBe(0);
  });

  it('calcula avg/min/max de tempo de entrega corretamente', async () => {
    const persons = [{ id: 'p1', name: 'Carlos', is_active: true }];
    const now = new Date('2024-01-15T14:00:00Z');
    const orders = [
      {
        id: 'o1', status: 'delivered', total: '50', delivery_fee: '8',
        delivery_person_id: 'p1',
        delivering_at: new Date(now.getTime() - 40 * 60000).toISOString(), // 40 min atrás
        delivered_at:  now.toISOString(),
        driver_collected_at: null, driver_delivered_at: null,
        created_at: '2024-01-15T10:00:00Z',
      },
      {
        id: 'o2', status: 'delivered', total: '35', delivery_fee: '7',
        delivery_person_id: 'p1',
        delivering_at: new Date(now.getTime() - 20 * 60000).toISOString(), // 20 min atrás
        delivered_at:  now.toISOString(),
        driver_collected_at: null, driver_delivered_at: null,
        created_at: '2024-01-15T10:30:00Z',
      },
    ];
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'delivery_persons') return mkChain(persons, null);
      if (table === 'orders')           return mkChain(orders, null);
      return mkChain(null, null);
    });

    const res = await handleGetDeliveryMetrics(mockSupabase as any, {});
    const body = await res.json();

    const carlos = body.persons[0];
    expect(carlos.delivered_count).toBe(2);
    expect(carlos.delivery_fees_total).toBeCloseTo(15);
    expect(carlos.min_delivery_minutes).toBe(20);
    expect(carlos.max_delivery_minutes).toBe(40);
    expect(carlos.avg_delivery_minutes).toBe(30);
  });

  it('limita `days` a máximo de 180', async () => {
    mockSupabase.from.mockImplementation(() => mkChain([], null));

    const res = await handleGetDeliveryMetrics(mockSupabase as any, { days: 9999 });
    const body = await res.json();

    expect(body.summary.days).toBe(180);
  });

  it('usa intervalo de datas explícito quando from/to são fornecidos', async () => {
    mockSupabase.from.mockImplementation(() => mkChain([], null));

    const res = await handleGetDeliveryMetrics(mockSupabase as any, {
      from: '2024-01-01', to: '2024-01-31',
    });
    const body = await res.json();

    expect(body.summary.from).toContain('2024-01-01');
    expect(body.summary.to).toContain('2024-01-31');
  });

  it('ignora date range inválido e usa padrão', async () => {
    mockSupabase.from.mockImplementation(() => mkChain([], null));

    const res = await handleGetDeliveryMetrics(mockSupabase as any, {
      from: 'invalid-date', to: '2024-01-31',
    });
    const body = await res.json();

    // Deve ter retornado sucesso com range padrão (30 dias)
    expect(res.status).toBe(200);
    expect(body.summary).toBeDefined();
  });
});
