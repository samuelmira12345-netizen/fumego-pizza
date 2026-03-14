import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { haversineKm, parseRadiusRules, quoteByRadius } from '../../../../lib/delivery-radius';

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatZipcode(zipcode: unknown): string {
  const digits = String(zipcode || '').replace(/\D/g, '');
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function ufToStateName(uf: unknown): string {
  const map: Record<string, string> = {
    AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
    DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
    MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
    PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
    RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
    SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
  };
  return map[String(uf || '').toUpperCase()] || '';
}

interface AddressDetails {
  street:       string;
  number:       string;
  complement:   string;
  neighborhood: string;
  city:         string;
  state:        string;
  zipcode:      string;
}

function parseAddressDetails(raw: unknown): AddressDetails | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    return {
      street:       normalizeText(p.street),
      number:       normalizeText(p.number),
      complement:   normalizeText(p.complement),
      neighborhood: normalizeText(p.neighborhood),
      city:         normalizeText(p.city),
      state:        normalizeText(p.state).toUpperCase(),
      zipcode:      String(p.zipcode || '').replace(/\D/g, ''),
    };
  } catch {
    return null;
  }
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'fumego-pizza-delivery/1.0',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GeoCoords { lat: number; lng: number; }

async function geocodeNominatimStructured(details: AddressDetails): Promise<GeoCoords | null> {
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

async function geocodeNominatimFreeform(query: string): Promise<GeoCoords | null> {
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

async function geocodeBrasilApiCep(zipcode: string): Promise<GeoCoords | null> {
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

async function geocodeAddress(details: AddressDetails): Promise<GeoCoords | null> {
  const brasilResult = await geocodeBrasilApiCep(details.zipcode);
  if (brasilResult) return brasilResult;

  await delay(1100);
  const structuredResult = await geocodeNominatimStructured(details);
  if (structuredResult) return structuredResult;

  await delay(1100);
  const neighborhoodQuery = [details.neighborhood, details.city, ufToStateName(details.state) || details.state, 'Brasil']
    .filter(Boolean)
    .join(', ');
  const neighborhoodResult = await geocodeNominatimFreeform(neighborhoodQuery);
  if (neighborhoodResult) return neighborhoodResult;

  await delay(1100);
  const cityQuery = [details.city, ufToStateName(details.state) || details.state, 'Brasil']
    .filter(Boolean)
    .join(', ');
  const cityResult = await geocodeNominatimFreeform(cityQuery);
  if (cityResult) return cityResult;

  return null;
}

async function getStoreCoordinates(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  settings: Record<string, string>,
  originDetails: AddressDetails | null,
): Promise<GeoCoords | null> {
  const cachedLat = Number(settings.delivery_origin_lat);
  const cachedLng = Number(settings.delivery_origin_lng);
  if (Number.isFinite(cachedLat) && Number.isFinite(cachedLng) && cachedLat !== 0 && cachedLng !== 0) {
    return { lat: cachedLat, lng: cachedLng };
  }

  if (!originDetails) return null;
  const result = await geocodeAddress(originDetails);
  if (!result) return null;

  void Promise.resolve(
    supabase
      .from('settings')
      .upsert([
        { key: 'delivery_origin_lat', value: String(result.lat) },
        { key: 'delivery_origin_lng', value: String(result.lng) },
      ])
  ).catch(() => {});

  return result;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    const settings: Record<string, string> = Object.fromEntries((settingsRows || []).map((r: { key: string; value: string }) => [r.key, r.value]));
    const rules = parseRadiusRules(settings.delivery_radius_rules);

    if (rules.length === 0) {
      return NextResponse.json({
        mode: 'fixed',
        fee: Number(settings.delivery_fee) || 0,
        estimated_mins: Number(settings.delivery_time) || null,
      });
    }

    const customerDetails: AddressDetails = {
      street:       normalizeText(street),
      number:       normalizeText(number),
      neighborhood: normalizeText(neighborhood),
      city:         normalizeText(city),
      state:        normalizeText(state).toUpperCase(),
      complement:   '',
      zipcode:      String(zipcode || '').replace(/\D/g, ''),
    };

    const originDetails = parseAddressDetails(settings.delivery_origin_address_details);
    const originIsComplete = originDetails
      && originDetails.zipcode
      && originDetails.street
      && originDetails.number
      && originDetails.neighborhood
      && originDetails.city
      && originDetails.state;

    const hasCachedCoords = Number.isFinite(Number(settings.delivery_origin_lat))
      && Number.isFinite(Number(settings.delivery_origin_lng))
      && Number(settings.delivery_origin_lat) !== 0;

    if (!originIsComplete && !hasCachedCoords && !settings.delivery_origin_address) {
      return NextResponse.json({ error: 'Endereço de origem da loja não configurado' }, { status: 400 });
    }

    if (!customerDetails.neighborhood && !customerDetails.zipcode) {
      return NextResponse.json({ error: 'Informe pelo menos o bairro ou CEP para calcular a entrega' }, { status: 400 });
    }

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
    return NextResponse.json({ error: (e as Error).message || 'Erro ao calcular entrega' }, { status: 500 });
  }
}
