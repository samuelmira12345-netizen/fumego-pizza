import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const {
      token,
      name, email, phone, cpf,
      address_street, address_number, address_complement,
      address_neighborhood, address_city, address_state, address_zipcode,
      current_password, new_password,
    } = await request.json();

    if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 401 });

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 });
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const userId = decoded.userId;

    const updates = {};
    if (name)                        updates.name                  = name;
    if (email)                       updates.email                 = email.toLowerCase().trim();
    if (phone  !== undefined)        updates.phone                 = phone;
    if (cpf    !== undefined)        updates.cpf                   = cpf;
    if (address_street      !== undefined) updates.address_street      = address_street;
    if (address_number      !== undefined) updates.address_number      = address_number;
    if (address_complement  !== undefined) updates.address_complement  = address_complement;
    if (address_neighborhood !== undefined) updates.address_neighborhood = address_neighborhood;
    if (address_city        !== undefined) updates.address_city        = address_city;
    if (address_state       !== undefined) updates.address_state       = address_state;
    if (address_zipcode     !== undefined) updates.address_zipcode     = address_zipcode;

    // Troca de senha
    if (new_password) {
      if (!current_password) return NextResponse.json({ error: 'Informe a senha atual para trocá-la' }, { status: 400 });
      if (new_password.length < 6) return NextResponse.json({ error: 'Nova senha deve ter pelo menos 6 caracteres' }, { status: 400 });

      const { data: current } = await supabase.from('users').select('password_hash').eq('id', userId).single();
      if (!current) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

      const valid = await bcrypt.compare(current_password, current.password_hash);
      if (!valid) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });

      updates.password_hash = await bcrypt.hash(new_password, 10);
    }

    const { data: updated, error } = await supabase
      .from('users').update(updates).eq('id', userId).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { password_hash: _, ...safeUser } = updated;
    return NextResponse.json({ user: safeUser });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
