/**
 * lib/cardapioweb-partner.js
 *
 * Cliente da Cardápio Web Partner API.
 * Envia pedidos feitos no app diretamente para o painel do CardápioWeb.
 *
 * Autenticação: dupla autenticação via headers HTTP
 *   X-API-KEY    — token do estabelecimento (obtido no portal do CardápioWeb)
 *   X-PARTNER-KEY — token do integrador (fornecido pelo CardápioWeb ao se cadastrar como integrador)
 *
 * Variáveis de ambiente necessárias:
 *   CW_BASE_URL      — URL base da API (ex: https://app.cardapioweb.com)
 *   CW_API_KEY       — X-API-KEY: token do estabelecimento
 *   CW_PARTNER_KEY   — X-PARTNER-KEY: token do integrador
 *
 * Variáveis opcionais:
 *   CW_DEFAULT_LAT   — Latitude do estabelecimento (fallback p/ coordenadas de entrega)
 *   CW_DEFAULT_LNG   — Longitude do estabelecimento (fallback p/ coordenadas de entrega)
 */

/** URL base sem barra final (evita double-slash nas rotas). */
function cwBaseUrl() {
  return (process.env.CW_BASE_URL || '').replace(/\/+$/, '');
}

/** Verifica se a integração Partner está configurada. */
export function isCWPartnerEnabled() {
  return !!(
    process.env.CW_BASE_URL &&
    process.env.CW_API_KEY  &&
    process.env.CW_PARTNER_KEY
  );
}

/** Headers de autenticação para todas as chamadas. */
function cwHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-API-KEY':    process.env.CW_API_KEY    || '',
    'X-PARTNER-KEY': process.env.CW_PARTNER_KEY || '',
  };
}

/**
 * GET /api/partner/v1/merchant/payment_methods
 * Retorna os métodos de pagamento ativos do estabelecimento no CW.
 */
export async function getCWPaymentMethods() {
  const res = await fetch(
    `${cwBaseUrl()}/api/partner/v1/merchant/payment_methods`,
    { headers: cwHeaders(), cache: 'no-store' }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status} mas resposta não é JSON. Primeiros 300 chars: ${text.slice(0, 300)}`);
  }
}

// ── Mapeamento de métodos de pagamento ───────────────────────────────────────

/** Mapeia nosso payment_method para o kind esperado pela API CW. */
const PAYMENT_KIND_MAP = {
  pix:           'pix',
  cash:          'money',
  card:          'credit_card',
  card_delivery: 'credit_card',
};

/** Encontra o método CW que corresponde ao método interno do pedido. */
function findPaymentMethod(methods, internalMethod) {
  const kind = PAYMENT_KIND_MAP[internalMethod] || 'pix';
  return methods.find(m => m.kind === kind) || methods[0] || null;
}

// ── Formatação do pedido ─────────────────────────────────────────────────────

/** Arredonda para 2 casas decimais. */
function r2(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

/**
 * Formata o pedido interno no payload exigido pela Partner API.
 * Regras de cálculo (documentação):
 *   items[].total_price = (unit_price + sum(options × unit_price)) × quantity
 *   totals.order_amount = sum(items.total_price) + delivery_fee + additional_fee - discounts
 *   sum(payments[].total) = totals.order_amount
 */
function formatOrderPayload(order, items, cwPaymentMethod) {
  // ── Telefone: apenas números, máximo 11 dígitos
  const phone = (order.customer_phone || '').replace(/\D/g, '').slice(0, 11) || '00000000000';

  // ── CEP: apenas números, 8 dígitos
  const postalCode = (order.delivery_zipcode || '').replace(/\D/g, '').padEnd(8, '0').slice(0, 8);

  // ── Itens: cada item do banco vira um item CW
  // Como o banco já tem unit_price e total_price corretos, usamos diretamente.
  const cwItems = items.map(item => {
    const entry = {
      name:        String(item.product_name || 'Item'),
      quantity:    Number(item.quantity)   || 1,
      unit_price:  r2(item.unit_price),
      total_price: r2(item.total_price),
    };
    // external_code: usa product_id ou drink_id como referência externa
    if (item.product_id) entry.external_code = String(item.product_id);
    if (item.drink_id)   entry.external_code = String(item.drink_id);
    if (item.observations) entry.observation = String(item.observations).slice(0, 500);
    return entry;
  });

  // ── Totais
  const itemsSum   = cwItems.reduce((s, i) => s + i.total_price, 0);
  const deliveryFee = r2(order.delivery_fee || 0);
  const discounts   = r2(order.discount     || 0);
  const orderAmount = r2(itemsSum + deliveryFee - discounts);

  // ── Coordenadas (fallback: localização do estabelecimento configurada via env)
  const lat = parseFloat(process.env.CW_DEFAULT_LAT || '0');
  const lng = parseFloat(process.env.CW_DEFAULT_LNG || '0');

  // ── Payload final
  const payload = {
    order_id:   String(order.id),
    display_id: String(order.order_number || order.id),
    order_type: 'delivery',
    created_at: order.created_at || new Date().toISOString(),

    customer: {
      phone,
      name:  order.customer_name  || null,
      email: order.customer_email || null,
    },

    totals: {
      order_amount: orderAmount,
      delivery_fee: deliveryFee,
      discounts,
    },

    delivery_address: {
      state:        (order.delivery_state        || '').toUpperCase(),
      city:          order.delivery_city         || '',
      neighborhood:  order.delivery_neighborhood || '',
      street:        order.delivery_street       || '',
      number:        order.delivery_number       || null,
      complement:    order.delivery_complement   || null,
      postal_code:   postalCode,
      coordinates: { latitude: lat, longitude: lng },
    },

    items: cwItems,

    payments: [{
      total:             orderAmount,
      payment_method_id: cwPaymentMethod.id,
    }],
  };

  if (order.observations) payload.observation = String(order.observations).slice(0, 500);

  return payload;
}

// ── Push principal ───────────────────────────────────────────────────────────

/**
 * Envia um pedido para a Partner API do CardápioWeb.
 *
 * @param {object} order  — Linha da tabela orders (já com todos os campos)
 * @param {object[]} items — Linhas da tabela order_items desse pedido
 * @returns {{ ok: boolean, data?: object, status?: number, errors?: string[], error?: string }}
 */
export async function pushOrderToCW(order, items) {
  if (!isCWPartnerEnabled()) {
    return {
      ok: false,
      error: 'CW Partner não configurado — defina CW_BASE_URL, CW_API_KEY e CW_PARTNER_KEY no Vercel.',
    };
  }

  try {
    // 1. Busca métodos de pagamento para obter o ID correto
    const methods  = await getCWPaymentMethods();
    const cwMethod = findPaymentMethod(methods, order.payment_method);

    if (!cwMethod) {
      return { ok: false, error: 'Nenhum método de pagamento ativo encontrado no CardápioWeb.' };
    }

    // 2. Formata o payload
    const payload = formatOrderPayload(order, items, cwMethod);

    // 3. Envia o pedido
    const res = await fetch(`${cwBaseUrl()}/api/partner/v1/orders`, {
      method:  'POST',
      headers: cwHeaders(),
      body:    JSON.stringify(payload),
    });

    if (res.status === 201) {
      const data = await res.json();
      return { ok: true, data };
    }

    const errData = await res.json().catch(() => ({}));
    return {
      ok:     false,
      status: res.status,
      errors: errData.errors || [`HTTP ${res.status}`],
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
