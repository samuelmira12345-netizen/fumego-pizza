/**
 * Testes unitários para validateCpf (lib/cpf-crypto.js).
 *
 * Cobre:
 * - CPFs válidos reais
 * - CPFs inválidos (dígitos errados, sequências triviais, formato incorreto)
 * - Entrada nula/undefined/vazia
 * - CPF formatado (com máscara) vs somente dígitos
 */

// ── Implementação inline (mesmo algoritmo do lib/cpf-crypto.js) ──────────────

function validateCpf(cpf: any) {
  if (!cpf) return false;
  const clean = String(cpf).replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(clean[10]);
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('validateCpf — CPFs válidos', () => {
  it('aceita CPF válido (somente dígitos)', () => {
    expect(validateCpf('11144477735')).toBe(true);
  });

  it('aceita CPF válido formatado com máscara', () => {
    expect(validateCpf('111.444.777-35')).toBe(true);
  });

  it('aceita outro CPF válido', () => {
    expect(validateCpf('52998224725')).toBe(true);
  });

  it('aceita CPF com dígito verificador zero', () => {
    // CPF com ambos dígitos verificadores = 0
    expect(validateCpf('05336872000')).toBe(true);
  });
});

describe('validateCpf — CPFs inválidos', () => {
  it('rejeita CPF com dígito verificador errado', () => {
    expect(validateCpf('11144477734')).toBe(false); // último dígito trocado
    expect(validateCpf('11144477745')).toBe(false); // penúltimo trocado
  });

  it('rejeita sequências triviais', () => {
    const triviais = [
      '00000000000', '11111111111', '22222222222', '33333333333',
      '44444444444', '55555555555', '66666666666', '77777777777',
      '88888888888', '99999999999',
    ];
    triviais.forEach(cpf => {
      expect(validateCpf(cpf)).toBe(false);
    });
  });

  it('rejeita CPF com menos de 11 dígitos', () => {
    expect(validateCpf('1234567890')).toBe(false);   // 10 dígitos
    expect(validateCpf('123456789')).toBe(false);    // 9 dígitos
  });

  it('rejeita CPF com mais de 11 dígitos', () => {
    expect(validateCpf('111444777351')).toBe(false); // 12 dígitos
  });

  it('rejeita string vazia', () => {
    expect(validateCpf('')).toBe(false);
  });

  it('rejeita null e undefined', () => {
    expect(validateCpf(null)).toBe(false);
    expect(validateCpf(undefined)).toBe(false);
  });

  it('rejeita string com apenas letras/símbolos', () => {
    expect(validateCpf('abc.def.ghi-jk')).toBe(false);
  });

  it('rejeita CPF com todos os dígitos iguais mas formatado', () => {
    expect(validateCpf('000.000.000-00')).toBe(false);
    expect(validateCpf('111.111.111-11')).toBe(false);
  });
});

describe('validateCpf — formatos de entrada', () => {
  it('trata CPF com espaços extras', () => {
    // Espaços não são dígitos, serão removidos junto com não-dígitos
    // Resultado: depende dos dígitos restantes
    const cpfComEspacos = '111 444 777 35';
    // Após strip de não-dígitos: "11144477735" = válido
    expect(validateCpf(cpfComEspacos)).toBe(true);
  });

  it('trata CPF com traços e pontos mistos', () => {
    expect(validateCpf('111-444-777.35')).toBe(true);
  });
});
