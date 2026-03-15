import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke tests — Fluxo de checkout → pagamento → confirmação
 *
 * Cobre os caminhos críticos de negócio sem depender de banco de dados real:
 * todas as chamadas de API externas são interceptadas via page.route() e
 * substituídas por respostas simuladas, tornando os testes determinísticos
 * e independentes de configuração de ambiente.
 *
 * Fluxos cobertos:
 *  1. Renderização do checkout com carrinho pré-carregado
 *  2. Validação de formulário (campos obrigatórios)
 *  3. Pagamento em dinheiro — do preenchimento à tela de "Pedido Enviado!"
 *  4. Pagamento em cartão na entrega
 *  5. Pagamento PIX — tela de QR Code exibida
 *  6. Pagamento PIX confirmado via polling → tela "Pagamento Confirmado!"
 *  7. Modal de confirmação pode ser descartado sem submeter
 *  8. Carrinho vazio redireciona para /teste
 */

// ── Dados de teste ────────────────────────────────────────────────────────────

const MOCK_CART = [
  {
    id: 'smoke-cart-1',
    product: {
      id: 'smoke-prod-1',
      name: 'Pizza Calabresa',
      slug: 'calabresa',
      price: '45.00',
    },
    option: null,
    drinks: [],
    observations: null,
  },
];

const MOCK_USER = {
  id: 'smoke-user-1',
  name: 'Cliente Smoke E2E',
  email: 'smoke@fumego.test',
  phone: '11987654321',
  cpf: '',
  address_street: 'Rua das Flores',
  address_number: '42',
  address_complement: '',
  address_neighborhood: 'Centro',
  address_city: 'São Paulo',
  address_state: 'SP',
  address_zipcode: '01310-100',
};

/** Pedido genérico retornado pelo mock de create-order */
const MOCK_ORDER_CASH = {
  id: 'smoke-order-cash',
  order_number: 9001,
  total: '53.00',
  status: 'pending',
  payment_method: 'cash',
  payment_status: 'pending',
};

const MOCK_ORDER_PIX = {
  ...MOCK_ORDER_CASH,
  id: 'smoke-order-pix',
  order_number: 9002,
  payment_method: 'pix',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Pré-carrega carrinho e usuário no localStorage e navega para /checkout.
 *
 * Não abre /checkout diretamente antes de setar o localStorage porque a página
 * redireciona imediatamente para /teste quando o carrinho está vazio — o que
 * aconteceria no primeiro render antes de setarmos os dados.
 */
async function setupCheckout(page: Page) {
  // Visita uma página neutra para ter acesso ao localStorage do domínio
  await page.goto('/');
  await page.evaluate(
    ({ cart, user }) => {
      localStorage.setItem('fumego_cart', JSON.stringify(cart));
      localStorage.setItem('fumego_user', JSON.stringify(user));
    },
    { cart: MOCK_CART, user: MOCK_USER },
  );
  await page.goto('/checkout');
  await page.waitForLoadState('networkidle');
}

/** Intercept padrão da API de cotação de entrega */
async function mockDeliveryQuote(page: Page) {
  await page.route('**/api/delivery/quote', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fee: 8.00, estimated_mins: 40 }),
    }),
  );
}

/** Intercept padrão de criação de pedido (retorna pedido em dinheiro) */
async function mockCreateOrder(page: Page, order = MOCK_ORDER_CASH) {
  await page.route('**/api/checkout/create-order', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ order }),
    }),
  );
}

/** Aguarda a taxa de entrega ser exibida (indica que o mock foi acionado) */
async function waitForDeliveryFee(page: Page) {
  await expect(
    page.locator('text=/R\\$.*8,00/').first(),
  ).toBeVisible({ timeout: 6000 });
}

// ── Suite 1 — Renderização e preenchimento ────────────────────────────────────

test.describe('Renderização e pré-preenchimento', () => {
  test.beforeEach(async ({ page }) => {
    await mockDeliveryQuote(page);
    await setupCheckout(page);
  });

  test('exibe o item do carrinho', async ({ page }) => {
    await expect(page.locator('text=Pizza Calabresa')).toBeVisible();
  });

  test('formula está pré-preenchida com os dados do usuário', async ({ page }) => {
    await expect(
      page.locator('input[placeholder="Nome completo *"]'),
    ).toHaveValue(MOCK_USER.name);

    await expect(
      page.locator('input[type="tel"]'),
    ).toHaveValue(MOCK_USER.phone);

    await expect(
      page.locator('input[placeholder="Rua / Avenida *"]'),
    ).toHaveValue(MOCK_USER.address_street);

    await expect(
      page.locator('input[placeholder="Bairro *"]'),
    ).toHaveValue(MOCK_USER.address_neighborhood);
  });

  test('exibe a taxa de entrega calculada', async ({ page }) => {
    await waitForDeliveryFee(page);
  });

  test('exibe o subtotal e o total no resumo de valores', async ({ page }) => {
    // Subtotal: R$ 45,00
    await expect(page.locator('text=/45,00/')).toBeVisible();
    // Total (subtotal + entrega): R$ 53,00
    await waitForDeliveryFee(page);
    await expect(page.locator('text=/53,00/').first()).toBeVisible();
  });
});

// ── Suite 2 — Validação de formulário ────────────────────────────────────────

test.describe('Validação de formulário', () => {
  test.beforeEach(async ({ page }) => {
    await mockDeliveryQuote(page);
    await setupCheckout(page);
    await waitForDeliveryFee(page);
  });

  test('exibe erro ao tentar finalizar com nome vazio', async ({ page }) => {
    await page.locator('input[placeholder="Nome completo *"]').clear();
    // Clica em qualquer botão de finalizar (texto depende da forma de pagamento selecionada)
    await page.locator('#checkout-submit button').click();
    await expect(
      page.locator('text=/Nome completo/i'),
    ).toBeVisible({ timeout: 3000 });
  });

  test('exibe erro ao tentar finalizar com telefone vazio', async ({ page }) => {
    await page.locator('input[type="tel"]').clear();
    await page.locator('#checkout-submit button').click();
    await expect(
      page.locator('text=/Telefone/i'),
    ).toBeVisible({ timeout: 3000 });
  });

  test('exibe erro ao tentar finalizar sem bairro', async ({ page }) => {
    await page.locator('input[placeholder="Bairro *"]').clear();
    await page.locator('#checkout-submit button').click();
    await expect(
      page.locator('text=/Bairro/i'),
    ).toBeVisible({ timeout: 3000 });
  });
});

// ── Suite 3 — Fluxo dinheiro (cash) ──────────────────────────────────────────

test.describe('Fluxo completo — pagamento em dinheiro', () => {
  test.beforeEach(async ({ page }) => {
    await mockDeliveryQuote(page);
    await mockCreateOrder(page, MOCK_ORDER_CASH);
    await setupCheckout(page);
    await waitForDeliveryFee(page);
  });

  test('abre modal de confirmação ao clicar em Finalizar', async ({ page }) => {
    await page.locator('text=Dinheiro').first().click();
    await page.locator('#checkout-submit button').click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#confirm-order-title')).toHaveText('Confirmar pedido?');
  });

  test('modal exibe resumo do carrinho e total', async ({ page }) => {
    await page.locator('text=Dinheiro').first().click();
    await page.locator('#checkout-submit button').click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    // Item do carrinho no modal
    await expect(modal.locator('text=Pizza Calabresa')).toBeVisible();
    // Total no modal
    await expect(modal.locator('text=/53,00/')).toBeVisible();
  });

  test('modal pode ser descartado com Voltar', async ({ page }) => {
    await page.locator('text=Dinheiro').first().click();
    await page.locator('#checkout-submit button').click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await modal.locator('button:has-text("Voltar")').click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
    // Permanece na página de checkout
    await expect(page.locator('text=Checkout')).toBeVisible();
  });

  test('pedido confirmado → exibe tela "Pedido Enviado!"', async ({ page }) => {
    await page.locator('text=Dinheiro').first().click();
    await page.locator('#checkout-submit button').click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.locator('button:has-text("Confirmar pedido")').click();

    await expect(
      page.locator('text=Pedido Enviado!'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('tela de sucesso exibe forma de pagamento e botão para voltar ao cardápio', async ({ page }) => {
    await page.locator('text=Dinheiro').first().click();
    await page.locator('#checkout-submit button').click();
    await page.locator('[role="dialog"] button:has-text("Confirmar pedido")').click();

    await expect(page.locator('text=Pedido Enviado!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Dinheiro na entrega/i')).toBeVisible();
    await expect(page.locator('button:has-text("Voltar ao Cardápio")')).toBeVisible();
  });
});

// ── Suite 4 — Fluxo cartão na entrega ────────────────────────────────────────

test.describe('Fluxo completo — cartão na entrega', () => {
  test.beforeEach(async ({ page }) => {
    await mockDeliveryQuote(page);
    await mockCreateOrder(page, { ...MOCK_ORDER_CASH, payment_method: 'card_delivery' });
    await setupCheckout(page);
    await waitForDeliveryFee(page);
  });

  test('pedido confirmado → exibe tela de sucesso com "Cartão na entrega"', async ({ page }) => {
    await page.locator('text=Cartão na entrega').first().click();
    await page.locator('#checkout-submit button').click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.locator('button:has-text("Confirmar pedido")').click();

    await expect(page.locator('text=Pedido Enviado!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Cartão na entrega/i')).toBeVisible();
  });
});

// ── Suite 5 — Fluxo PIX ───────────────────────────────────────────────────────

test.describe('Fluxo PIX — QR Code', () => {
  test.beforeEach(async ({ page }) => {
    await mockDeliveryQuote(page);
    await mockCreateOrder(page, MOCK_ORDER_PIX);

    await page.route('**/api/create-payment', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          payment_id: 'smoke-pix-id',
          qr_code:    '00020126580014br.gov.bcb.pix0136smoke-qr-code',
          qr_code_base64: '',
          status: 'pending',
        }),
      }),
    );

    await setupCheckout(page);
    await waitForDeliveryFee(page);
  });

  test('PIX é a forma de pagamento padrão', async ({ page }) => {
    // O botão de finalizar deve conter "PIX" por padrão
    await expect(
      page.locator('#checkout-submit button'),
    ).toContainText(/PIX/i);
  });

  test('exibe tela de QR Code após confirmar pedido PIX', async ({ page }) => {
    await page.locator('#checkout-submit button').click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.locator('button:has-text("Confirmar pedido")').click();

    await expect(
      page.locator('text=Pagamento via PIX'),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Copiar Código PIX')).toBeVisible();
  });

  test('exibe o código PIX copia-e-cola', async ({ page }) => {
    await page.locator('#checkout-submit button').click();
    await page.locator('[role="dialog"] button:has-text("Confirmar pedido")').click();

    await expect(page.locator('text=Pagamento via PIX')).toBeVisible({ timeout: 10000 });
    // O código PIX mock deve aparecer na tela
    await expect(
      page.locator('text=smoke-qr-code'),
    ).toBeVisible();
  });
});

// ── Suite 6 — PIX confirmado via polling ─────────────────────────────────────

test.describe('Fluxo PIX — pagamento confirmado via polling', () => {
  test('mostra "Pagamento Confirmado!" quando o status muda para approved', async ({ page }) => {
    await mockDeliveryQuote(page);
    await mockCreateOrder(page, MOCK_ORDER_PIX);

    await page.route('**/api/create-payment', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          payment_id: 'smoke-pix-polling',
          qr_code:    'smoke-qr-polling',
          qr_code_base64: '',
          status: 'pending',
        }),
      }),
    );

    // Mock de polling que retorna "approved" imediatamente
    await page.route('**/api/payment-status/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ payment_status: 'approved' }),
      }),
    );

    await setupCheckout(page);
    await waitForDeliveryFee(page);

    await page.locator('#checkout-submit button').click();
    await page.locator('[role="dialog"] button:has-text("Confirmar pedido")').click();

    // O polling começa assim que a tela PIX aparece; o mock retorna approved instantaneamente
    await expect(
      page.locator('text=Pagamento Confirmado!'),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.locator('button:has-text("Voltar ao Cardápio")'),
    ).toBeVisible();
  });
});

// ── Suite 7 — Carrinho vazio ──────────────────────────────────────────────────

test.describe('Carrinho vazio', () => {
  test('redireciona para /teste quando o carrinho está vazio', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('fumego_cart');
    });
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/teste/, { timeout: 5000 });
  });

  test('redireciona para /teste quando fumego_cart é um array vazio', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('fumego_cart', JSON.stringify([]));
    });
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/teste/, { timeout: 5000 });
  });
});

// ── Suite 8 — Resiliência de erros ────────────────────────────────────────────

test.describe('Tratamento de erros', () => {
  test('exibe mensagem de erro quando create-order retorna 500', async ({ page }) => {
    await mockDeliveryQuote(page);

    await page.route('**/api/checkout/create-order', route =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Erro interno de teste' }),
      }),
    );

    await setupCheckout(page);
    await waitForDeliveryFee(page);

    await page.locator('text=Dinheiro').first().click();
    await page.locator('#checkout-submit button').click();
    await page.locator('[role="dialog"] button:has-text("Confirmar pedido")').click();

    // Deve exibir o erro sem quebrar a página
    await expect(
      page.locator('text=/Erro interno de teste|Erro ao processar/i'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('exibe erro de PIX quando create-payment retorna erro', async ({ page }) => {
    await mockDeliveryQuote(page);
    await mockCreateOrder(page, MOCK_ORDER_PIX);

    await page.route('**/api/create-payment', route =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Token inválido ou expirado',
          details: 'Copie o Access Token novamente.',
        }),
      }),
    );

    await setupCheckout(page);
    await waitForDeliveryFee(page);

    await page.locator('#checkout-submit button').click();
    await page.locator('[role="dialog"] button:has-text("Confirmar pedido")').click();

    await expect(
      page.locator('text=Token inválido ou expirado'),
    ).toBeVisible({ timeout: 10000 });
    // Botão para fechar o erro deve estar disponível
    await expect(page.locator('button:has-text("Fechar")')).toBeVisible();
  });
});
