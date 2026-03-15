/**
 * GET /api/admin/diagnostics
 *
 * Verifica o status de Sentry e Upstash em produção.
 *
 * Autenticação (aceita qualquer uma das opções):
 *  1. JWT admin  — Authorization: Bearer <token do painel>
 *  2. Chave dedicada — Authorization: Bearer <DIAGNOSTICS_SECRET>
 *     Defina DIAGNOSTICS_SECRET nas env vars do Vercel (qualquer string aleatória forte).
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}

/** Aceita JWT admin válido OU o DIAGNOSTICS_SECRET direto. */
function isAuthorized(req: NextRequest): boolean {
  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return false;

  // Opção 1: chave dedicada (mais simples para Postman/CI)
  const diagSecret = process.env.DIAGNOSTICS_SECRET;
  if (diagSecret && token === diagSecret) return true;

  // Opção 2: JWT admin padrão
  const jwtSecret = process.env.ADMIN_JWT_SECRET;
  if (!jwtSecret) return false;
  try {
    const decoded = jwt.verify(token, jwtSecret) as { role?: string };
    return decoded.role === 'admin';
  } catch {
    return false;
  }
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

// ── Pedidos com falha de sync CW ─────────────────────────────────────────────

async function checkCwFailedOrders(): Promise<{
  count: number;
  orders: { id: string; order_number: string | number; cw_push_last_error: string | null; created_at: string }[];
  ok: boolean;
}> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, cw_push_last_error, created_at')
      .eq('cw_push_status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return { count: 0, orders: [], ok: false };

    return {
      count: (data || []).length,
      orders: (data || []) as { id: string; order_number: string | number; cw_push_last_error: string | null; created_at: string }[],
      ok:     (data || []).length === 0,
    };
  } catch {
    return { count: 0, orders: [], ok: false };
  }
}

// ── Pedidos com conflito de estoque ──────────────────────────────────────────

async function checkStockConflicts(): Promise<{
  count: number;
  orders: { id: string; order_number: string | number; created_at: string }[];
  ok: boolean;
}> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, created_at')
      .eq('stock_conflict', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return { count: 0, orders: [], ok: true }; // coluna pode não existir ainda
    return {
      count: (data || []).length,
      orders: (data || []) as { id: string; order_number: string | number; created_at: string }[],
      ok:     (data || []).length === 0,
    };
  } catch {
    return { count: 0, orders: [], ok: true };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const [upstash, sentry, rateLimit, cwFailed, stockConflicts] = await Promise.all([
    testUpstash(),
    testSentry(),
    testRateLimit(),
    checkCwFailedOrders(),
    checkStockConflicts(),
  ]);

  const allOk = upstash.ok && sentry.ok && cwFailed.ok && stockConflicts.ok;

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      allOk,
      upstash,
      sentry,
      rateLimit,
      cwFailedSync:    cwFailed,
      stockConflicts,
    },
    { status: allOk ? 200 : 207 }
  );
}
