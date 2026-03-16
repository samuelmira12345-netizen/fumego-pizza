import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { earnCashback } from '../../../../lib/cashback';
import { logger } from '../../../../lib/logger';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE   = 20;

/**
 * POST /api/cron/process-cashback-queue
 *
 * Processa entradas pendentes da fila de cashback (P9).
 * Deve ser chamado por um cron job (ex: Vercel Cron Jobs, serviço externo).
 *
 * Autenticação: header Authorization: Bearer <CRON_SECRET>
 * Configure CRON_SECRET nas variáveis de ambiente do Vercel.
 *
 * Vercel cron.json example:
 *   { "crons": [{ "path": "/api/cron/process-cashback-queue", "schedule": "0 * * * *" }] }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();

  // Busca as entradas mais antigas ainda não processadas e abaixo do limite de tentativas
  const { data: entries, error } = await supabase
    .from('cashback_earn_queue')
    .select('id, user_id, order_id, order_total, attempts')
    .is('processed_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    logger.error('[CronCashback] Erro ao buscar fila', error as unknown as Error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = { processed: 0, failed: 0, skipped: 0 };

  for (const entry of entries ?? []) {
    try {
      const earned = await earnCashback(
        supabase,
        entry.user_id,
        entry.order_id,
        entry.order_total,
      );

      // earnCashback returns 0 for "already done" or "cashback disabled" — both OK
      await supabase
        .from('cashback_earn_queue')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', entry.id);

      if (earned > 0) {
        logger.info('[CronCashback] Cashback creditado via fila', {
          orderId: entry.order_id,
          earned,
        });
      }
      results.processed++;
    } catch (e) {
      const attempts = entry.attempts + 1;
      await supabase
        .from('cashback_earn_queue')
        .update({
          attempts,
          last_error: (e as Error).message?.slice(0, 500) || 'unknown',
          // Mark as permanently failed after MAX_ATTEMPTS to avoid infinite loops
          processed_at: attempts >= MAX_ATTEMPTS ? new Date().toISOString() : null,
        })
        .eq('id', entry.id);

      logger.error('[CronCashback] Tentativa falhou', e as Error);
      results.failed++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
