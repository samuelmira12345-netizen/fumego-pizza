import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { haversineKm, parseRadiusRules, quoteByRadius } from '../../../../lib/delivery-radius';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseAddressDetails(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      street: normalizeText(parsed.street),
      number: normalizeText(parsed.number),
      complement: normalizeText(parsed.complement),
      neighborhood: normalizeText(parsed.neighborhood),
      city: normalizeText(parsed.city),
      state: normalizeText(parsed.state).toUpperCase(),
      zipcode: String(parsed.zipcode || '').replace(/\D/g, ''),
    };
  } catch {
    return null;
  }
}

function getAddressCandidates(details, rawAddress = '') {
  const streetLine = [details.street, details.number].filter(Boolean).join(', ');
  const withZip = [streetLine, details.complement, details.neighborhood, details.city, details.state, details.zipcode]
    .filter(Boolean)
    .join(', ');
  const withoutZip = [streetLine, details.complement, details.neighborhood, details.city, details.state]
    .filter(Boolean)
    .join(', ');
  const neighborhoodFirst = [details.neighborhood, details.city, details.state, details.zipcode]
    .filter(Boolean)
    .join(', ');
  const fallbackRaw = normalizeText(rawAddress);

  return [withZip, withoutZip, neighborhoodFirst, fallbackRaw]
    .map(normalizeText)
    .filter((value, idx, arr) => value && arr.indexOf(value) === idx);
}

async function geocode(addresses) {
  const candidates = Array.isArray(addresses) ? addresses : [addresses];
  for (const address of candidates) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'fumego-pizza-delivery/1.0',
          'Accept-Language': 'pt-BR',
        },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const r = rows[0];
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, query: address };
    } catch {
      // tenta próximo candidato
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { street, number, neighborhood, city, state, zipcode } = body || {};

    const supabase = getSupabaseAdmin();
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key,value')
      .in('key', ['delivery_fee', 'delivery_time', 'delivery_origin_address', 'delivery_origin_address_details', 'delivery_radius_rules']);

    const settings = Object.fromEntries((settingsRows || []).map((r) => [r.key, r.value]));
    const rules = parseRadiusRules(settings.delivery_radius_rules);

    if (rules.length === 0) {
      return NextResponse.json({
        mode: 'fixed',
        fee: Number(settings.delivery_fee) || 0,
        estimated_mins: Number(settings.delivery_time) || null,
      });
    }

    const customerDetails = {
      street: normalizeText(street),
      number: normalizeText(number),
      neighborhood: normalizeText(neighborhood),
      city: normalizeText(city),
      state: normalizeText(state).toUpperCase(),
      zipcode: String(zipcode || '').replace(/\D/g, ''),
    };

    const originDetails = parseAddressDetails(settings.delivery_origin_address_details);
    const originIsComplete = originDetails
      && originDetails.zipcode
      && originDetails.street
      && originDetails.number
      && originDetails.neighborhood
      && originDetails.city
      && originDetails.state;

    if (!originIsComplete && !settings.delivery_origin_address) {
      return NextResponse.json({ error: 'Endereço de origem da loja não configurado' }, { status: 400 });
    }

    if (!customerDetails.street || !customerDetails.number || !customerDetails.neighborhood || !customerDetails.zipcode) {
      return NextResponse.json({ error: 'Endereço de entrega incompleto' }, { status: 400 });
    }

    const originCandidates = getAddressCandidates(originDetails || {}, settings.delivery_origin_address);
    const customerCandidates = getAddressCandidates(customerDetails);

    const [storeGeo, customerGeo] = await Promise.all([
      geocode(originCandidates),
      geocode(customerCandidates),
    ]);

    if (!storeGeo || !customerGeo) {
      return NextResponse.json({ error: 'Não foi possível localizar os endereços no mapa. Confira CEP, número e bairro.' }, { status: 400 });
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
