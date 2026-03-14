'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Uma cor por entregador ────────────────────────────────────────────────────
const DRIVER_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#BE185D'];

// ── Ícone circular com inicial do nome ───────────────────────────────────────
function makeDriverIcon(name: string, colorIdx: number, isRecent: boolean) {
  const initial = (name || '?').trim()[0].toUpperCase();
  const color   = DRIVER_COLORS[colorIdx % DRIVER_COLORS.length];

  // Anel pulsante quando localização é recente (< 5 min)
  const pulse = isRecent ? `
    <div style="
      position:absolute;top:-6px;left:-6px;
      width:46px;height:46px;border-radius:50%;
      background:${color};opacity:0.25;
      animation:drv-pulse 2s ease-in-out infinite;
    "></div>` : '';

  return L.divIcon({
    className: '',
    html: `
      <style>
        @keyframes drv-pulse {
          0%,100% { transform:scale(1);   opacity:0.25; }
          50%      { transform:scale(1.6); opacity:0.08; }
        }
      </style>
      <div style="position:relative;width:34px;height:34px;">
        ${pulse}
        <div style="
          position:absolute;top:0;left:0;
          width:34px;height:34px;
          background:${color};
          border:3px solid #fff;
          border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 10px rgba(0,0,0,0.45);
          font-size:15px;font-weight:800;color:#fff;
          font-family:sans-serif;letter-spacing:0;
        ">${initial}</div>
      </div>`,
    iconSize:   [34, 34],
    iconAnchor: [17, 17],
    tooltipAnchor: [17, -17],
  });
}

// ── Ajusta o viewport para englobar todos os entregadores ────────────────────
function MapFitter({ locations }: { locations: any[] }) {
  const map = useMap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (locations.length === 0) return;
    if (locations.length === 1) {
      map.flyTo(
        [parseFloat(locations[0].driver_location_lat), parseFloat(locations[0].driver_location_lng)],
        15,
        { duration: 0.8 }
      );
      return;
    }
    const bounds = L.latLngBounds(
      locations.map((l: any) => [parseFloat(l.driver_location_lat), parseFloat(l.driver_location_lng)])
    );
    map.flyToBounds(bounds.pad(0.35), { duration: 0.8, maxZoom: 16 });
  }, [locations.map((l: any) => `${l.driver_location_lat},${l.driver_location_lng}`).join('|')]); // eslint-disable-line
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DriverTrackingMap({ locations }: { locations: any[] }) {
  const valid = (locations || []).filter(
    (l: any) => Number.isFinite(parseFloat(l.driver_location_lat))
      && Number.isFinite(parseFloat(l.driver_location_lng))
  );

  const center: LatLngExpression = valid.length > 0
    ? [parseFloat(valid[0].driver_location_lat), parseFloat(valid[0].driver_location_lng)]
    : [-15.7942, -47.8822]; // Brasil como fallback

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom
      style={{ width: '100%', height: '100%', minHeight: 480 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapFitter locations={valid} />

      {valid.map((loc: any, idx: number) => {
        const lat    = parseFloat(loc.driver_location_lat);
        const lng    = parseFloat(loc.driver_location_lng);
        const name   = loc.delivery_persons?.name || 'Entregador';
        const age    = loc.driver_location_at
          ? Math.floor((Date.now() - new Date(loc.driver_location_at).getTime()) / 60000)
          : null;
        const isRecent = age !== null && age < 5;

        const statusEmoji = age === null ? '⚪'
          : age < 1  ? '🟢'
          : age < 5  ? '🟢'
          : age < 15 ? '🟡'
          : '🔴';
        const ageLabel = age === null ? '—'
          : age < 1 ? 'agora'
          : `há ${age} min`;

        return (
          <Marker
            key={loc.delivery_person_id}
            position={[lat, lng]}
            icon={makeDriverIcon(name, idx, isRecent)}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <div style={{ fontSize: 12, lineHeight: 1.8, fontFamily: 'sans-serif', minWidth: 140 }}>
                <strong style={{ fontSize: 13 }}>{name}</strong>
                <br />
                <span style={{ color: '#6B7280', fontSize: 11 }}>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                <br />
                {statusEmoji} <span style={{ fontWeight: 600 }}>{ageLabel}</span>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
