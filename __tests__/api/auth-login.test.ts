/**
 * Tests for POST /api/auth/login
 *
 * Mocks:
 *  - lib/supabase    → getSupabaseAdmin with chainable builder
 *  - lib/rate-limit  → checkRateLimit always allows (default), getClientIp → '127.0.0.1'
 *  - lib/cpf-crypto  → decryptCpf returns plain string
 *  - bcryptjs        → compare result controlled per test
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCompare = jest.fn<Promise<boolean>, [string, string]>();

jest.mock('bcryptjs', () => ({
  compare: (...args: [string, string]) => mockCompare(...args),
}));

jest.mock('../../lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
  getClientIp:    jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('../../lib/cpf-crypto', () => ({
  decryptCpf: (v: string) => v,
}));

// Minimal single-row query builder
function makeSingleBuilder(data: unknown | null, error: unknown | null) {
  return {
    select: () => makeSingleBuilder(data, error),
    eq:     () => makeSingleBuilder(data, error),
    single: () => Promise.resolve({ data, error }),
  };
}

const mockSupabaseClient = { from: jest.fn() };

jest.mock('../../lib/supabase', () => ({
  getSupabaseAdmin: () => mockSupabaseClient,
}));

import { POST } from '../../app/api/auth/login/route';
import { NextRequest } from 'next/server';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_USER = {
  id:            'user-uuid-1',
  email:         'joao@example.com',
  name:          'João Silva',
  password_hash: '$2b$12$hashedpassword',
  cpf:           null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL  = 'https://test.supabase.co';
    process.env.JWT_SECRET                = 'test-jwt-secret-32-chars-minimum!!';
  });

  it('returns 200 with token and user when credentials are valid', async () => {
    mockSupabaseClient.from.mockReturnValue(makeSingleBuilder(VALID_USER, null));
    mockCompare.mockResolvedValue(true);

    const response = await POST(makeRequest({ email: 'joao@example.com', password: 'senha123' }));
    const body     = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('token');
    expect(typeof body.token).toBe('string');
    expect(body.user).toMatchObject({ id: VALID_USER.id, email: VALID_USER.email });
    // password_hash must NOT be exposed
    expect(body.user).not.toHaveProperty('password_hash');
  });

  it('returns 401 when user is not found', async () => {
    mockSupabaseClient.from.mockReturnValue(
      makeSingleBuilder(null, { message: 'No rows found' })
    );

    const response = await POST(makeRequest({ email: 'inexistente@example.com', password: 'qualquer' }));
    const body     = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/email/i);
  });

  it('returns 401 when password is wrong', async () => {
    mockSupabaseClient.from.mockReturnValue(makeSingleBuilder(VALID_USER, null));
    mockCompare.mockResolvedValue(false);

    const response = await POST(makeRequest({ email: 'joao@example.com', password: 'senhaerrada' }));
    const body     = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/senha/i);
  });

  it('returns 400 when email is missing (Zod validation)', async () => {
    const response = await POST(makeRequest({ password: 'senha123' }));
    const body     = await response.json();

    expect(response.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when password is empty (Zod validation)', async () => {
    const response = await POST(makeRequest({ email: 'joao@example.com', password: '' }));
    const body     = await response.json();

    expect(response.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when email format is invalid (Zod validation)', async () => {
    const response = await POST(makeRequest({ email: 'nao-e-email', password: 'senha123' }));
    const body     = await response.json();

    expect(response.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { checkRateLimit } = require('../../lib/rate-limit');
    (checkRateLimit as jest.Mock).mockResolvedValueOnce({ allowed: false, retryAfterMs: 60_000 });

    const response = await POST(makeRequest({ email: 'joao@example.com', password: 'senha123' }));
    const body     = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(body).toHaveProperty('error');
  });
});
