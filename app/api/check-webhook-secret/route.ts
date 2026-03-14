import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// GET /api/check-webhook-secret - Verifica se o MERCADO_PAGO_WEBHOOK_SECRET está configurado
export async function GET(): Promise<NextResponse> {
  const secret = (process.env.MERCADO_PAGO_WEBHOOK_SECRET || '').trim();

  if (!secret) {
    return NextResponse.json({
      status: 'WARNING',
      configured: false,
      message: 'MERCADO_PAGO_WEBHOOK_SECRET NÃO está configurado',
      security_risk: 'Sem este segredo, qualquer requisição ao webhook será aceita sem verificação de autenticidade',
      fix: 'Vá em mercadopago.com.br/developers → Suas integrações → selecione sua aplicação → Webhooks → copie o "Segredo" e adicione como MERCADO_PAGO_WEBHOOK_SECRET nas variáveis de ambiente da Vercel',
    });
  }

  const lengthOk = secret.length >= 10;

  let hmacWorks = false;
  let hmacError: string | null = null;
  try {
    const testMessage = 'id:123456;request-id:test-req;ts:1234567890;';
    const hash = createHmac('sha256', secret).update(testMessage).digest('hex');
    hmacWorks = typeof hash === 'string' && hash.length === 64;
  } catch (e) {
    hmacError = `Erro ao gerar HMAC: ${(e as Error).message}`;
  }

  const allOk = lengthOk && hmacWorks;

  return NextResponse.json({
    status: allOk ? 'OK' : 'ERROR',
    configured: true,
    secret_length: secret.length,
    length_ok: lengthOk,
    hmac_functional: hmacWorks,
    error: hmacError,
    message: allOk
      ? 'MERCADO_PAGO_WEBHOOK_SECRET está configurado e funcionando corretamente'
      : 'MERCADO_PAGO_WEBHOOK_SECRET está configurado mas apresenta problemas',
    fix: allOk ? null : 'Verifique se o segredo foi copiado corretamente do painel do Mercado Pago sem espaços extras',
  });
}
