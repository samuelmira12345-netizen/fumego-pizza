import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase';
import { verifyODToken, orderURL } from '../../../../../lib/open-delivery';
import { logger } from '../../../../../lib/logger';

/**
 * GET /api/open-delivery/v1/events-polling
 * (mapeado de GET /v1/events:polling via rewrite em next.config.js)
 *
 * O CardápioWeb chama este endpoint periodicamente para buscar novos eventos
 * de pedidos criados ou cancelados no nosso app.
 *
 * Retorna array de Event objects conforme Open Delivery spec.
 * Eventos não-acknowledged continuam aparecendo até serem confirmados.
 *
 * Response 200: array de Events
 * Response 204: sem eventos pendentes
 */
export async function GET(request) {
  const decoded = verifyODToken(request);
  if (!decoded) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Buscar eventos pendentes (não acknowledged e não expirados)
    const { data: events, error } = await supabase
      .from('od_events')
      .select('id, order_id, event_type, created_at')
      .is('acknowledged_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      logger.error('[OD Polling] Erro ao buscar eventos', error);
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (!events || events.length === 0) {
      return new Response(null, { status: 204 });
    }

    const appId = process.env.OD_APP_ID || undefined;

    const body = events.map(ev => ({
      eventId:    ev.id,
      eventType:  ev.event_type,
      orderId:    ev.order_id,
      orderURL:   orderURL(ev.order_id),
      createdAt:  new Date(ev.created_at).toISOString(),
      ...(appId ? { sourceAppId: appId } : {}),
    }));

    return NextResponse.json(body);
  } catch (e) {
    logger.error('[OD Polling] Erro inesperado', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
