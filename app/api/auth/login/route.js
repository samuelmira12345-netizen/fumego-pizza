import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

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

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });

    const { password_hash, ...safeUser } = user;
    return NextResponse.json({ token, user: safeUser });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
