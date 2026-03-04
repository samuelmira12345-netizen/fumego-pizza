import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { earnCashback } from '../../../../lib/cashback';

/**
 * POST /api/cashback/earn
 * Registra cashback ganho após confirmação de pagamento (PIX/cartão online).
 * Para cash/card_delivery o earn já ocorre no create-order.
 *
 * Body: { user_id, order_id, order_total }
 */
export async function POST(request) {
  try {
    const { user_id, order_id, order_total } = await request.json();

    if (!user_id || !order_id || !order_total || order_total <= 0) {
      return NextResponse.json({ earned: 0 });
    }

    const supabase = getSupabaseAdmin();
    const earned = await earnCashback(supabase, user_id, order_id, order_total);

    return NextResponse.json({ earned });
  } catch (e) {
    console.error('[Cashback Earn API]', e.message);
    return NextResponse.json({ earned: 0 });
  }
}
