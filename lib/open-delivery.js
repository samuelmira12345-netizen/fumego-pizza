/**
 * Open Delivery Integration – Helpers
 *
 * Nosso app é o "Ordering Application" no padrão Open Delivery.
 * O CardápioWeb é o "Software Service".
 *
 * Fluxo completo:
 *  1. Cliente faz pedido no nosso app
 *  2. Salvamos o pedido + enfileiramos evento em od_events (para polling)
 *  3. PUSH imediato: chamamos POST {OD_CW_BASE_URL}/v1/newEvent no CardápioWeb
 *  4. CardápioWeb recebe o evento e busca detalhes: GET /api/open-delivery/v1/orders/{id}
 *  5. Funcionário vê e confirma no dashboard do CardápioWeb
 *  6. CardápioWeb chama nossos callbacks de status (confirm, preparing, dispatch…)
 *  7. Atualizamos o status do pedido no banco
 *
 * Variáveis de ambiente:
 *
 *   -- Credenciais que VOCÊ gera e fornece ao CardápioWeb --
 *   OD_CLIENT_ID      UUID gerado por você  (CardápioWeb usa pra autenticar com a gente)
 *   OD_CLIENT_SECRET  string aleatória      (CardápioWeb usa pra autenticar com a gente)
 *   OD_APP_ID         UUID gerado por você  (identificador único do nosso app)
 *
 *   -- Credenciais que o CardápioWeb fornece (tela "API Open Delivery" deles) --
 *   OD_MERCHANT_ID    "ID do estabelecimento"   do CardápioWeb
 *   OD_CW_BASE_URL    "URL base"                do CardápioWeb  (ex: https://integracao.cardapioweb.com)
 *
 *   -- Nome exibido nos pedidos --
 *   OD_MERCHANT_NAME  "Fumêgo Pizza"
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || '';
const TOKEN_TTL_SECONDS = 3600; // 1 hora

// ============================================================
// Configuração
// ============================================================

export function isODEnabled() {
  return Boolean(process.env.OD_CLIENT_ID && process.env.OD_CLIENT_SECRET);
}

/** Retorna true se o push para o CardápioWeb está configurado */
export function isCWPushEnabled() {
  return Boolean(process.env.OD_CW_BASE_URL);
}

export function getODConfig() {
  return {
    appId:        process.env.OD_APP_ID        || '',
    clientId:     process.env.OD_CLIENT_ID     || '',
    clientSecret: process.env.OD_CLIENT_SECRET || '',
    merchantId:   process.env.OD_MERCHANT_ID   || '',
    merchantName: process.env.OD_MERCHANT_NAME || 'Fumêgo Pizza',
    cwBaseUrl:    process.env.OD_CW_BASE_URL   || '',
    baseUrl:      APP_BASE_URL,
  };
}

// ============================================================
// Autenticação – OAuth2 Client Credentials
// (CardápioWeb chama nosso endpoint /oauth/token)
// ============================================================

export function issueAccessToken(merchantId) {
  const secret = process.env.OD_CLIENT_SECRET;
  if (!secret) throw new Error('[OD] OD_CLIENT_SECRET não configurado');
  return jwt.sign(
    { sub: 'cardapioweb', merchantId, scope: 'od.all' },
    secret,
    { expiresIn: TOKEN_TTL_SECONDS }
  );
}

export function verifyODToken(request) {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace(/^Bearer\s+/i, '').trim();
  const secret = process.env.OD_CLIENT_SECRET;
  if (!token || !secret) return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

// ============================================================
// Assinatura de Webhooks (X-App-Signature)
// ============================================================

export function signWebhookBody(body) {
  const secret = process.env.OD_CLIENT_SECRET;
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// ============================================================
// PUSH → Envia evento para o CardápioWeb
// ============================================================

/**
 * Chama POST {OD_CW_BASE_URL}/v1/newEvent para notificar o CardápioWeb
 * de um novo evento de pedido (CREATED, CANCELLED, etc.).
 *
 * O endpoint /v1/newEvent do CardápioWeb não exige Bearer token —
 * usa o X-App-Signature para verificar autenticidade.
 *
 * @param {string} orderId
 * @param {string} eventType  – 'CREATED' | 'CANCELLED' | etc.
 * @returns {{ ok: boolean, status?: number, error?: string }}
 */
export async function pushEventToCardapioWeb(orderId, eventType = 'CREATED') {
  const cwBaseUrl   = process.env.OD_CW_BASE_URL;
  const appId       = process.env.OD_APP_ID       || '';
  const merchantId  = process.env.OD_MERCHANT_ID  || '';

  if (!cwBaseUrl) {
    return { ok: false, error: 'OD_CW_BASE_URL não configurado' };
  }

  const event = {
    eventId:   crypto.randomUUID(),
    eventType,
    orderId,
    orderURL:  orderURL(orderId),
    createdAt: new Date().toISOString(),
    ...(appId ? { sourceAppId: appId } : {}),
  };

  const body      = JSON.stringify(event);
  const signature = signWebhookBody(body);

  try {
    const res = await fetch(`${cwBaseUrl}/v1/newEvent`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-App-Id':        appId,
        'X-App-MerchantId': merchantId,
        'X-App-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    const responseText = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(`[OD Push] CardápioWeb respondeu ${res.status}:`, responseText);
      return { ok: false, status: res.status, error: responseText };
    }

    console.log('[OD Push] Evento enviado ao CardápioWeb:', { orderId, eventType, status: res.status });
    return { ok: true, status: res.status };
  } catch (e) {
    console.error('[OD Push] Falha ao chamar CardápioWeb:', e.message);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// Formatação do Pedido no padrão Open Delivery
// ============================================================

export function formatOrderAsOD(order, items = []) {
  const cfg        = getODConfig();
  const createdAt  = new Date(order.created_at).toISOString();
  const totalFloat = Number(order.total);
  const feeFloat   = Number(order.delivery_fee || 0);
  const discFloat  = Number(order.discount || 0);
  const subFloat   = Number(order.subtotal || (totalFloat - feeFloat + discFloat));

  const odItems = items.map((item, idx) => ({
    id:           item.id,
    index:        idx + 1,
    name:         item.product_name,
    externalCode: item.product_id || item.drink_id || String(idx),
    unit:         'UN',
    quantity:     item.quantity,
    unitPrice:    price(Number(item.unit_price)),
    totalPrice:   price(Number(item.total_price)),
    ...(item.observations ? { specialInstructions: item.observations } : {}),
  }));

  const otherFees = [];
  if (feeFloat > 0) {
    otherFees.push({
      name:       'Taxa de entrega',
      type:       'DELIVERY_FEE',
      receivedBy: 'MERCHANT',
      price:      price(feeFloat),
    });
  }

  const discounts = [];
  if (discFloat > 0) {
    discounts.push({
      amount:  price(discFloat),
      target:  'CART',
      sponsorshipValues: [{ name: 'MERCHANT', amount: price(discFloat) }],
    });
  }

  const paymentMethod = mapPaymentMethod(order.payment_method);
  const isPrepaid     = order.payment_status === 'approved' || order.payment_method === 'pix';
  const payments = {
    prepaid: isPrepaid ? totalFloat : 0,
    pending: isPrepaid ? 0 : totalFloat,
    methods: [{
      value:    totalFloat,
      currency: 'BRL',
      type:     isPrepaid ? 'PREPAID' : 'PENDING',
      method:   paymentMethod,
      ...(order.payment_method === 'money' && order.change_for
        ? { changeFor: Number(order.change_for) }
        : {}),
    }],
  };

  const delivery = order.delivery_street ? {
    deliveredBy: 'MERCHANT',
    deliveryAddress: {
      formattedAddress: [
        order.delivery_street,
        order.delivery_number,
        order.delivery_complement,
        order.delivery_neighborhood,
        order.delivery_city,
        order.delivery_state,
      ].filter(Boolean).join(', '),
      country:    'BR',
      state:      order.delivery_state        || '',
      city:       order.delivery_city         || '',
      district:   order.delivery_neighborhood || '',
      street:     order.delivery_street       || '',
      number:     order.delivery_number       || '',
      complement: order.delivery_complement   || '',
      postalCode: (order.delivery_zipcode || '').replace(/\D/g, ''),
    },
    estimatedDeliveryDateTime: createdAt,
  } : undefined;

  const customer = {
    id:   order.user_id || order.id,
    name: order.customer_name,
    phone: { number: (order.customer_phone || '').replace(/\s/g, '') },
    ordersCountOnMerchant: 0,
    ...(order.customer_email ? { email: order.customer_email } : {}),
  };

  return {
    id:                       order.id,
    type:                     'DELIVERY',
    displayId:                String(order.order_number || order.id.slice(0, 8)),
    sourceAppId:              cfg.appId || undefined,
    salesChannel:             'FUMÊGO App',
    createdAt,
    lastEvent:                mapStatusToODEvent(order.status),
    orderTiming:              'INSTANT',
    preparationStartDateTime: createdAt,
    merchant: {
      id:   cfg.merchantId || 'fumego-pizza',
      name: cfg.merchantName,
    },
    items:      odItems,
    otherFees,
    discounts,
    total: {
      itemsPrice:  price(subFloat),
      otherFees:   price(feeFloat),
      discount:    price(discFloat),
      orderAmount: price(totalFloat),
    },
    payments,
    customer,
    ...(delivery ? { delivery } : {}),
    ...(order.observations ? { additionalInfo: order.observations } : {}),
    sendPreparing: false,
    sendPickedUp:  false,
    sendDelivered: true,
    sendTracking:  false,
  };
}

// ── helpers ────────────────────────────────────────────────────────────────

function price(value) {
  return { value: Math.round(Number(value) * 100) / 100, currency: 'BRL' };
}

function mapPaymentMethod(method) {
  const map = { pix: 'PIX', card: 'CREDIT', money: 'CASH', credit: 'CREDIT', debit: 'DEBIT' };
  return map[method] || 'OTHER';
}

function mapStatusToODEvent(status) {
  const map = {
    pending:    'CREATED',
    confirmed:  'CONFIRMED',
    preparing:  'PREPARING',
    delivering: 'DISPATCHED',
    delivered:  'DELIVERED',
    cancelled:  'CANCELLED',
  };
  return map[status] || 'CREATED';
}

export function orderURL(orderId) {
  return `${APP_BASE_URL}/api/open-delivery/v1/orders/${orderId}`;
}
