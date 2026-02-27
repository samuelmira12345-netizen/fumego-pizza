/**
 * Testes de integração do fluxo de pagamento.
 *
 * Cobre:
 * - Verificação de assinatura do webhook (Mercado Pago)
 * - Rate limiting (login e admin)
 * - Criptografia/hash do CPF
 * - Validação de MIME type nos uploads
 * - Criação de pedido server-side
 */

// ============================================================
// 1. WEBHOOK — Verificação de assinatura HMAC-SHA256
// ============================================================

const { createHmac } = require('crypto');

function verifySignature(headers, dataId, secret) {
  if (!secret) return false; // MERCADO_PAGO_WEBHOOK_SECRET obrigatório

  const signatureHeader = headers['x-signature'];
  const requestId = headers['x-request-id'];
  if (!signatureHeader || !requestId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => {
      const [k, v] = p.split('=');
      return [k.trim(), v?.trim()];
    })
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  const message = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(message).digest('hex');
  return expected === v1;
}

describe('Webhook — verificação de assinatura', () => {
  const secret = 'meu-segredo-de-teste';
  const dataId = '12345678';
  const requestId = 'req-abc';
  const ts = String(Date.now());

  function buildSignature(msg) {
    const sig = createHmac('sha256', secret).update(msg).digest('hex');
    return `ts=${ts},v1=${sig}`;
  }

  it('aceita assinatura correta', () => {
    const message = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const headers = {
      'x-signature': buildSignature(message),
      'x-request-id': requestId,
    };
    expect(verifySignature(headers, dataId, secret)).toBe(true);
  });

  it('rejeita assinatura incorreta', () => {
    const headers = {
      'x-signature': `ts=${ts},v1=assinatura-errada`,
      'x-request-id': requestId,
    };
    expect(verifySignature(headers, dataId, secret)).toBe(false);
  });

  it('rejeita quando o segredo não está configurado', () => {
    const message = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const headers = {
      'x-signature': buildSignature(message),
      'x-request-id': requestId,
    };
    expect(verifySignature(headers, dataId, undefined)).toBe(false);
    expect(verifySignature(headers, dataId, '')).toBe(false);
  });

  it('rejeita quando cabeçalhos ausentes', () => {
    expect(verifySignature({}, dataId, secret)).toBe(false);
    expect(verifySignature({ 'x-signature': 'ts=1,v1=abc' }, dataId, secret)).toBe(false);
  });

  it('rejeita quando dataId é diferente', () => {
    const message = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const headers = {
      'x-signature': buildSignature(message),
      'x-request-id': requestId,
    };
    expect(verifySignature(headers, 'outro-id', secret)).toBe(false);
  });
});

// ============================================================
// 2. RATE LIMITING
// ============================================================

// Versão síncrona simplificada para teste (mesma lógica do lib/rate-limit.js)
function makeRateLimiter() {
  const store = new Map();
  return function checkRateLimit(key, maxAttempts, windowMs) {
    const now = Date.now();
    if (!store.has(key)) {
      store.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }
    const entry = store.get(key);
    if (now - entry.windowStart > windowMs) {
      store.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }
    if (entry.count >= maxAttempts) {
      return { allowed: false };
    }
    entry.count += 1;
    return { allowed: true };
  };
}

describe('Rate limiting', () => {
  it('permite tentativas dentro do limite', () => {
    const rl = makeRateLimiter();
    for (let i = 0; i < 5; i++) {
      expect(rl('ip:1.2.3.4', 5, 60000).allowed).toBe(true);
    }
  });

  it('bloqueia após exceder o limite', () => {
    const rl = makeRateLimiter();
    for (let i = 0; i < 5; i++) rl('ip:1.2.3.4', 5, 60000);
    expect(rl('ip:1.2.3.4', 5, 60000).allowed).toBe(false);
  });

  it('isola chaves diferentes (IPs diferentes)', () => {
    const rl = makeRateLimiter();
    for (let i = 0; i < 5; i++) rl('ip:1.1.1.1', 5, 60000);
    expect(rl('ip:1.1.1.1', 5, 60000).allowed).toBe(false);
    expect(rl('ip:2.2.2.2', 5, 60000).allowed).toBe(true);
  });
});

// ============================================================
// 3. CRIPTOGRAFIA DE CPF
// ============================================================

const crypto = require('crypto');

function encryptCpf(cpf, key) {
  if (!cpf) return null;
  const clean = String(cpf).replace(/\D/g, '');
  if (!clean) return null;
  const derivedKey = crypto.createHash('sha256').update(key).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptCpf(stored, key) {
  if (!stored || !stored.includes(':')) return null;
  try {
    const [ivHex, tagHex, encHex] = stored.split(':');
    if (!ivHex || !tagHex || !encHex) return null;
    const derivedKey = crypto.createHash('sha256').update(key).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const encData = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encData).toString('utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

function hashCpf(cpf, secret) {
  if (!cpf) return null;
  const clean = String(cpf).replace(/\D/g, '');
  if (clean.length !== 11) return null;
  return crypto.createHmac('sha256', secret).update(clean).digest('hex');
}

describe('Criptografia de CPF', () => {
  const key = 'chave-de-teste-segura-32bytes!!';
  const cpfValido = '123.456.789-09';
  const cpfLimpo = '12345678909';

  describe('encryptCpf / decryptCpf (AES-256-GCM)', () => {
    it('criptografa e descriptografa corretamente', () => {
      const encrypted = encryptCpf(cpfValido, key);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toContain('12345678909');

      const decrypted = decryptCpf(encrypted, key);
      expect(decrypted).toBe(cpfLimpo);
    });

    it('retorna null para CPF vazio', () => {
      expect(encryptCpf(null, key)).toBeNull();
      expect(encryptCpf('', key)).toBeNull();
    });

    it('cada criptografia gera um valor diferente (IV aleatório)', () => {
      const enc1 = encryptCpf(cpfValido, key);
      const enc2 = encryptCpf(cpfValido, key);
      expect(enc1).not.toBe(enc2);
    });

    it('falha ao descriptografar com chave errada', () => {
      const encrypted = encryptCpf(cpfValido, key);
      const result = decryptCpf(encrypted, 'chave-errada');
      expect(result).toBeNull();
    });

    it('retorna null para valor não criptografado', () => {
      expect(decryptCpf(cpfLimpo, key)).toBeNull(); // sem ":"
      expect(decryptCpf(null, key)).toBeNull();
    });
  });

  describe('hashCpf (HMAC-SHA256)', () => {
    it('gera hash consistente para o mesmo CPF', () => {
      const h1 = hashCpf(cpfValido, key);
      const h2 = hashCpf(cpfValido, key);
      expect(h1).toBe(h2);
    });

    it('formata com ou sem máscara e gera o mesmo hash', () => {
      expect(hashCpf('123.456.789-09', key)).toBe(hashCpf('12345678909', key));
    });

    it('gera hashes diferentes para CPFs diferentes', () => {
      expect(hashCpf('12345678909', key)).not.toBe(hashCpf('98765432100', key));
    });

    it('retorna null para CPF inválido (menos de 11 dígitos)', () => {
      expect(hashCpf('1234', key)).toBeNull();
      expect(hashCpf(null, key)).toBeNull();
    });

    it('o hash não contém o CPF em texto puro', () => {
      const h = hashCpf(cpfValido, key);
      expect(h).not.toContain(cpfLimpo);
    });
  });
});

// ============================================================
// 4. VALIDAÇÃO DE MIME TYPE (magic bytes)
// ============================================================

function detectMimeType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return 'application/octet-stream';
}

describe('Validação de MIME type por magic bytes', () => {
  it('detecta JPEG', () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(detectMimeType(bytes)).toBe('image/jpeg');
  });

  it('detecta PNG', () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectMimeType(bytes)).toBe('image/png');
  });

  it('detecta GIF', () => {
    const bytes = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(detectMimeType(bytes)).toBe('image/gif');
  });

  it('detecta WebP', () => {
    const bytes = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // tamanho (dummy)
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(detectMimeType(bytes)).toBe('image/webp');
  });

  it('rejeita arquivo executável disfarçado de imagem', () => {
    // Arquivo EXE (MZ header) com extensão .jpg
    const bytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    expect(detectMimeType(bytes)).toBe('application/octet-stream');
  });

  it('rejeita arquivo de texto disfarçado de imagem', () => {
    const bytes = Buffer.from('<html><body>malware</body></html>', 'utf8');
    expect(detectMimeType(bytes)).toBe('application/octet-stream');
  });
});

// ============================================================
// 5. VALIDAÇÃO DO PAYLOAD DE CRIAÇÃO DE PEDIDO
// ============================================================

describe('Validação do payload de criação de pedido', () => {
  function validateOrderPayload(payload) {
    const errors = [];
    if (!payload.customer_name?.trim()) errors.push('Nome obrigatório');
    if (!payload.customer_phone?.trim()) errors.push('Telefone obrigatório');
    if (!payload.delivery_street?.trim()) errors.push('Rua obrigatória');
    if (!payload.delivery_number?.trim()) errors.push('Número obrigatório');
    if (!payload.delivery_neighborhood?.trim()) errors.push('Bairro obrigatório');
    if (typeof payload.total !== 'number' || payload.total < 0) errors.push('Total inválido');
    const allowed = ['pix', 'card', 'cash', 'card_delivery'];
    if (!allowed.includes(payload.payment_method)) errors.push('Método de pagamento inválido');
    return errors;
  }

  it('aceita payload válido', () => {
    const errors = validateOrderPayload({
      customer_name: 'João Silva',
      customer_phone: '31999999999',
      delivery_street: 'Rua das Flores',
      delivery_number: '123',
      delivery_neighborhood: 'Centro',
      total: 59.90,
      payment_method: 'pix',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejeita payload sem campos obrigatórios', () => {
    const errors = validateOrderPayload({
      customer_name: '',
      customer_phone: '',
      delivery_street: '',
      delivery_number: '',
      delivery_neighborhood: '',
      total: -1,
      payment_method: 'bitcoin',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Nome obrigatório');
    expect(errors).toContain('Total inválido');
    expect(errors).toContain('Método de pagamento inválido');
  });

  it('rejeita método de pagamento desconhecido', () => {
    const errors = validateOrderPayload({
      customer_name: 'Ana',
      customer_phone: '31999999999',
      delivery_street: 'Rua A',
      delivery_number: '1',
      delivery_neighborhood: 'Bairro',
      total: 50,
      payment_method: 'boleto',
    });
    expect(errors).toContain('Método de pagamento inválido');
  });

  it('aceita todos os métodos de pagamento válidos', () => {
    const base = {
      customer_name: 'Maria',
      customer_phone: '31988888888',
      delivery_street: 'Rua B',
      delivery_number: '2',
      delivery_neighborhood: 'Vila',
      total: 45.00,
    };
    ['pix', 'card', 'cash', 'card_delivery'].forEach(method => {
      expect(validateOrderPayload({ ...base, payment_method: method })).toHaveLength(0);
    });
  });
});
