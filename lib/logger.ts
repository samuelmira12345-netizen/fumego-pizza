/**
 * lib/logger.ts — Logging estruturado para APIs Next.js.
 *
 * Emite JSON (em produção) ou texto legível (em desenvolvimento).
 * Para integrar com Sentry ou Datadog, adicione o SDK correspondente
 * dentro de logError() abaixo.
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
    // TODO: integrar Sentry aqui se necessário:
    // if (IS_PROD && errorOrMeta instanceof Error) Sentry.captureException(errorOrMeta);
  },
};
