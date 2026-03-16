import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { getCashbackBalance } from '../../../../lib/cashback';
import { logger } from '../../../../lib/logger';
import { getAuthUserWithRevocation } from '../../../../lib/auth';

/**
 * GET /api/cashback/balance?user_id=...
 * Retorna o saldo válido de cashback e o histórico de transações do usuário.
 *
 * Requer autenticação JWT. O user_id da query string deve corresponder
 * ao usuário autenticado para impedir que qualquer pessoa consulte o
 * saldo de terceiros.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseAdmin();
  const authUser = await getAuthUserWithRevocation(request, supabase);
  if (!authUser) {
    return NextResponse.json({ balance: 0, transactions: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ balance: 0, transactions: [] });
  }

  // Garante que o usuário só pode consultar seu próprio saldo
  if (userId !== authUser.userId) {
    return NextResponse.json({ balance: 0, transactions: [] }, { status: 403 });
  }

  try {
    const [result, settingRes] = await Promise.all([
      getCashbackBalance(supabase, userId),
      supabase.from('settings').select('value').eq('key', 'cashback_max_percent').single(),
    ]);
    const cashbackMaxPercent = parseFloat(String(settingRes.data?.value) || '50');
    return NextResponse.json({ ...result, cashback_max_percent: cashbackMaxPercent });
  } catch (e) {
    logger.error('[Cashback Balance]', e as Error);
    return NextResponse.json({ balance: 0, transactions: [], cashback_max_percent: 50 });
  }
}
