import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { hashCpf, validateCpf } from '../../../../lib/cpf-crypto';
import { sendOrderConfirmationEmail } from '../../../../lib/email';
import { createOrderSchema } from '../../../../lib/schemas';
import { isCWPartnerEnabled, pushOrderToCW, PushOrderResult } from '../../../../lib/cardapioweb-partner';
import type { OrderItem } from '../../../../types';
import { logger } from '../../../../lib/logger';
import { earnCashback, useCashback } from '../../../../lib/cashback';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';

/** Remove tags HTML e caracteres de controle de mensagens vindas de APIs externas. */
function sanitizeExternalError(msg: string): string {
  return String(msg || '')
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars (mantém \t \n \r)
    .trim()
    .slice(0, 500);
}

/** Validação mínima de formato de e-mail antes de tentar envio. */
function isValidEmail(email: string): boolean {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Envia e-mail de confirmação com 1 retry após 3 s em caso de falha. */
async function sendOrderEmailWithRetry(
  email: string, name: string,
  orderNumber: unknown, total: unknown,
  items: unknown, deliveryTime: string,
): Promise<void> {
  try {
    await sendOrderConfirmationEmail(email, name, orderNumber, total, items, deliveryTime);
  } catch {
    await new Promise(r => setTimeout(r, 3000));
    await sendOrderConfirmationEmail(email, name, orderNumber, total, items, deliveryTime);
  }
}

/**
 * Cria o pedido no banco de dados com CPF hasheado server-side.
 * Após criar, envia o pedido para o CardápioWeb via Partner API.
 *
 * Idempotência: o cliente pode enviar o header X-Idempotency-Key (UUID gerado no client).
 * Se um pedido já foi criado com a mesma chave, retorna o pedido existente sem criar duplicata.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(`create-order:${ip}`, 10, 60_000);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${retryAfterSec} segundos.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  try {
    const raw = await request.json();
    const parsed = createOrderSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados do pedido inválidos';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { orderPayload, items, coupon, cpf } = parsed.data;

    const supabase = getSupabaseAdmin();

    // ── Idempotência: evita pedidos duplicados ────────────────────────────────
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('orders')
        .select()
        .eq('idempotency_key', idempotencyKey)
        .single();
      if (existing) {
        logger.info('[Order] Pedido duplicado detectado via idempotency key', {
          orderId: existing.id, idempotencyKey,
        });
        return NextResponse.json({ order: existing });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Decrementar estoque de forma atômica (lock no banco) ──────────────────
    const { data: stockResult, error: stockErr } = await supabase.rpc(
      'decrement_stock_atomic',
      { p_items: items }
    );

    if (stockErr) {
      logger.warn('[Stock] decrement_stock_atomic não disponível, usando fallback sem lock', {
        error: stockErr.message,
      });

      try {
        const productIds = items.filter((i: Record<string, unknown>) => i.product_id).map((i: Record<string, unknown>) => i.product_id);
        const drinkIds   = items.filter((i: Record<string, unknown>) => i.drink_id).map((i: Record<string, unknown>) => i.drink_id);

        if (productIds.length > 0) {
          const { data: stocks } = await supabase
            .from('product_stock')
            .select('product_id, quantity, enabled')
            .in('product_id', productIds)
            .eq('enabled', true);

          for (const item of items as Record<string, unknown>[]) {
            if (!item.product_id) continue;
            const entry = (stocks as Record<string, unknown>[] | null)?.find((s: Record<string, unknown>) => s.product_id === item.product_id);
            if (!entry?.enabled) continue;
            if ((entry.quantity as number) < ((item.quantity as number) || 1)) {
              return NextResponse.json({ error: `"${item.product_name}" está esgotado e não pode ser pedido.` }, { status: 409 });
            }
          }
        }

        if (drinkIds.length > 0) {
          const { data: stocks } = await supabase
            .from('drink_stock')
            .select('drink_id, quantity, enabled')
            .in('drink_id', drinkIds)
            .eq('enabled', true);

          for (const item of items as Record<string, unknown>[]) {
            if (!item.drink_id) continue;
            const entry = (stocks as Record<string, unknown>[] | null)?.find((s: Record<string, unknown>) => String(s.drink_id) === String(item.drink_id));
            if (!entry?.enabled) continue;
            if ((entry.quantity as number) < ((item.quantity as number) || 1)) {
              return NextResponse.json({ error: `"${item.product_name}" não tem estoque suficiente.` }, { status: 409 });
            }
          }
        }
      } catch (validationErr) {
        logger.error('[Stock] Erro na validação de estoque fallback', { error: (validationErr as Error).message });
      }
    } else if (stockResult && !(stockResult as Record<string, unknown>).ok) {
      return NextResponse.json({ error: (stockResult as Record<string, unknown>).error }, { status: 409 });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Validar CPF antes de processar
    if (cpf) {
      const cleanCpf = String(cpf).replace(/\D/g, '');
      if (!validateCpf(cleanCpf)) {
        return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
      }
    }

    // Hash do CPF no servidor (não expõe o dado em texto puro)
    const cpfHash = cpf ? hashCpf(cpf) : null;

    const securePayload: Record<string, unknown> = {
      ...orderPayload,
      customer_cpf: cpfHash,
    };

    if (idempotencyKey) {
      securePayload.idempotency_key = idempotencyKey;
    }

    if (!securePayload.scheduled_for) {
      delete securePayload.scheduled_for;
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert(securePayload)
      .select()
      .single();

    if (orderErr) {
      return NextResponse.json({ error: orderErr.message }, { status: 500 });
    }

    // Inserir itens do pedido
    const orderItems = (items as OrderItem[]).map(item => ({ ...item, order_id: order.id })) as OrderItem[];
    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
    if (itemsErr) {
      logger.error('Erro ao inserir itens do pedido', { orderId: order.id, error: itemsErr.message });
    }

    if (stockErr) {
      // Fallback best-effort com lock otimista: o UPDATE inclui a quantidade original
      // no WHERE, então se outro request já decrementou antes de nós, o update afeta
      // 0 linhas e logamos o conflito em vez de criar overselling silencioso.
      try {
        for (const item of items as Record<string, unknown>[]) {
          if (!item.product_id) continue;
          const need = (item.quantity as number) || 1;
          const { data: row } = await supabase
            .from('product_stock').select('quantity, enabled').eq('product_id', item.product_id).single();
          const r = row as Record<string, unknown> | null;
          if (!r?.enabled) continue;
          const originalQty = r.quantity as number;
          const newQty = Math.max(0, originalQty - need);
          // Lock otimista: só atualiza se a quantidade não mudou desde a leitura
          const { data: updated } = await supabase.from('product_stock')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('product_id', item.product_id)
            .eq('quantity', originalQty)
            .select('product_id');
          if (!updated || (updated as unknown[]).length === 0) {
            logger.error('[Stock] Fallback: lock otimista falhou — possível overselling', new Error(`Conflito de concorrência no estoque do produto ${item.product_id} (pedido ${order.id})`));
            supabase.from('orders').update({ stock_conflict: true }).eq('id', order.id).then(() => {});
            continue;
          }
          if (newQty === 0) {
            await supabase.from('products').update({ is_active: false }).eq('id', item.product_id);
          }
        }
      } catch (stockDecrErr) {
        logger.error('[Stock] Erro ao decrementar estoque (fallback)', { error: (stockDecrErr as Error).message });
      }

      try {
        for (const item of items as Record<string, unknown>[]) {
          if (!item.drink_id) continue;
          const need = (item.quantity as number) || 1;
          const { data: row } = await supabase
            .from('drink_stock').select('quantity, enabled').eq('drink_id', item.drink_id).single();
          const r = row as Record<string, unknown> | null;
          if (!r?.enabled) continue;
          const originalQty = r.quantity as number;
          const newQty = Math.max(0, originalQty - need);
          // Lock otimista: só atualiza se a quantidade não mudou desde a leitura
          const { data: updated } = await supabase.from('drink_stock')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('drink_id', item.drink_id)
            .eq('quantity', originalQty)
            .select('drink_id');
          if (!updated || (updated as unknown[]).length === 0) {
            logger.error('[DrinkStock] Fallback: lock otimista falhou — possível overselling', new Error(`Conflito de concorrência no estoque da bebida ${item.drink_id} (pedido ${order.id})`));
            supabase.from('orders').update({ stock_conflict: true }).eq('id', order.id).then(() => {});
            continue;
          }
          if (newQty === 0) {
            await supabase.from('drinks').update({ is_active: false }).eq('id', item.drink_id);
          }
        }
      } catch (drinkStockErr) {
        logger.error('[DrinkStock] Erro ao decrementar estoque de bebidas (fallback)', { error: (drinkStockErr as Error).message });
      }
    }

    // ── Cashback: consumir saldo (FIFO) se o cliente usou cashback ───────────
    const cashbackUsed = (orderPayload as Record<string, unknown>).cashback_used as number || 0;
    if (cashbackUsed > 0 && (orderPayload as Record<string, unknown>).user_id) {
      useCashback(supabase, (orderPayload as Record<string, unknown>).user_id as string, order.id, cashbackUsed)
        .catch((e: Error) => logger.error('[Cashback] Erro ao consumir saldo', { error: e.message }));
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Registrar uso de cupom com CPF hasheado
    if (coupon && cpf) {
      await supabase.from('coupon_usage').insert({
        coupon_id: (coupon as Record<string, unknown>).id,
        cpf: cpfHash,
        user_id: (orderPayload as Record<string, unknown>).user_id || null,
      });
      await supabase
        .from('coupons')
        .update({ times_used: (coupon as Record<string, unknown>).times_used as number + 1 })
        .eq('id', (coupon as Record<string, unknown>).id);
    }

    // ── Cardápio Web Partner API ──────────────────────────────────────────────
    if (isCWPartnerEnabled()) {
      pushOrderToCW(order, orderItems)
        .then(async (result: PushOrderResult) => {
          if (result.ok) {
            logger.info('[CW Partner] Pedido enviado com sucesso ao CardápioWeb', {
              orderId:   order.id,
              cwOrderId: (result.data as Record<string, unknown>)?.id,
            });
            await supabase.from('orders').update({
              cw_push_status:      'success',
              cw_push_attempts:    (order.cw_push_attempts || 0) + 1,
              cw_push_last_error:  null,
            }).eq('id', order.id);
          } else {
            const rawErrMsg = result.error || (result.errors || []).join('; ') || `HTTP ${result.status}`;
            const errMsg = sanitizeExternalError(rawErrMsg);
            logger.error('[CW Partner] Falha ao enviar pedido ao CardápioWeb', new Error(`Pedido ${order.id} rejeitado pelo CardápioWeb (HTTP ${result.status}): ${errMsg}`));
            await supabase.from('orders').update({
              cw_push_status:     'failed',
              cw_push_attempts:   (order.cw_push_attempts || 0) + 1,
              cw_push_last_error: errMsg,
            }).eq('id', order.id);
          }
        })
        .catch(async (e: Error) => {
          logger.error('[CW Partner] Exceção ao enviar pedido ao CardápioWeb', e);
          await supabase.from('orders').update({
            cw_push_status:     'failed',
            cw_push_attempts:   (order.cw_push_attempts || 0) + 1,
            cw_push_last_error: sanitizeExternalError(e.message || ''),
          }).eq('id', order.id);
        });
    } else {
      logger.warn('[CW Partner] Integração inativa — pedido NÃO enviado ao CardápioWeb', {
        orderId: order.id,
        hint:    'Configure CW_BASE_URL, CW_API_KEY e CW_PARTNER_KEY no Vercel.',
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Enviar e-mail de confirmação (fire-and-forget com validação + 1 retry)
    const customerEmail = (orderPayload as Record<string, unknown>).customer_email as string | undefined;
    if (customerEmail) {
      if (isValidEmail(customerEmail)) {
        const deliveryTime = (orderPayload as Record<string, unknown>).delivery_time as string || '40–60 min';
        sendOrderEmailWithRetry(
          customerEmail,
          (orderPayload as Record<string, unknown>).customer_name as string,
          order.order_number,
          order.total,
          items,
          deliveryTime,
        ).catch((err: Error) => logger.error('Erro ao enviar e-mail de confirmação (após retry)', new Error(err.message)));
      } else {
        logger.warn('[Email] Formato de e-mail inválido, envio ignorado', { email: customerEmail?.slice(0, 80) });
      }
    }

    return NextResponse.json({ order });
  } catch (e) {
    logger.error('Erro ao criar pedido', { error: (e as Error).message });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
