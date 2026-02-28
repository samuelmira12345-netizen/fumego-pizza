import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { hashCpf } from '../../../../lib/cpf-crypto';
import { sendOrderConfirmationEmail } from '../../../../lib/email';
import { createOrderSchema } from '../../../../lib/schemas';
import { isCWPushEnabled, pushEventToCardapioWeb } from '../../../../lib/open-delivery';
import { logger } from '../../../../lib/logger';

/**
 * Cria o pedido no banco de dados com CPF hasheado server-side.
 * Após criar, enfileira evento Open Delivery e faz push imediato ao CardápioWeb.
 */
export async function POST(request) {
  try {
    const raw = await request.json();
    const parsed = createOrderSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || 'Dados do pedido inválidos';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { orderPayload, items, coupon, cpf } = parsed.data;

    const supabase = getSupabaseAdmin();

    // Hash do CPF no servidor (não expõe o dado em texto puro)
    const cpfHash = cpf ? hashCpf(cpf) : null;

    const securePayload = {
      ...orderPayload,
      customer_cpf: cpfHash,
    };

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
      console.error('Erro ao inserir itens:', itemsErr.message);
    }

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

    // ── Open Delivery ────────────────────────────────────────────────────────
    // 1. Enfileira na tabela od_events (para suporte a polling)
    const { error: evErr } = await supabase
      .from('od_events')
      .insert({ order_id: order.id, event_type: 'CREATED' });
    if (evErr) {
      // Loga mas não bloqueia: a tabela pode não existir ainda (SQL não executado)
      console.error('[OD] Falha ao inserir od_events — rode open-delivery-schema.sql no Supabase:', evErr.message);
    }

    // 2. Push imediato para o CardápioWeb (não aguarda para não atrasar a resposta)
    if (isCWPushEnabled()) {
      pushEventToCardapioWeb(order.id, 'CREATED')
        .then(result => {
          if (!result.ok) {
            // Log estruturado: status HTTP + corpo da resposta do CardápioWeb
            logger.error('[OD Push] CardápioWeb rejeitou o evento CREATED', {
              orderId: order.id,
              status:  result.status,
              error:   result.error,
            });
          } else {
            logger.info('[OD Push] Evento CREATED aceito pelo CardápioWeb', {
              orderId: order.id,
              status:  result.status,
            });
          }
        })
        .catch(e =>
          logger.error('[OD Push] Exceção ao enviar evento CREATED ao CardápioWeb', {
            orderId: order.id,
            error:   e.message,
          })
        );
    } else {
      logger.warn('[OD Push] OD_CW_BASE_URL não definido — pedido NÃO notificado ao CardápioWeb', {
        orderId: order.id,
        hint:    'Defina OD_CW_BASE_URL nas variáveis de ambiente',
      });
    }
    // ────────────────────────────────────────────────────────────────────────

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
      ).catch(err => console.error('Erro ao enviar e-mail de confirmação:', err));
    }

    return NextResponse.json({ order });
  } catch (e) {
    console.error('Erro ao criar pedido:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
