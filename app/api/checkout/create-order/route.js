import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { hashCpf } from '../../../../lib/cpf-crypto';
import { sendOrderConfirmationEmail } from '../../../../lib/email';
import { createOrderSchema } from '../../../../lib/schemas';
import { isODEnabled } from '../../../../lib/open-delivery';

/**
 * Cria o pedido no banco de dados com CPF hasheado server-side.
 * Substitui a escrita direta do cliente anônimo para operações sensíveis.
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

    // Enfileirar evento Open Delivery CREATED (para CardápioWeb fazer polling)
    if (isODEnabled()) {
      supabase.from('od_events').insert({
        order_id:   order.id,
        event_type: 'CREATED',
      }).then(({ error: evErr }) => {
        if (evErr) console.error('[OD] Erro ao enfileirar evento CREATED:', evErr.message);
      });
    }

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
