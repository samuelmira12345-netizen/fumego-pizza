import { NextResponse } from 'next/server';

/**
 * GET /api/open-delivery/v1/versions/merchant
 *
 * Retorna a versão dos endpoints de Merchant hospedados neste sistema.
 * Endpoint público — não requer autenticação.
 *
 * Formato conforme schema VersionMerchant do Open Delivery spec:
 *   merchantEndpoint → versão do GET /v1/merchant
 *   ordersWebhook    → versão do POST /v1/orderUpdate (webhook de eventos)
 *
 * Response 200: VersionMerchant
 */
export async function GET() {
  return NextResponse.json({
    merchantEndpoint: '1.2.1',
    ordersWebhook:    '1.2.1',
  });
}
