import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getODConfig, isODEnabled } from '../../../../lib/open-delivery';
import { logger } from '../../../../lib/logger';

/**
 * Verifica token de admin (mesmo mecanismo do /api/admin).
 */
function verifyAdminToken(request) {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const d = jwt.verify(token, secret);
    return d.role === 'admin';
  } catch { return false; }
}

/**
 * GET /api/open-delivery/setup
 *
 * Retorna as credenciais e configurações para exibir no painel admin.
 * O admin usa essas informações para configurar o CardápioWeb.
 */
export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const cfg     = getODConfig();
  const baseUrl = cfg.baseUrl || process.env.NEXT_PUBLIC_APP_URL || '';

  return NextResponse.json({
    enabled:       isODEnabled(),
    appId:         cfg.appId        || '(não configurado)',
    clientId:      cfg.clientId     || '(não configurado)',
    merchantId:    cfg.merchantId   || '(não configurado)',
    merchantName:  cfg.merchantName,
    endpoints: {
      token:            `${baseUrl}/api/open-delivery/oauth/token`,
      merchant:         `${baseUrl}/api/open-delivery/v1/merchant`,
      merchantStatus:   `${baseUrl}/api/open-delivery/v1/merchantStatus`,
      merchantAvail:    `${baseUrl}/api/open-delivery/v1/merchant/{merchantId}/status`,
      eventsPolling:    `${baseUrl}/api/open-delivery/v1/events-polling`,
      acknowledgment:   `${baseUrl}/api/open-delivery/v1/events/acknowledgment`,
      orderDetails:     `${baseUrl}/api/open-delivery/v1/orders/{orderId}`,
      orderTracking:    `${baseUrl}/api/open-delivery/v1/orders/{orderId}/tracking`,
      orderValidCode:   `${baseUrl}/api/open-delivery/v1/orders/{orderId}/validateCode`,
      versionMerchant:  `${baseUrl}/api/open-delivery/v1/versions/merchant`,
      versionOrderingApp: `${baseUrl}/api/open-delivery/v1/versions/orderingApp`,
      baseUrl:          `${baseUrl}/api/open-delivery`,
    },
    instructions: [
      'Configure as variáveis de ambiente: OD_CLIENT_ID, OD_CLIENT_SECRET, OD_APP_ID, OD_MERCHANT_ID, OD_MERCHANT_NAME',
      'No portal do CardápioWeb, configure a integração Open Delivery com:',
      `  - Base URL: ${baseUrl}/api/open-delivery`,
      `  - Token URL: ${baseUrl}/api/open-delivery/oauth/token`,
      `  - Client ID: ${cfg.clientId || '(defina OD_CLIENT_ID)'}`,
      '  - Client Secret: (defina OD_CLIENT_SECRET)',
      '  - App ID: (defina OD_APP_ID)',
    ],
  });
}

/**
 * POST /api/open-delivery/setup/test
 * Testa a conexão com o CardápioWeb via Open Delivery (sandbox ou produção).
 */
export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!isODEnabled()) {
    return NextResponse.json({ error: 'Integração não configurada. Defina OD_CLIENT_ID e OD_CLIENT_SECRET.' }, { status: 503 });
  }

  try {
    const { cwBaseUrl } = await request.json().catch(() => ({}));
    if (!cwBaseUrl) {
      return NextResponse.json({ error: 'Informe cwBaseUrl (URL base do CardápioWeb Open Delivery)' }, { status: 400 });
    }

    const cfg = getODConfig();

    // Tenta buscar informações do merchant via GET /v1/merchant no CardápioWeb
    const res = await fetch(`${cwBaseUrl}/v1/merchant`, {
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json({ error: `CardápioWeb respondeu ${res.status}: ${body}` }, { status: 502 });
    }

    const merchant = await res.json();
    logger.info('[OD Setup] Conexão com CardápioWeb bem-sucedida', { merchantName: merchant?.name?.short });

    return NextResponse.json({ success: true, merchant });
  } catch (e) {
    logger.error('[OD Setup] Erro ao testar conexão', e);
    return NextResponse.json({ error: e.message }, { status: 503 });
  }
}
