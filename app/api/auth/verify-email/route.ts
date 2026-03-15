import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { logger } from '../../../../lib/logger';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';

/** GET /api/auth/verify-email?token=... — verifica o token de e-mail. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(`verify-email:${ip}`, 10, 15 * 60_000);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${retryAfterSec} segundos.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: record } = await supabase
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expirado. Faça login para receber um novo link.' }, { status: 400 });
    }

    // Marca o token como usado e verifica o e-mail do usuário atomicamente
    await Promise.all([
      supabase
        .from('email_verification_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', record.id),
      supabase
        .from('users')
        .update({ email_verified: true })
        .eq('id', record.user_id),
    ]);

    return NextResponse.json({ success: true, message: 'E-mail verificado com sucesso!' });
  } catch (e) {
    logger.error('Verify email error', e as Error);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
