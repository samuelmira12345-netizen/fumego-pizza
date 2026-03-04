/**
 * Open Delivery Integration – Helpers
 *
 * Nosso app é o "Ordering Application" no padrão Open Delivery.
 * O CardápioWeb é o "Software Service" (PDV do restaurante).
 *
 * Fluxo completo:
 *  1. Cliente faz pedido no nosso app
 *  2. Salvamos o pedido + enfileiramos evento em od_events (para polling)
 *  3. PUSH imediato: autenticamos no OAuth do CardápioWeb e chamamos POST {OD_CW_BASE_URL}/v1/newEvent
 *  4. CardápioWeb busca detalhes do pedido: GET /api/open-delivery/v1/orders/{id} (na nossa API)
 *  5. Funcionário vê e confirma no dashboard do CardápioWeb
 *  6. CardápioWeb chama nossos callbacks de status (confirm, preparing, dispatch…)
 *  7. Atualizamos o status do pedido no banco
 *
 * Variáveis de ambiente:
 *
 *   -- Credenciais fornecidas PELO CardápioWeb (Configurações → Integrações → API Open Delivery) --
 *   OD_CLIENT_ID      "ID do estabelecimento"   fornecido pelo CardápioWeb
 *   OD_CLIENT_SECRET  "Segredo do estabelecimento" fornecido pelo CardápioWeb
 *   OD_MERCHANT_ID    "ID do estabelecimento"   (pode ser igual ao OD_CLIENT_ID)
 *   OD_CW_BASE_URL    URL base do CardápioWeb   (https://integracao.cardapioweb.com/api/open_delivery)
 *
 *   -- Configuração local --
 *   OD_MERCHANT_NAME  "Fumêgo Pizza"
 *   OD_APP_ID         (não utilizado na autenticação — mantido por compatibilidade)
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
// Assinatura de Webhooks (X-App-Signature) — mantida para receber callbacks do CardápioWeb
// ============================================================

export function signWebhookBody(body) {
  const secret = process.env.OD_CLIENT_SECRET;
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// ============================================================
// PUSH → Envia evento para o CardápioWeb
// ============================================================

// Cache do token OAuth do CardápioWeb (in-memory, válido dentro de uma invocação quente)
let _cwToken    = null;
let _cwTokenExp = 0;

/**
 * Obtém (ou reutiliza do cache) um Bearer token do OAuth do CardápioWeb.
 * Credenciais: OD_CLIENT_ID / OD_CLIENT_SECRET (fornecidas pelo CardápioWeb no portal).
 */
async function getCWToken(cwBaseUrl, clientId, clientSecret) {
  const now = Date.now();
  if (_cwToken && _cwTokenExp > now + 60_000) return _cwToken;

  // Tenta primeiro com application/json, depois com form-urlencoded
  for (const [contentType, body] of [
    ['application/json', JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })],
    ['application/x-www-form-urlencoded', `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`],
  ]) {
    const res = await fetch(`${cwBaseUrl}/oauth/token`, {
      method:  'POST',
      headers: { 'Content-Type': contentType },
      body,
      signal:  AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (!res) continue;

    const text = await res.text().catch(() => '');
    if (!res.ok) {
      console.warn(`[OD OAuth] ${contentType} → ${res.status}: ${text}`);
      continue;
    }

    const data = (() => { try { return JSON.parse(text); } catch { return {}; } })();
    if (data.access_token) {
      _cwToken    = data.access_token;
      _cwTokenExp = now + (data.expires_in || 3600) * 1000;
      console.log('[OD OAuth] Token CardápioWeb obtido, expira em', data.expires_in || 3600, 's');
      return _cwToken;
    }
  }

  throw new Error('Não foi possível obter token OAuth do CardápioWeb — verifique OD_CLIENT_ID e OD_CLIENT_SECRET');
}

/**
 * Autentica com o OAuth do CardápioWeb e envia POST {OD_CW_BASE_URL}/v1/newEvent.
 *
 * @param {string} orderId
 * @param {string} eventType  – 'CREATED' | 'CANCELLED' | etc.
 * @returns {{ ok: boolean, status?: number, error?: string }}
 */
export async function pushEventToCardapioWeb(orderId, eventType = 'CREATED') {
  const cwBaseUrl    = process.env.OD_CW_BASE_URL;
  const clientId     = process.env.OD_CLIENT_ID     || '';
  const clientSecret = process.env.OD_CLIENT_SECRET || '';
  const merchantId   = process.env.OD_MERCHANT_ID   || '';

  if (!cwBaseUrl) {
    return { ok: false, error: 'OD_CW_BASE_URL não configurado' };
  }

  // 1. Obtém Bearer token do CardápioWeb
  let accessToken;
  try {
    accessToken = await getCWToken(cwBaseUrl, clientId, clientSecret);
  } catch (e) {
    console.error('[OD Push] Falha no OAuth CardápioWeb:', e.message);
    return { ok: false, error: e.message };
  }

  // 2. Envia o evento com Bearer token
  const event = {
    eventId:   crypto.randomUUID(),
    eventType,
    orderId,
    orderURL:  orderURL(orderId),
    createdAt: new Date().toISOString(),
  };

  const body = JSON.stringify(event);

  try {
    const res = await fetch(`${cwBaseUrl}/v1/newEvent`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Authorization':   `Bearer ${accessToken}`,
        'X-App-MerchantId': merchantId,
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
      // OD spec requires coordinates; no lat/lng in DB — send zeroes as placeholder.
      coordinates: { latitude: 0, longitude: 0 },
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
  if (!APP_BASE_URL) {
    // CRÍTICO: sem APP_BASE_URL o CardápioWeb recebe uma URL relativa ("/api/...")
    // que ele não consegue acessar. Defina NEXT_PUBLIC_APP_URL=https://SEU-DOMINIO.com
    console.warn('[OD] NEXT_PUBLIC_APP_URL não definido — orderURL será relativa e inacessível pelo CardápioWeb!');
  }
  return `${APP_BASE_URL}/api/open-delivery/v1/orders/${orderId}`;
}
