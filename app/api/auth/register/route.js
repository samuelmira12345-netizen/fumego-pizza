import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const { name, email, phone, cpf, password } = await request.json();
    if (!name || !email || !password) return NextResponse.json({ error: 'Nome, email e senha obrigatórios' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Senha mínimo 6 caracteres' }, { status: 400 });

    const db = getSupabaseAdmin();

    const { data: exists } = await db.from('users').select('id').eq('email', email.toLowerCase().trim()).single();
    if (exists) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });

    if (cpf) {
      const { data: cpfExists } = await db.from('users').select('id').eq('cpf', cpf.replace(/\D/g, '')).single();
      if (cpfExists) return NextResponse.json({ error: 'CPF já cadastrado' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const { data: newUser, error } = await db.from('users').insert({
      name, email: email.toLowerCase().trim(), phone: phone || null,
      cpf: cpf ? cpf.replace(/\D/g, '') : null, password_hash: hash,
    }).select().single();
    if (error) throw error;

    const token = jwt.sign({ userId: newUser.id, email: newUser.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...safe } = newUser;
    return NextResponse.json({ token, user: safe });
  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
