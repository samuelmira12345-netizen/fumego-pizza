/**
 * Cliente HTTP para a API do CardápioWeb
 * Documentação: https://cardapioweb.stoplight.io/docs/api
 *
 * Autenticação: header X-API-KEY com a chave gerada no Portal CardápioWeb
 *   Portal → Configurações → Integrações → API
 *
 * Ambientes:
 *   Sandbox:    https://integracao.sandbox.cardapioweb.com
 *   Produção:   https://integracao.cardapioweb.com
 */

const BASE_URL =
  process.env.CARDAPIOWEB_API_URL ||
  'https://integracao.cardapioweb.com';

/**
 * Monta os headers obrigatórios para todas as requisições.
 * Lança erro se a variável de ambiente não estiver configurada.
 */
function getHeaders() {
  const apiKey = process.env.CARDAPIOWEB_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[CardápioWeb] Variável CARDAPIOWEB_API_KEY não configurada. ' +
      'Gere um token em: Portal → Configurações → Integrações → API'
    );
  }
  return {
    'Content-Type': 'application/json',
    'X-API-KEY': apiKey,
  };
}

/**
 * Executa uma requisição autenticada à API do CardápioWeb.
 * - Retorna null para respostas 204 No Content.
 * - Lança Error para respostas de erro (4xx/5xx).
 */
async function cwFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `[CardápioWeb] ${res.status} ${res.statusText} em ${path}: ${body}`
    );
  }

  return res.json();
}

// ============================================================
// MÓDULO: PEDIDOS  (/api/partner/v1/orders)
// ============================================================

/**
 * Retorna pedidos modificados nas últimas 8 horas (polling).
 * Recomendado: chamar a cada 30 segundos como fallback para webhooks.
 *
 * @param {Object} opts
 * @param {string} [opts.updatedSince] - ISO 8601; retorna apenas pedidos modificados após esta data
 * @param {string|string[]} [opts.status] - Filtrar por status(es)
 */
export async function getOrders({ updatedSince, status } = {}) {
  const params = new URLSearchParams();
  if (updatedSince) params.set('updated_since', updatedSince);
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    statuses.forEach(s => params.append('status[]', s));
  }
  const query = params.toString() ? `?${params}` : '';
  return cwFetch(`/api/partner/v1/orders${query}`);
}

/**
 * Retorna os detalhes completos de um pedido pelo ID do CardápioWeb.
 * @param {number} orderId
 */
export async function getOrder(orderId) {
  return cwFetch(`/api/partner/v1/orders/${orderId}`);
}

/**
 * Histórico de pedidos por período (max 6 meses de intervalo).
 * Rate limit: 5 req/min.
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 */
export async function getOrderHistory(startDate, endDate, { status, page, perPage } = {}) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    statuses.forEach(s => params.append('status[]', s));
  }
  if (page) params.set('page', page);
  if (perPage) params.set('per_page', perPage);
  return cwFetch(`/api/partner/v1/orders/history?${params}`);
}

/**
 * Confirma/aceita um pedido (waiting_confirmation → confirmed).
 * Para pedidos agendados: waiting_confirmation → scheduled_confirmed.
 * @param {number} orderId
 */
export async function confirmOrder(orderId) {
  return cwFetch(`/api/partner/v1/orders/${orderId}/confirm`, { method: 'POST' });
}

/**
 * Inicia preparação de pedido agendado (scheduled_confirmed → confirmed).
 * @param {number} orderId
 */
export async function startPreparation(orderId) {
  return cwFetch(`/api/partner/v1/orders/${orderId}/start_preparation`, { method: 'POST' });
}

/**
 * Marca pedido como pronto:
 *   - delivery    → released
 *   - takeout/onsite → waiting_to_catch
 * @param {number} orderId
 */
export async function markOrderReady(orderId) {
  return cwFetch(`/api/partner/v1/orders/${orderId}/ready`, { method: 'POST' });
}

/**
 * Marca pedido de delivery como entregue (released → delivered).
 * Disponível apenas para pedidos de entrega em status "released".
 * @param {number} orderId
 */
export async function markOrderDelivered(orderId) {
  return cwFetch(`/api/partner/v1/orders/${orderId}/delivered`, { method: 'POST' });
}

/**
 * Finaliza o pedido (status final: closed). Sem retorno possível.
 * @param {number} orderId
 */
export async function finalizeOrder(orderId) {
  return cwFetch(`/api/partner/v1/orders/${orderId}/finalize`, { method: 'POST' });
}

/**
 * Cancela o pedido (status final: canceled). Sem retorno possível.
 * @param {number} orderId
 * @param {string} [cancellationReason] - Motivo do cancelamento (opcional)
 */
export async function cancelOrder(orderId, cancellationReason) {
  const body = cancellationReason
    ? JSON.stringify({ cancellation_reason: cancellationReason })
    : undefined;
  return cwFetch(`/api/partner/v1/orders/${orderId}/cancel`, {
    method: 'POST',
    ...(body ? { body } : {}),
  });
}

// ============================================================
// MÓDULO: LOJA  (/api/partner/v1/merchant)
// ============================================================

/**
 * Retorna informações do estabelecimento (endereço, horários, etc.).
 * Rate limit: 5 req/min.
 */
export async function getMerchant() {
  return cwFetch('/api/partner/v1/merchant');
}

/**
 * Lista cupons do estabelecimento.
 * @param {number} [page]
 * @param {number} [perPage] - Máx. 20
 */
export async function getCoupons({ page, perPage } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', page);
  if (perPage) params.set('per_page', perPage);
  const query = params.toString() ? `?${params}` : '';
  return cwFetch(`/api/partner/v1/merchant/coupons${query}`);
}

/**
 * Lista avaliações do estabelecimento.
 */
export async function getReviews() {
  return cwFetch('/api/partner/v1/merchant/reviews');
}

// ============================================================
// MÓDULO: CATÁLOGO  (/api/partner/v1/catalog)
// ============================================================

/**
 * Retorna o catálogo completo (categorias, produtos, complementos).
 * Rate limit: 5 req/min.
 */
export async function getCatalog() {
  return cwFetch('/api/partner/v1/catalog');
}

// ============================================================
// UTILITÁRIOS
// ============================================================

/**
 * Verifica se a integração está ativa (API key configurada).
 */
export function isIntegrationEnabled() {
  return Boolean(process.env.CARDAPIOWEB_API_KEY);
}

/**
 * Mapeia status do CardápioWeb para rótulo em português.
 */
export const STATUS_LABELS = {
  waiting_confirmation: 'Aguardando',
  pending_payment:      'Pag. Pendente',
  pending_online_payment: 'Pag. Online Pendente',
  scheduled_confirmed:  'Agendado',
  confirmed:            'Confirmado',
  released:             'Em Entrega',
  waiting_to_catch:     'Aguard. Retirada',
  delivered:            'Entregue',
  canceling:            'Cancelando',
  canceled:             'Cancelado',
  closed:               'Finalizado',
};

/**
 * Mapeia tipo de pedido para rótulo em português.
 */
export const ORDER_TYPE_LABELS = {
  delivery:     'Delivery',
  takeout:      'Retirada',
  onsite:       'Mesa',
  closed_table: 'Comanda',
};
