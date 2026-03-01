import { NextResponse } from 'next/server';
import { verifyODToken, getODConfig } from '../../../../../lib/open-delivery';
import { logger } from '../../../../../lib/logger';

/**
 * PUT /api/open-delivery/v1/merchantOnboarding?merchantId={id}
 *
 * Chamado pelo Software Service (CardápioWeb/TaxiMachine) para registrar ou
 * atualizar as informações do endpoint do merchant no nosso Ordering Application.
 *
 * Este endpoint é OBRIGATÓRIO pela spec Open Delivery (v1.x) e deve ser
 * implementado pelo Ordering Application.
 *
 * Request body (MerchantAPIInfo):
 *   - getMerchantURL.baseURL:  URL do GET /v1/merchant do CardápioWeb
 *   - getMerchantURL.apiKey:   API key para acessar o endpoint (opcional)
 *   - ordersWebhookURL:        URL onde devemos enviar eventos (POST /v1/newEvent)
 *
 * Response 201 (MerchantAPIInfo):
 *   - Espelha o body recebido + adiciona orderingAppMerchantId (nosso ID interno do merchant)
 *
 * Spec: https://abrasel-nacional.github.io/docs/ → PUT /v1/merchantOnboarding
 */
export async function PUT(request) {
  const decoded = verifyODToken(request);
  if (!decoded) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const url        = new URL(request.url);
  const merchantId = url.searchParams.get('merchantId');

  if (!merchantId) {
    return NextResponse.json(
      { message: 'merchantId query parameter is required' },
      { status: 400 }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // body vazio é aceitável — processamos com defaults
  }

  const cfg = getODConfig();

  // orderingAppMerchantId = ID do merchant no nosso sistema.
  // Usamos o OD_MERCHANT_ID (ID do estabelecimento no CardápioWeb) como
  // identificador consistente do merchant no nosso ordering app.
  const orderingAppMerchantId = cfg.merchantId || merchantId;

  logger.info('[OD Onboarding] Merchant registrado/atualizado', {
    merchantId,
    orderingAppMerchantId,
    ordersWebhookURL:  body.ordersWebhookURL   || '(não fornecido)',
    getMerchantURL:    body.getMerchantURL?.baseURL || '(não fornecido)',
  });

  // Resposta 201: espelha o MerchantAPIInfo recebido + adiciona orderingAppMerchantId
  const responseBody = {
    ...body,
    orderingAppMerchantId,
  };

  return NextResponse.json(responseBody, { status: 201 });
}
