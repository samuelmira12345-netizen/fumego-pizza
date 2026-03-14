import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { isCWPartnerEnabled, pushOrderToCW } from '../../../../lib/cardapioweb-partner';
import { logger } from '../../../../lib/logger';

/**
 * GET /api/cron/dispatch-scheduled
 * Executa a cada 5 minutos via Vercel Cron.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: scheduledOrders, error } = await supabase.from('orders')
      .select('*')
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', now)
      .eq('status', 'pending')
      .not('payment_status', 'eq', 'cancelled');

    if (error) throw error;

    const { data: failedOrders } = await supabase.from('orders')
      .select('*')
      .eq('cw_push_status', 'failed')
      .lt('cw_push_attempts', 6)
      .not('status', 'eq', 'cancelled');

    const toDispatch = scheduledOrders || [];
    const toRetry    = (failedOrders || []).filter(
      (o: { id: string }) => !toDispatch.some((d: { id: string }) => d.id === o.id)
    );

    if (!toDispatch.length && !toRetry.length) {
      return NextResponse.json({ dispatched: 0, retried: 0 });
    }

    let dispatched = 0;
    for (const order of toDispatch) {
      await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id);

      const { data: orderItems } = await supabase
        .from('order_items').select('*').eq('order_id', order.id);

      if (isCWPartnerEnabled()) {
        pushOrderToCW(order, orderItems || [])
          .then(async (r: { ok: boolean; data?: { id?: string }; error?: string; errors?: string[] }) => {
            if (r.ok) {
              logger.info('[Cron] Pedido agendado enviado ao CardápioWeb', {
                orderId: order.id, cwOrderId: r.data?.id, scheduled_for: order.scheduled_for,
              });
              await supabase.from('orders').update({
                cw_push_status:     'success',
                cw_push_attempts:   (order.cw_push_attempts || 0) + 1,
                cw_push_last_error: null,
              }).eq('id', order.id);
            } else {
              const errMsg = r.error || (r.errors || []).join('; ');
              logger.error('[Cron] Falha ao enviar pedido agendado ao CardápioWeb', {
                orderId: order.id, errors: r.errors, error: r.error,
              });
              await supabase.from('orders').update({
                cw_push_status:     'failed',
                cw_push_attempts:   (order.cw_push_attempts || 0) + 1,
                cw_push_last_error: errMsg?.slice(0, 500),
              }).eq('id', order.id);
            }
          })
          .catch(async (e: Error) => {
            logger.error('[Cron] Exceção ao enviar pedido agendado ao CardápioWeb', {
              orderId: order.id, error: e.message,
            });
            await supabase.from('orders').update({
              cw_push_status:     'failed',
              cw_push_attempts:   (order.cw_push_attempts || 0) + 1,
              cw_push_last_error: e.message?.slice(0, 500),
            }).eq('id', order.id);
          });
      }

      dispatched++;
    }

    let retried = 0;
    if (isCWPartnerEnabled()) {
      for (const order of toRetry) {
        const { data: orderItems } = await supabase
          .from('order_items').select('*').eq('order_id', order.id);

        pushOrderToCW(order, orderItems || [])
          .then(async (r: { ok: boolean; data?: { id?: string }; error?: string; errors?: string[] }) => {
            if (r.ok) {
              logger.info('[Cron] Retry CW bem-sucedido', {
                orderId: order.id, cwOrderId: r.data?.id, attempt: (order.cw_push_attempts || 0) + 1,
              });
              await supabase.from('orders').update({
                cw_push_status:     'success',
                cw_push_attempts:   (order.cw_push_attempts || 0) + 1,
                cw_push_last_error: null,
              }).eq('id', order.id);
            } else {
              const errMsg = r.error || (r.errors || []).join('; ');
              logger.error('[Cron] Retry CW falhou novamente', {
                orderId: order.id, attempt: (order.cw_push_attempts || 0) + 1, error: errMsg,
              });
              await supabase.from('orders').update({
                cw_push_status:     'failed',
                cw_push_attempts:   (order.cw_push_attempts || 0) + 1,
                cw_push_last_error: errMsg?.slice(0, 500),
              }).eq('id', order.id);
            }
          })
          .catch(async (e: Error) => {
            await supabase.from('orders').update({
              cw_push_status:     'failed',
              cw_push_attempts:   (order.cw_push_attempts || 0) + 1,
              cw_push_last_error: e.message?.slice(0, 500),
            }).eq('id', order.id);
          });

        retried++;
      }
    }

    logger.info(`[Cron] dispatch-scheduled: ${dispatched} despachado(s), ${retried} retry(s) CW`);
    return NextResponse.json({ dispatched, retried });
  } catch (e) {
    logger.error('[Cron] Erro em dispatch-scheduled:', e as Error);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
