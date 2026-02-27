import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { hashCpf } from '../../../../lib/cpf-crypto';

/**
 * Cria o pedido no banco de dados com CPF hasheado server-side.
 * Substitui a escrita direta do cliente anônimo para operações sensíveis.
 */
export async function POST(request) {
  try {
    const { orderPayload, items, coupon, cpf } = await request.json();

    if (!orderPayload || !items) {
      return NextResponse.json({ error: 'Dados do pedido inválidos' }, { status: 400 });
    }

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

    return NextResponse.json({ order });
  } catch (e) {
    console.error('Erro ao criar pedido:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
