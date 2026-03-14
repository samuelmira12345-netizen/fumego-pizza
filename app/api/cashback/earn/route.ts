import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { earnCashback } from '../../../../lib/cashback';
import { logger } from '../../../../lib/logger';

/**
 * POST /api/cashback/earn
 * Registra cashback ganho após confirmação de pagamento (PIX/cartão online).
 *
 * Body: { user_id, order_id, order_total }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user_id, order_id, order_total } = await request.json();

    if (!user_id || !order_id || !order_total || order_total <= 0) {
      return NextResponse.json({ earned: 0 });
    }

    const supabase = getSupabaseAdmin();
    const earned = await earnCashback(supabase, user_id, order_id, order_total);

    return NextResponse.json({ earned });
  } catch (e) {
    logger.error('[Cashback Earn API]', e as Error);
    return NextResponse.json({ earned: 0 });
  }
}
