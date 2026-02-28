import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { logger } from '../../../../../../../lib/logger';

/**
 * POST /api/open-delivery/v1/orders/{orderId}/confirm
 *
 * Chamado pelo CardápioWeb quando um funcionário aceita o pedido no dashboard.
 * Atualiza o status do pedido para "confirmed" no nosso banco.
 *
 * Request body: { createdAt, orderExternalCode, preparationTime? }
 * Response 202: Accepted
 */
export async function POST(request, { params }) {
  const decoded = verifyODToken(request);
  if (!decoded) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { orderId } = params;
  try {
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    await supabase
      .from('orders')
      .update({ status: 'confirmed' })
      .eq('id', orderId);

    logger.info('[OD] Pedido confirmado pelo CardápioWeb', { orderId, preparationTime: body.preparationTime });
    return NextResponse.json({ message: 'accepted' }, { status: 202 });
  } catch (e) {
    logger.error('[OD Confirm] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
