import { NextResponse } from 'next/server';
import { isCWPartnerEnabled, getCWPaymentMethods } from '../../../../lib/cardapioweb-partner';

/**
 * GET /api/cardapioweb-partner/test
 * Testa a conexão com a Partner API do CardápioWeb.
 * Retorna os métodos de pagamento disponíveis se a conexão for bem-sucedida.
 * Requer: Authorization: Bearer <ADMIN_PASSWORD>
 */
export async function GET(request) {
  const authHeader    = request.headers.get('authorization') || '';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!isCWPartnerEnabled()) {
    return NextResponse.json({
      enabled: false,
      error: 'Integração inativa — configure CW_BASE_URL, CW_API_KEY e CW_PARTNER_KEY no Vercel.',
    });
  }

  try {
    const payment_methods = await getCWPaymentMethods();
    return NextResponse.json({ enabled: true, payment_methods });
  } catch (e) {
    return NextResponse.json({ enabled: true, error: `Erro ao conectar: ${e.message}` }, { status: 502 });
  }
}
