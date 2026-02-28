import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../lib/open-delivery';
import { logger } from '../../../../../../lib/logger';

/**
 * POST /api/open-delivery/v1/events/acknowledgment
 *
 * O CardápioWeb chama este endpoint para confirmar que recebeu e processou
 * um ou mais eventos do polling. Eventos acknowledged são removidos da fila.
 *
 * Request body: array de AckEvents:
 *   [{ id: "eventId", orderId: "uuid", eventType: "CREATED" }]
 *
 * Response 202: Accepted
 */
export async function POST(request) {
  const decoded = verifyODToken(request);
  if (!decoded) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const acks = Array.isArray(body) ? body : [body];

    if (acks.length === 0) {
      return NextResponse.json({ message: 'No events to acknowledge' }, { status: 400 });
    }

    const eventIds = acks.map(a => a.id).filter(Boolean);
    if (eventIds.length === 0) {
      return NextResponse.json({ message: 'Invalid acknowledgment payload' }, { status: 400 });
    }

    const supabase  = getSupabaseAdmin();
    const now       = new Date().toISOString();

    const { error } = await supabase
      .from('od_events')
      .update({ acknowledged_at: now })
      .in('id', eventIds)
      .is('acknowledged_at', null);

    if (error) {
      logger.error('[OD Ack] Erro ao marcar eventos', error);
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    return NextResponse.json({ acknowledged: eventIds.length }, { status: 202 });
  } catch (e) {
    logger.error('[OD Ack] Erro inesperado', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
