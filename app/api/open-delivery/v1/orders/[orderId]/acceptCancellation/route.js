import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { logger } from '../../../../../../../lib/logger';

/**
 * POST /api/open-delivery/v1/orders/{orderId}/acceptCancellation
 *
 * Chamado pelo CardápioWeb aceitando um pedido de cancelamento que partiu de nós.
 * Confirma o cancelamento no nosso banco.
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
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    logger.info('[OD] Cancelamento aceito pelo CardápioWeb', { orderId });
    return NextResponse.json({ message: 'accepted' }, { status: 202 });
  } catch (e) {
    logger.error('[OD AcceptCancellation] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
