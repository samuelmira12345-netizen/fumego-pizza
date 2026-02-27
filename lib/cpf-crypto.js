/**
 * Utilitários de criptografia para CPF.
 *
 * - encryptCpf  : AES-256-GCM (reversível) — para armazenar no perfil do usuário
 * - decryptCpf  : Descriptografa o valor salvo com encryptCpf
 * - hashCpf     : HMAC-SHA256 (irreversível) — para comparações em coupon_usage e orders
 *
 * Variável de ambiente necessária: CPF_ENCRYPTION_KEY
 * Gere uma chave segura com: openssl rand -hex 32
 */

import { createHmac, createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

function getKey() {
  const raw = process.env.CPF_ENCRYPTION_KEY;
  if (!raw) throw new Error('CPF_ENCRYPTION_KEY não configurada');
  // Derivar exatamente 32 bytes a partir da chave fornecida
  return createHash('sha256').update(raw).digest();
}

/**
 * Criptografa um CPF com AES-256-GCM.
 * Retorna string no formato "iv:authTag:ciphertext" em hex, ou null se inválido.
 */
export function encryptCpf(cpf) {
  if (!cpf) return null;
  const clean = String(cpf).replace(/\D/g, '');
  if (!clean) return null;

  const key = getKey();
  const iv = randomBytes(12); // 96 bits para GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descriptografa um CPF criptografado com encryptCpf.
 * Retorna o CPF limpo (somente dígitos) ou null se falhar.
 */
export function decryptCpf(stored) {
  if (!stored) return null;
  // Suporte retroativo: se não tem o formato esperado, retorna null
  if (!stored.includes(':')) return null;

  try {
    const parts = stored.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, encHex] = parts;

    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const encData = Buffer.from(encHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encData).toString('utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

/**
 * Gera um hash HMAC-SHA256 do CPF para comparações (coupon_usage, customer_cpf em orders).
 * Irreversível: adequado onde só é preciso verificar igualdade, não recuperar o valor.
 * Retorna null se o CPF não tiver 11 dígitos.
 */
export function hashCpf(cpf) {
  if (!cpf) return null;
  const clean = String(cpf).replace(/\D/g, '');
  if (clean.length !== 11) return null;

  const secret = process.env.CPF_ENCRYPTION_KEY;
  if (!secret) throw new Error('CPF_ENCRYPTION_KEY não configurada');
  return createHmac('sha256', secret).update(clean).digest('hex');
}
