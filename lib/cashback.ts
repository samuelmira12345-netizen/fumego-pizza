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

import type { SupabaseClient } from '@supabase/supabase-js';

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
    console.error('[Cashback] earnCashback error:', (e as Error).message);
    return 0;
  }
}

/**
 * Aplica cashback como desconto usando FIFO (mais antigos primeiro).
 * Registra transações de 'use' correspondentes.
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
    const now = new Date().toISOString();

    // FIFO: busca transações ativas ordenadas da mais antiga para a mais nova
    const { data: transactions } = await supabase
      .from('cashback_transactions')
      .select('id, remaining')
      .eq('user_id', userId)
      .eq('type', 'earn')
      .in('status', ['active', 'partial'])
      .gt('remaining', 0)
      .gte('expires_at', now)
      .order('created_at', { ascending: true });

    if (!transactions || transactions.length === 0) return 0;

    let toDeduct      = cashbackToUse;
    let totalDeducted = 0;

    for (const tx of transactions) {
      if (toDeduct <= 0) break;

      const deduct       = Math.min(toDeduct, Number(tx.remaining));
      const newRemaining = Math.round((Number(tx.remaining) - deduct) * 100) / 100;
      const newStatus    = newRemaining <= 0 ? 'used' : 'partial';

      // Atualiza o saldo restante da transação de ganho
      await supabase
        .from('cashback_transactions')
        .update({ remaining: newRemaining, status: newStatus })
        .eq('id', tx.id);

      // Registra a transação de uso (rastreabilidade)
      await supabase.from('cashback_transactions').insert({
        user_id:  userId,
        order_id: orderId,
        type:     'use',
        amount:   Math.round(deduct * 100) / 100,
      });

      toDeduct      -= deduct;
      totalDeducted += deduct;
    }

    const finalDeducted = Math.round(totalDeducted * 100) / 100;

    // Atualiza o campo cashback_used no pedido
    if (finalDeducted > 0) {
      await supabase
        .from('orders')
        .update({ cashback_used: finalDeducted })
        .eq('id', orderId);
    }

    return finalDeducted;
  } catch (e) {
    console.error('[Cashback] useCashback error:', (e as Error).message);
    return 0;
  }
}
