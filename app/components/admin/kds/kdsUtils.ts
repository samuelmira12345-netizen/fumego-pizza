// KDS constants and pure helper utilities
// Extracted from KDSBoard.tsx — no React, no side-effects

import {
  Bell, Calendar, ChefHat, Truck, CheckCircle, XCircle,
  PackageCheck, Zap, CreditCard, Banknote,
} from 'lucide-react';

// ── Status config ──────────────────────────────────────────────────────────────

export const S = {
  pending: {
    label: 'NOVOS',        color: '#B45309', bg: '#FEFCE8', border: '#FEF08A',
    headerBg: '#D97706',   text: '#fff',     icon: Bell,
  },
  scheduled: {
    label: 'AGENDADOS',    color: '#0F766E', bg: '#F0FDFA', border: '#99F6E4',
    headerBg: '#0D9488',   text: '#fff',     icon: Calendar,
  },
  confirmed: {
    label: 'EM PREPARO',   color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE',
    headerBg: '#2563EB',   text: '#fff',     icon: ChefHat,
  },
  preparing: {
    label: 'EM PREPARO',   color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE',
    headerBg: '#2563EB',   text: '#fff',     icon: ChefHat,
  },
  ready: {
    label: 'PRONTO',       color: '#B45309', bg: '#FFFBEB', border: '#FDE68A',
    headerBg: '#F59E0B',   text: '#fff',     icon: PackageCheck,
  },
  delivering: {
    label: 'EM ENTREGA',   color: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE',
    headerBg: '#7C3AED',   text: '#fff',     icon: Truck,
  },
  delivered: {
    label: 'FINALIZADOS',  color: '#047857', bg: '#ECFDF5', border: '#A7F3D0',
    headerBg: '#059669',   text: '#fff',     icon: CheckCircle,
  },
  cancelled: {
    label: 'CANCELADOS',   color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB',
    headerBg: '#9CA3AF',   text: '#fff',     icon: XCircle,
  },
} as const;

export const COLUMNS = [
  { id: 'novos',       statuses: ['pending'],                cfg: S.pending },
  { id: 'agendados',   statuses: ['scheduled'],              cfg: S.scheduled },
  { id: 'preparo',     statuses: ['confirmed', 'preparing'], cfg: S.confirmed },
  { id: 'prontos',     statuses: ['ready'],                  cfg: S.ready },
  { id: 'entrega',     statuses: ['delivering'],              cfg: S.delivering },
  { id: 'finalizados', statuses: ['delivered'],               cfg: S.delivered },
];

export const PM = {
  pix:          { label: 'PIX',              icon: Zap,        color: '#1D4ED8' },
  card:         { label: 'Cartão online',    icon: CreditCard, color: '#7C3AED' },
  card_credit:  { label: 'Cartão (crédito)', icon: CreditCard, color: '#7C3AED' },
  card_debit:   { label: 'Cartão (débito)',  icon: CreditCard, color: '#7C3AED' },
  debit:        { label: 'Débito',           icon: CreditCard, color: '#7C3AED' },
  cash:         { label: 'Dinheiro',         icon: Banknote,   color: '#059669' },
  card_delivery:{ label: 'Cartão',           icon: CreditCard, color: '#7C3AED' },
  voucher:      { label: 'Vale refeição',    icon: CreditCard, color: '#D97706' },
} as const;

// ── Formatters ─────────────────────────────────────────────────────────────────

export function fmtBRL(v: any) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtPhone(p: any) {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p;
}

export function fmtTime(isoStr: any) {
  return new Date(isoStr).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  });
}

export function fmtDateFull(isoStr: any) {
  return new Date(isoStr).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function fmtElapsed(mins: any) {
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? (mins % 60) + 'm' : ''}`;
}

// ── Name / address helpers ─────────────────────────────────────────────────────

export function getNameInitials(name: any) {
  if (!name || typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export function buildAddress(order: any) {
  return [
    `${order?.delivery_street || ''} ${order?.delivery_number || ''}`.trim(),
    order?.delivery_neighborhood || '',
    order?.delivery_city || '',
    order?.delivery_zipcode || '',
  ].filter(Boolean).join(', ');
}

export function getMapsLinks(order: any) {
  const address = buildAddress(order);
  if (!address) return { address: '', googleMaps: '', waze: '' };
  const encoded = encodeURIComponent(address);
  return {
    address,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    waze: `https://waze.com/ul?q=${encoded}&navigate=yes`,
  };
}

// ── Timer helpers ──────────────────────────────────────────────────────────────

export function elapsedMins(isoStr: any) {
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
}

export function timerColor(mins: any) {
  if (mins < 20) return '#059669';
  if (mins < 35) return '#D97706';
  return '#DC2626';
}

export function diffMins(fromIso: any, toIso: any) {
  if (!fromIso || !toIso) return null;
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000);
}

// ── Date helpers (São Paulo timezone) ─────────────────────────────────────────

export function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function daysAgoSP(n: any) {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

export function weekStartSP() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('en-CA');
}

export function orderDateSP(isoStr: any) {
  return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// ── Sound (browser-only, call only from client components) ────────────────────

export function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [[880, 0, 0.25], [1100, 0.20, 0.25], [1320, 0.40, 0.25], [1100, 0.60, 0.20], [1320, 0.80, 0.35]].forEach(([freq, t, dur]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t);
      gain.gain.setValueAtTime(0.65, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + dur + 0.01);
    });
  } catch {}
}

export function playReadyChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [[1047, 0, 0.45], [1319, 0.22, 0.45], [1568, 0.44, 0.65], [1319, 0.68, 0.35]].forEach(([freq, t, dur]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t);
      gain.gain.setValueAtTime(0.55, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + dur + 0.01);
    });
  } catch {}
}
