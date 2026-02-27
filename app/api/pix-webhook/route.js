import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('=== PIX WEBHOOK ===', JSON.stringify(body));

    if (body.type === 'payment' && body.data?.id) {
      const paymentId = body.data.id;
      const accessToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();

      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const mpData = await mpRes.json();

      const supabase = getSupabaseAdmin();
      const orderId = mpData.external_reference;
      if (orderId) {
        if (mpData.status === 'approved') {
          await supabase.from('orders').update({
            payment_status: 'approved',
            status: 'confirmed',
          }).eq('id', orderId);
          console.log('Pedido aprovado:', orderId);
        } else if (['rejected', 'cancelled', 'expired'].includes(mpData.status)) {
          await supabase.from('orders').update({
            payment_status: 'cancelled',
            status: 'cancelled',
          }).eq('id', orderId);
          console.log('Pedido cancelado:', orderId, mpData.status);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return NextResponse.json({ received: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'webhook active' });
}
