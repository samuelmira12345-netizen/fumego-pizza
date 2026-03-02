import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { isCWPushEnabled, pushEventToCardapioWeb } from '../../../../lib/open-delivery';
import { logger } from '../../../../lib/logger';

/**
 * GET /api/cron/dispatch-scheduled
 * Executa a cada 5 minutos via Vercel Cron.
 * Busca pedidos agendados cujo horário já passou e os confirma,
 * enviando o evento CREATED ao CardápioWeb para que a cozinha receba.
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
      .select('id, order_number, scheduled_for, payment_status')
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

      // Insere evento Open Delivery
      await supabase.from('od_events').insert({ order_id: order.id, event_type: 'CREATED' }).catch(() => {});

      // Push ao CardápioWeb
      if (isCWPushEnabled()) {
        pushEventToCardapioWeb(order.id, 'CREATED')
          .then(r => {
            if (!r.ok) logger.error('[Cron] Falha ao notificar CardápioWeb', { orderId: order.id });
            else logger.info('[Cron] Pedido agendado disparado', { orderId: order.id, scheduled_for: order.scheduled_for });
          })
          .catch(e => logger.error('[Cron] Exceção ao notificar CardápioWeb', { orderId: order.id, error: e.message }));
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
