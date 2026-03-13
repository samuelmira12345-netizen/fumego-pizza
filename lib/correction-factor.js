/**
 * Retorna o FC como decimal (ex: 0.10 para 10%).
 * Aceita dois formatos:
 *   - Legado (< 1): 0.10 → 10%  (retrocompatibilidade)
 *   - Atual  (>= 1): 10  → 10%  (percentual direto, como aparece no campo)
 */
export function parseCorrectionLoss(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return 0;
  const parsed = parseFloat(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;

  // Backward compat: valores menores que 1 eram armazenados como decimal (0.10 = 10%)
  if (parsed < 1) return Math.min(parsed, 0.9999);

  // Formato atual: percentual direto (10 = 10%)
  return Math.min(parsed / 100, 0.9999);
}

/**
 * Aplica o Fator de Correção ao custo base.
 * FC de 10% sobre R$10,00 resulta em R$11,00.
 *
 * Exemplo: costWithFC(10, 10) → 11.00
 *
 * @param {number} baseCost - Custo base do insumo
 * @param {number|string} correctionFactor - FC em % (ex: 10 para 10%) ou decimal legado (0.10)
 */
export function costWithFC(baseCost, correctionFactor) {
  const cost = parseFloat(baseCost) || 0;
  const loss = parseCorrectionLoss(correctionFactor);
  if (loss <= 0) return cost;
  return cost * (1 + loss);
}
