import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { haversineKm, parseRadiusRules, quoteByRadius } from '../../../../lib/delivery-radius';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeZipcode(zipcode) {
  return String(zipcode || '').replace(/\D/g, '');
}

function formatZipcode(zipcode) {
  const digits = normalizeZipcode(zipcode);
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
      zipcode: normalizeZipcode(parsed.zipcode),
    };
  } catch {
    return null;
  }
}

function buildAddressCandidates(details, rawAddress = '') {
  const zipcodeFormatted = formatZipcode(details.zipcode);
  const stateName = ufToStateName(details.state);

  const streetLine = [details.street, details.number].filter(Boolean).join(', ');
  const withZip = [streetLine, details.complement, details.neighborhood, details.city, details.state, zipcodeFormatted]
    .filter(Boolean)
    .join(', ');
  const withoutZip = [streetLine, details.complement, details.neighborhood, details.city, details.state]
    .filter(Boolean)
    .join(', ');
  const withoutNumber = [details.street, details.neighborhood, details.city, details.state, zipcodeFormatted]
    .filter(Boolean)
    .join(', ');
  const neighborhoodFirst = [details.neighborhood, details.city, details.state, zipcodeFormatted]
    .filter(Boolean)
    .join(', ');
  const cityAndZip = [details.city, details.state, zipcodeFormatted]
    .filter(Boolean)
    .join(', ');
  const stateAsName = [streetLine, details.neighborhood, details.city, stateName, zipcodeFormatted]
    .filter(Boolean)
    .join(', ');
  const fallbackRaw = normalizeText(rawAddress);

  const base = [
    withZip,
    withoutZip,
    withoutNumber,
    neighborhoodFirst,
    cityAndZip,
    zipcodeFormatted,
    stateAsName,
    fallbackRaw,
  ]
    .map(normalizeText)
    .filter(Boolean);

  const withCountry = base.map((value) => `${value}, Brasil`);

  return [...base, ...withCountry]
    .map(normalizeText)
    .filter((value, idx, arr) => value && arr.indexOf(value) === idx);
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupCep(cep) {
  const zipcode = normalizeZipcode(cep);
  if (zipcode.length !== 8) return null;

  const data = await fetchJsonWithTimeout(`https://viacep.com.br/ws/${zipcode}/json/`, {
    headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
  }, 5000);

  if (!data || data.erro) return null;

  return {
    street: normalizeText(data.logradouro),
    neighborhood: normalizeText(data.bairro),
    city: normalizeText(data.localidade),
    state: normalizeText(data.uf).toUpperCase(),
    zipcode,
  };
}

function mergeAddressWithCep(base, cepInfo) {
  if (!cepInfo) return base;
  return {
    ...base,
    street: base.street || cepInfo.street,
    neighborhood: base.neighborhood || cepInfo.neighborhood,
    city: base.city || cepInfo.city,
    state: base.state || cepInfo.state,
    zipcode: base.zipcode || cepInfo.zipcode,
  };
}

function getStoreFallbackCoordinates() {
  const lat = Number(process.env.CW_DEFAULT_LAT);
  const lng = Number(process.env.CW_DEFAULT_LNG);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng, query: 'CW_DEFAULT_LAT/LNG' };
  }
  return null;
}

function parseCoordinatesFromRows(rows, query) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const first = rows[0];
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, query };
  return null;
}

async function geocode(addresses) {
  const candidates = Array.isArray(addresses) ? addresses : [addresses];
  for (const address of candidates) {
    const providers = [
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&addressdetails=1&q=${encodeURIComponent(address)}`,
      `https://geocode.maps.co/search?q=${encodeURIComponent(address)}&country=BR`,
    ];

    for (const url of providers) {
      const rows = await fetchJsonWithTimeout(url, {
        headers: {
          'User-Agent': 'fumego-pizza-delivery/1.1 (contato@fumegopizza.com)',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      }, 6000);

      const parsed = parseCoordinatesFromRows(rows, address);
      if (parsed) return parsed;
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

    const customerDetailsRaw = {
      street: normalizeText(street),
      number: normalizeText(number),
      neighborhood: normalizeText(neighborhood),
      city: normalizeText(city),
      state: normalizeText(state).toUpperCase(),
      zipcode: normalizeZipcode(zipcode),
    };

    if (!customerDetailsRaw.number || !customerDetailsRaw.zipcode) {
      return NextResponse.json({ error: 'Endereço de entrega incompleto' }, { status: 400 });
    }

    const originDetailsRaw = parseAddressDetails(settings.delivery_origin_address_details) || {
      street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipcode: '',
    };

    if (!originDetailsRaw.number || (!originDetailsRaw.zipcode && !settings.delivery_origin_address)) {
      return NextResponse.json({ error: 'Endereço de origem da loja não configurado' }, { status: 400 });
    }

    const [customerCep, originCep] = await Promise.all([
      lookupCep(customerDetailsRaw.zipcode),
      lookupCep(originDetailsRaw.zipcode),
    ]);

    const customerDetails = mergeAddressWithCep(customerDetailsRaw, customerCep);
    const originDetails = mergeAddressWithCep(originDetailsRaw, originCep);

    if (!customerDetails.street || !customerDetails.neighborhood || !customerDetails.city || !customerDetails.state) {
      return NextResponse.json({ error: 'Endereço de entrega incompleto' }, { status: 400 });
    }

    const originCandidates = buildAddressCandidates(originDetails, settings.delivery_origin_address);
    const customerCandidates = buildAddressCandidates(customerDetails);

    const [storeGeoResolved, customerGeo] = await Promise.all([
      geocode(originCandidates),
      geocode(customerCandidates),
    ]);

    const storeGeo = storeGeoResolved || getStoreFallbackCoordinates();

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
