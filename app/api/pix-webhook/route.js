import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.type === 'payment' || body.action === 'payment.updated' || body.action === 'payment.created') {
      const paymentId = body.data?.id;
      if (!paymentId) return NextResponse.json({ received: true });

      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const payment = await mpRes.json();

      if (payment.status === 'approved') {
        const supabaseAdmin = getSupabaseAdmin();
        const orderId = payment.external_reference;

        await supabaseAdmin.from('orders').update({
          payment_status: 'approved',
          status: 'confirmed',
          pix_payment_id: String(paymentId),
          updated_at: new Date().toISOString(),
        }).eq('id', orderId);

        console.log(`✅ Pagamento aprovado: pedido ${orderId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return NextResponse.json({ error: 'webhook error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'webhook active' });
}
