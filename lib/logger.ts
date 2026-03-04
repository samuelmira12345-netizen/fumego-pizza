/**
 * lib/logger.ts — Logging estruturado para APIs Next.js.
 *
 * Emite JSON (em produção) ou texto legível (em desenvolvimento).
 * Integração com Sentry: defina NEXT_PUBLIC_SENTRY_DSN nas variáveis de
 * ambiente e instale @sentry/nextjs (`npm i @sentry/nextjs`).
 */

const IS_PROD = process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'warn' | 'error';
type LogMeta = Record<string, unknown>;

function formatLog(level: LogLevel, message: string, meta: LogMeta = {}): string {
  if (IS_PROD) {
    return JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta });
  }
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `[${level.toUpperCase()}] ${message}${metaStr}`;
}

/** Captura exceção no Sentry se disponível (falha silenciosa se não instalado). */
async function captureException(err: Error): Promise<void> {
  if (!IS_PROD || !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(err);
  } catch {
    // @sentry/nextjs não instalado — ignorar silenciosamente
  }
}

export const logger = {
  info(message: string, meta: LogMeta = {}): void {
    console.log(formatLog('info', message, meta));
  },
  warn(message: string, meta: LogMeta = {}): void {
    console.warn(formatLog('warn', message, meta));
  },
  error(message: string, errorOrMeta: Error | LogMeta = {}): void {
    const meta: LogMeta = errorOrMeta instanceof Error
      ? { error: errorOrMeta.message, stack: IS_PROD ? undefined : errorOrMeta.stack }
      : errorOrMeta;
    console.error(formatLog('error', message, meta));
    if (errorOrMeta instanceof Error) {
      captureException(errorOrMeta);
    }
  },
};
