import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { getOrder, isIntegrationEnabled } from '../../../../lib/cardapioweb';
import { logger } from '../../../../lib/logger';

function buildInsertPayload(order: Record<string, unknown>): Record<string, unknown> {
  const customer = order.customer as Record<string, unknown> | null;
  return {
    cw_order_id:      order.id,
    cw_display_id:    order.display_id,
    status:           order.status,
    order_type:       order.order_type,
    customer_name:    customer?.name  || null,
    customer_phone:   customer?.phone || null,
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!isIntegrationEnabled()) {
      logger.warn('[CW Webhook] CARDAPIOWEB_API_KEY não configurada — integração desabilitada');
      return NextResponse.json({ received: true });
    }

    const webhookToken = process.env.CARDAPIOWEB_WEBHOOK_TOKEN;
    if (webhookToken) {
      const received = request.headers.get('x-webhook-token');
      if (received !== webhookToken) {
        logger.warn('[CW Webhook] Token inválido recebido');
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { event_type, order_id, order_status } = body;

    logger.info('[CW Webhook] Evento recebido', { event_type, order_id, order_status });

    if (!event_type || !order_id) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('cardapioweb_orders')
      .select('id, status')
      .eq('cw_order_id', order_id)
      .maybeSingle();

    if (event_type === 'ORDER_CREATED') {
      if (existing) {
        if (existing.status !== order_status) {
          await supabase
            .from('cardapioweb_orders')
            .update({ status: order_status, cw_updated_at: new Date().toISOString() })
            .eq('cw_order_id', order_id);
        }
      } else {
        const orderData = await getOrder(order_id) as Record<string, unknown>;
        await supabase.from('cardapioweb_orders').insert(buildInsertPayload(orderData));
      }
    } else if (event_type === 'ORDER_STATUS_UPDATED') {
      if (existing) {
        await supabase
          .from('cardapioweb_orders')
          .update({ status: order_status, cw_updated_at: new Date().toISOString() })
          .eq('cw_order_id', order_id);
      } else {
        try {
          const orderData = await getOrder(order_id) as Record<string, unknown>;
          await supabase.from('cardapioweb_orders').insert(buildInsertPayload(orderData));
        } catch (err) {
          logger.error('[CW Webhook] Falha ao buscar pedido desconhecido', { order_id, err: (err as Error).message });
        }
      }
    }

    return NextResponse.json({ received: true });

  } catch (e) {
    logger.error('[CW Webhook] Erro inesperado', e as Error);
    return NextResponse.json({ received: true });
  }
}
