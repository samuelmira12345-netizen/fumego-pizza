import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { isCWPartnerEnabled, getCWPaymentMethods } from '../../../../lib/cardapioweb-partner';

/**
 * GET /api/cardapioweb-partner/test
 * Testa a conexão com a Partner API do CardápioWeb.
 * Retorna os métodos de pagamento disponíveis se a conexão for bem-sucedida.
 * Requer: Authorization: Bearer <JWT session token>
 */
export async function GET(request) {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  let authorized = false;
  if (token && secret) {
    try {
      const decoded = jwt.verify(token, secret);
      authorized = decoded.role === 'admin';
    } catch { /* invalid token */ }
  }
  if (!authorized) {
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
