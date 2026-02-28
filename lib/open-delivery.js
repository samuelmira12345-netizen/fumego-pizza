/**
 * Open Delivery Integration – Helpers
 *
 * Nosso app é o "Ordering Application" no padrão Open Delivery.
 * O CardápioWeb é o "Software Service".
 *
 * Fluxo:
 *  1. Cliente faz pedido no nosso app
 *  2. Salvamos o pedido + enfileiramos evento CREATED em od_events
 *  3. CardápioWeb faz polling em GET /api/open-delivery/v1/events-polling
 *  4. CardápioWeb busca detalhes: GET /api/open-delivery/v1/orders/{id}
 *  5. Funcionário vê e confirma no dashboard do CardápioWeb
 *  6. CardápioWeb chama POST /api/open-delivery/v1/orders/{id}/confirm (etc.)
 *  7. Atualizamos o status do pedido no nosso banco
 *
 * Variáveis de ambiente necessárias:
 *   OD_CLIENT_ID      – clientId que fornecemos ao CardápioWeb para autenticação
 *   OD_CLIENT_SECRET  – clientSecret correspondente
 *   OD_APP_ID         – UUID único da nossa aplicação (gerado uma vez)
 *   OD_MERCHANT_ID    – ID do estabelecimento fornecido pelo CardápioWeb
 *   OD_MERCHANT_NAME  – Nome do estabelecimento (ex: "Fumêgo Pizza")
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || '';
const TOKEN_TTL_SECONDS = 3600; // 1 hora

// ============================================================
// Configuração
// ============================================================

export function isODEnabled() {
  return Boolean(process.env.OD_CLIENT_ID && process.env.OD_CLIENT_SECRET);
}

export function getODConfig() {
  return {
    appId:        process.env.OD_APP_ID        || '',
    clientId:     process.env.OD_CLIENT_ID     || '',
    clientSecret: process.env.OD_CLIENT_SECRET || '',
    merchantId:   process.env.OD_MERCHANT_ID   || '',
    merchantName: process.env.OD_MERCHANT_NAME || 'Fumêgo Pizza',
    baseUrl:      APP_BASE_URL,
  };
}

// ============================================================
// Autenticação – OAuth2 Client Credentials
// ============================================================

/**
 * Gera um access token JWT para o CardápioWeb usar em suas chamadas a nós.
 * O CardápioWeb chama POST /oauth/token com clientId+clientSecret e recebe este token.
 */
export function issueAccessToken(merchantId) {
  const secret = process.env.OD_CLIENT_SECRET;
  if (!secret) throw new Error('[OD] OD_CLIENT_SECRET não configurado');
  return jwt.sign(
    { sub: 'cardapioweb', merchantId, scope: 'od.all' },
    secret,
    { expiresIn: TOKEN_TTL_SECONDS }
  );
}

/**
 * Valida o Bearer token enviado pelo CardápioWeb nos headers.
 * Retorna o payload decodificado ou null se inválido.
 */
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

/**
 * Gera o X-App-Signature para envio de eventos ao CardápioWeb.
 * SHA256 HMAC do body usando o clientSecret como chave.
 */
export function signWebhookBody(body) {
  const secret = process.env.OD_CLIENT_SECRET;
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// ============================================================
// Formatação do Pedido no padrão Open Delivery
// ============================================================

/**
 * Converte um pedido interno + seus itens para o schema Order do Open Delivery.
 *
 * @param {Object} order   – linha da tabela orders
 * @param {Array}  items   – linhas da tabela order_items
 * @returns {Object} Open Delivery Order object
 */
export function formatOrderAsOD(order, items = []) {
  const cfg        = getODConfig();
  const baseUrl    = `${APP_BASE_URL}/api/open-delivery`;
  const createdAt  = new Date(order.created_at).toISOString();
  const totalFloat = Number(order.total);
  const feeFloat   = Number(order.delivery_fee || 0);
  const discFloat  = Number(order.discount || 0);
  const subFloat   = Number(order.subtotal || (totalFloat - feeFloat + discFloat));

  // ── Itens ──────────────────────────────────────────────────────────────
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

  // ── Outras taxas ────────────────────────────────────────────────────────
  const otherFees = [];
  if (feeFloat > 0) {
    otherFees.push({
      name:       'Taxa de entrega',
      type:       'DELIVERY_FEE',
      receivedBy: 'MERCHANT',
      price:      price(feeFloat),
    });
  }

  // ── Descontos ───────────────────────────────────────────────────────────
  const discounts = [];
  if (discFloat > 0) {
    discounts.push({
      amount:  price(discFloat),
      target:  'CART',
      sponsorshipValues: [{ name: 'MERCHANT', amount: price(discFloat) }],
    });
  }

  // ── Pagamento ───────────────────────────────────────────────────────────
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

  // ── Endereço de entrega ─────────────────────────────────────────────────
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
      state:      order.delivery_state       || '',
      city:       order.delivery_city        || '',
      district:   order.delivery_neighborhood || '',
      street:     order.delivery_street      || '',
      number:     order.delivery_number      || '',
      complement: order.delivery_complement  || '',
      postalCode: (order.delivery_zipcode || '').replace(/\D/g, ''),
    },
    estimatedDeliveryDateTime: createdAt, // placeholder; app pode calcular
  } : undefined;

  // ── Cliente ─────────────────────────────────────────────────────────────
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
      itemsPrice: price(subFloat),
      otherFees:  price(feeFloat),
      discount:   price(discFloat),
      orderAmount: price(totalFloat),
    },
    payments,
    customer,
    ...(delivery ? { delivery } : {}),
    ...(order.observations ? { additionalInfo: order.observations } : {}),
    sendPreparing:  false,
    sendPickedUp:   false,
    sendDelivered:  true,
    sendTracking:   false,
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function price(value) {
  return { value: Math.round(Number(value) * 100) / 100, currency: 'BRL' };
}

function mapPaymentMethod(method) {
  const map = {
    pix:    'PIX',
    card:   'CREDIT',
    money:  'CASH',
    credit: 'CREDIT',
    debit:  'DEBIT',
  };
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

// ============================================================
// Construção da Event URL
// ============================================================

export function orderURL(orderId) {
  return `${APP_BASE_URL}/api/open-delivery/v1/orders/${orderId}`;
}
