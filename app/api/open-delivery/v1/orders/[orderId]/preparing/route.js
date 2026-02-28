import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { logger } from '../../../../../../../lib/logger';

/**
 * POST /api/open-delivery/v1/orders/{orderId}/preparing
 *
 * Opcional. Chamado pelo CardápioWeb quando a preparação do pedido iniciou.
 * Atualiza o status para "preparing".
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
      .update({ status: 'preparing' })
      .eq('id', orderId);

    logger.info('[OD] Pedido em preparação', { orderId });
    return NextResponse.json({ message: 'accepted' }, { status: 202 });
  } catch (e) {
    logger.error('[OD Preparing] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
