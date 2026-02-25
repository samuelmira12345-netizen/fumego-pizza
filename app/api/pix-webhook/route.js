import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Mercado Pago envia notificações com type e data.id
    if (body.type === 'payment' || body.action === 'payment.updated') {
      const paymentId = body.data?.id;

      if (!paymentId) {
        return NextResponse.json({ received: true });
      }

      // Consultar detalhes do pagamento no Mercado Pago
      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      const payment = await mpResponse.json();

      if (payment.status === 'approved') {
        const supabaseAdmin = getSupabaseAdmin();
        const orderId = payment.external_reference;

        // Atualizar status do pagamento no banco
        await supabaseAdmin
          .from('orders')
          .update({
            payment_status: 'approved',
            status: 'confirmed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        console.log(`✅ Pagamento aprovado para pedido: ${orderId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

// Mercado Pago também pode fazer GET para verificar a URL
export async function GET() {
  return NextResponse.json({ status: 'webhook active' });
}
