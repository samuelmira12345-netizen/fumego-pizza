import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { logger } from '../../../../../../../lib/logger';

/**
 * POST /api/open-delivery/v1/orders/{orderId}/tracking
 *
 * Recebe atualizações de rastreamento da entrega (posição do entregador,
 * previsão de chegada, etc.) enviadas pelo CardápioWeb ou Logistic Service.
 *
 * Request body:
 *   description   - descrição do evento de rastreamento
 *   deliveryTime  - previsão de chegada (ISO 8601)
 *   latitude      - latitude do entregador
 *   longitude     - longitude do entregador
 *
 * Response 204: No Content (sucesso sem corpo)
 */
export async function POST(request, { params }) {
  const decoded = verifyODToken(request);
  if (!decoded) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { orderId } = params;
  try {
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    // Verifica se o pedido existe
    const { data: order, error: findErr } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (findErr || !order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Rastreamento recebido — logado para auditoria.
    // Se desejar persistir posição/ETA, adicione as colunas ao schema e descomente:
    // if (body.deliveryTime) {
    //   await supabase.from('orders').update({ estimated_delivery_time: body.deliveryTime }).eq('id', orderId);
    // }

    logger.info('[OD Tracking] Rastreamento recebido', {
      orderId,
      description: body.description,
      deliveryTime: body.deliveryTime,
      lat: body.latitude,
      lng: body.longitude,
    });

    // 204 No Content conforme o padrão Open Delivery
    return new Response(null, { status: 204 });
  } catch (e) {
    logger.error('[OD Tracking] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
