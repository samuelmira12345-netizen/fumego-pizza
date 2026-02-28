import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { logger } from '../../../../../../../lib/logger';

/**
 * POST /api/open-delivery/v1/orders/{orderId}/delivered
 *
 * Chamado pelo CardápioWeb quando o pedido foi entregue ao cliente.
 * Atualiza o status para "delivered".
 *
 * Response 202: Accepted
 */
export async function POST(request, { params }) {
  const decoded = verifyODToken(request);
  if (!decoded) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { orderId } = params;
  try {
    await getSupabaseAdmin()
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', orderId);

    logger.info('[OD] Pedido entregue', { orderId });
    return NextResponse.json({ message: 'accepted' }, { status: 202 });
  } catch (e) {
    logger.error('[OD Delivered] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
