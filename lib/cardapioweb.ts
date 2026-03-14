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

interface GetOrdersOptions {
  updatedSince?: string;
  status?: string | string[];
}

interface GetOrderHistoryOptions {
  status?: string | string[];
  page?: number | string;
  perPage?: number | string;
}

interface GetCouponsOptions {
  page?: number | string;
  perPage?: number | string;
}

/**
 * Monta os headers obrigatórios para todas as requisições.
 * Lança erro se a variável de ambiente não estiver configurada.
 */
function getHeaders(): Record<string, string> {
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
async function cwFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers as Record<string, string> || {}),
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
 */
export async function getOrders({ updatedSince, status }: GetOrdersOptions = {}): Promise<unknown> {
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
 */
export async function getOrder(orderId: number | string): Promise<unknown> {
  return cwFetch(`/api/partner/v1/orders/${orderId}`);
}

/**
 * Histórico de pedidos por período (max 6 meses de intervalo).
 * Rate limit: 5 req/min.
 */
export async function getOrderHistory(
  startDate: string,
  endDate: string,
  { status, page, perPage }: GetOrderHistoryOptions = {}
): Promise<unknown> {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    statuses.forEach(s => params.append('status[]', s));
  }
  if (page)    params.set('page', String(page));
  if (perPage) params.set('per_page', String(perPage));
  return cwFetch(`/api/partner/v1/orders/history?${params}`);
}

/**
 * Confirma/aceita um pedido (waiting_confirmation → confirmed).
 */
export async function confirmOrder(orderId: number | string): Promise<unknown> {
  return cwFetch(`/api/partner/v1/orders/${orderId}/confirm`, { method: 'POST' });
}

/**
 * Inicia preparação de pedido agendado (scheduled_confirmed → confirmed).
 */
export async function startPreparation(orderId: number | string): Promise<unknown> {
  return cwFetch(`/api/partner/v1/orders/${orderId}/start_preparation`, { method: 'POST' });
}

/**
 * Marca pedido como pronto.
 */
export async function markOrderReady(orderId: number | string): Promise<unknown> {
  return cwFetch(`/api/partner/v1/orders/${orderId}/ready`, { method: 'POST' });
}

/**
 * Marca pedido de delivery como entregue (released → delivered).
 */
export async function markOrderDelivered(orderId: number | string): Promise<unknown> {
  return cwFetch(`/api/partner/v1/orders/${orderId}/delivered`, { method: 'POST' });
}

/**
 * Finaliza o pedido (status final: closed).
 */
export async function finalizeOrder(orderId: number | string): Promise<unknown> {
  return cwFetch(`/api/partner/v1/orders/${orderId}/finalize`, { method: 'POST' });
}

/**
 * Cancela o pedido (status final: canceled).
 */
export async function cancelOrder(orderId: number | string, cancellationReason?: string): Promise<unknown> {
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
 */
export async function getMerchant(): Promise<unknown> {
  return cwFetch('/api/partner/v1/merchant');
}

/**
 * Lista cupons do estabelecimento.
 */
export async function getCoupons({ page, perPage }: GetCouponsOptions = {}): Promise<unknown> {
  const params = new URLSearchParams();
  if (page)    params.set('page', String(page));
  if (perPage) params.set('per_page', String(perPage));
  const query = params.toString() ? `?${params}` : '';
  return cwFetch(`/api/partner/v1/merchant/coupons${query}`);
}

/**
 * Lista avaliações do estabelecimento.
 */
export async function getReviews(): Promise<unknown> {
  return cwFetch('/api/partner/v1/merchant/reviews');
}

// ============================================================
// MÓDULO: CATÁLOGO  (/api/partner/v1/catalog)
// ============================================================

/**
 * Retorna o catálogo completo (categorias, produtos, complementos).
 */
export async function getCatalog(): Promise<unknown> {
  return cwFetch('/api/partner/v1/catalog');
}

// ============================================================
// UTILITÁRIOS
// ============================================================

/**
 * Verifica se a integração está ativa (API key configurada).
 */
export function isIntegrationEnabled(): boolean {
  return Boolean(process.env.CARDAPIOWEB_API_KEY);
}

/**
 * Mapeia status do CardápioWeb para rótulo em português.
 */
export const STATUS_LABELS: Record<string, string> = {
  waiting_confirmation:   'Aguardando',
  pending_payment:        'Pag. Pendente',
  pending_online_payment: 'Pag. Online Pendente',
  scheduled_confirmed:    'Agendado',
  confirmed:              'Confirmado',
  released:               'Em Entrega',
  waiting_to_catch:       'Aguard. Retirada',
  delivered:              'Entregue',
  canceling:              'Cancelando',
  canceled:               'Cancelado',
  closed:                 'Finalizado',
};

/**
 * Mapeia tipo de pedido para rótulo em português.
 */
export const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery:     'Delivery',
  takeout:      'Retirada',
  onsite:       'Mesa',
  closed_table: 'Comanda',
};
