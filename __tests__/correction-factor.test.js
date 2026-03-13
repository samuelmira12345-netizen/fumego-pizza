import { parseCorrectionLoss, costWithFC } from '../lib/correction-factor';

/**
 * Nova lógica de FC: markup simples.
 * FC de 10% sobre R$10,00 = R$11,00  (cost * 1.10)
 *
 * Formatos aceitos:
 *  - Percentual direto (>= 1): "10" → 10%
 *  - Decimal legado (< 1):     "0.10" → 10% (retrocompatibilidade)
 */
describe('correction factor — markup model', () => {
  it('percentual direto: 10 → 10% → R$10 vira R$11', () => {
    expect(parseCorrectionLoss(10)).toBeCloseTo(0.10, 5);
    expect(costWithFC(10, 10)).toBeCloseTo(11.0, 5);
  });

  it('formato decimal legado: 0.10 → 10% → R$10 vira R$11', () => {
    expect(parseCorrectionLoss('0.10')).toBeCloseTo(0.10, 5);
    expect(costWithFC(10, '0.10')).toBeCloseTo(11.0, 5);
  });

  it('percentual 20%: R$50 vira R$60', () => {
    expect(costWithFC(50, 20)).toBeCloseTo(60.0, 5);
  });

  it('percentual 5%: R$100 vira R$105', () => {
    expect(costWithFC(100, 5)).toBeCloseTo(105.0, 5);
  });

  it('aceita FC zero — custo não muda', () => {
    expect(parseCorrectionLoss(0)).toBe(0);
    expect(costWithFC(10, 0)).toBe(10);
    expect(costWithFC(10, null)).toBe(10);
    expect(costWithFC(10, '')).toBe(10);
  });

  it('FC 1.1 (decimal legado) → 1.1% sobre R$10 = R$10.11', () => {
    // Nota: 1.1 < 100, mas >= 1 → interpreta como percentual direto (1.1%)
    expect(parseCorrectionLoss('1.1')).toBeCloseTo(0.011, 5);
    expect(costWithFC(10, '1.1')).toBeCloseTo(10.11, 3);
  });
});
