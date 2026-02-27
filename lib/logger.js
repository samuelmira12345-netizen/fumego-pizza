/**
 * lib/logger.js — Logging estruturado para APIs Next.js.
 *
 * Emite JSON (em produção) ou texto legível (em desenvolvimento).
 * Para integrar com Sentry ou Datadog, adicione o SDK correspondente
 * dentro de logError() abaixo.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

function fmt(level, message, meta = {}) {
  if (IS_PROD) {
    return JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta });
  }
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `[${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  info(message, meta = {}) {
    console.log(fmt('info', message, meta));
  },
  warn(message, meta = {}) {
    console.warn(fmt('warn', message, meta));
  },
  error(message, errorOrMeta = {}) {
    const meta = errorOrMeta instanceof Error
      ? { error: errorOrMeta.message, stack: IS_PROD ? undefined : errorOrMeta.stack }
      : errorOrMeta;
    console.error(fmt('error', message, meta));
    // TODO: integrar Sentry aqui se necessário:
    // if (IS_PROD && errorOrMeta instanceof Error) Sentry.captureException(errorOrMeta);
  },
};
