import { NextRequest, NextResponse } from 'next/server';

/**
 * Proteção CSRF via validação do header Origin.
 *
 * Estratégia de defesa em profundidade para rotas de API que alteram estado:
 *
 *  - Se a requisição carrega `Authorization: Bearer …`, ela exige código JS para
 *    ser montada, portanto não é forjável por um form cross-origin → permitida.
 *
 *  - Webhooks possuem verificação de assinatura própria → permitidos.
 *
 *  - Se o header Origin está presente e seu host difere do host da aplicação,
 *    a requisição é rejeitada com 403.
 *
 *  - Se o header Origin está ausente (ex.: curl, requisições server-to-server)
 *    a requisição é permitida — o cookie SameSite=Lax já impede form-CSRF de
 *    origem cruzada em browsers modernos.
 */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Caminhos de webhook com verificação de assinatura própria — não precisam de CSRF. */
const WEBHOOK_PATHS = ['/api/pix-webhook', '/api/cardapioweb/webhook'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname, host } = request.nextUrl;

  // Só inspeciona rotas de API com métodos que alteram estado
  if (!pathname.startsWith('/api/') || !MUTATING_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  // Webhooks têm verificação de assinatura — não aplicar CSRF aqui
  if (WEBHOOK_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Rotas autenticadas via Bearer não são vulneráveis a CSRF clássico
  // (o header Authorization não pode ser adicionado por um form cross-origin)
  const authHeader = request.headers.get('authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    return NextResponse.next();
  }

  // Validação do Origin
  const origin = request.headers.get('origin');

  // Sem Origin: requisição não-browser (curl, server-to-server) — permitir.
  // O cookie SameSite=Lax já bloqueia form-POST cross-origin em browsers.
  if (!origin) {
    return NextResponse.next();
  }

  // Extrai o host do Origin e compara com o host da requisição
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json(
      { error: 'Origin inválida' },
      { status: 403 },
    );
  }

  // Permite localhost em qualquer porta (desenvolvimento)
  const appHost = host; // e.g. "fumego.com.br" or "localhost:3000"
  const originBase = originHost.split(':')[0];  // strip port for comparison
  const appBase    = appHost.split(':')[0];

  if (originBase === 'localhost' && appBase === 'localhost') {
    return NextResponse.next();
  }

  if (originHost !== appHost) {
    return NextResponse.json(
      { error: 'Origem não permitida' },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
