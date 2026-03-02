import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { loginSchema } from '../../../../lib/schemas';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';
import { decryptCpf } from '../../../../lib/cpf-crypto';

export async function POST(request) {
  try {
    // Rate limiting: máximo 10 tentativas por IP a cada 15 minutos
    const ip = getClientIp(request);
    const { allowed, retryAfterMs } = checkRateLimit(`login:${ip}`, 10, 15 * 60_000);
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

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 });
    const token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: '30d' });

    const { password_hash, ...safeUser } = user;
    // Descriptografar CPF antes de retornar ao cliente
    if (safeUser.cpf) safeUser.cpf = decryptCpf(safeUser.cpf) || '';
    return NextResponse.json({ token, user: safeUser });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
