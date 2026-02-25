import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const { name, email, phone, cpf, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verificar se email já existe
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 409 });
    }

    // Verificar se CPF já existe (se fornecido)
    if (cpf) {
      const { data: existingCpf } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('cpf', cpf)
        .single();

      if (existingCpf) {
        return NextResponse.json({ error: 'Este CPF já está cadastrado' }, { status: 409 });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        name,
        email: email.toLowerCase().trim(),
        phone: phone || null,
        cpf: cpf || null,
        password_hash,
      })
      .select()
      .single();

    if (error) {
      console.error('Register error:', error);
      return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 });
    }

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password_hash: _, ...userWithoutPassword } = newUser;

    return NextResponse.json({
      token,
      user: userWithoutPassword,
    });
  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
