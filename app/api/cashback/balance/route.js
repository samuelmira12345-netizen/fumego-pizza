import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { getCashbackBalance } from '../../../../lib/cashback';

/**
 * GET /api/cashback/balance?user_id=...
 * Retorna o saldo válido de cashback e o histórico de transações do usuário.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ balance: 0, transactions: [] });
  }

  try {
    const supabase = getSupabaseAdmin();
    const result = await getCashbackBalance(supabase, userId);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[Cashback Balance]', e.message);
    return NextResponse.json({ balance: 0, transactions: [] });
  }
}
