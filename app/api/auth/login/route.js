import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 });

    const db = getSupabaseAdmin();
    const { data: user, error } = await db.from('users').select('*').eq('email', email.toLowerCase().trim()).single();
    if (error || !user) return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...safe } = user;
    return NextResponse.json({ token, user: safe });
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
