import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseAdmin } from '../../../lib/supabase';

function verifySignature(request, dataId) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return true; // Skip if not configured (backwards compatible)

  const signatureHeader = request.headers.get('x-signature');
  const requestId = request.headers.get('x-request-id');
  if (!signatureHeader || !requestId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => { const [k, v] = p.split('='); return [k.trim(), v?.trim()]; })
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const message = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(message).digest('hex');
  return expected === v1;
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.type === 'payment' && body.data?.id) {
      if (!verifySignature(request, body.data.id)) {
        console.warn('Webhook: assinatura inválida rejeitada');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

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
    console.error('Webhook error:', e.message);
    return NextResponse.json({ received: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'webhook active' });
}
