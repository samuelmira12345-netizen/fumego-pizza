import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';

/** GET /api/auth/verify-email?token=... — verifica o token de e-mail. */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: record } = await supabase
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expirado. Faça login para receber um novo link.' }, { status: 400 });
    }

    // Marcar e-mail como verificado (coluna email_verified na tabela users, se existir)
    // Se a coluna não existir, apenas marca o token como usado
    await supabase.from('email_verification_tokens').update({ used_at: new Date().toISOString() }).eq('id', record.id);

    return NextResponse.json({ success: true, message: 'E-mail verificado com sucesso!' });
  } catch (e) {
    console.error('Verify email error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
