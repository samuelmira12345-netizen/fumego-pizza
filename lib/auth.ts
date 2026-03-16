/**
 * Utilitários de autenticação JWT.
 *
 * O token JWT é armazenado em um cookie httpOnly (seguro contra XSS).
 * As rotas de API leem o token do cookie ou do header Authorization (retrocompatibilidade).
 *
 * Revogação (P8): cada token inclui um claim `jti` (JWT ID, UUID v4).
 * O jti é persistido em `user_sessions` no login e removido no logout.
 * As rotas protegidas chamam `getAuthUserWithRevocation` para confirmar que
 * o jti ainda está ativo — tokens roubados podem ser invalidados sem rotacionar
 * o JWT_SECRET inteiro.
 */

import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface JWTPayload {
  userId: string;
  email: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

/** Nome do cookie que armazena o JWT do usuário. */
export const AUTH_COOKIE = 'fumego_auth';

/** Duração do cookie/token: 30 dias em segundos. */
const TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Gera um JWT assinado para o usuário.
 * Inclui `jti` (UUID v4) para permitir revogação individual de tokens.
 */
export function signUserToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não configurado');
  const jti = randomUUID();
  return jwt.sign({ userId, email, jti }, secret, { expiresIn: '30d' });
}

/**
 * Verifica e decodifica um JWT de usuário.
 * Retorna o payload decodificado ou null se inválido.
 * Não verifica revogação — use getAuthUserWithRevocation para isso.
 */
export function verifyUserToken(token: string): JWTPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    return jwt.verify(token, secret) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extrai o JWT de uma request Next.js.
 * Tenta o cookie httpOnly primeiro; fallback para o header Authorization.
 */
export function extractToken(request: NextRequest | Request): string | null {
  // Tenta cookie httpOnly (preferencial — não acessível por JavaScript)
  const cookieHeader = (request as NextRequest).cookies?.get?.(AUTH_COOKIE)?.value;
  if (cookieHeader) return cookieHeader;

  // Fallback: header Authorization: Bearer <token>
  const auth = (request.headers as Headers).get('authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  return bearer || null;
}

/**
 * Extrai e verifica o token da request. Retorna o payload ou null.
 * Verificação apenas criptográfica — NÃO consulta o banco de dados.
 * Para verificar revogação, use getAuthUserWithRevocation.
 */
export function getAuthUser(request: NextRequest | Request): JWTPayload | null {
  const token = extractToken(request);
  if (!token) return null;
  return verifyUserToken(token);
}

/**
 * Extrai, verifica e checa revogação do token.
 * Retorna o payload se o token for válido E o jti ainda existir em user_sessions.
 * Tokens removidos do banco (logout, revogação forçada) retornam null.
 */
export async function getAuthUserWithRevocation(
  request: NextRequest | Request,
  supabase: SupabaseClient,
): Promise<JWTPayload | null> {
  const payload = getAuthUser(request);
  if (!payload) return null;

  // Tokens emitidos antes da feature de revogação não têm jti — aceita para
  // retrocompatibilidade mas loga aviso para que sejam rotacionados.
  if (!payload.jti) return payload;

  const { data } = await supabase
    .from('user_sessions')
    .select('jti')
    .eq('jti', payload.jti)
    .eq('user_id', payload.userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  return data ? payload : null;
}

/**
 * Persiste o jti do token recém-emitido em user_sessions.
 * Deve ser chamado imediatamente após signUserToken no login/registro.
 */
export async function createUserSession(
  supabase: SupabaseClient,
  token: string,
  userId: string,
): Promise<void> {
  const payload = jwt.decode(token) as JWTPayload | null;
  if (!payload?.jti) return;

  const expiresAt = new Date(Date.now() + TOKEN_MAX_AGE * 1000).toISOString();
  await supabase
    .from('user_sessions')
    .insert({ jti: payload.jti, user_id: userId, expires_at: expiresAt });
}

/**
 * Remove a sessão do token da request, invalidando-o imediatamente.
 * Deve ser chamado no logout ou em revogação forçada.
 */
export async function revokeUserSession(
  supabase: SupabaseClient,
  request: NextRequest | Request,
): Promise<void> {
  const payload = getAuthUser(request);
  if (!payload?.jti) return;
  await supabase.from('user_sessions').delete().eq('jti', payload.jti);
}

/**
 * Define o cookie de autenticação httpOnly na response.
 * Chame após um login ou registro bem-sucedido.
 */
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });
}

/**
 * Remove o cookie de autenticação (logout).
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}
