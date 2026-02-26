import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const { name, email, phone, password } = await request.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('users').select('id').eq('email', email.toLowerCase().trim()).single();

    if (existing) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from('users').insert({
        name, email: email.toLowerCase().trim(), phone: phone || null, password_hash,
      }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });

    const { password_hash: _, ...safeUser } = user;
    return NextResponse.json({ token, user: safeUser });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
