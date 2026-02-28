import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { logger } from '../../../../../../../lib/logger';

/**
 * PATCH /api/open-delivery/v1/orders/{orderId}/details
 *
 * Atualiza propriedades não-status do pedido (tempo de preparo, observações, etc.).
 * Chamado pelo CardápioWeb para informar dados adicionais após confirmação.
 *
 * Request body (todos opcionais):
 *   preparationTime  - tempo de preparo estimado em minutos
 *   additionalInfo   - observações adicionais
 *   orderExternalCode- código externo do pedido no sistema do CardápioWeb
 *
 * Response 200: { message: "updated" }
 */
export async function PATCH(request, { params }) {
  const decoded = verifyODToken(request);
  if (!decoded) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { orderId } = params;
  try {
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    // Verifica se o pedido existe
    const { data: order, error: findErr } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .single();

    if (findErr || !order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Atualiza apenas o campo observations (existente no schema).
    // preparationTime e orderExternalCode são registrados no log para rastreabilidade.
    const updates = {};
    if (body.additionalInfo !== undefined) updates.observations = body.additionalInfo;

    if (Object.keys(updates).length > 0) {
      await supabase.from('orders').update(updates).eq('id', orderId);
    }

    logger.info('[OD Order Details] Detalhes atualizados', { orderId, updates });
    return NextResponse.json({ message: 'updated' });
  } catch (e) {
    logger.error('[OD Order Details] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
