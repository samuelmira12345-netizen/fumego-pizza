import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { computeStoreStatus } from '../../../lib/store-hours';
import { logger } from '../../../lib/logger';

export async function POST(request) {
  try {
    const body = await request.json();
    const { order_id, order_number, description, payer_email, payer_name, payer_cpf, payment_type } = body;

    const accessToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();

    if (!accessToken) {
      return NextResponse.json({
        error: 'Token não configurado',
        details: 'MERCADO_PAGO_ACCESS_TOKEN não está definido nas variáveis de ambiente da Vercel.',
      }, { status: 500 });
    }

    if (!accessToken.startsWith('APP_USR-') && !accessToken.startsWith('TEST-')) {
      return NextResponse.json({
        error: 'Token com formato inválido',
        details: `O token deve começar com "APP_USR-" ou "TEST-". Seu token começa com: "${accessToken.substring(0, 10)}..."`,
      }, { status: 500 });
    }

    if (!order_id) {
      return NextResponse.json({ error: 'order_id obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Server-side store status check: block payments when store is closed
    const { data: settingsRows } = await supabase
      .from('settings').select('key,value').in('key', ['store_open', 'business_hours']);
    const settingsMap = Object.fromEntries((settingsRows || []).map(r => [r.key, r.value]));
    const { open: storeIsOpen } = computeStoreStatus(settingsMap);
    if (!storeIsOpen) {
      return NextResponse.json({
        error: 'Loja fechada',
        details: 'A loja está fechada no momento. Tente novamente no horário de funcionamento.',
      }, { status: 400 });
    }

    // Server-side price validation: always use the total stored in the DB, never trust the client
    const { data: order, error: orderErr } = await supabase
      .from('orders').select('total').eq('id', order_id).single();
    if (orderErr || !order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }
    const numAmount = Number(order.total);
    if (!numAmount || numAmount <= 0 || isNaN(numAmount)) {
      return NextResponse.json({ error: 'Valor inválido no pedido' }, { status: 400 });
    }

    const email = (payer_email && payer_email.includes('@')) ? payer_email.trim() : `cliente${Date.now()}@fumego.com.br`;
    let cleanCpf = payer_cpf ? String(payer_cpf).replace(/\D/g, '') : '';
    if (cleanCpf.length !== 11) cleanCpf = '';

    // ===== CARTÃO → Checkout Pro (redirect) =====
    if (payment_type === 'card') {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

      const prefBody = {
        items: [{
          title: description || `FUMEGO Pizza - Pedido #${order_number || 'N/A'}`,
          quantity: 1,
          unit_price: parseFloat(numAmount.toFixed(2)),
          currency_id: 'BRL',
        }],
        payer: { email },
        external_reference: String(order_id),
        back_urls: {
          success: `${appUrl}/?payment=success`,
          failure: `${appUrl}/?payment=failure`,
          pending: `${appUrl}/?payment=pending`,
        },
        auto_return: 'approved',
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
        },
      };

      if (appUrl) {
        prefBody.notification_url = `${appUrl.replace(/\/$/, '')}/api/pix-webhook`;
      }

      try {
        const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(prefBody),
        });

        const prefData = await prefRes.json();

        if (!prefRes.ok) {
          return NextResponse.json({
            error: 'Erro ao criar checkout de cartão',
            details: prefData.message || JSON.stringify(prefData),
          }, { status: 500 });
        }

        return NextResponse.json({
          checkout_url: prefData.init_point || prefData.sandbox_init_point,
          preference_id: prefData.id,
        });
      } catch (e) {
        return NextResponse.json({
          error: 'Erro de conexão ao criar checkout',
          details: e.message,
        }, { status: 500 });
      }
    }

    // ===== PIX =====
    const firstName = payer_name ? String(payer_name).trim().split(' ')[0] : 'Cliente';
    const lastName = payer_name ? String(payer_name).trim().split(' ').slice(1).join(' ') || 'FUMEGO' : 'FUMEGO';

    const paymentBody = {
      transaction_amount: parseFloat(numAmount.toFixed(2)),
      description: description || `FUMEGO Pizza - Pedido #${order_number || 'N/A'}`,
      payment_method_id: 'pix',
      payer: { email, first_name: firstName, last_name: lastName },
    };

    if (order_id) paymentBody.external_reference = String(order_id);
    if (cleanCpf.length === 11) {
      paymentBody.payer.identification = { type: 'CPF', number: cleanCpf };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      paymentBody.notification_url = `${appUrl.replace(/\/$/, '')}/api/pix-webhook`;
    }

    logger.info('Criando pagamento PIX', { order_id, order_number, amount: numAmount });

    let mpResponse;
    try {
      mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': `fumego-${order_id || Date.now()}-${Math.random().toString(36).substring(7)}`,
        },
        body: JSON.stringify(paymentBody),
      });
    } catch (fetchError) {
      return NextResponse.json({ error: 'Erro de conexão', details: fetchError.message }, { status: 500 });
    }

    let mpData;
    try { mpData = await mpResponse.json(); } catch {
      return NextResponse.json({ error: 'Resposta inválida do Mercado Pago' }, { status: 500 });
    }

    if (!mpResponse.ok) {
      let errorMsg = 'Erro ao gerar PIX';
      let errorDetails = '';

      if (mpResponse.status === 401) {
        errorMsg = 'Token inválido ou expirado';
        errorDetails = 'Copie o Access Token novamente do Mercado Pago e atualize na Vercel.';
      } else if (mpResponse.status === 400) {
        errorMsg = 'Dados inválidos';
        errorDetails = mpData.cause?.map(c => `${c.code}: ${c.description || ''}`).join('; ') || mpData.message || '';
      } else if (mpData.message === 'internal_error') {
        errorMsg = 'Erro interno do Mercado Pago';
        errorDetails = 'Copie o Access Token novamente, cole na Vercel sem espaços, e faça Redeploy.';
      } else {
        errorMsg = mpData.message || 'Erro desconhecido';
        errorDetails = JSON.stringify(mpData);
      }

      return NextResponse.json({ error: errorMsg, details: errorDetails, mp_status: mpResponse.status }, { status: 500 });
    }

    const qrCode       = mpData.point_of_interaction?.transaction_data?.qr_code || '';
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '';
    const paymentId    = String(mpData.id);

    // Salva os dados do PIX no pedido (server-side, sem expor ao cliente a necessidade de escrever no DB)
    await supabase.from('orders').update({
      pix_payment_id: paymentId,
      pix_qr_code: qrCode,
      pix_qr_code_base64: qrCodeBase64,
    }).eq('id', order_id);

    return NextResponse.json({
      payment_id: paymentId,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      expires_at: mpData.date_of_expiration || null,
      status: mpData.status,
    });

  } catch (e) {
    logger.error('Exceção create-payment', e);
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 });
  }
}
