import { NextResponse } from 'next/server';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatZipcode(zipcode) {
  const digits = String(zipcode || '').replace(/\D/g, '');
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

const UF_MAP = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

const HEADERS = {
  'User-Agent': 'fumego-pizza-delivery/1.0',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryBrasilApi(zipcode) {
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

async function tryNominatimStructured(details) {
  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    countrycodes: 'br',
  });
  if (details.street) {
    params.set('street', [details.street, details.number].filter(Boolean).join(', '));
  }
  if (details.city) params.set('city', details.city);
  if (details.state) params.set('state', UF_MAP[details.state] || details.state);
  if (details.zipcode) params.set('postalcode', formatZipcode(details.zipcode) || details.zipcode);

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: HEADERS, cache: 'no-store',
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

async function tryNominatimFreeform(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`,
      { headers: HEADERS, cache: 'no-store' },
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

export async function POST(request) {
  try {
    const body = await request.json();
    const details = {
      street: normalizeText(body.street),
      number: normalizeText(body.number),
      neighborhood: normalizeText(body.neighborhood),
      city: normalizeText(body.city),
      state: normalizeText(body.state).toUpperCase(),
      zipcode: String(body.zipcode || '').replace(/\D/g, ''),
    };

    // Strategy 1: BrasilAPI by CEP
    const brasilResult = await tryBrasilApi(details.zipcode);
    if (brasilResult) return NextResponse.json(brasilResult);

    // Strategy 2: Nominatim structured
    await delay(1100);
    const structuredResult = await tryNominatimStructured(details);
    if (structuredResult) return NextResponse.json(structuredResult);

    // Strategy 3: Nominatim freeform with full address
    await delay(1100);
    const fullQuery = [details.street, details.number, details.neighborhood, details.city, UF_MAP[details.state] || details.state, 'Brasil']
      .filter(Boolean).join(', ');
    const freeformResult = await tryNominatimFreeform(fullQuery);
    if (freeformResult) return NextResponse.json(freeformResult);

    // Strategy 4: Nominatim freeform with neighborhood + city
    await delay(1100);
    const neighborhoodQuery = [details.neighborhood, details.city, UF_MAP[details.state] || details.state, 'Brasil']
      .filter(Boolean).join(', ');
    const neighborhoodResult = await tryNominatimFreeform(neighborhoodQuery);
    if (neighborhoodResult) return NextResponse.json(neighborhoodResult);

    return NextResponse.json({ error: 'Não foi possível geocodificar o endereço' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Erro ao geocodificar' }, { status: 500 });
  }
}
