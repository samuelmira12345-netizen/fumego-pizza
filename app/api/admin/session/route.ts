import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';
import { logger } from '../../../../lib/logger';
import { getSupabaseAdmin } from '../../../../lib/supabase';

const ADMIN_COOKIE  = 'admin_session';
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 horas em segundos

function setAdminCookie(response: NextResponse, token: string): void {
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  });
}

function clearAdminCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,
    path:     '/',
  });
}

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

/** POST /api/admin/session — autentica e seta cookie httpOnly de sessão (8 h). */
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

    let token: string;
    let role: string;
    let resolvedUsername: string;
    let allowedTabs: string[] | null;

    // ── Login master via env vars (retrocompatibilidade) ──────────────────────
    const isMasterAttempt = !username || username.trim() === '' || username.trim().toLowerCase() === 'master';

    if (isMasterAttempt) {
      const isValid = await verifyMasterPassword(password);
      if (!isValid) {
        return NextResponse.json({ error: 'Credenciais incorretas' }, { status: 401 });
      }
      role             = 'master';
      resolvedUsername = 'master';
      allowedTabs      = null;
    } else {
      // ── Login sub-admin via tabela admin_users ──────────────────────────────
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

      supabase
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', adminUser.id)
        .then(() => {});

      role             = adminUser.role === 'master' ? 'master' : 'sub';
      resolvedUsername = adminUser.username as string;
      allowedTabs      = role === 'master' ? null : (adminUser.allowed_tabs as string[] ?? []);
    }

    token = jwt.sign({ role, username: resolvedUsername, allowedTabs }, secret, { expiresIn: '8h' });

    // Token retornado no body para uso nos cabeçalhos Authorization das
    // chamadas subsequentes (em memória, não persiste em localStorage).
    // Cookie httpOnly para restaurar a sessão em recarregamentos de página.
    const response = NextResponse.json({ token, role, username: resolvedUsername, allowedTabs });
    setAdminCookie(response, token);
    return response;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/admin/session — verifica sessão via cookie httpOnly ou header Authorization.
 * Retorna o token e o payload decodificado para restaurar estado em memória.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) return NextResponse.json({ valid: false }, { status: 401 });

    // Cookie httpOnly tem prioridade; fallback para Authorization header
    const cookieToken = request.cookies.get(ADMIN_COOKIE)?.value;
    const authHeader  = request.headers.get('authorization') || '';
    const headerToken = authHeader.replace('Bearer ', '').trim();
    const token       = cookieToken || headerToken;

    if (!token) return NextResponse.json({ valid: false }, { status: 401 });

    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    return NextResponse.json({
      valid:       true,
      token,
      role:        decoded.role        ?? 'master',
      username:    decoded.username    ?? 'master',
      allowedTabs: decoded.allowedTabs ?? null,
    });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}

/** DELETE /api/admin/session — encerra a sessão limpando o cookie httpOnly. */
export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true });
  clearAdminCookie(response);
  return response;
}
