import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { getOrder, isIntegrationEnabled } from '../../../../lib/cardapioweb';
import { logger } from '../../../../lib/logger';

/**
 * POST /api/cardapioweb/webhook
 *
 * Recebe notificações de eventos do CardápioWeb:
 *   - ORDER_CREATED        → novo pedido aguardando confirmação
 *   - ORDER_STATUS_UPDATED → mudança de status de um pedido existente
 *
 * Configuração no Portal CardápioWeb:
 *   Configurações → Integrações → API → Webhooks
 *   URL: https://<seu-domínio>/api/cardapioweb/webhook
 *
 * Timeout: o CardápioWeb aguarda 200 OK em até 5 segundos.
 * Em caso de falha, há retry com backoff (15s, 30s, 60s… até 15 tentativas).
 * Após 15 falhas, o webhook é pausado e deve ser reativado manualmente no Portal.
 *
 * Autenticação opcional via header X-Webhook-Token (configure em CARDAPIOWEB_WEBHOOK_TOKEN).
 */
export async function POST(request) {
  // Responder 200 rapidamente; processamento pesado (getOrder) acontece antes
  // mas dentro do mesmo handler para garantir consistência.
  try {
    if (!isIntegrationEnabled()) {
      logger.warn('[CW Webhook] CARDAPIOWEB_API_KEY não configurada — integração desabilitada');
      return NextResponse.json({ received: true });
    }

    // ── Verificação do token de webhook (opcional) ──────────────────────────
    const webhookToken = process.env.CARDAPIOWEB_WEBHOOK_TOKEN;
    if (webhookToken) {
      const received = request.headers.get('x-webhook-token');
      if (received !== webhookToken) {
        logger.warn('[CW Webhook] Token inválido recebido');
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
      }
    }

    // ── Parse do payload ────────────────────────────────────────────────────
    const body = await request.json();
    const { event_id, event_type, order_id, order_status } = body;

    logger.info('[CW Webhook] Evento recebido', { event_type, order_id, order_status });

    if (!event_type || !order_id) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // ── Verificar se já existe localmente (idempotência) ────────────────────
    const { data: existing } = await supabase
      .from('cardapioweb_orders')
      .select('id, status')
      .eq('cw_order_id', order_id)
      .maybeSingle();

    // ── ORDER_CREATED ───────────────────────────────────────────────────────
    if (event_type === 'ORDER_CREATED') {
      if (existing) {
        // Já temos este pedido — apenas atualizar status se mudou
        if (existing.status !== order_status) {
          await supabase
            .from('cardapioweb_orders')
            .update({ status: order_status, cw_updated_at: new Date().toISOString() })
            .eq('cw_order_id', order_id);
        }
      } else {
        // Pedido novo: buscar detalhes completos e persistir
        const orderData = await getOrder(order_id);
        await supabase.from('cardapioweb_orders').insert(buildInsertPayload(orderData));
      }
    }

    // ── ORDER_STATUS_UPDATED ────────────────────────────────────────────────
    else if (event_type === 'ORDER_STATUS_UPDATED') {
      if (existing) {
        await supabase
          .from('cardapioweb_orders')
          .update({ status: order_status, cw_updated_at: new Date().toISOString() })
          .eq('cw_order_id', order_id);
      } else {
        // Pedido desconhecido (pode ter chegado antes da integração ser ativada)
        // Buscar e criar localmente
        try {
          const orderData = await getOrder(order_id);
          await supabase.from('cardapioweb_orders').insert(buildInsertPayload(orderData));
        } catch (err) {
          logger.error('[CW Webhook] Falha ao buscar pedido desconhecido', { order_id, err: err.message });
        }
      }
    }

    // Retorna 200 para o CardápioWeb confirmar recebimento
    return NextResponse.json({ received: true });

  } catch (e) {
    logger.error('[CW Webhook] Erro inesperado', e);
    // Retornar 200 mesmo em erro interno para não acionar retries
    // (falhas de processamento devem ser investigadas nos logs)
    return NextResponse.json({ received: true });
  }
}

/**
 * Monta o objeto de inserção na tabela cardapioweb_orders
 * a partir do payload completo retornado pela API do CardápioWeb.
 */
function buildInsertPayload(order) {
  return {
    cw_order_id:      order.id,
    cw_display_id:    order.display_id,
    status:           order.status,
    order_type:       order.order_type,
    customer_name:    order.customer?.name  || null,
    customer_phone:   order.customer?.phone || null,
    delivery_address: order.delivery_address || null,
    items:            order.items    || [],
    payments:         order.payments || [],
    total:            order.total,
    delivery_fee:     order.delivery_fee   || 0,
    observation:      order.observation    || null,
    raw_data:         order,
    cw_created_at:    order.created_at,
    cw_updated_at:    order.updated_at,
  };
}
