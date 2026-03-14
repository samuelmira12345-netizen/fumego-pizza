import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { sendPasswordResetEmail } from '../../../../lib/email';
import { forgotPasswordSchema } from '../../../../lib/schemas';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';
import crypto from 'crypto';
import { logger } from '../../../../lib/logger';

/** POST /api/auth/forgot-password — envia e-mail de recuperação de senha. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(`forgot-pwd:${ip}`, 5, 15 * 60_000);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${retryAfterSec} segundos.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  try {
    const raw = await request.json();
    const parsed = forgotPasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues?.[0]?.message || 'E-mail inválido' }, { status: 400 });
    }
    const { email } = parsed.data;

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (!user) return NextResponse.json({ success: true });

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase.from('password_reset_tokens').insert({
      user_id: user.id, token, expires_at: expiresAt,
    });

    const appUrl   = process.env.NEXT_PUBLIC_APP_URL || '';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error('Forgot password error', e as Error);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
