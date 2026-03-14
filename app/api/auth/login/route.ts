import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { loginSchema } from '../../../../lib/schemas';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';
import { decryptCpf } from '../../../../lib/cpf-crypto';
import { signUserToken, setAuthCookie } from '../../../../lib/auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ip = getClientIp(request);
    const { allowed, retryAfterMs } = await checkRateLimit(`login:${ip}`, 10, 15 * 60_000);
    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${retryAfterSec} segundos.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const raw = await request.json();
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('users').select('*').eq('email', email.toLowerCase().trim()).single();

    if (error || !user) {
      return NextResponse.json({ error: 'Email não encontrado' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    const token = signUserToken(user.id, user.email);

    const { password_hash, ...safeUser } = user;
    if (safeUser.cpf) safeUser.cpf = decryptCpf(safeUser.cpf) || '';

    const response = NextResponse.json({ token, user: safeUser });
    setAuthCookie(response, token);
    return response;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
