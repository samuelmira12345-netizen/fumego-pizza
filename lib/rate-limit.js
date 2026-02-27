/**
 * Rate limiter simples em memória.
 * Suficiente para instância única (Vercel Serverless). Para múltiplas instâncias,
 * substitua pelo Redis (ex: @upstash/ratelimit).
 */

const stores = new Map();

/** Remove entradas cuja janela já expirou (evita crescimento ilimitado do Map). */
function evictExpired(windowMs) {
  const now = Date.now();
  for (const [key, entry] of stores) {
    if (now - entry.windowStart > windowMs) stores.delete(key);
  }
}

/**
 * Verifica se a chave excedeu o limite de tentativas na janela de tempo.
 * @param {string} key         - Identificador (ex: IP + endpoint)
 * @param {number} maxAttempts - Número máximo de tentativas
 * @param {number} windowMs    - Janela em milissegundos
 * @returns {{ allowed: boolean, retryAfterMs: number }}
 */
export function checkRateLimit(key, maxAttempts = 5, windowMs = 60_000) {
  const now = Date.now();

  // Limpeza periódica: a cada 500 entradas para evitar acúmulo de memória
  if (stores.size > 500) evictExpired(windowMs);

  if (!stores.has(key)) {
    stores.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  const entry = stores.get(key);

  if (now - entry.windowStart > windowMs) {
    // Janela expirou — reset
    stores.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Extrai o IP do request do Next.js (App Router). */
export function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
