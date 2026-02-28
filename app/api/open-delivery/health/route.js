import { NextResponse } from 'next/server';

/**
 * GET /api/open-delivery/health
 *
 * Endpoint mínimo sem dependências externas.
 * Usado para verificar se o roteamento do Next.js está funcionando.
 */
export async function GET() {
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
