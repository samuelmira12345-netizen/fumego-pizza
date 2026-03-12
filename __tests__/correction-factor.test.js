import { parseCorrectionLoss, costWithFC } from '../lib/correction-factor';

describe('correction factor loss model', () => {
  it('interpreta percentual de perda moderno', () => {
    expect(parseCorrectionLoss('0.10')).toBeCloseTo(0.1, 5);
    expect(costWithFC(10, '0.10')).toBeCloseTo(11.1111, 3);
  });

  it('mantém compatibilidade com formato legado multiplicador', () => {
    expect(parseCorrectionLoss('1.1')).toBeCloseTo(0.090909, 5);
    expect(costWithFC(10, '1.1')).toBeCloseTo(11, 5);
  });

  it('aceita FC zero', () => {
    expect(parseCorrectionLoss(0)).toBe(0);
    expect(costWithFC(10, 0)).toBe(10);
  });
});
