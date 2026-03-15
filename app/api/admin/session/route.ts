import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';
import { logger } from '../../../../lib/logger';
import { getSupabaseAdmin } from '../../../../lib/supabase';

/** Verifica a senha mestre via variáveis de ambiente (retrocompatibilidade). */
async function verifyMasterPassword(inputPassword: string): Promise<boolean> {
  const hashEnv  = process.env.ADMIN_PASSWORD_HASH;
  const plainEnv = process.env.ADMIN_PASSWORD;

  if (hashEnv) {
    return bcrypt.compare(inputPassword, hashEnv);
  }

  if (plainEnv) {
    logger.warn('[Admin] ADMIN_PASSWORD_HASH não definida — usando ADMIN_PASSWORD em texto puro. Migre para ADMIN_PASSWORD_HASH.');
    return inputPassword === plainEnv;
  }

  return false;
}

/** POST /api/admin/session — troca username+senha pelo token de sessão (8 h). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(`admin-session:${ip}`, 5, 15 * 60_000);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${retryAfterSec} segundos.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const { username, password } = body as { username?: string; password: string };
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

    if (!secret) {
      return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 });
    }

    // ── Login master via env vars (retrocompatibilidade) ──────────────────────
    // Triggers when: username is omitted, empty, or explicitly 'master'
    const isMasterAttempt = !username || username.trim() === '' || username.trim().toLowerCase() === 'master';

    if (isMasterAttempt) {
      const isValid = await verifyMasterPassword(password);
      if (!isValid) {
        return NextResponse.json({ error: 'Credenciais incorretas' }, { status: 401 });
      }

      const token = jwt.sign(
        { role: 'master', username: 'master', allowedTabs: null },
        secret,
        { expiresIn: '8h' }
      );
      return NextResponse.json({ token });
    }

    // ── Login sub-admin via tabela admin_users ────────────────────────────────
    const supabase = getSupabaseAdmin();
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('id, username, password_hash, role, allowed_tabs, is_active')
      .eq('username', username.trim())
      .single();

    if (error || !adminUser) {
      return NextResponse.json({ error: 'Credenciais incorretas' }, { status: 401 });
    }

    if (!adminUser.is_active) {
      return NextResponse.json({ error: 'Conta desativada' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, adminUser.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Credenciais incorretas' }, { status: 401 });
    }

    // Atualiza last_login_at em background (não bloqueia resposta)
    supabase
      .from('admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', adminUser.id)
      .then(() => {});

    const role = adminUser.role === 'master' ? 'master' : 'sub';
    const allowedTabs: string[] | null = role === 'master' ? null : (adminUser.allowed_tabs ?? []);

    const token = jwt.sign(
      { role, username: adminUser.username, allowedTabs },
      secret,
      { expiresIn: '8h' }
    );

    return NextResponse.json({ token });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** GET /api/admin/session — verifica se o token ainda é válido. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth   = request.headers.get('authorization') || '';
    const token  = auth.replace('Bearer ', '').trim();
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

    if (!token || !secret) return NextResponse.json({ valid: false }, { status: 401 });

    jwt.verify(token, secret);
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
