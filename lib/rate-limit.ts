/**
 * Rate limiter híbrido com três níveis de fallback:
 *   1. Upstash Redis REST API (distribuído, sem latência extra de DB)
 *   2. Supabase rate_limit_log (distribuído, fallback se Upstash não configurado)
 *   3. In-memory Map (single-instance fallback, último recurso)
 *
 * Para usar Upstash (recomendado):
 *   Adicione ao Vercel → Settings → Environment Variables:
 *     UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
 *     UPSTASH_REDIS_REST_TOKEN=AXxx...
 *   Crie um banco Redis em https://console.upstash.com (plano gratuito suficiente)
 *
 * Para usar Supabase (alternativa):
 *   Execute no Supabase SQL Editor:
 *   CREATE TABLE IF NOT EXISTS rate_limit_log (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     key TEXT NOT NULL,
 *     attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_rate_limit_log_key_at
 *     ON rate_limit_log (key, attempted_at);
 *   ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "service role only" ON rate_limit_log
 *     USING (false) WITH CHECK (false);
 */

// ── 1. Upstash Redis (janela fixa via INCR + EXPIRE) ─────────────────────────

async function checkRateLimitUpstash(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash não configurado');

  // Janela fixa: bucket muda a cada windowMs milissegundos
  const bucket = Math.floor(Date.now() / windowMs);
  const redisKey = `rl:${key}:${bucket}`;
  const ttlSec = Math.ceil((windowMs * 2) / 1000);

  // Pipeline: INCR + EXPIRE num único request HTTP
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['EXPIRE', redisKey, ttlSec],
    ]),
  });

  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);

  // Upstash pipeline retorna [{ result: N, error: null }, { result: 1, error: null }]
  const [{ result: count }] = await res.json() as [{ result: number; error: string | null }];

  if (count > maxAttempts) {
    // Tempo até o fim da janela atual
    const windowEnd = (bucket + 1) * windowMs;
    const retryAfterMs = Math.max(0, windowEnd - Date.now());
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true, retryAfterMs: 0 };
}

// ── 2. Supabase rate_limit_log (fallback distribuído) ────────────────────────

async function checkRateLimitSupabase(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const { getSupabaseAdmin } = await import('./supabase');
  const supabase = getSupabaseAdmin();

  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const { count, error: countErr } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('attempted_at', windowStart);

  if (countErr) throw countErr;

  const attempts = count ?? 0;

  if (attempts >= maxAttempts) {
    const { data: oldest } = await supabase
      .from('rate_limit_log')
      .select('attempted_at')
      .eq('key', key)
      .gte('attempted_at', windowStart)
      .order('attempted_at', { ascending: true })
      .limit(1)
      .single();

    const oldestAt = oldest?.attempted_at
      ? new Date(oldest.attempted_at).getTime()
      : Date.now() - windowMs;

    const retryAfterMs = Math.max(0, windowMs - (Date.now() - oldestAt));
    return { allowed: false, retryAfterMs };
  }

  await supabase.from('rate_limit_log').insert({ key });

  // Limpeza assíncrona (fire-and-forget)
  void supabase.from('rate_limit_log').delete().lt('attempted_at', windowStart);

  return { allowed: true, retryAfterMs: 0 };
}

// ── 3. In-memory fallback (single-instance, último recurso) ──────────────────
//
// ⚠️  AVISO IMPORTANTE PARA PRODUÇÃO:
//   O in-memory store NÃO é distribuído. Em deploys Vercel (multi-instância) cada
//   serverless function tem seu próprio mapa em memória — instâncias diferentes não
//   compartilham contadores. Além disso, o mapa é zerado a cada cold start (~minutos
//   de inatividade). O rate limiting efetivo em produção exige Upstash ou Supabase.
//
//   Prioridade recomendada:
//     1. Upstash Redis  — configure UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//     2. Supabase       — execute o SQL acima para criar rate_limit_log
//     3. In-memory      — usado apenas em dev local ou como último fallback de emergência

interface MemEntry { count: number; windowStart: number }
const memStore = new Map<string, MemEntry>();

function evictExpired(windowMs: number) {
  const now = Date.now();
  for (const [k, e] of memStore) {
    if (now - e.windowStart > windowMs) memStore.delete(k);
  }
}

function checkRateLimitMemory(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  if (memStore.size > 500) evictExpired(windowMs);

  const entry = memStore.get(key);
  if (!entry) {
    memStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (now - entry.windowStart > windowMs) {
    memStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (entry.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: windowMs - (now - entry.windowStart) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

// ── Exportação principal ──────────────────────────────────────────────────────

/**
 * Verifica se a chave excedeu o limite de tentativas na janela de tempo.
 * Tenta Upstash → Supabase → in-memory nessa ordem.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 60_000
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  // Nível 1: Upstash Redis (preferencial em produção multi-instância)
  try {
    return await checkRateLimitUpstash(key, maxAttempts, windowMs);
  } catch {
    // Upstash não configurado ou falhou → próximo nível
  }

  // Nível 2: Supabase rate_limit_log
  try {
    return await checkRateLimitSupabase(key, maxAttempts, windowMs);
  } catch {
    // Supabase falhou → último recurso
  }

  // Nível 3: in-memory (não distribuído, mas nunca falha)
  return checkRateLimitMemory(key, maxAttempts, windowMs);
}

/** Extrai o IP real do request do Next.js (App Router). */
export function getClientIp(request: Request): string {
  const fwd = (request.headers as Headers).get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = (request.headers as Headers).get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
