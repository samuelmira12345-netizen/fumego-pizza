import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { resetPasswordSchema } from '../../../../lib/schemas';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';
import bcrypt from 'bcryptjs';

/** POST /api/auth/reset-password — redefine a senha usando o token enviado por e-mail. */
export async function POST(request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(`reset-pwd:${ip}`, 5, 15 * 60_000);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${retryAfterSec} segundos.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  try {
    const raw = await request.json();
    const parsed = resetPasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Dados inválidos' }, { status: 400 });
    }
    const { token, new_password } = parsed.data;

    const supabase = getSupabaseAdmin();
    const { data: record } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expirado. Solicite um novo link.' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await supabase.from('users').update({ password_hash }).eq('id', record.user_id);
    await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', record.id);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Reset password error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
