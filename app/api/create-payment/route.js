import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { order_id, amount, description, payer_email, payer_name, payer_cpf } = await request.json();

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado' },
        { status: 500 }
      );
    }

    // Criar pagamento PIX via API do Mercado Pago
    const paymentBody = {
      transaction_amount: Number(amount),
      description: description || 'FUMÊGO Pizza',
      payment_method_id: 'pix',
      payer: {
        email: payer_email || 'cliente@fumego.com.br',
        first_name: payer_name || 'Cliente',
        identification: payer_cpf ? {
          type: 'CPF',
          number: payer_cpf.replace(/\D/g, ''),
        } : undefined,
      },
      external_reference: order_id,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/pix-webhook`,
    };

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': order_id,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Mercado Pago error:', mpData);
      return NextResponse.json(
        { error: 'Erro ao criar pagamento PIX', details: mpData },
        { status: 500 }
      );
    }

    return NextResponse.json({
      payment_id: String(mpData.id),
      qr_code: mpData.point_of_interaction?.transaction_data?.qr_code || '',
      qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '',
      expires_at: mpData.date_of_expiration || null,
      status: mpData.status,
    });
  } catch (e) {
    console.error('Create payment error:', e);
    return NextResponse.json({ error: 'Erro interno ao criar pagamento' }, { status: 500 });
  }
}
