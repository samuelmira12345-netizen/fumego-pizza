import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { sendVerificationEmail } from '../../../../lib/email';
import { registerSchema } from '../../../../lib/schemas';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { signUserToken, setAuthCookie } from '../../../../lib/auth';
import { logger } from '../../../../lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw = await request.json();
    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const {
      name, email, phone, password,
      address_street, address_number, address_complement,
      address_neighborhood, address_city, address_state, address_zipcode,
    } = parsed.data;

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('users').select('id').eq('email', email.toLowerCase().trim()).single();

    if (existing) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from('users').insert({
        name,
        email: email.toLowerCase().trim(),
        phone: phone || null,
        password_hash,
        address_street:       address_street       || null,
        address_number:       address_number       || null,
        address_complement:   address_complement   || null,
        address_neighborhood: address_neighborhood || null,
        address_city:         address_city         || null,
        address_state:        address_state        || null,
        address_zipcode:      address_zipcode      || null,
      }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const token = signUserToken(user.id, user.email);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    supabase.from('email_verification_tokens').insert({
      user_id: user.id, token: verificationToken, expires_at: expiresAt,
    }).then(() => {
      const appUrl    = process.env.NEXT_PUBLIC_APP_URL || '';
      const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;
      sendVerificationEmail(user.email, user.name, verifyUrl)
        .catch((err: Error) => logger.error('Erro ao enviar e-mail de verificação', err));
    });

    const { password_hash: _, ...safeUser } = user;

    const response = NextResponse.json({ token, user: safeUser });
    setAuthCookie(response, token);
    return response;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
