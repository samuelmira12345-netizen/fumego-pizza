import { NextResponse } from 'next/server';

/**
 * GET /api/open-delivery/v1/versions/orderingApp
 *
 * Retorna a versão dos endpoints hospedados no Ordering Application (nosso app).
 * Endpoint público — não requer autenticação.
 *
 * Formato conforme schema VersionOrderingApp do Open Delivery spec:
 *   merchant.version → versão dos endpoints de merchant (merchantStatus, etc.)
 *   order.version    → versão dos endpoints de orders (events:polling, orders/{id}, etc.)
 *
 * Response 200: VersionOrderingApp
 */
export async function GET() {
  return NextResponse.json({
    merchant: { version: '1.6.0' },
    order:    { version: '1.6.0' },
  });
}
