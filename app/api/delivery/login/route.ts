import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../../lib/supabase';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: person, error } = await supabase
      .from('delivery_persons')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !person) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, person.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const secret = process.env.JWT_SECRET as string;
    const token = jwt.sign(
      { id: person.id, name: person.name, role: 'delivery' },
      secret,
      { expiresIn: '12h' }
    );

    return NextResponse.json({
      token,
      person: { id: person.id, name: person.name, phone: person.phone, email: person.email },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
