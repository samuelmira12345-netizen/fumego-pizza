/**
 * GET /api/admin/diagnostics
 *
 * Verifica o status de Sentry e Upstash em produção.
 * Protegido pelo mesmo token admin (Authorization: Bearer <ADMIN_JWT_SECRET>).
 *
 * Retorna JSON com o resultado de cada teste.
 */

import { NextRequest, NextResponse } from 'next/server';

// ── Helpers ───────────────────────────────────────────────────────────────────

function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}

/** Verifica o token admin simples (mesmo mecanismo do route.js admin). */
function isAuthorized(req: NextRequest): boolean {
  const auth   = req.headers.get('authorization') ?? '';
  const secret = process.env.ADMIN_JWT_SECRET ?? '';
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

// ── Teste Upstash ─────────────────────────────────────────────────────────────

async function testUpstash(): Promise<{
  configured: boolean;
  ok: boolean;
  latencyMs?: number;
  error?: string;
  fallback?: string;
}> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return {
      configured: false,
      ok: false,
      fallback: 'rate limiter usando Supabase ou in-memory',
    };
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`${url}/ping`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        configured: true,
        ok: false,
        latencyMs,
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const body = await res.json() as { result: string };
    if (body?.result !== 'PONG') {
      return {
        configured: true,
        ok: false,
        latencyMs,
        error: `Resposta inesperada: ${JSON.stringify(body)}`,
      };
    }

    return { configured: true, ok: true, latencyMs };
  } catch (e: unknown) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ── Teste Sentry ──────────────────────────────────────────────────────────────

async function testSentry(): Promise<{
  configured: boolean;
  packageInstalled: boolean;
  ok: boolean;
  sentryEventId?: string;
  error?: string;
}> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    return {
      configured: false,
      packageInstalled: false,
      ok: false,
    };
  }

  try {
    const Sentry = await import('@sentry/nextjs');

    // Captura um erro de teste e obtém o event ID
    const testErr = new Error('[Diagnóstico] Teste de integração Sentry — pode ignorar');
    const eventId = Sentry.captureException(testErr);

    return {
      configured: true,
      packageInstalled: true,
      ok: !!eventId,
      sentryEventId: eventId ?? undefined,
    };
  } catch (e: unknown) {
    return {
      configured: true,
      packageInstalled: false,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ── Teste rate limiter ────────────────────────────────────────────────────────

async function testRateLimit(): Promise<{
  activeBackend: 'upstash' | 'supabase' | 'memory';
  ok: boolean;
  error?: string;
}> {
  try {
    const { checkRateLimit } = await import('../../../../lib/rate-limit');

    const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    const result = await checkRateLimit('diagnostics:test', 100, 60_000);

    const activeBackend =
      upstashUrl && upstashToken ? 'upstash' :
      'supabase'; // in-memory é indistinguível externamente

    return { activeBackend, ok: result.allowed };
  } catch (e: unknown) {
    return {
      activeBackend: 'memory',
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const [upstash, sentry, rateLimit] = await Promise.all([
    testUpstash(),
    testSentry(),
    testRateLimit(),
  ]);

  const allOk = upstash.ok && sentry.ok;

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      allOk,
      upstash,
      sentry,
      rateLimit,
    },
    { status: allOk ? 200 : 207 }
  );
}
