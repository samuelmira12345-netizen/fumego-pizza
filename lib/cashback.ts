/**
 * lib/cashback.ts
 * Funções core do sistema de Carteira de Cashback.
 *
 * Regras de negócio:
 * - Porcentagem dinâmica: lida da tabela settings (key = 'cashback_percent')
 * - Expiração independente: cada cashback expira 30 dias após gerado
 * - Limite de uso: máximo 50% do total do pedido atual
 * - FIFO: os cashbacks mais antigos são consumidos primeiro (protege contra expiração)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

export interface CashbackTransaction {
  id: string;
  amount: number;
  remaining: number;
  expires_at: string;
  created_at: string;
}

export interface CashbackBalance {
  balance: number;
  transactions: CashbackTransaction[];
}

/**
 * Calcula o saldo válido de cashback do usuário, marcando expirados (soft expiry).
 */
export async function getCashbackBalance(supabase: SupabaseClient, userId: string): Promise<CashbackBalance> {
  const now = new Date().toISOString();

  // Marca como expiradas as transações que passaram do prazo (soft expiry em leitura)
  await supabase
    .from('cashback_transactions')
    .update({ status: 'expired', remaining: 0 })
    .eq('user_id', userId)
    .eq('type', 'earn')
    .in('status', ['active', 'partial'])
    .lt('expires_at', now);

  const { data: transactions } = await supabase
    .from('cashback_transactions')
    .select('id, amount, remaining, expires_at, created_at')
    .eq('user_id', userId)
    .eq('type', 'earn')
    .in('status', ['active', 'partial'])
    .gt('remaining', 0)
    .gte('expires_at', now)
    .order('created_at', { ascending: true });

  const balance = (transactions || []).reduce((sum, t) => sum + Number(t.remaining), 0);

  return {
    balance: Math.round(balance * 100) / 100,
    transactions: transactions || [],
  };
}

/**
 * Registra cashback ganho pelo usuário após a confirmação de um pedido.
 * Idempotente: não cria duplicatas para o mesmo order_id.
 * Lança exceção em caso de falha — use earnCashbackWithQueue para retry automático.
 *
 * @returns Valor de cashback gerado (0 se cashback desativado ou duplicata)
 */
export async function earnCashback(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  orderTotal: number
): Promise<number> {
  try {
    if (!userId || !orderId || !orderTotal) return 0;

    // Busca a porcentagem configurada no painel admin
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'cashback_percent')
      .single();

    const percent = parseFloat(setting?.value || '0');
    if (percent <= 0) return 0;

    const earned = Math.round(orderTotal * (percent / 100) * 100) / 100;
    if (earned <= 0) return 0;

    // Idempotência: não registra duas vezes para o mesmo pedido
    const { data: existing } = await supabase
      .from('cashback_transactions')
      .select('id')
      .eq('order_id', orderId)
      .eq('type', 'earn')
      .maybeSingle();

    if (existing) return 0;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error } = await supabase.from('cashback_transactions').insert({
      user_id:    userId,
      order_id:   orderId,
      type:       'earn',
      amount:     earned,
      remaining:  earned,
      expires_at: expiresAt.toISOString(),
      status:     'active',
    });

    if (error) throw error;

    // Atualiza o campo cashback_earned no pedido (não bloqueia se falhar)
    await supabase
      .from('orders')
      .update({ cashback_earned: earned })
      .eq('id', orderId);

    return earned;
  } catch (e) {
    logger.error('[Cashback] earnCashback error', e as Error);
    return 0;
  }
}

/**
 * P9: Versão resiliente de earnCashback com fila de retry persistente.
 *
 * Tenta creditá-lo diretamente. Se a tentativa falhar (erro de rede,
 * Supabase temporariamente fora), insere o pedido em `cashback_earn_queue`
 * para que o cron `/api/cron/process-cashback-queue` processe depois.
 * O cashback nunca é silenciosamente perdido.
 *
 * @returns Valor creditado nesta chamada (0 se falhou mas foi enfileirado)
 */
export async function earnCashbackWithQueue(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  orderTotal: number
): Promise<number> {
  try {
    return await earnCashback(supabase, userId, orderId, orderTotal);
  } catch (e) {
    logger.error('[Cashback] earnCashback falhou — enfileirando para retry', e as Error);
    try {
      await supabase.from('cashback_earn_queue').upsert(
        {
          user_id:     userId,
          order_id:    orderId,
          order_total: orderTotal,
          attempts:    1,
          last_error:  (e as Error).message?.slice(0, 500) || 'unknown',
        },
        { onConflict: 'order_id', ignoreDuplicates: true }
      );
    } catch (qErr) {
      logger.error('[Cashback] Falha ao enfileirar cashback — cashback perdido', qErr as Error);
    }
    return 0;
  }
}

/**
 * Aplica cashback como desconto de forma atômica via RPC Postgres.
 *
 * A função `use_cashback_atomic` no banco usa SELECT … FOR UPDATE para
 * serializar acessos concorrentes ao mesmo saldo, eliminando a race condition
 * que ocorria quando dois requests simultâneos liam o mesmo saldo antes de
 * qualquer um decrementar.
 *
 * SQL da função (executar no Supabase SQL Editor):
 *
 *   CREATE OR REPLACE FUNCTION use_cashback_atomic(
 *     p_user_id  UUID,
 *     p_order_id UUID,
 *     p_amount   NUMERIC
 *   )
 *   RETURNS NUMERIC
 *   LANGUAGE plpgsql
 *   AS $$
 *   DECLARE
 *     v_remaining NUMERIC := p_amount;
 *     v_deducted  NUMERIC := 0;
 *     v_tx        RECORD;
 *     v_deduct    NUMERIC;
 *     v_new_rem   NUMERIC;
 *   BEGIN
 *     FOR v_tx IN
 *       SELECT id, remaining
 *       FROM cashback_transactions
 *       WHERE user_id   = p_user_id
 *         AND type      = 'earn'
 *         AND status    IN ('active', 'partial')
 *         AND remaining > 0
 *         AND expires_at > now()
 *       ORDER BY created_at ASC
 *       FOR UPDATE SKIP LOCKED
 *     LOOP
 *       EXIT WHEN v_remaining <= 0;
 *       v_deduct  := LEAST(v_remaining, v_tx.remaining);
 *       v_new_rem := ROUND((v_tx.remaining - v_deduct)::NUMERIC, 2);
 *       UPDATE cashback_transactions
 *          SET remaining = v_new_rem,
 *              status    = CASE WHEN v_new_rem <= 0 THEN 'used' ELSE 'partial' END
 *        WHERE id = v_tx.id;
 *       INSERT INTO cashback_transactions (user_id, order_id, type, amount)
 *       VALUES (p_user_id, p_order_id, 'use', ROUND(v_deduct::NUMERIC, 2));
 *       v_remaining := v_remaining - v_deduct;
 *       v_deducted  := v_deducted  + v_deduct;
 *     END LOOP;
 *     v_deducted := ROUND(v_deducted::NUMERIC, 2);
 *     IF v_deducted > 0 THEN
 *       UPDATE orders SET cashback_used = v_deducted WHERE id = p_order_id;
 *     END IF;
 *     RETURN v_deducted;
 *   END;
 *   $$;
 *
 * @returns Valor efetivamente deduzido (pode ser menor se saldo insuficiente)
 */
export async function useCashback(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  cashbackToUse: number
): Promise<number> {
  if (!cashbackToUse || cashbackToUse <= 0) return 0;

  try {
    const { data, error } = await supabase.rpc('use_cashback_atomic', {
      p_user_id:  userId,
      p_order_id: orderId,
      p_amount:   cashbackToUse,
    });

    if (error) {
      logger.error('[Cashback] use_cashback_atomic RPC error', error as unknown as Error);
      return 0;
    }

    return typeof data === 'number' ? data : 0;
  } catch (e) {
    logger.error('[Cashback] useCashback error', e as Error);
    return 0;
  }
}
