import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { logger } from '../../../lib/logger';
import { earnCashback } from '../../../lib/cashback';

function verifySignature(request, dataId) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('MERCADO_PAGO_WEBHOOK_SECRET não está configurada. Webhook rejeitado.');
    return false;
  }

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
        logger.warn('Webhook: assinatura inválida rejeitada', { paymentId: body.data.id });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      const paymentId = String(body.data.id);
      const accessToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();

      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const mpData = await mpRes.json();

      const supabase = getSupabaseAdmin();
      const orderId = mpData.external_reference;

      if (orderId) {
        if (mpData.status === 'approved') {
          // Idempotência: só atualiza se o pedido ainda está pendente de pagamento.
          // Isso garante que um webhook entregue duas vezes não processe o pagamento
          // duas vezes (não gera cashback duplicado, não muda status já confirmado).
          const { data: updated, error: updateErr } = await supabase
            .from('orders')
            .update({
              payment_status: 'approved',
              status: 'confirmed',
              pix_payment_id: paymentId,
            })
            .eq('id', orderId)
            .eq('payment_status', 'pending')   // <-- garante idempotência
            .select()
            .single();

          if (updateErr) {
            logger.error('Webhook: erro ao atualizar pedido', { orderId, paymentId, error: updateErr.message });
          } else if (!updated) {
            // Nenhuma linha atualizada = pagamento já foi processado antes
            logger.info('Webhook: pagamento já processado anteriormente, ignorado', { orderId, paymentId });
          } else {
            logger.info('Pagamento aprovado', { orderId, paymentId });

            // Gerar cashback apenas quando confirmamos pela primeira vez
            if (updated.user_id) {
              earnCashback(supabase, updated.user_id, orderId, updated.total)
                .catch(e => logger.error('[Cashback] Erro ao gerar cashback pós-pagamento', { error: e.message }));
            }
          }
        } else if (['rejected', 'cancelled', 'expired'].includes(mpData.status)) {
          // Idempotência: só cancela se ainda não foi cancelado
          const { error: cancelErr } = await supabase
            .from('orders')
            .update({ payment_status: 'cancelled', status: 'cancelled' })
            .eq('id', orderId)
            .neq('status', 'cancelled');

          if (cancelErr) {
            logger.error('Webhook: erro ao cancelar pedido', { orderId, error: cancelErr.message });
          } else {
            logger.info('Pedido cancelado via webhook', { orderId, mpStatus: mpData.status });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    logger.error('Webhook error', { error: e.message });
    return NextResponse.json({ received: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'webhook active' });
}
