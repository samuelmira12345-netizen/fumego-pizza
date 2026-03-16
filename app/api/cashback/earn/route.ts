import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { earnCashbackWithQueue } from '../../../../lib/cashback';
import { logger } from '../../../../lib/logger';
import { getAuthUserWithRevocation } from '../../../../lib/auth';

/**
 * POST /api/cashback/earn
 * Registra cashback ganho após confirmação de pagamento (PIX/cartão online).
 *
 * Requer autenticação JWT do usuário. O user_id do body deve corresponder
 * ao usuário autenticado. O total do pedido é lido do banco de dados (não
 * do body) para evitar inflação de valor pelo cliente.
 *
 * Body: { user_id, order_id }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdmin();
    const authUser = await getAuthUserWithRevocation(request, supabase);
    if (!authUser) {
      return NextResponse.json({ earned: 0 }, { status: 401 });
    }

    const { user_id, order_id } = await request.json();

    if (!user_id || !order_id) {
      return NextResponse.json({ earned: 0 });
    }

    // Garante que o usuário só pode registrar cashback para sua própria conta
    if (user_id !== authUser.userId) {
      return NextResponse.json({ earned: 0 }, { status: 403 });
    }

    // Busca o pedido no banco para obter o total autoritativo e verificar
    // que o pedido pertence ao usuário e que o pagamento foi aprovado.
    // Isso impede que o cliente envie um order_total inflado.
    const { data: order } = await supabase
      .from('orders')
      .select('id, total, payment_status')
      .eq('id', order_id)
      .eq('user_id', user_id)
      .eq('payment_status', 'approved')
      .single();

    if (!order) {
      // Pedido não encontrado, não pertence ao usuário, ou pagamento não aprovado
      return NextResponse.json({ earned: 0 });
    }

    const earned = await earnCashbackWithQueue(supabase, user_id, order_id, order.total);
    return NextResponse.json({ earned });
  } catch (e) {
    logger.error('[Cashback Earn API]', e as Error);
    return NextResponse.json({ earned: 0 });
  }
}
