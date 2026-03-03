/**
 * Rate limiter híbrido: usa Supabase como backend distribuído (funciona em múltiplas
 * instâncias serverless no Vercel) e faz fallback para in-memory se o Supabase falhar.
 *
 * Para usar o Supabase, execute o SQL abaixo no seu projeto Supabase:
 *
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

// ── Fallback in-memory (instância única) ──────────────────────────────────────

interface MemEntry {
  count: number;
  windowStart: number;
}

const memStore = new Map<string, MemEntry>();

function evictExpired(windowMs: number) {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (now - entry.windowStart > windowMs) memStore.delete(key);
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
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

// ── Rate limiter distribuído via Supabase ──────────────────────────────────────

async function checkRateLimitSupabase(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  // Import dinâmico para evitar circular dependency
  const { getSupabaseAdmin } = await import('./supabase');
  const supabase = getSupabaseAdmin();

  const windowStart = new Date(Date.now() - windowMs).toISOString();

  // Conta tentativas recentes para esta chave
  const { count, error: countErr } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('attempted_at', windowStart);

  if (countErr) throw countErr;

  const attempts = count ?? 0;

  if (attempts >= maxAttempts) {
    // Calcula quando a janela mais antiga vai expirar
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

  // Registra esta tentativa
  await supabase.from('rate_limit_log').insert({ key });

  // Limpeza assíncrona de entradas antigas (não bloqueia a resposta)
  supabase
    .from('rate_limit_log')
    .delete()
    .lt('attempted_at', windowStart)
    .then(() => {})
    .catch(() => {});

  return { allowed: true, retryAfterMs: 0 };
}

// ── Exportação principal ───────────────────────────────────────────────────────

/**
 * Verifica se a chave excedeu o limite de tentativas na janela de tempo.
 *
 * Usa Supabase para funcionar corretamente em múltiplas instâncias serverless
 * (Vercel, AWS Lambda, etc.). Faz fallback para in-memory se Supabase falhar.
 *
 * @param key         - Identificador único (ex: "login:1.2.3.4")
 * @param maxAttempts - Número máximo de tentativas permitidas
 * @param windowMs    - Janela de tempo em milissegundos
 */
export async function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 60_000
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  try {
    return await checkRateLimitSupabase(key, maxAttempts, windowMs);
  } catch {
    // Supabase indisponível ou tabela não criada → fallback in-memory
    return checkRateLimitMemory(key, maxAttempts, windowMs);
  }
}

/** Extrai o IP real do request do Next.js (App Router). */
export function getClientIp(request: Request): string {
  const fwd = (request.headers as Headers).get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = (request.headers as Headers).get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
