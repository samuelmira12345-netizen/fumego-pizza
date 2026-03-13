import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { haversineKm, parseRadiusRules, quoteByRadius } from '../../../../lib/delivery-radius';

async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'fumego-pizza-delivery/1.0',
      'Accept-Language': 'pt-BR',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Falha na geocodificação');
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
  return { lat: Number(r.lat), lng: Number(r.lon) };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { street, number, neighborhood, city, state, zipcode } = body || {};

    const supabase = getSupabaseAdmin();
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key,value')
      .in('key', ['delivery_fee', 'delivery_time', 'delivery_origin_address', 'delivery_radius_rules']);

    const settings = Object.fromEntries((settingsRows || []).map((r) => [r.key, r.value]));
    const rules = parseRadiusRules(settings.delivery_radius_rules);

    if (rules.length === 0) {
      return NextResponse.json({
        mode: 'fixed',
        fee: Number(settings.delivery_fee) || 0,
        estimated_mins: Number(settings.delivery_time) || null,
      });
    }

    if (!settings.delivery_origin_address) {
      return NextResponse.json({ error: 'Endereço de origem da loja não configurado' }, { status: 400 });
    }

    const customerAddress = [street, number, neighborhood, city, state, zipcode].filter(Boolean).join(', ');
    if (!customerAddress || String(customerAddress).trim().length < 8) {
      return NextResponse.json({ error: 'Endereço de entrega incompleto' }, { status: 400 });
    }

    const [storeGeo, customerGeo] = await Promise.all([
      geocode(settings.delivery_origin_address),
      geocode(customerAddress),
    ]);

    if (!storeGeo || !customerGeo) {
      return NextResponse.json({ error: 'Não foi possível localizar os endereços no mapa' }, { status: 400 });
    }

    const distance_km = haversineKm(storeGeo.lat, storeGeo.lng, customerGeo.lat, customerGeo.lng);
    const quote = quoteByRadius(distance_km, rules);

    if (!quote) {
      return NextResponse.json({
        error: 'Endereço fora da área de entrega',
        distance_km,
      }, { status: 400 });
    }

    return NextResponse.json({
      mode: 'radius',
      fee: quote.fee,
      estimated_mins: quote.estimated_mins,
      matched_radius_km: quote.matched_radius_km,
      distance_km,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Erro ao calcular entrega' }, { status: 500 });
  }
}
