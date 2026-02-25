import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { order_id, order_number, amount, description, payer_email, payer_name, payer_cpf } = await request.json();

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado no .env' }, { status: 500 });
    }

    // Validar amount
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return NextResponse.json({ error: 'Valor inválido para pagamento' }, { status: 400 });
    }

    // Limpar CPF (apenas números, 11 dígitos)
    let cleanCpf = payer_cpf ? payer_cpf.replace(/\D/g, '') : '';
    if (cleanCpf.length !== 11) cleanCpf = ''; // CPF inválido

    // Email obrigatório para o Mercado Pago
    const email = payer_email && payer_email.includes('@') ? payer_email : `cliente${Date.now()}@fumego.com.br`;

    // Montar body do pagamento
    const paymentBody = {
      transaction_amount: parseFloat(numAmount.toFixed(2)),
      description: description || `FUMEGO Pizza - Pedido`,
      payment_method_id: 'pix',
      payer: {
        email: email,
        first_name: payer_name || 'Cliente',
        last_name: 'FUMEGO',
      },
      external_reference: order_id,
    };

    // Adicionar CPF se válido
    if (cleanCpf.length === 11) {
      paymentBody.payer.identification = {
        type: 'CPF',
        number: cleanCpf,
      };
    }

    // Adicionar webhook URL se configurada
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      paymentBody.notification_url = `${appUrl}/api/pix-webhook`;
    }

    console.log('=== Criando pagamento PIX ===');
    console.log('Amount:', numAmount);
    console.log('Email:', email);
    console.log('CPF:', cleanCpf || 'não informado');

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': `${order_id}-${Date.now()}`,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('=== Mercado Pago ERROR ===');
      console.error('Status:', mpResponse.status);
      console.error('Response:', JSON.stringify(mpData));

      // Extrair mensagem de erro legível
      let errorMsg = 'Erro ao gerar pagamento PIX';
      if (mpData.message) errorMsg = mpData.message;
      if (mpData.cause && mpData.cause.length > 0) {
        errorMsg = mpData.cause.map(c => c.description || c.code).join(', ');
      }

      return NextResponse.json({
        error: errorMsg,
        details: mpData,
        status_code: mpResponse.status,
      }, { status: 500 });
    }

    console.log('=== Pagamento criado com sucesso ===');
    console.log('Payment ID:', mpData.id);
    console.log('Status:', mpData.status);

    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || '';
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '';

    return NextResponse.json({
      payment_id: String(mpData.id),
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      expires_at: mpData.date_of_expiration || null,
      status: mpData.status,
    });
  } catch (e) {
    console.error('=== Create payment exception ===', e);
    return NextResponse.json({
      error: 'Erro interno ao criar pagamento',
      details: e.message,
    }, { status: 500 });
  }
}
