import { NextResponse } from 'next/server';

/**
 * Belt-and-suspenders fallback for the Open Delivery polling URL.
 *
 * The Open Delivery spec defines GET /v1/events:polling (with a colon).
 * next.config.js already rewrites this via path-to-regexp escape (\:),
 * but some Next.js/Vercel versions don't handle literal colons in rewrites
 * reliably. This middleware catches the raw URL before routing and redirects
 * it to the internal handler.
 */
export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  if (pathname === '/api/open-delivery/v1/events:polling') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/open-delivery/v1/events-polling';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/open-delivery/v1/events:polling'],
};
