'use client';

/**
 * Mapa de calor de entregas.
 * Geocodifica bairros via Nominatim (OpenStreetMap, sem API key)
 * e renderiza os pontos usando leaflet.heat.
 *
 * Este componente deve ser carregado dinamicamente (next/dynamic, ssr:false)
 * pois usa APIs do browser (Leaflet).
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Cache de geocodificação no localStorage
const GEO_CACHE_KEY = 'fumego_geo_cache_v1';

function loadGeoCache(): Record<string, [number, number] | null> {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveGeoCache(cache: Record<string, [number, number] | null>) {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

async function geocodeNeighborhood(neighborhood: string, city: string): Promise<[number, number] | null> {
  const cache = loadGeoCache();
  const key   = `${neighborhood}||${city}`;
  if (key in cache) return cache[key];

  try {
    const q   = encodeURIComponent(`${neighborhood}, ${city}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!res.ok) throw new Error('nominatim error');
    const data = await res.json();
    if (!data.length) { cache[key] = null; saveGeoCache(cache); return null; }
    const lat  = parseFloat(data[0].lat);
    const lng  = parseFloat(data[0].lon);
    const coords: [number, number] = [lat, lng];
    cache[key] = coords;
    saveGeoCache(cache);
    return coords;
  } catch {
    return null;
  }
}

export interface AddressGroup {
  neighborhood: string;
  city: string;
  count: number;
}

interface Props {
  addressGroups: AddressGroup[];
  height?: number;
}

export default function DeliveryHeatMap({ addressGroups, height = 480 }: Props) {
  const mapRef     = useRef<L.Map | null>(null);
  const mapDivRef  = useRef<HTMLDivElement | null>(null);
  const heatLayRef = useRef<any>(null);

  useEffect(() => {
    if (!mapDivRef.current) return;

    // Inicializa o mapa se ainda não existe
    if (!mapRef.current) {
      mapRef.current = L.map(mapDivRef.current, { zoomControl: true }).setView([-15.78, -47.93], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(mapRef.current);
    }

    if (addressGroups.length === 0) return;

    // Limpa camada de calor anterior
    if (heatLayRef.current) {
      mapRef.current.removeLayer(heatLayRef.current);
      heatLayRef.current = null;
    }

    // Geocodifica bairros e constrói heatmap
    (async () => {
      const map    = mapRef.current!;
      const maxCnt = Math.max(...addressGroups.map(g => g.count), 1);
      const points: [number, number, number][] = [];
      const bounds: L.LatLngTuple[] = [];

      // Geocodifica em série com delay de 200 ms para respeitar Nominatim
      for (const group of addressGroups) {
        const coords = await geocodeNeighborhood(group.neighborhood, group.city);
        if (!coords) continue;
        const intensity = group.count / maxCnt;
        points.push([coords[0], coords[1], intensity]);
        bounds.push(coords);
        // Throttle requests
        await new Promise(r => setTimeout(r, 250));
      }

      if (points.length === 0) return;

      // Carrega leaflet.heat dinamicamente (requer browser)
      await import('leaflet.heat');
      const L2 = L as any;
      heatLayRef.current = L2.heatLayer(points, {
        radius: 35,
        blur: 25,
        maxZoom: 17,
        gradient: { 0.0: '#00ff00', 0.4: '#aaff00', 0.65: '#ffaa00', 0.9: '#ff5500', 1.0: '#ff0000' },
      }).addTo(map);

      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds as L.LatLngTuple[]), { padding: [40, 40] });
      }
    })();

    return () => {
      // Não destruir o mapa no cleanup — apenas as camadas
    };
  }, [addressGroups]);

  // Destroy map on component unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mapDivRef}
      style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden' }}
    />
  );
}
