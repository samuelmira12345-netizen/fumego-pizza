import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { logger } from '../../../../../../../lib/logger';

/**
 * POST /api/open-delivery/v1/orders/{orderId}/requestCancellation
 *
 * Chamado pelo CardápioWeb quando o estabelecimento quer cancelar o pedido.
 * Nós aceitamos a solicitação e atualizamos o status para "cancelled".
 * (Para MVP aceitamos automaticamente; num sistema real consultaríamos o cliente)
 *
 * Request body: { reason, code, mode }
 * Response 202: Accepted (processamento assíncrono)
 */
export async function POST(request, { params }) {
  const decoded = verifyODToken(request);
  if (!decoded) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { orderId } = params;
  try {
    const body = await request.json().catch(() => ({}));

    await getSupabaseAdmin()
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    logger.info('[OD] Cancelamento solicitado pelo CardápioWeb', { orderId, reason: body.reason, code: body.code });
    return NextResponse.json({ message: 'accepted' }, { status: 202 });
  } catch (e) {
    logger.error('[OD RequestCancellation] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
