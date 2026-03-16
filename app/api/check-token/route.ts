import { NextRequest, NextResponse } from 'next/server';

// GET /api/check-token - Verifica se o token do Mercado Pago está configurado
// Protegido por DIAGNOSTICS_SECRET: passe ?secret=<valor> na URL.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const diagnosticsSecret = process.env.DIAGNOSTICS_SECRET;
  if (!diagnosticsSecret || request.nextUrl.searchParams.get('secret') !== diagnosticsSecret) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const token = (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();

  if (!token) {
    return NextResponse.json({
      status: 'ERROR',
      message: 'MERCADO_PAGO_ACCESS_TOKEN NÃO está configurado',
      fix: 'Vá em Vercel → Settings → Environment Variables → Adicione MERCADO_PAGO_ACCESS_TOKEN',
    });
  }

  const startsCorrect = token.startsWith('APP_USR-') || token.startsWith('TEST-');
  const tokenType = token.startsWith('TEST-') ? 'TESTE' : token.startsWith('APP_USR-') ? 'PRODUÇÃO' : 'DESCONHECIDO';

  let tokenWorks = false;
  let mpError: string | null = null;
  try {
    const res = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    tokenWorks = res.ok;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      mpError = `Status ${res.status}: ${(data as Record<string, string>).message || 'erro desconhecido'}`;
    }
  } catch (e) {
    mpError = `Erro de conexão: ${(e as Error).message}`;
  }

  return NextResponse.json({
    status: tokenWorks ? 'OK' : 'ERROR',
    token_configured: true,
    token_prefix: token.substring(0, 12) + '...',
    token_length: token.length,
    token_type: tokenType,
    format_correct: startsCorrect,
    token_works: tokenWorks,
    error: mpError,
    fix: tokenWorks ? null : 'O token não está funcionando. Vá em mercadopago.com.br/developers → Suas integrações → copie o Access Token novamente e cole na Vercel sem espaços extras.',
  });
}
