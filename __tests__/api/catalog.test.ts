/**
 * Tests for GET /api/catalog
 *
 * Mocks:
 *  - lib/supabase  → getSupabaseAdmin returns a chainable Supabase-like mock
 *  - lib/catalog-visibility → pure functions, mocked to keep tests focused on
 *    the route's own logic (status codes, response shape, error handling)
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Minimal chainable builder: .from(t).select(f).order(c) / .eq(c,v) → Promise
function makeQueryBuilder(result: { data: unknown[] | null; error: unknown }) {
  const builder = {
    select: () => builder,
    order:  () => builder,
    eq:     () => builder,
    then: (resolve: (v: typeof result) => void) => resolve(result),
  };
  return builder;
}

const mockSupabaseClient = {
  from: jest.fn(),
};

jest.mock('../../lib/supabase', () => ({
  getSupabaseAdmin: () => mockSupabaseClient,
}));

jest.mock('../../lib/catalog-visibility', () => ({
  parseCatalogVisibilityOverrides: () => ({}),
  applyCatalogVisibilityOverrides: (_products: unknown[], _drinks: unknown[]) => ({
    products: _products,
    drinks:   _drinks,
  }),
}));

// next/server is available in the node environment via the installed next package
import { GET } from '../../app/api/catalog/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSuccessBuilder(data: unknown[]) {
  return makeQueryBuilder({ data, error: null });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/catalog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL  = 'https://test.supabase.co';
  });

  it('returns 200 with products, drinks and settings on success', async () => {
    const products = [{ id: '1', name: 'Pizza Margherita', is_hidden: false }];
    const drinks   = [{ id: '2', name: 'Coca-Cola', is_hidden: false, is_active: true }];
    const settings = [{ key: 'store_open', value: 'true' }];

    // Promise.all fires 5 queries in parallel; map each .from() call in order
    let callCount = 0;
    mockSupabaseClient.from.mockImplementation(() => {
      const fixtures = [products, drinks, settings, [], []];
      return makeSuccessBuilder(fixtures[callCount++] ?? []);
    });

    const response = await GET();
    const body     = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('products');
    expect(body).toHaveProperty('drinks');
    expect(body).toHaveProperty('settings');
    expect(body).toHaveProperty('productStock');
    expect(body).toHaveProperty('drinkStock');
    expect(body.products).toHaveLength(1);
    expect(body.drinks).toHaveLength(1);
  });

  it('filters out hidden products and inactive drinks', async () => {
    const products = [
      { id: '1', name: 'Visível',  is_hidden: false },
      { id: '2', name: 'Oculto',   is_hidden: true  },
    ];
    const drinks = [
      { id: '3', name: 'Ativa',   is_hidden: false, is_active: true  },
      { id: '4', name: 'Inativa', is_hidden: false, is_active: false },
      { id: '5', name: 'Oculta',  is_hidden: true,  is_active: true  },
    ];

    let callCount = 0;
    mockSupabaseClient.from.mockImplementation(() => {
      const fixtures = [products, drinks, [], [], []];
      return makeSuccessBuilder(fixtures[callCount++] ?? []);
    });

    const response = await GET();
    const body     = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toHaveLength(1);
    expect(body.products[0].name).toBe('Visível');
    expect(body.drinks).toHaveLength(1);
    expect(body.drinks[0].name).toBe('Ativa');
  });

  it('returns 500 when Supabase throws an error', async () => {
    mockSupabaseClient.from.mockImplementation(() => {
      throw new Error('connection refused');
    });

    const response = await GET();
    const body     = await response.json();

    expect(response.status).toBe(500);
    expect(body).toHaveProperty('error');
    expect(body.error).toBe('connection refused');
  });

  it('sets Cache-Control: no-store on successful response', async () => {
    let callCount = 0;
    mockSupabaseClient.from.mockImplementation(() => {
      return makeSuccessBuilder([]);
    });
    callCount; // suppress unused warning

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
