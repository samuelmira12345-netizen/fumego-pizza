import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { order_id, order_number, amount, description, payer_email, payer_name, payer_cpf } = body;

    // ===== VALIDAR ACCESS TOKEN =====
    const accessToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
    
    if (!accessToken) {
      return NextResponse.json({ 
        error: 'Token não configurado',
        details: 'MERCADO_PAGO_ACCESS_TOKEN não está definido nas variáveis de ambiente da Vercel. Vá em Vercel → Settings → Environment Variables e adicione.',
      }, { status: 500 });
    }

    // Verificar formato do token
    if (!accessToken.startsWith('APP_USR-') && !accessToken.startsWith('TEST-')) {
      return NextResponse.json({ 
        error: 'Token com formato inválido',
        details: `O token deve começar com "APP_USR-" (produção) ou "TEST-" (teste). Seu token começa com: "${accessToken.substring(0, 10)}..."`,
      }, { status: 500 });
    }

    // ===== VALIDAR AMOUNT =====
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0 || isNaN(numAmount)) {
      return NextResponse.json({ error: 'Valor inválido', details: `Amount recebido: ${amount}` }, { status: 400 });
    }

    // ===== PREPARAR DADOS DO PAGADOR =====
    // CPF: apenas números, 11 dígitos
    let cleanCpf = payer_cpf ? String(payer_cpf).replace(/\D/g, '') : '';
    if (cleanCpf.length !== 11) cleanCpf = '';

    // Email: obrigatório para MP
    const email = (payer_email && payer_email.includes('@')) 
      ? payer_email.trim() 
      : `cliente${Date.now()}@fumego.com.br`;

    // Nome
    const firstName = payer_name ? String(payer_name).trim().split(' ')[0] : 'Cliente';
    const lastName = payer_name ? String(payer_name).trim().split(' ').slice(1).join(' ') || 'FUMEGO' : 'FUMEGO';

    // ===== MONTAR BODY DO PAGAMENTO =====
    const paymentBody = {
      transaction_amount: parseFloat(numAmount.toFixed(2)),
      description: description || `FUMEGO Pizza - Pedido #${order_number || 'N/A'}`,
      payment_method_id: 'pix',
      payer: {
        email: email,
        first_name: firstName,
        last_name: lastName,
      },
    };

    // Adicionar external_reference se tiver order_id
    if (order_id) {
      paymentBody.external_reference = String(order_id);
    }

    // Adicionar CPF se válido
    if (cleanCpf.length === 11) {
      paymentBody.payer.identification = {
        type: 'CPF',
        number: cleanCpf,
      };
    }

    // Webhook URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      paymentBody.notification_url = `${appUrl.replace(/\/$/, '')}/api/pix-webhook`;
    }

    console.log('=== CRIANDO PAGAMENTO PIX ===');
    console.log('Amount:', numAmount);
    console.log('Email:', email);
    console.log('CPF:', cleanCpf || 'não informado');
    console.log('Token inicio:', accessToken.substring(0, 15) + '...');
    console.log('Body:', JSON.stringify(paymentBody, null, 2));

    // ===== CHAMADA MERCADO PAGO =====
    const idempotencyKey = `fumego-${order_id || Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    let mpResponse;
    try {
      mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(paymentBody),
      });
    } catch (fetchError) {
      console.error('=== ERRO DE CONEXÃO COM MERCADO PAGO ===', fetchError);
      return NextResponse.json({ 
        error: 'Erro de conexão',
        details: `Não foi possível conectar ao Mercado Pago: ${fetchError.message}`,
      }, { status: 500 });
    }

    let mpData;
    try {
      mpData = await mpResponse.json();
    } catch (parseError) {
      const rawText = await mpResponse.text().catch(() => 'não legível');
      console.error('=== ERRO AO LER RESPOSTA DO MP ===', rawText);
      return NextResponse.json({ 
        error: 'Resposta inválida do Mercado Pago',
        details: `Status: ${mpResponse.status}. Resposta: ${rawText.substring(0, 200)}`,
      }, { status: 500 });
    }

    // ===== TRATAR ERROS DO MERCADO PAGO =====
    if (!mpResponse.ok) {
      console.error('=== MERCADO PAGO ERROR ===');
      console.error('Status:', mpResponse.status);
      console.error('Response:', JSON.stringify(mpData));

      // Mensagens de erro mais claras
      let errorMsg = 'Erro ao gerar PIX';
      let errorDetails = '';

      if (mpResponse.status === 401) {
        errorMsg = 'Token de acesso inválido ou expirado';
        errorDetails = 'Verifique se o MERCADO_PAGO_ACCESS_TOKEN na Vercel está correto e completo. Vá em mercadopago.com.br/developers → Suas Integrações → Credenciais de Teste → copie o Access Token novamente.';
      } else if (mpResponse.status === 400) {
        errorMsg = 'Dados do pagamento inválidos';
        if (mpData.cause && mpData.cause.length > 0) {
          errorDetails = mpData.cause.map(c => `${c.code}: ${c.description || 'sem descrição'}`).join('; ');
        } else {
          errorDetails = mpData.message || JSON.stringify(mpData);
        }
      } else if (mpResponse.status === 403) {
        errorMsg = 'Acesso negado pelo Mercado Pago';
        errorDetails = 'Sua conta pode ter restrições. Verifique se sua aplicação está ativa no painel do Mercado Pago.';
      } else {
        // internal_error (500) do MP
        if (mpData.message === 'internal_error') {
          errorMsg = 'Erro interno do Mercado Pago';
          errorDetails = 'Isso geralmente acontece quando: (1) O Access Token está incorreto ou com caracteres extras - copie novamente; (2) O token expirou - gere um novo; (3) Problema temporário do MP - tente novamente em 1 minuto. DICA: Vá na Vercel → Settings → Environment Variables → edite MERCADO_PAGO_ACCESS_TOKEN → apague e cole novamente sem espaços.';
        } else {
          errorMsg = mpData.message || 'Erro desconhecido';
          errorDetails = JSON.stringify(mpData);
        }
      }

      return NextResponse.json({
        error: errorMsg,
        details: errorDetails,
        mp_status: mpResponse.status,
        mp_message: mpData.message || null,
      }, { status: 500 });
    }

    // ===== SUCESSO =====
    console.log('=== PAGAMENTO CRIADO COM SUCESSO ===');
    console.log('Payment ID:', mpData.id);
    console.log('Status:', mpData.status);

    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || '';
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '';

    if (!qrCode && !qrCodeBase64) {
      console.warn('AVISO: Pagamento criado mas QR Code não retornado');
    }

    return NextResponse.json({
      payment_id: String(mpData.id),
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      expires_at: mpData.date_of_expiration || null,
      status: mpData.status,
    });

  } catch (e) {
    console.error('=== EXCEÇÃO GERAL NO CREATE-PAYMENT ===', e);
    return NextResponse.json({
      error: 'Erro interno no servidor',
      details: e.message || 'Erro desconhecido',
    }, { status: 500 });
  }
}
