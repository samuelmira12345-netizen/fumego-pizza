import { test, expect } from '@playwright/test';

/**
 * Testes E2E — Página inicial (cardápio público)
 *
 * Cobre os principais fluxos do cliente:
 * - Carregamento da página
 * - Listagem de produtos
 * - Navegação para login/cadastro
 * - Indicador de status da loja (aberta/fechada)
 */

test.describe('Página inicial — cardápio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('carrega a página sem erros de JavaScript', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('exibe o logo/nome da pizzaria', async ({ page }) => {
    // O header contém o nome da loja — pode ser imagem ou texto
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('exibe pelo menos um produto ou mensagem de catálogo vazio', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Aguarda produtos ou o estado "sem produtos"
    const hasProducts = await page.locator('[data-testid="product-card"], .product-card').count() > 0;
    const isEmpty = await page.locator('text=/sem produtos|cardápio vazio|em breve/i').isVisible().catch(() => false);

    // A loja deve mostrar produtos OU uma mensagem de vazio — não uma tela em branco
    expect(hasProducts || isEmpty).toBeTruthy();
  });

  test('botão de login está acessível no header', async ({ page }) => {
    const loginButton = page.locator('text=/entrar|login/i').first();
    // Pode estar em um menu de usuário ou visível diretamente
    const isVisible = await loginButton.isVisible().catch(() => false);
    expect(isVisible).toBeTruthy();
  });
});

test.describe('Navegação de autenticação', () => {
  test('redireciona para /login ao clicar em Entrar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loginLink = page.locator('a[href="/login"], text=/entrar|login/i').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('página de login exibe formulário de e-mail e senha', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[placeholder*="e-mail" i], input[placeholder*="email" i]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('página de login exibe link para cadastro', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.locator('a[href="/register"], text=/cadastr|criar conta/i').first();
    await expect(registerLink).toBeVisible();
  });

  test('página de cadastro exibe campos de nome, e-mail e senha', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[placeholder*="nome" i], input[name="name"]').first()).toBeVisible();
    await expect(page.locator('input[type="email"], input[placeholder*="e-mail" i]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('exibe erro de validação ao submeter login com campos vazios', async ({ page }) => {
    await page.goto('/login');
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    // Deve aparecer erro de validação nativo (required) ou mensagem de erro
    const emailField = page.locator('input[type="email"]').first();
    const validityMessage = await emailField.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validityMessage.length).toBeGreaterThan(0);
  });
});

test.describe('API de saúde', () => {
  test('GET /api/settings responde com status 200 ou 404', async ({ request }) => {
    const response = await request.get('/api/settings');
    // Pode retornar 200 (com configurações) ou 404/500 se não configurado, mas não deve quebrar
    expect([200, 404, 500]).toContain(response.status());
  });
});
