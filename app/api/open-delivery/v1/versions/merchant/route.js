import { NextResponse } from 'next/server';

/**
 * GET /api/open-delivery/v1/versions/merchant
 *
 * Retorna a versão da API do Merchant (Software Service) implementada por este sistema.
 * Endpoint público — não requer autenticação.
 *
 * Response 200: { version: "1.7.0" }
 */
export async function GET() {
  return NextResponse.json({ version: '1.7.0' });
}
