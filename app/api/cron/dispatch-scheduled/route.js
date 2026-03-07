import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { isCWPartnerEnabled, pushOrderToCW } from '../../../../lib/cardapioweb-partner';
import { logger } from '../../../../lib/logger';

/**
 * GET /api/cron/dispatch-scheduled
 * Executa a cada 5 minutos via Vercel Cron (ou pelo auto-dispatch do admin).
 * Busca pedidos agendados cujo horário já passou e os confirma,
 * enviando-os ao CardápioWeb via Partner API para que a cozinha receba.
 *
 * Autenticação: Bearer token via CRON_SECRET env var.
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Buscar pedidos agendados que já chegaram no horário e ainda estão pendentes
    const { data: orders, error } = await supabase.from('orders')
      .select('*')
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', now)
      .eq('status', 'pending')
      .not('payment_status', 'eq', 'cancelled');

    if (error) throw error;
    if (!orders?.length) return NextResponse.json({ dispatched: 0 });

    let dispatched = 0;
    for (const order of orders) {
      // Confirma o pedido
      await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id);

      // Busca os itens do pedido para enviar ao CW
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      // Envia ao CardápioWeb via Partner API
      if (isCWPartnerEnabled()) {
        pushOrderToCW(order, orderItems || [])
          .then(r => {
            if (r.ok) {
              logger.info('[Cron] Pedido agendado enviado ao CardápioWeb', {
                orderId:      order.id,
                cwOrderId:    r.data?.id,
                scheduled_for: order.scheduled_for,
              });
            } else {
              logger.error('[Cron] Falha ao enviar pedido agendado ao CardápioWeb', {
                orderId: order.id,
                errors:  r.errors,
                error:   r.error,
              });
            }
          })
          .catch(e =>
            logger.error('[Cron] Exceção ao enviar pedido agendado ao CardápioWeb', {
              orderId: order.id,
              error:   e.message,
            })
          );
      }

      dispatched++;
    }

    logger.info(`[Cron] dispatch-scheduled: ${dispatched} pedido(s) disparado(s)`);
    return NextResponse.json({ dispatched });
  } catch (e) {
    logger.error('[Cron] Erro em dispatch-scheduled:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
