/**
 * lib/cardapioweb-partner.ts
 *
 * Cliente da Cardápio Web Partner API.
 * Envia pedidos feitos no app diretamente para o painel do CardápioWeb.
 *
 * Autenticação: dupla autenticação via headers HTTP
 *   X-API-KEY     — token do estabelecimento (obtido no portal do CardápioWeb)
 *   X-PARTNER-KEY — token do integrador (fornecido pelo CardápioWeb ao se cadastrar como integrador)
 *
 * Variáveis de ambiente necessárias:
 *   CW_BASE_URL      — URL base da API
 *   CW_API_KEY       — X-API-KEY: token do estabelecimento
 *   CW_PARTNER_KEY   — X-PARTNER-KEY: token do integrador
 *
 * Variáveis opcionais:
 *   CW_DEFAULT_LAT   — Latitude do estabelecimento (fallback p/ coordenadas de entrega)
 *   CW_DEFAULT_LNG   — Longitude do estabelecimento (fallback p/ coordenadas de entrega)
 */

import type { Order, OrderItem } from '../types';

interface CWPaymentMethod {
  id: string | number;
  kind: string;
}

interface CWItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  external_code?: string;
  observation?: string;
}

interface CWOrderPayload {
  order_id: string;
  display_id: string;
  order_type: string;
  created_at: string;
  totals: {
    order_amount: number;
    delivery_fee: number;
    discounts: number;
  };
  items: CWItem[];
  payments: Array<{ total: number; payment_method_id: string | number }>;
  observation?: string;
  customer?: { phone: string | null; name: string | null; email: string | null };
  delivery_address?: {
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    number: string | null;
    complement: string | null;
    postal_code: string;
    coordinates: { latitude: number; longitude: number };
  };
}

export interface PushOrderResult {
  ok: boolean;
  data?: unknown;
  status?: number;
  errors?: string[];
  error?: string;
}

/** URL base sem barra final (evita double-slash nas rotas). */
function cwBaseUrl(): string {
  return (process.env.CW_BASE_URL || '').replace(/\/+$/, '');
}

/** Verifica se a integração Partner está configurada. */
export function isCWPartnerEnabled(): boolean {
  return !!(
    process.env.CW_BASE_URL &&
    process.env.CW_API_KEY  &&
    process.env.CW_PARTNER_KEY
  );
}

/** Headers de autenticação para todas as chamadas. */
function cwHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-KEY':     process.env.CW_API_KEY     || '',
    'X-PARTNER-KEY': process.env.CW_PARTNER_KEY || '',
  };
}

/**
 * GET /api/partner/v1/merchant/payment_methods
 * Retorna os métodos de pagamento ativos do estabelecimento no CW.
 */
export async function getCWPaymentMethods(): Promise<CWPaymentMethod[]> {
  const res = await fetch(
    `${cwBaseUrl()}/api/partner/v1/merchant/payment_methods`,
    { headers: cwHeaders(), cache: 'no-store' }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as CWPaymentMethod[];
  } catch {
    throw new Error(`HTTP ${res.status} mas resposta não é JSON. Primeiros 300 chars: ${text.slice(0, 300)}`);
  }
}

// ── Mapeamento de métodos de pagamento ───────────────────────────────────────

const PAYMENT_KIND_MAP: Record<string, string> = {
  pix:           'pix',
  cash:          'money',
  card:          'credit_card',
  card_delivery: 'credit_card',
};

function findPaymentMethod(methods: CWPaymentMethod[], internalMethod: string): CWPaymentMethod | null {
  const kind = PAYMENT_KIND_MAP[internalMethod] || 'pix';
  return methods.find(m => m.kind === kind) || methods[0] || null;
}

// ── Mapeamento de tipos de pedido ────────────────────────────────────────────

const ORDER_TYPE_MAP: Record<string, string> = {
  delivery:     'delivery',
  takeout:      'takeout',
  onsite:       'onsite',
  closed_table: 'onsite',
};

// ── Formatação do pedido ─────────────────────────────────────────────────────

function r2(n: number | string | null | undefined): number {
  return Math.round((parseFloat(String(n)) || 0) * 100) / 100;
}

function formatOrderPayload(
  order: Order & { order_type?: string; delivery_lat?: string; delivery_lng?: string; delivery_latitude?: string; delivery_longitude?: string },
  items: OrderItem[],
  cwPaymentMethod: CWPaymentMethod
): CWOrderPayload {
  const cwOrderType = ORDER_TYPE_MAP[order.order_type || ''] || 'delivery';
  const isDelivery  = cwOrderType === 'delivery';

  const cwItems: CWItem[] = items.map(item => {
    const entry: CWItem = {
      name:        String(item.product_name || 'Item'),
      quantity:    Number(item.quantity)   || 1,
      unit_price:  r2(item.unit_price),
      total_price: r2(item.total_price),
    };
    if (item.product_id) entry.external_code = String(item.product_id);
    if (item.drink_id)   entry.external_code = String(item.drink_id);
    if (item.observations) entry.observation = String(item.observations).slice(0, 500);
    return entry;
  });

  const itemsSum    = cwItems.reduce((s, i) => s + i.total_price, 0);
  const deliveryFee = r2(isDelivery ? (order.delivery_fee || 0) : 0);
  const discounts   = r2(order.discount || 0);
  const orderAmount = r2(itemsSum + deliveryFee - discounts);

  const payload: CWOrderPayload = {
    order_id:   String(order.id),
    display_id: String(order.order_number || order.id),
    order_type: cwOrderType,
    created_at: order.created_at || new Date().toISOString(),
    totals: { order_amount: orderAmount, delivery_fee: deliveryFee, discounts },
    items: cwItems,
    payments: [{ total: orderAmount, payment_method_id: cwPaymentMethod.id }],
  };

  if (order.observations) payload.observation = String(order.observations).slice(0, 500);

  const rawPhone = (order.customer_phone || '').replace(/\D/g, '').slice(0, 11);
  if (isDelivery || rawPhone) {
    payload.customer = {
      phone: rawPhone || null,
      name:  order.customer_name  || null,
      email: order.customer_email || null,
    };
  }

  if (isDelivery) {
    const postalCode = (order.delivery_zipcode || '').replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
    const lat = parseFloat(
      order.delivery_lat || order.delivery_latitude ||
      process.env.CW_DEFAULT_LAT || '0'
    );
    const lng = parseFloat(
      order.delivery_lng || order.delivery_longitude ||
      process.env.CW_DEFAULT_LNG || '0'
    );
    payload.delivery_address = {
      state:        (order.delivery_state        || '').toUpperCase(),
      city:          order.delivery_city         || '',
      neighborhood:  order.delivery_neighborhood || '',
      street:        order.delivery_street       || '',
      number:        order.delivery_number       || null,
      complement:    order.delivery_complement   || null,
      postal_code:   postalCode,
      coordinates: { latitude: lat, longitude: lng },
    };
  }

  return payload;
}

// ── Validação pré-envio ───────────────────────────────────────────────────────

function validatePayload(payload: CWOrderPayload): string | null {
  if (payload.order_type === 'delivery') {
    const phone = payload.customer?.phone || '';
    if (phone.length !== 11) {
      return `Telefone do cliente inválido para delivery (${phone.length} dígitos, esperado 11). Pedido não enviado ao CardápioWeb.`;
    }
    const { latitude, longitude } = payload.delivery_address?.coordinates || {};
    if (!latitude && !longitude) {
      return 'Coordenadas de entrega são 0,0. Configure CW_DEFAULT_LAT e CW_DEFAULT_LNG ou use geolocalização no pedido.';
    }
  }
  return null;
}

// ── Retry helper ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postOrderWithRetry(payload: CWOrderPayload, maxAttempts = 3): Promise<PushOrderResult> {
  const delays = [1000, 2000, 4000];
  let lastResult: PushOrderResult = { ok: false, error: 'Sem resposta' };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${cwBaseUrl()}/api/partner/v1/orders`, {
        method:  'POST',
        headers: cwHeaders(),
        body:    JSON.stringify(payload),
      });

      if (res.status === 201) {
        const data = await res.json() as unknown;
        return { ok: true, data };
      }

      const errData = await res.json().catch(() => ({})) as { errors?: string[] };
      lastResult = {
        ok:     false,
        status: res.status,
        errors: errData.errors || [`HTTP ${res.status}`],
      };

      if (res.status >= 400 && res.status < 500) return lastResult;

    } catch (e) {
      lastResult = { ok: false, error: (e as Error).message };
    }

    if (attempt < maxAttempts) {
      await sleep(delays[attempt - 1] ?? 4000);
    }
  }

  return lastResult;
}

// ── Push principal ───────────────────────────────────────────────────────────

/**
 * Envia um pedido para a Partner API do CardápioWeb com retry automático
 * (3 tentativas com backoff: 1s, 2s, 4s) para erros transientes.
 */
export async function pushOrderToCW(
  order: Order & { order_type?: string; delivery_lat?: string; delivery_lng?: string; delivery_latitude?: string; delivery_longitude?: string },
  items: OrderItem[]
): Promise<PushOrderResult> {
  if (!isCWPartnerEnabled()) {
    return {
      ok: false,
      error: 'CW Partner não configurado — defina CW_BASE_URL, CW_API_KEY e CW_PARTNER_KEY no Vercel.',
    };
  }

  try {
    const methods  = await getCWPaymentMethods();
    const cwMethod = findPaymentMethod(methods, order.payment_method);

    if (!cwMethod) {
      return { ok: false, error: 'Nenhum método de pagamento ativo encontrado no CardápioWeb.' };
    }

    const payload = formatOrderPayload(order, items, cwMethod);

    const validationError = validatePayload(payload);
    if (validationError) {
      return { ok: false, error: validationError };
    }

    return await postOrderWithRetry(payload);

  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
