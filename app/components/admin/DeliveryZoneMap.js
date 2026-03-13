'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Tooltip, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Colors por zona (menor → maior raio) ─────────────────────────────────────
const RING_COLORS = ['#15803D', '#22C55E', '#4ADE80', '#86EFAC', '#BBF7D0'];

// ── Ícone da loja: ponto vermelho simples ─────────────────────────────────────
function makeStoreIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 14px; height: 14px;
      background: #EF4444;
      border: 2.5px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 6px rgba(0,0,0,0.45);
    "></div>`,
    iconSize:   [14, 14],
    iconAnchor: [7, 7],
  });
}

// ── Zoom baseado no raio máximo ───────────────────────────────────────────────
function calcZoom(maxKm) {
  if (maxKm <= 0.5) return 15;
  if (maxKm <= 1)   return 14;
  if (maxKm <= 2)   return 13;
  if (maxKm <= 4)   return 12;
  if (maxKm <= 8)   return 11;
  if (maxKm <= 15)  return 10;
  return 9;
}

// ── Subcomponente: reposiciona o mapa quando coordenadas/zoom mudam ───────────
function MapController({ lat, lng, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.flyTo([lat, lng], zoom, { duration: 0.9 });
    }
  }, [lat, lng, zoom]); // eslint-disable-line
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DeliveryZoneMap({ rules, originCoords }) {
  const lat = parseFloat(originCoords?.lat);
  const lng = parseFloat(originCoords?.lng);
  const hasCoords = Number.isFinite(lat) && lat !== 0 && Number.isFinite(lng) && lng !== 0;

  // Centro: coordenadas da loja ou centro do Brasil
  const center = hasCoords ? [lat, lng] : [-15.7942, -47.8822];

  const activeRules = [...(rules || [])]
    .filter(r => parseFloat(r.radius_km) > 0)
    .sort((a, b) => parseFloat(a.radius_km) - parseFloat(b.radius_km));

  const maxKm  = activeRules.length > 0 ? Math.max(...activeRules.map(r => parseFloat(r.radius_km))) : 5;
  const zoom   = calcZoom(maxKm);
  const icon   = makeStoreIcon();

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      style={{ width: '100%', height: '100%', minHeight: 420, borderRadius: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Atualiza posição/zoom quando props mudam */}
      <MapController lat={hasCoords ? lat : -15.7942} lng={hasCoords ? lng : -47.8822} zoom={zoom} />

      {/* Círculos de zona — do maior para o menor (menor fica no topo) */}
      {hasCoords && [...activeRules].reverse().map((rule, revIdx) => {
        const idx      = activeRules.length - 1 - revIdx;
        const radiusM  = parseFloat(rule.radius_km) * 1000;
        const color    = RING_COLORS[idx % RING_COLORS.length];
        const inactive = rule.is_active === false;
        const fee      = parseFloat(rule.fee || 0).toFixed(2).replace('.', ',');

        return (
          <Circle
            key={`zone-${idx}`}
            center={[lat, lng]}
            radius={radiusM}
            pathOptions={{
              color:       inactive ? '#9CA3AF' : color,
              fillColor:   inactive ? '#D1D5DB' : color,
              fillOpacity: inactive ? 0.08 : 0.13,
              weight:      inactive ? 1.5 : 2,
              dashArray:   inactive ? '6 4' : undefined,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontSize: 12, lineHeight: 1.7, fontFamily: 'sans-serif' }}>
                <strong style={{ fontSize: 13 }}>📍 {rule.radius_km} km</strong>
                <br />
                Taxa: <strong>R$ {fee}</strong>
                <br />
                Tempo: ~<strong>{rule.estimated_mins} min</strong>
                {inactive && (
                  <span style={{ color: '#EF4444', fontWeight: 700, display: 'block', marginTop: 2 }}>
                    ⚠ Zona inativa
                  </span>
                )}
              </div>
            </Tooltip>
          </Circle>
        );
      })}

      {/* Marcador da loja */}
      {hasCoords && (
        <Marker position={[lat, lng]} icon={icon}>
          <Tooltip direction="top" offset={[0, -10]}>
            <span style={{ fontSize: 12 }}>📌 Sua loja</span>
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
