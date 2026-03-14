export interface RadiusRule {
  radius_km: number;
  fee: number;
  estimated_mins: number;
  is_active: boolean;
}

export interface DeliveryQuote {
  fee: number;
  estimated_mins: number;
  matched_radius_km: number;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function parseRadiusRules(raw: string | unknown[] | null | undefined): RadiusRule[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return (parsed as unknown[])
    .map((r) => ({
      radius_km:      Number((r as Record<string, unknown>)?.radius_km),
      fee:            Number((r as Record<string, unknown>)?.fee),
      estimated_mins: Number((r as Record<string, unknown>)?.estimated_mins) || 40,
      is_active:      (r as Record<string, unknown>)?.is_active !== false,
    }))
    .filter((r) => Number.isFinite(r.radius_km) && r.radius_km > 0 && Number.isFinite(r.fee) && r.is_active)
    .sort((a, b) => a.radius_km - b.radius_km);
}

export function quoteByRadius(distanceKm: number, rules: RadiusRule[] = []): DeliveryQuote | null {
  const hit = rules.find((r) => distanceKm <= r.radius_km);
  if (!hit) return null;
  return {
    fee: hit.fee,
    estimated_mins: hit.estimated_mins,
    matched_radius_km: hit.radius_km,
  };
}
