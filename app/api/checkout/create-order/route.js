import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { hashCpf, validateCpf } from '../../../../lib/cpf-crypto';
import { sendOrderConfirmationEmail } from '../../../../lib/email';
import { createOrderSchema } from '../../../../lib/schemas';
import { isCWPartnerEnabled, pushOrderToCW } from '../../../../lib/cardapioweb-partner';
import { logger } from '../../../../lib/logger';
import { earnCashback, useCashback } from '../../../../lib/cashback';

/**
 * Cria o pedido no banco de dados com CPF hasheado server-side.
 * Após criar, envia o pedido para o CardápioWeb via Partner API.
 *
 * Idempotência: o cliente pode enviar o header X-Idempotency-Key (UUID gerado no client).
 * Se um pedido já foi criado com a mesma chave, retorna o pedido existente sem criar duplicata.
 */
export async function POST(request) {
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
    // A função decrement_stock_atomic usa pg_advisory_xact_lock para garantir
    // que dois pedidos simultâneos não possam vender o mesmo produto esgotado.
    const { data: stockResult, error: stockErr } = await supabase.rpc(
      'decrement_stock_atomic',
      { p_items: items }
    );

    if (stockErr) {
      // A função RPC não existe ainda — fallback para validação simples (sem lock)
      // ATENÇÃO: execute supabase-stock-atomic.sql no Supabase SQL Editor para ativar o lock atômico
      logger.warn('[Stock] decrement_stock_atomic não disponível, usando fallback sem lock', {
        error: stockErr.message,
      });

      // Fallback: validação de estoque sem lock usando tabelas product_stock / drink_stock
      try {
        const productIds = items.filter(i => i.product_id).map(i => i.product_id);
        const drinkIds   = items.filter(i => i.drink_id).map(i => i.drink_id);

        if (productIds.length > 0) {
          const { data: stocks } = await supabase
            .from('product_stock')
            .select('product_id, quantity, enabled')
            .in('product_id', productIds)
            .eq('enabled', true);

          for (const item of items) {
            if (!item.product_id) continue;
            const entry = stocks?.find(s => s.product_id === item.product_id);
            if (!entry?.enabled) continue;
            if (entry.quantity < (item.quantity || 1)) {
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

          for (const item of items) {
            if (!item.drink_id) continue;
            const entry = stocks?.find(s => String(s.drink_id) === String(item.drink_id));
            if (!entry?.enabled) continue;
            if (entry.quantity < (item.quantity || 1)) {
              return NextResponse.json({ error: `"${item.product_name}" não tem estoque suficiente.` }, { status: 409 });
            }
          }
        }
      } catch (validationErr) {
        logger.error('[Stock] Erro na validação de estoque fallback', { error: validationErr.message });
      }
    } else if (stockResult && !stockResult.ok) {
      return NextResponse.json({ error: stockResult.error }, { status: 409 });
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

    const securePayload = {
      ...orderPayload,
      customer_cpf: cpfHash,
    };

    // Adicionar idempotency_key ao pedido se fornecido
    if (idempotencyKey) {
      securePayload.idempotency_key = idempotencyKey;
    }

    // Não enviar scheduled_for: null para o banco — evita erro se a coluna ainda não existe.
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
    const orderItems = items.map(item => ({ ...item, order_id: order.id }));
    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
    if (itemsErr) {
      logger.error('Erro ao inserir itens do pedido', { orderId: order.id, error: itemsErr.message });
    }

    // Nota: quando a função RPC de estoque atômico está disponível, o decremento
    // já foi feito na chamada rpc() acima. O fallback abaixo só executa quando
    // a RPC não está disponível (stockErr != null).
    if (stockErr) {
      // Fallback: decrementar estoque usando tabelas product_stock / drink_stock (sem lock)
      try {
        for (const item of items) {
          if (!item.product_id) continue;
          const need = item.quantity || 1;
          const { data: row } = await supabase
            .from('product_stock').select('quantity, enabled').eq('product_id', item.product_id).single();
          if (!row?.enabled) continue;
          const newQty = Math.max(0, row.quantity - need);
          await supabase.from('product_stock')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('product_id', item.product_id);
          if (newQty === 0) {
            await supabase.from('products').update({ is_active: false }).eq('id', item.product_id);
          }
        }
      } catch (stockDecrErr) {
        logger.error('[Stock] Erro ao decrementar estoque (fallback)', { error: stockDecrErr.message });
      }

      try {
        for (const item of items) {
          if (!item.drink_id) continue;
          const need = item.quantity || 1;
          const { data: row } = await supabase
            .from('drink_stock').select('quantity, enabled').eq('drink_id', item.drink_id).single();
          if (!row?.enabled) continue;
          const newQty = Math.max(0, row.quantity - need);
          await supabase.from('drink_stock')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('drink_id', item.drink_id);
          if (newQty === 0) {
            await supabase.from('drinks').update({ is_active: false }).eq('id', item.drink_id);
          }
        }
      } catch (drinkStockErr) {
        logger.error('[DrinkStock] Erro ao decrementar estoque de bebidas (fallback)', { error: drinkStockErr.message });
      }
    }

    // ── Cashback: consumir saldo (FIFO) se o cliente usou cashback ───────────
    const cashbackUsed = orderPayload.cashback_used || 0;
    if (cashbackUsed > 0 && orderPayload.user_id) {
      useCashback(supabase, orderPayload.user_id, order.id, cashbackUsed)
        .catch(e => logger.error('[Cashback] Erro ao consumir saldo', { error: e.message }));
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Registrar uso de cupom com CPF hasheado
    if (coupon && cpf) {
      await supabase.from('coupon_usage').insert({
        coupon_id: coupon.id,
        cpf: cpfHash,
        user_id: orderPayload.user_id || null,
      });
      await supabase
        .from('coupons')
        .update({ times_used: coupon.times_used + 1 })
        .eq('id', coupon.id);
    }

    // ── Cardápio Web Partner API ──────────────────────────────────────────────
    // Envia o pedido ao painel do CardápioWeb (não bloqueia a resposta ao cliente)
    if (isCWPartnerEnabled()) {
      pushOrderToCW(order, orderItems)
        .then(result => {
          if (result.ok) {
            logger.info('[CW Partner] Pedido enviado com sucesso ao CardápioWeb', {
              orderId:   order.id,
              cwOrderId: result.data?.id,
            });
          } else {
            logger.error('[CW Partner] Falha ao enviar pedido ao CardápioWeb', {
              orderId: order.id,
              status:  result.status,
              errors:  result.errors,
              error:   result.error,
            });
          }
        })
        .catch(e =>
          logger.error('[CW Partner] Exceção ao enviar pedido ao CardápioWeb', {
            orderId: order.id,
            error:   e.message,
          })
        );
    } else {
      logger.warn('[CW Partner] Integração inativa — pedido NÃO enviado ao CardápioWeb', {
        orderId: order.id,
        hint:    'Configure CW_BASE_URL, CW_API_KEY e CW_PARTNER_KEY no Vercel.',
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Enviar e-mail de confirmação (não bloqueia a resposta se falhar)
    if (orderPayload.customer_email) {
      const deliveryTime = orderPayload.delivery_time || '40–60 min';
      sendOrderConfirmationEmail(
        orderPayload.customer_email,
        orderPayload.customer_name,
        order.order_number,
        order.total,
        items,
        deliveryTime,
      ).catch(err => logger.error('Erro ao enviar e-mail de confirmação', { error: err.message }));
    }

    return NextResponse.json({ order });
  } catch (e) {
    logger.error('Erro ao criar pedido', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
