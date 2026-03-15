import { test, expect } from '@playwright/test';

/**
 * Smoke tests — Contratos de API e proteção CSRF
 *
 * Testa diretamente as rotas de API via HTTP (sem browser), usando o fixture
 * `request` do Playwright. Os testes verificam:
 *
 *  1. Contrato de entrada: a API rejeita payloads inválidos com os códigos
 *     HTTP corretos (400, 401, 404) antes de qualquer acesso ao banco.
 *
 *  2. Middleware CSRF: requisições POST com header Origin cruzado recebem 403;
 *     requisições com Authorization: Bearer são permitidas mesmo com Origin cruzado.
 *
 * Nota: testes que dependem de banco de dados real (ex.: login com credenciais
 * válidas) estão fora do escopo deste arquivo. O objetivo é garantir que a
 * camada de validação e os guards de segurança funcionam de forma determinística
 * sem dependências externas.
 */

// ── Helper: faz requisição JSON ao servidor local ─────────────────────────────

/** URL base do servidor — lida do config (default: http://localhost:3000) */
const BASE = process.env.BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

// ── Suite 1 — /api/auth/login ─────────────────────────────────────────────────

test.describe('POST /api/auth/login', () => {
  test('retorna 400 com body completamente vazio', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('retorna 400 sem campo email', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { password: 'qualquercoisa' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('retorna 400 sem campo password', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { email: 'user@example.com' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('retorna 400 com email em formato inválido', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { email: 'nao-e-um-email', password: 'abc123' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('retorna 401 com credenciais inexistentes (email não cadastrado)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: {
        email: 'naoexiste_smoke_test_99@fumego.test',
        password: 'SenhaQualquer123!',
      },
    });
    // 401 = email não encontrado
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ── Suite 2 — /api/checkout/create-order ─────────────────────────────────────

test.describe('POST /api/checkout/create-order', () => {
  test('retorna 400 com body vazio', async ({ request }) => {
    const res = await request.post(`${BASE}/api/checkout/create-order`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('retorna 400 sem campo items', async ({ request }) => {
    const res = await request.post(`${BASE}/api/checkout/create-order`, {
      data: {
        orderPayload: { customer_name: 'Teste', total: 50 },
        // items ausente
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('retorna 400 sem orderPayload', async ({ request }) => {
    const res = await request.post(`${BASE}/api/checkout/create-order`, {
      data: {
        items: [{ product_id: 'x', quantity: 1 }],
        // orderPayload ausente
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('retorna 400 com CPF inválido', async ({ request }) => {
    const res = await request.post(`${BASE}/api/checkout/create-order`, {
      data: {
        orderPayload: {
          customer_name: 'Smoke Test',
          customer_email: 'smoke@fumego.test',
          customer_phone: '11987654321',
          address_street: 'Rua Smoke',
          address_number: '1',
          address_neighborhood: 'Centro',
          address_city: 'São Paulo',
          address_state: 'SP',
          payment_method: 'cash',
          total: 50,
        },
        items: [{ product_id: 'smoke-prod', product_name: 'Pizza', quantity: 1, price: 50 }],
        cpf: '000.000.000-00', // CPF inválido
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/CPF/i);
  });
});

// ── Suite 3 — /api/create-payment ────────────────────────────────────────────

test.describe('POST /api/create-payment', () => {
  test('retorna 400 sem order_id', async ({ request }) => {
    const res = await request.post(`${BASE}/api/create-payment`, {
      data: {
        order_number: 9999,
        description: 'Teste smoke',
        payer_email: 'smoke@fumego.test',
        payer_name: 'Smoke Test',
      },
      // Sem order_id
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('retorna erro (400 ou 500) com order_id inexistente', async ({ request }) => {
    const res = await request.post(`${BASE}/api/create-payment`, {
      data: {
        order_id: '00000000-0000-0000-0000-000000000000',
        order_number: 9999,
        description: 'Teste smoke',
        payer_email: 'smoke@fumego.test',
        payer_name: 'Smoke Test',
      },
    });
    // Espera erro (pode ser 404 "pedido não encontrado", 400 "loja fechada" ou 500 "token não configurado")
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ── Suite 4 — /api/delivery/quote ────────────────────────────────────────────

test.describe('POST /api/delivery/quote', () => {
  test('retorna 200 ou 400 com payload mínimo (sem bairro nem CEP)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/delivery/quote`, {
      data: {
        street: 'Rua das Flores',
        number: '42',
        city: 'São Paulo',
        state: 'SP',
        // Sem neighborhood nem zipcode
      },
    });
    // Esperamos 400 "Informe pelo menos o bairro ou CEP" ou 400 de configuração
    // Em qualquer caso, deve retornar JSON com campo error ou fee
    const body = await res.json();
    if (res.status() === 400) {
      expect(body).toHaveProperty('error');
    } else {
      expect(res.status()).toBe(200);
      expect(body).toHaveProperty('fee');
    }
  });

  test('retorna JSON com campo fee ou error quando modo fixo está ativo', async ({ request }) => {
    // Quando não há delivery_radius_rules configurado, a API cai no modo fixo e retorna fee.
    // Em ambiente de teste sem banco, pode retornar 400 (endereço de origem não configurado).
    const res = await request.post(`${BASE}/api/delivery/quote`, {
      data: {
        street: 'Rua das Flores',
        number: '42',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipcode: '01310-100',
      },
    });
    // Aceita 200 (fee calculada) ou 400 (origem não configurada / fora da área)
    expect([200, 400]).toContain(res.status());
    const body = await res.json();
    // Em qualquer caso a resposta deve ser um objeto JSON válido com fee ou error
    const hasKnownField = 'fee' in body || 'error' in body;
    expect(hasKnownField).toBe(true);
  });
});

// ── Suite 5 — /api/payment-status/:orderId ────────────────────────────────────

test.describe('GET /api/payment-status/:orderId', () => {
  test('retorna 400 para ID com formato inválido', async ({ request }) => {
    const res = await request.get(`${BASE}/api/payment-status/nao-e-uuid-valido`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('retorna 404 para UUID válido mas pedido inexistente', async ({ request }) => {
    const res = await request.get(`${BASE}/api/payment-status/00000000-0000-0000-0000-000000000000`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/não encontrado/i);
  });

  test('retorna 400 para POST com action desconhecida', async ({ request }) => {
    const res = await request.post(`${BASE}/api/payment-status/00000000-0000-0000-0000-000000000001`, {
      data: { action: 'reembolso' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ── Suite 6 — Middleware CSRF ─────────────────────────────────────────────────

test.describe('Middleware CSRF — proteção de Origin', () => {
  /**
   * O middleware rejeita POST para /api/* quando o header Origin pertence a um
   * domínio diferente do host da aplicação (fumego.com.br ou localhost).
   * Exceções: rotas de webhook (assinatura própria) e Bearer token.
   */

  test('rejeita POST com Origin cruzado → 403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      headers: {
        'Origin': 'https://atacante.com',
        'Content-Type': 'application/json',
      },
      data: { email: 'smoke@test.com', password: '123' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/origem não permitida/i);
  });

  test('rejeita POST com Origin de subdomínio diferente → 403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/checkout/create-order`, {
      headers: {
        'Origin': 'https://malicioso.fumego.com.br',
        'Content-Type': 'application/json',
      },
      data: {},
    });
    expect(res.status()).toBe(403);
  });

  test('permite POST com Authorization: Bearer mesmo com Origin cruzado → não 403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      headers: {
        'Origin': 'https://atacante.com',
        'Authorization': 'Bearer token-qualquer',
        'Content-Type': 'application/json',
      },
      data: { email: 'smoke@fumego.test', password: 'abc' },
    });
    // Com Bearer token, o CSRF não bloqueia (retorna 400 ou 401, nunca 403 do CSRF)
    expect(res.status()).not.toBe(403);
  });

  test('permite POST sem header Origin (ex.: requisição server-to-server)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      headers: {
        // Sem Origin explícito
        'Content-Type': 'application/json',
      },
      data: { email: 'smoke@fumego.test', password: 'abc' },
    });
    // Sem Origin → passa pelo CSRF, vai para validação do schema (400) ou auth (401)
    expect(res.status()).not.toBe(403);
    expect([400, 401, 429]).toContain(res.status());
  });

  test('GET /api/payment-status nunca é bloqueado pelo CSRF (só POST/PUT/PATCH/DELETE)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/payment-status/nao-e-uuid`, {
      headers: {
        'Origin': 'https://atacante.com',
      },
    });
    // CSRF não se aplica a GET — deve passar e retornar 400 (ID inválido), não 403
    expect(res.status()).toBe(400);
    expect(res.status()).not.toBe(403);
  });

  test('webhook path não é bloqueado pelo CSRF mesmo com Origin cruzado', async ({ request }) => {
    // O webhook tem verificação de assinatura própria, não deve ser bloqueado pelo middleware CSRF
    const res = await request.post(`${BASE}/api/pix-webhook`, {
      headers: {
        'Origin': 'https://api.mercadopago.com',
        'Content-Type': 'application/json',
      },
      data: { type: 'payment', data: { id: '0' } },
    });
    // Não deve ser 403 do CSRF; pode ser 400/401/500 por falha de assinatura/validação
    expect(res.status()).not.toBe(403);
  });
});
