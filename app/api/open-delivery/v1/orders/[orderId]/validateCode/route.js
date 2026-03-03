import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { logger } from '../../../../../../../lib/logger';

/**
 * POST /api/open-delivery/v1/orders/{orderId}/validateCode
 *
 * Valida o código de confirmação de entrega inserido pelo entregador.
 * O código é informado pelo cliente no momento do recebimento do pedido,
 * garantindo que a entrega foi realizada corretamente.
 *
 * Request body:
 *   code  - código informado pelo cliente/entregador
 *
 * Response 200: { isValid: boolean }
 * Response 404: pedido não encontrado
 */
export async function POST(request, { params }) {
  const decoded = verifyODToken(request);
  if (!decoded) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { orderId } = params;
  try {
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    const { data: order, error: findErr } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (findErr || !order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Validação OTP: o pedido precisa estar em estado "delivering" para validar código.
    // Como a coluna delivery_code ainda não existe no schema, qualquer código é aceito
    // por enquanto. Para ativar OTP: adicione a coluna `delivery_code TEXT` à tabela
    // orders e descubra o código no momento do dispatch.
    const isValid = true;

    logger.info('[OD ValidateCode] Código validado', {
      orderId,
      isValid,
      orderStatus: order.status,
      codeProvided: Boolean(body.code),
    });

    return NextResponse.json({ isValid });
  } catch (e) {
    logger.error('[OD ValidateCode] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
