import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { haversineKm, parseRadiusRules, quoteByRadius } from '../../../../lib/delivery-radius';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatZipcode(zipcode) {
  const digits = String(zipcode || '').replace(/\D/g, '');
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function ufToStateName(uf) {
  const map = {
    AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
    DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
    MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
    PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
    RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
    SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
  };
  return map[String(uf || '').toUpperCase()] || '';
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

const NOMINATIM_HEADERS = {
  'User-Agent': 'fumego-pizza-delivery/1.0',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Geocode using Nominatim structured query (most accurate for Brazilian addresses).
 * Uses separate street/city/state/postalcode params instead of freeform q=.
 */
async function geocodeNominatimStructured(details) {
  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    countrycodes: 'br',
  });
  if (details.street) {
    const streetQuery = [details.street, details.number].filter(Boolean).join(', ');
    params.set('street', streetQuery);
  }
  if (details.city) params.set('city', details.city);
  if (details.state) params.set('state', ufToStateName(details.state) || details.state);
  if (details.zipcode) params.set('postalcode', formatZipcode(details.zipcode) || details.zipcode);

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: NOMINATIM_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const lat = Number(rows[0].lat);
    const lng = Number(rows[0].lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  } catch {}
  return null;
}

/**
 * Geocode using Nominatim freeform query.
 */
async function geocodeNominatimFreeform(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`,
      { headers: NOMINATIM_HEADERS, cache: 'no-store' },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const lat = Number(rows[0].lat);
    const lng = Number(rows[0].lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  } catch {}
  return null;
}

/**
 * Geocode a CEP using BrasilAPI (returns lat/lng for many Brazilian zipcodes).
 */
async function geocodeBrasilApiCep(zipcode) {
  const cep = String(zipcode || '').replace(/\D/g, '');
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      headers: { 'User-Agent': 'fumego-pizza-delivery/1.0' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const lat = Number(data.location?.coordinates?.latitude);
    const lng = Number(data.location?.coordinates?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      return { lat, lng };
    }
  } catch {}
  return null;
}

/**
 * Main geocoding function with multiple strategies and rate-limit-safe delays.
 * Tries up to 4 strategies, with 1.1s delay between Nominatim requests.
 */
async function geocodeAddress(details) {
  // Strategy 1: BrasilAPI by CEP (fast, no rate limit issues, good for Brazil)
  const brasilResult = await geocodeBrasilApiCep(details.zipcode);
  if (brasilResult) return brasilResult;

  // Strategy 2: Nominatim structured query (most accurate)
  await delay(1100);
  const structuredResult = await geocodeNominatimStructured(details);
  if (structuredResult) return structuredResult;

  // Strategy 3: Nominatim freeform with neighborhood + city + state
  await delay(1100);
  const neighborhoodQuery = [details.neighborhood, details.city, ufToStateName(details.state) || details.state, 'Brasil']
    .filter(Boolean)
    .join(', ');
  const neighborhoodResult = await geocodeNominatimFreeform(neighborhoodQuery);
  if (neighborhoodResult) return neighborhoodResult;

  // Strategy 4: Nominatim freeform with city + state only (rough fallback)
  await delay(1100);
  const cityQuery = [details.city, ufToStateName(details.state) || details.state, 'Brasil']
    .filter(Boolean)
    .join(', ');
  const cityResult = await geocodeNominatimFreeform(cityQuery);
  if (cityResult) return cityResult;

  return null;
}

/**
 * Get store coordinates — uses cached lat/lng from settings if available,
 * otherwise geocodes the store address and caches the result.
 */
async function getStoreCoordinates(supabase, settings, originDetails) {
  // Check for cached coordinates first
  const cachedLat = Number(settings.delivery_origin_lat);
  const cachedLng = Number(settings.delivery_origin_lng);
  if (Number.isFinite(cachedLat) && Number.isFinite(cachedLng) && cachedLat !== 0 && cachedLng !== 0) {
    return { lat: cachedLat, lng: cachedLng };
  }

  // Geocode the store address
  if (!originDetails) return null;
  const result = await geocodeAddress(originDetails);
  if (!result) return null;

  // Cache the coordinates for future requests (non-blocking)
  supabase
    .from('settings')
    .upsert([
      { key: 'delivery_origin_lat', value: String(result.lat) },
      { key: 'delivery_origin_lng', value: String(result.lng) },
    ])
    .then(() => {})
    .catch(() => {});

  return result;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { street, number, neighborhood, city, state, zipcode } = body || {};

    const supabase = getSupabaseAdmin();
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key,value')
      .in('key', [
        'delivery_fee', 'delivery_time',
        'delivery_origin_address', 'delivery_origin_address_details',
        'delivery_radius_rules',
        'delivery_origin_lat', 'delivery_origin_lng',
      ]);

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

    // Check if we have cached store coords OR a complete store address to geocode
    const hasCachedCoords = Number.isFinite(Number(settings.delivery_origin_lat))
      && Number.isFinite(Number(settings.delivery_origin_lng))
      && Number(settings.delivery_origin_lat) !== 0;

    if (!originIsComplete && !hasCachedCoords && !settings.delivery_origin_address) {
      return NextResponse.json({ error: 'Endereço de origem da loja não configurado' }, { status: 400 });
    }

    if (!customerDetails.neighborhood && !customerDetails.zipcode) {
      return NextResponse.json({ error: 'Informe pelo menos o bairro ou CEP para calcular a entrega' }, { status: 400 });
    }

    // Geocode store (uses cache if available) and customer in parallel
    const [storeGeo, customerGeo] = await Promise.all([
      getStoreCoordinates(supabase, settings, originDetails),
      geocodeAddress(customerDetails),
    ]);

    if (!storeGeo) {
      return NextResponse.json({
        error: 'Não foi possível localizar o endereço da loja. Verifique as configurações de entrega no painel admin.',
      }, { status: 400 });
    }

    if (!customerGeo) {
      return NextResponse.json({
        error: 'Não foi possível localizar seu endereço. Verifique o CEP, bairro e cidade.',
      }, { status: 400 });
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
