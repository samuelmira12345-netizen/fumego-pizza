export function parseCorrectionLoss(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return 0;

  const parsed = parseFloat(rawValue);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed <= 0) return 0;

  // Legacy format (stored multiplier, e.g. 1.10 = +10% cost)
  if (parsed >= 1) {
    const legacyLoss = 1 - (1 / parsed);
    return Math.min(Math.max(legacyLoss, 0), 0.9999);
  }

  // Current format: percentual de perda em decimal (0.10 = 10%)
  return Math.min(parsed, 0.9999);
}

export function costWithFC(baseCost, correctionFactor) {
  const cost = parseFloat(baseCost) || 0;
  const loss = parseCorrectionLoss(correctionFactor);
  const denominator = 1 - loss;

  if (denominator <= 0) return cost;
  return cost / denominator;
}
