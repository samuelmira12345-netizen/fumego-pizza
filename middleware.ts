import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware unificado:
 *  1. Gera nonce por request para CSP nonce-based (rotas de página)
 *  2. Aplica CSP header em todas as rotas
 *  3. Proteção CSRF via validação de Origin (rotas de API)
 */

// ── CSP builder ───────────────────────────────────────────────────────────────

function buildCSP(nonce: string | null): string {
  // unsafe-eval apenas em dev (Next.js webpack hot-reload usa eval)
  const evalDirective = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';

  // Com nonce: remove unsafe-inline de script-src; 'strict-dynamic' permite
  // scripts carregados por scripts já autorizados (Next.js runtime, GA).
  // Sem nonce (rotas de API que retornam JSON): política mínima sem inline.
  const scriptSrc = nonce
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'${evalDirective}`
    : `'self'${evalDirective}`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // style-src mantém unsafe-inline: Next.js injeta <style> internos que não
    // suportam nonce de forma confiável em todas as versões do Next.js 14.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://sentry.io https://*.sentry.io https://brasilapi.com.br https://nominatim.openstreetmap.org https://*.upstash.io https://www.google-analytics.com",
    "frame-ancestors 'self'",
    "form-action 'self'",
  ].join('; ');
}

// ── CSRF ──────────────────────────────────────────────────────────────────────

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const WEBHOOK_PATHS    = ['/api/pix-webhook', '/api/cardapioweb/webhook'];

function csrfGuard(request: NextRequest): NextResponse | null {
  const { pathname, host } = request.nextUrl;

  if (!MUTATING_METHODS.has(request.method)) return null;
  if (WEBHOOK_PATHS.some(p => pathname.startsWith(p))) return null;

  const authHeader = request.headers.get('authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) return null;

  const origin = request.headers.get('origin');
  if (!origin) return null; // server-to-server, curl, etc.

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: 'Origin inválida' }, { status: 403 });
  }

  const appBase    = host.split(':')[0];
  const originBase = originHost.split(':')[0];

  if (originBase === 'localhost' && appBase === 'localhost') return null;

  if (originHost !== host) {
    return NextResponse.json({ error: 'Origem não permitida' }, { status: 403 });
  }

  return null;
}

// ── Middleware principal ───────────────────────────────────────────────────────

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isApiRoute   = pathname.startsWith('/api/');

  // ── Rotas de API: CSRF guard + CSP sem nonce (resposta é JSON, não HTML) ──
  if (isApiRoute) {
    const csrfError = csrfGuard(request);
    if (csrfError) return csrfError;

    const response = NextResponse.next();
    response.headers.set('Content-Security-Policy', buildCSP(null));
    return response;
  }

  // ── Rotas de página: gera nonce e injeta no CSP + request headers ─────────
  // O nonce é passado via x-nonce para que o layout.tsx o leia com headers().
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', buildCSP(nonce));
  return response;
}

export const config = {
  // Inclui todas as rotas exceto assets estáticos do Next.js
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
