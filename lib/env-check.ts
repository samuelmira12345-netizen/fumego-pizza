/**
 * Validação de variáveis de ambiente obrigatórias.
 * Importe este módulo nas rotas que dependem de cada variável,
 * ou no topo de lib/supabase.ts para falha imediata no boot.
 *
 * Em produção um erro de configuração é imediatamente visível nos logs
 * em vez de gerar falhas silenciosas em tempo de execução.
 */

interface EnvEntry {
  key: string;
  context: string;
}

const REQUIRED: EnvEntry[] = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL',    context: 'Supabase URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', context: 'Supabase anon key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY',   context: 'Supabase service role (server-side)' },
  { key: 'JWT_SECRET',                  context: 'Autenticação de usuários' },
  { key: 'ADMIN_PASSWORD',              context: 'Painel admin' },
  { key: 'CPF_ENCRYPTION_KEY',          context: 'Criptografia de CPF' },
  { key: 'MERCADO_PAGO_ACCESS_TOKEN',   context: 'Pagamentos Mercado Pago' },
  { key: 'MERCADO_PAGO_WEBHOOK_SECRET', context: 'Verificação de webhooks do Mercado Pago' },
  { key: 'RESEND_API_KEY',              context: 'Envio de e-mails' },
  { key: 'EMAIL_FROM',                  context: 'Remetente dos e-mails (ex: noreply@seudominio.com.br)' },
  { key: 'NEXT_PUBLIC_APP_URL',         context: 'URL pública da aplicação (para links nos e-mails)' },
  { key: 'ADMIN_JWT_SECRET',            context: 'Token de sessão do admin' },
];

/**
 * Variáveis opcionais da integração CardápioWeb.
 * A integração é desabilitada silenciosamente se não configuradas —
 * o app continua funcionando normalmente sem elas.
 *
 * CARDAPIOWEB_API_KEY        (obrigatório para a integração)
 * CARDAPIOWEB_API_URL        (opcional, padrão: produção)
 * CARDAPIOWEB_WEBHOOK_TOKEN  (opcional, mas recomendado)
 */

import { logger } from './logger'

let checked = false;

// Durante o build (next build), o Next.js define NEXT_PHASE como
// 'phase-production-build'. Nessa fase as env vars de runtime não
// estão disponíveis, então nunca lançamos erro — apenas avisamos.
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Verifica todas as variáveis de ambiente obrigatórias.
 * Lança um erro com lista completa de quais estão faltando.
 * Chame uma vez na inicialização (ex: em lib/supabase.ts ou em um route handler crítico).
 */
export function checkEnv(): void {
  if (checked) return; // Evita re-execução no hot-reload

  // NEXT_PUBLIC_* são acessíveis no client; as demais só no server.
  // Esta função deve ser chamada apenas server-side.
  const missing = REQUIRED.filter(({ key }) => !process.env[key]);

  if (missing.length > 0) {
    const list = missing.map(({ key, context }) => `  - ${key}  (${context})`).join('\n');
    const msg = `\n[FUMÊGO] Variáveis de ambiente obrigatórias não configuradas:\n${list}\n\nConfigure-as no .env.local (desenvolvimento) ou nas Environment Variables do Vercel (produção).`;

    // Durante o build ou em desenvolvimento: apenas avisa, não derruba
    // Em runtime de produção: gera erro imediato para diagnóstico rápido
    if (IS_BUILD_PHASE || process.env.NODE_ENV !== 'production') {
      logger.warn(msg);
    } else {
      throw new Error(msg);
    }
  }

  checked = true;
}

/**
 * Versão mais leve: verifica apenas uma chave específica.
 * Lança sempre (dev e prod) — use em funções que absolutamente necessitam da variável.
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`[FUMÊGO] Variável de ambiente obrigatória não configurada: ${key}`);
  return value;
}
