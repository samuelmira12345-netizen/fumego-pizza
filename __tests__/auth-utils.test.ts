/**
 * Testes unitários para lib/auth — utilitários de JWT e cookies.
 */

import jwt from 'jsonwebtoken';

function signUserToken(userId: any, email: any, secret: any) {
  if (!secret) throw new Error('JWT_SECRET não configurado');
  return jwt.sign({ userId, email }, secret, { expiresIn: '30d' });
}

function verifyUserToken(token: any, secret: any) {
  if (!secret) return null;
  try { return jwt.verify(token, secret); } catch { return null; }
}

function extractToken(cookieValue: any, authHeader: any) {
  if (cookieValue) return cookieValue;
  if (authHeader) {
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    return bearer || null;
  }
  return null;
}

function getAuthUser(cookieValue: any, authHeader: any, secret: any) {
  const token = extractToken(cookieValue, authHeader);
  if (!token) return null;
  return verifyUserToken(token, secret);
}

const TEST_SECRET = 'test-secret-at-least-32-chars-long!!';

describe('signUserToken', () => {
  it('gera um JWT com userId e email no payload', () => {
    const token = signUserToken('user-123', 'joao@example.com', TEST_SECRET);
    expect(typeof token).toBe('string');
    const decoded = jwt.decode(token) as any;
    expect(decoded.userId).toBe('user-123');
    expect(decoded.email).toBe('joao@example.com');
  });

  it('token expira em 30 dias', () => {
    const token = signUserToken('user-123', 'joao@example.com', TEST_SECRET);
    const decoded = jwt.decode(token) as any;
    const diffDays = (decoded.exp - decoded.iat) / (60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('lança erro se JWT_SECRET estiver ausente', () => {
    expect(() => signUserToken('user-123', 'joao@example.com', undefined)).toThrow('JWT_SECRET não configurado');
    expect(() => signUserToken('user-123', 'joao@example.com', null)).toThrow('JWT_SECRET não configurado');
    expect(() => signUserToken('user-123', 'joao@example.com', '')).toThrow('JWT_SECRET não configurado');
  });
});

describe('verifyUserToken', () => {
  it('retorna o payload para token válido', () => {
    const token = signUserToken('user-456', 'maria@example.com', TEST_SECRET);
    const payload = verifyUserToken(token, TEST_SECRET) as any;
    expect(payload).not.toBeNull();
    expect(payload.userId).toBe('user-456');
    expect(payload.email).toBe('maria@example.com');
  });

  it('retorna null para token com assinatura inválida', () => {
    const token = signUserToken('user-456', 'maria@example.com', TEST_SECRET);
    expect(verifyUserToken(token, 'wrong-secret')).toBeNull();
  });

  it('retorna null para string aleatória (não é JWT)', () => {
    expect(verifyUserToken('nao-e-um-jwt', TEST_SECRET)).toBeNull();
  });

  it('retorna null para token expirado', () => {
    const expiredToken = jwt.sign({ userId: 'user-789', email: 'expired@example.com' }, TEST_SECRET, { expiresIn: -1 });
    expect(verifyUserToken(expiredToken, TEST_SECRET)).toBeNull();
  });

  it('retorna null se JWT_SECRET estiver ausente', () => {
    const token = signUserToken('user-456', 'maria@example.com', TEST_SECRET);
    expect(verifyUserToken(token, undefined)).toBeNull();
    expect(verifyUserToken(token, null)).toBeNull();
    expect(verifyUserToken(token, '')).toBeNull();
  });
});

describe('extractToken', () => {
  it('retorna o valor do cookie quando presente', () => {
    expect(extractToken('meu-token-de-cookie', null)).toBe('meu-token-de-cookie');
  });

  it('retorna o Bearer token do header quando não há cookie', () => {
    expect(extractToken(null, 'Bearer meu-token')).toBe('meu-token');
    expect(extractToken(null, 'bearer meu-token')).toBe('meu-token');
  });

  it('prefere cookie quando ambos estão presentes', () => {
    expect(extractToken('cookie-token', 'Bearer header-token')).toBe('cookie-token');
  });

  it('retorna null quando nem cookie nem header estão presentes', () => {
    expect(extractToken(null, null)).toBeNull();
    expect(extractToken('', '')).toBeNull();
    expect(extractToken(undefined, undefined)).toBeNull();
  });
});

describe('getAuthUser', () => {
  it('retorna o payload quando token de cookie é válido', () => {
    const token = signUserToken('user-abc', 'abc@example.com', TEST_SECRET);
    const result = getAuthUser(token, null, TEST_SECRET) as any;
    expect(result).not.toBeNull();
    expect(result.userId).toBe('user-abc');
  });

  it('retorna o payload quando token de header Authorization é válido', () => {
    const token = signUserToken('user-abc', 'abc@example.com', TEST_SECRET);
    const result = getAuthUser(null, `Bearer ${token}`, TEST_SECRET) as any;
    expect(result).not.toBeNull();
    expect(result.userId).toBe('user-abc');
  });

  it('retorna null quando não há token', () => {
    expect(getAuthUser(null, null, TEST_SECRET)).toBeNull();
  });

  it('retorna null quando token é inválido', () => {
    expect(getAuthUser('token-invalido', null, TEST_SECRET)).toBeNull();
  });
});
