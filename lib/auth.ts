/**
 * Utilitários de autenticação JWT.
 *
 * O token JWT é armazenado em um cookie httpOnly (seguro contra XSS).
 * As rotas de API leem o token do cookie ou do header Authorization (retrocompatibilidade).
 */

import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/** Nome do cookie que armazena o JWT do usuário. */
export const AUTH_COOKIE = 'fumego_auth';

/** Duração do cookie/token: 30 dias em segundos. */
const TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Gera um JWT assinado para o usuário.
 */
export function signUserToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não configurado');
  return jwt.sign({ userId, email }, secret, { expiresIn: '30d' });
}

/**
 * Verifica e decodifica um JWT de usuário.
 * Retorna o payload decodificado ou null se inválido.
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
 */
export function getAuthUser(request: NextRequest | Request): JWTPayload | null {
  const token = extractToken(request);
  if (!token) return null;
  return verifyUserToken(token);
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
