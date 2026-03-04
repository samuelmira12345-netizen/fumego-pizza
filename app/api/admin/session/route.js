import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';
import { logger } from '../../../../lib/logger';

/**
 * Verifica a senha do admin com suporte a bcrypt.
 *
 * Fluxo de autenticação:
 *  1. Se ADMIN_PASSWORD_HASH estiver definida (hash bcrypt), usa bcrypt.compare — RECOMENDADO.
 *  2. Caso contrário, cai no ADMIN_PASSWORD (texto puro) como fallback de compatibilidade.
 *
 * Para migrar para bcrypt, execute no terminal:
 *   node -e "const b=require('bcryptjs');b.hash('SUA_SENHA',12).then(h=>console.log(h))"
 * Defina o resultado como ADMIN_PASSWORD_HASH e remova ADMIN_PASSWORD.
 */
async function verifyAdminPassword(inputPassword) {
  const hashEnv  = process.env.ADMIN_PASSWORD_HASH;
  const plainEnv = process.env.ADMIN_PASSWORD;

  if (hashEnv) {
    return bcrypt.compare(inputPassword, hashEnv);
  }

  if (plainEnv) {
    // Aviso: use ADMIN_PASSWORD_HASH com bcrypt em produção
    logger.warn('[Admin] ADMIN_PASSWORD_HASH não definida — usando ADMIN_PASSWORD em texto puro. Migre para ADMIN_PASSWORD_HASH.');
    return inputPassword === plainEnv;
  }

  return false;
}

/** POST /api/admin/session — troca senha pelo token de sessão (8 h). */
export async function POST(request) {
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
    const { password } = await request.json();
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

    if (!secret) {
      return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 });
    }

    const isValid = await verifyAdminPassword(password);
    if (!isValid) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    const token = jwt.sign({ role: 'admin' }, secret, { expiresIn: '8h' });
    return NextResponse.json({ token });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** GET /api/admin/session — verifica se o token ainda é válido. */
export async function GET(request) {
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
