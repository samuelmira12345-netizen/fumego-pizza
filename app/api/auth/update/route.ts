import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import bcrypt from 'bcryptjs';
import { encryptCpf, decryptCpf, validateCpf } from '../../../../lib/cpf-crypto';
import { getAuthUser } from '../../../../lib/auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let decoded = getAuthUser(request);

    const body = await request.json();
    const {
      name, email, phone, cpf,
      address_street, address_number, address_complement,
      address_neighborhood, address_city, address_state, address_zipcode,
      current_password, new_password,
    } = body;

    if (!decoded && body.token) {
      const { verifyUserToken } = await import('../../../../lib/auth');
      decoded = verifyUserToken(body.token);
    }

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const userId = decoded.userId;

    if (!current_password) {
      return NextResponse.json({ error: 'Informe a senha atual para salvar as alterações.' }, { status: 400 });
    }
    const { data: currentUser } = await supabase.from('users').select('password_hash').eq('id', userId).single();
    if (!currentUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    const passwordValid = await bcrypt.compare(current_password, currentUser.password_hash);
    if (!passwordValid) return NextResponse.json({ error: 'Senha atual incorreta. Verifique e tente novamente.' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (name)                          updates.name                  = name;
    if (email)                         updates.email                 = email.toLowerCase().trim();
    if (phone  !== undefined)          updates.phone                 = phone;
    if (cpf !== undefined) {
      if (cpf && !validateCpf(cpf)) {
        return NextResponse.json({ error: 'CPF inválido. Verifique os dígitos e tente novamente.' }, { status: 400 });
      }
      updates.cpf = cpf ? encryptCpf(cpf) : null;
    }
    if (address_street      !== undefined) updates.address_street      = address_street;
    if (address_number      !== undefined) updates.address_number      = address_number;
    if (address_complement  !== undefined) updates.address_complement  = address_complement;
    if (address_neighborhood !== undefined) updates.address_neighborhood = address_neighborhood;
    if (address_city        !== undefined) updates.address_city        = address_city;
    if (address_state       !== undefined) updates.address_state       = address_state;
    if (address_zipcode     !== undefined) updates.address_zipcode     = address_zipcode;

    if (new_password) {
      if (new_password.length < 6) return NextResponse.json({ error: 'Nova senha deve ter pelo menos 6 caracteres' }, { status: 400 });
      updates.password_hash = await bcrypt.hash(new_password, 10);
    }

    const { data: updated, error } = await supabase
      .from('users').update(updates).eq('id', userId).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { password_hash: _, ...safeUser } = updated;
    if (safeUser.cpf) safeUser.cpf = decryptCpf(safeUser.cpf) || '';
    return NextResponse.json({ user: safeUser });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
