import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { earnCashback } from '../../../../../../../lib/cashback';
import { logger } from '../../../../../../../lib/logger';

/**
 * POST /api/open-delivery/v1/orders/{orderId}/delivered
 *
 * Chamado pelo CardápioWeb quando o pedido foi entregue ao cliente.
 * Atualiza o status para "delivered" e gera o cashback para dinheiro/cartão na entrega.
 * Para PIX/cartão online o cashback já foi gerado na confirmação do pagamento.
 *
 * Response 202: Accepted
 */
export async function POST(request, { params }) {
  const decoded = verifyODToken(request);
  if (!decoded) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { orderId } = params;
  try {
    const supabase = getSupabaseAdmin();

    // Busca dados do pedido antes de atualizar (para gerar cashback corretamente)
    const { data: order } = await supabase
      .from('orders')
      .select('user_id, total, payment_method')
      .eq('id', orderId)
      .single();

    await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', orderId);

    logger.info('[OD] Pedido entregue', { orderId });

    // Gera cashback para dinheiro e cartão na entrega (finalização pela loja)
    // PIX/cartão online já recebem cashback na confirmação do pagamento
    if (order?.user_id && ['cash', 'card_delivery'].includes(order.payment_method)) {
      earnCashback(supabase, order.user_id, orderId, order.total)
        .catch(e => logger.error('[Cashback] Erro ao gerar cashback no delivered', { orderId, err: e.message }));
    }

    return NextResponse.json({ message: 'accepted' }, { status: 202 });
  } catch (e) {
    logger.error('[OD Delivered] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
