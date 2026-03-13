export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function parseRadiusRules(raw) {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((r) => ({
      radius_km: Number(r?.radius_km),
      fee: Number(r?.fee),
      estimated_mins: Number(r?.estimated_mins) || 40,
      is_active: r?.is_active !== false,
    }))
    .filter((r) => Number.isFinite(r.radius_km) && r.radius_km > 0 && Number.isFinite(r.fee) && r.is_active)
    .sort((a, b) => a.radius_km - b.radius_km);
}

export function quoteByRadius(distanceKm, rules = []) {
  const hit = rules.find((r) => distanceKm <= r.radius_km);
  if (!hit) return null;
  return {
    fee: hit.fee,
    estimated_mins: hit.estimated_mins,
    matched_radius_km: hit.radius_km,
  };
}
