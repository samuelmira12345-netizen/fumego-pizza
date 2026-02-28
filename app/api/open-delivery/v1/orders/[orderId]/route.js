import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../lib/supabase';
import { verifyODToken, formatOrderAsOD } from '../../../../../../lib/open-delivery';
import { logger } from '../../../../../../lib/logger';

/**
 * GET /api/open-delivery/v1/orders/{orderId}
 *
 * O CardápioWeb chama este endpoint após receber um evento CREATED no polling,
 * para buscar todos os detalhes do pedido (itens, endereço, pagamento, cliente).
 *
 * Response 200: Order object no formato Open Delivery
 */
export async function GET(request, { params }) {
  const decoded = verifyODToken(request);
  if (!decoded) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { orderId } = params;

  try {
    const supabase = getSupabaseAdmin();

    const [orderRes, itemsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).single(),
      supabase.from('order_items').select('*').eq('order_id', orderId),
    ]);

    if (orderRes.error || !orderRes.data) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const odOrder = formatOrderAsOD(orderRes.data, itemsRes.data || []);
    return NextResponse.json(odOrder);
  } catch (e) {
    logger.error('[OD Order Details] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
