'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone, MapPin, Clock, ChefHat, Truck, CheckCircle, XCircle,
  Printer, RefreshCw, Volume2, VolumeX, X, Bell, Calendar,
  CreditCard, Zap, Banknote, AlertTriangle, User, List,
  EyeOff, Eye, ChevronDown, Plus, ShoppingBag, Star,
  ArrowRight, PackageCheck, Timer, LayoutList,
} from 'lucide-react';
import ManualOrderDrawer from './ManualOrderDrawer';
import OrdersTab from './OrdersTab';

// ── Status config ──────────────────────────────────────────────────────────────

const S = {
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
};

const COLUMNS = [
  { id: 'novos',       statuses: ['pending'],               cfg: S.pending },
  { id: 'agendados',   statuses: ['scheduled'],             cfg: S.scheduled },
  { id: 'preparo',     statuses: ['confirmed', 'preparing'], cfg: S.confirmed },
  { id: 'entrega',     statuses: ['delivering'],             cfg: S.delivering },
  { id: 'finalizados', statuses: ['delivered'],              cfg: S.delivered },
];

const PM = {
  pix:          { label: 'PIX',      icon: Zap,        color: '#1D4ED8' },
  cash:         { label: 'Dinheiro', icon: Banknote,   color: '#059669' },
  card_delivery:{ label: 'Cartão',   icon: CreditCard, color: '#7C3AED' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPhone(p) {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p;
}

function elapsedMins(isoStr) {
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
}

function fmtElapsed(mins) {
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? (mins % 60) + 'm' : ''}`;
}

function timerColor(mins) {
  if (mins < 20) return '#059669';
  if (mins < 35) return '#D97706';
  return '#DC2626';
}

function fmtTime(isoStr) {
  return new Date(isoStr).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateFull(isoStr) {
  return new Date(isoStr).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function daysAgoSP(n) {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

function weekStartSP() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('en-CA');
}

function orderDateSP(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function diffMins(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  return Math.round((new Date(toIso) - new Date(fromIso)) / 60000);
}

// Beep estridente via Web Audio API
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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

function useSecondTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);
  return tick;
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({ order, onClick, onQuickAction, isNew, onDragStart, customerOrderCount }) {
  const cfg  = S[order.status] || S.pending;
  const mins = elapsedMins(order.created_at);
  const pm   = PM[order.payment_method];

  const totalOrders = customerOrderCount?.[order.customer_phone || order.customer_name] ?? 1;
  const isNewCustomer = totalOrders === 1;

  const quickAction = {
    scheduled:  { label: '→ Preparo',    next: 'confirmed',  bg: S.confirmed.headerBg },
    confirmed:  { label: '→ Entrega',    next: 'delivering', bg: S.delivering.headerBg },
    preparing:  { label: '→ Entrega',    next: 'delivering', bg: S.delivering.headerBg },
    delivering: { label: '✓ Finalizar',  next: 'delivered',  bg: S.delivered.headerBg },
  }[order.status];

  return (
    <div
      draggable
      onDragStart={e => { onDragStart(order); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 4,
        border: `1px solid ${isNew ? cfg.color : '#D1D5DB'}`,
        borderLeft: `4px solid ${cfg.color}`,
        padding: '11px 12px 10px',
        cursor: 'grab',
        boxShadow: isNew
          ? `0 0 0 2px ${cfg.color}30, 0 2px 6px rgba(0,0,0,0.07)`
          : '0 1px 2px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.12s, transform 0.1s, opacity 0.1s',
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.12)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = isNew ? `0 0 0 2px ${cfg.color}30` : '0 1px 2px rgba(0,0,0,0.05)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {isNew && (
        <div style={{
          position: 'absolute', top: 9, right: 9,
          width: 8, height: 8, borderRadius: '50%', background: '#EF4444',
          boxShadow: '0 0 0 3px #FEE2E2',
          animation: 'kdsPulse 1.2s ease-in-out infinite',
        }} />
      )}

      {/* Número + timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 19, fontWeight: 900, color: '#111827', fontFamily: 'monospace', letterSpacing: -0.5 }}>
          #{order.order_number || String(order.id).slice(-4).toUpperCase()}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
          background: timerColor(mins) + '15',
          color: timerColor(mins),
          border: `1px solid ${timerColor(mins)}35`,
        }}>
          ⏱ {fmtElapsed(mins)}
        </span>
      </div>

      {/* Cliente + contagem de pedidos */}
      <div style={{ marginBottom: 2 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {order.customer_name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          {isNewCustomer ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 3, padding: '1px 6px' }}>
              🔵 Cliente Novo
            </span>
          ) : (
            <span style={{ fontSize: 10, color: '#6B7280' }}>
              🛍 {totalOrders} pedido{totalOrders !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Bairro */}
      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        📍 {order.delivery_neighborhood || '—'}
      </p>

      {/* Obs */}
      {order.observations && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 3, padding: '4px 7px', marginBottom: 7 }}>
          <p style={{ fontSize: 11, color: '#92400E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ⚠️ {order.observations}
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {pm && <pm.icon size={12} color={pm.color} />}
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{fmtBRL(order.total)}</span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>· {fmtTime(order.created_at)}</span>
        </div>
        {quickAction && (
          <button
            onClick={e => { e.stopPropagation(); onQuickAction(order.id, 'status', quickAction.next); }}
            style={{
              padding: '4px 10px', borderRadius: 3, border: 'none',
              background: quickAction.bg, color: '#fff',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {quickAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Coluna Kanban ─────────────────────────────────────────────────────────────

const DROP_TARGET_STATUS = {
  novos:       'pending',
  agendados:   'scheduled',
  preparo:     'confirmed',
  entrega:     'delivering',
  finalizados: 'delivered',
};

function KDSColumn({ col, orders, onCardClick, onQuickAction, newIds, onDragStart, onDrop, customerOrderCount }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const cards = orders
    .filter(o => col.statuses.includes(o.status))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const Icon = col.cfg.icon;
  const isFinalized = col.id === 'finalizados';
  const visible = isFinalized ? cards.slice(-8) : cards;

  return (
    <div
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => { e.preventDefault(); setIsDragOver(false); onDrop(DROP_TARGET_STATUS[col.id]); }}
      style={{
        display: 'flex', flexDirection: 'column',
        flex: '1 1 260px', minWidth: 220,
        background: isDragOver ? col.cfg.bg : '#F8FAFC',
        borderRadius: 6,
        border: `${isDragOver ? 2 : 1}px solid ${isDragOver ? col.cfg.headerBg : col.cfg.border}`,
        maxHeight: '100%',
        overflow: 'hidden',
        transition: 'border 0.12s, background 0.12s',
      }}
    >
      <div style={{
        background: col.cfg.headerBg,
        padding: '10px 13px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, borderRadius: isDragOver ? '4px 4px 0 0' : '5px 5px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon size={14} color="#fff" />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 0.8 }}>{col.cfg.label}</span>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.22)', color: '#fff',
          fontSize: 13, fontWeight: 900, minWidth: 24, height: 24, borderRadius: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
        }}>
          {cards.length}
        </div>
      </div>

      {isDragOver && (
        <div style={{ padding: '8px 9px 0' }}>
          <div style={{ border: `2px dashed ${col.cfg.headerBg}`, borderRadius: 4, padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: col.cfg.headerBg }}>
            Soltar aqui → {col.cfg.label}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '9px 9px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {visible.length === 0 && !isDragOver ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: col.cfg.color + '70', fontSize: 13 }}>
            <Icon size={26} style={{ margin: '0 auto 9px', display: 'block', opacity: 0.35 }} />
            Nenhum pedido
          </div>
        ) : (
          <>
            {isFinalized && cards.length > 8 && (
              <p style={{ textAlign: 'center', fontSize: 11, color: col.cfg.color, fontWeight: 600, padding: '3px 0' }}>
                +{cards.length - 8} pedidos anteriores
              </p>
            )}
            {visible.map(o => (
              <OrderCard
                key={o.id}
                order={o}
                onClick={() => onCardClick(o)}
                onQuickAction={onQuickAction}
                isNew={newIds.has(o.id)}
                onDragStart={onDragStart}
                customerOrderCount={customerOrderCount}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Timeline do pedido ────────────────────────────────────────────────────────

function OrderTimeline({ order }) {
  const steps = [
    { label: 'Pedido recebido',       time: order.created_at,    icon: Bell,         color: '#D97706' },
    { label: 'Entrou em preparo',      time: order.confirmed_at,  icon: ChefHat,      color: '#2563EB' },
    { label: 'Saiu para entrega',      time: order.delivering_at, icon: Truck,        color: '#7C3AED' },
    { label: 'Pedido entregue',        time: order.delivered_at,  icon: CheckCircle,  color: '#059669' },
  ];

  const durations = [
    { label: 'Produção',  from: order.created_at,   to: order.delivering_at },
    { label: 'Entrega',   from: order.delivering_at, to: order.delivered_at  },
    { label: 'Total',     from: order.created_at,   to: order.delivered_at  },
  ].filter(d => d.from && d.to);

  return (
    <div>
      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step, i) => {
          const Icon = step.icon;
          const done = !!step.time;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, opacity: done ? 1 : 0.35 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: done ? step.color + '15' : '#F3F4F6', border: `2px solid ${done ? step.color : '#E5E7EB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={12} color={done ? step.color : '#9CA3AF'} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: done ? 600 : 400, color: done ? '#111827' : '#9CA3AF' }}>{step.label}</span>
              </div>
              <span style={{ fontSize: 11, color: done ? '#6B7280' : '#D1D5DB', fontFamily: 'monospace' }}>
                {done ? fmtTime(step.time) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Durações */}
      {durations.length > 0 && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: '#F9FAFB', borderRadius: 5, border: '1px solid #E5E7EB', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {durations.map(d => {
            const mins = diffMins(d.from, d.to);
            return (
              <div key={d.label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                  {mins !== null ? (mins < 60 ? `${mins}min` : `${Math.floor(mins/60)}h${mins%60}m`) : '—'}
                </p>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{d.label}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Mini CRM do cliente ───────────────────────────────────────────────────────

function CustomerProfilePanel({ phone, name, adminToken, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) { setLoading(false); return; }
    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'get_customer_profile', data: { phone } }),
    })
      .then(r => r.json())
      .then(d => setProfile(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [phone, adminToken]);

  const orders     = profile?.orders || [];
  const active     = orders.filter(o => o.status !== 'cancelled');
  const cancelled  = orders.filter(o => o.status === 'cancelled');
  const totalSpent = active.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
  const avgTicket  = active.length > 0 ? totalSpent / active.length : 0;
  const firstOrder = orders.length > 0 ? orders[orders.length - 1] : null;
  const lastOrder  = orders.length > 0 ? orders[0] : null;
  const cancelRate = orders.length > 0 ? (cancelled.length / orders.length * 100).toFixed(0) : 0;

  // Average days between orders
  let avgDays = null;
  if (active.length >= 2) {
    const sorted = [...active].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    let totalDiff = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalDiff += (new Date(sorted[i].created_at) - new Date(sorted[i-1].created_at)) / 86400000;
    }
    avgDays = Math.round(totalDiff / (sorted.length - 1));
  }

  // Top neighborhood
  const nbhMap = {};
  active.forEach(o => { if (o.delivery_neighborhood) nbhMap[o.delivery_neighborhood] = (nbhMap[o.delivery_neighborhood] || 0) + 1; });
  const topNbh = Object.entries(nbhMap).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Payment method breakdown
  const pmMap = {};
  active.forEach(o => { if (o.payment_method) pmMap[o.payment_method] = (pmMap[o.payment_method] || 0) + 1; });
  const pmLabels = { pix: 'PIX', card: 'Cartão', card_delivery: 'Cartão/Entrega', cash: 'Dinheiro', debit: 'Débito', voucher: 'Vale' };

  const statusCfg = {
    delivered: { label: 'Entregue', color: '#10B981', bg: '#ECFDF5' },
    cancelled:  { label: 'Cancelado', color: '#EF4444', bg: '#FEF2F2' },
    pending:    { label: 'Pendente', color: '#F59E0B', bg: '#FFFBEB' },
    confirmed:  { label: 'Confirmado', color: '#60A5FA', bg: '#EFF6FF' },
    preparing:  { label: 'Preparando', color: '#F97316', bg: '#FFF7ED' },
    delivering: { label: 'Entregando', color: '#A78BFA', bg: '#F5F3FF' },
    scheduled:  { label: 'Agendado', color: '#B794F4', bg: '#F5F3FF' },
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', borderRadius: 8, overflowY: 'auto', zIndex: 10, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={18} color="#2563EB" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{name}</p>
            <p style={{ fontSize: 11, color: '#6B7280' }}>{fmtPhone(phone)}</p>
          </div>
        </div>
        <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 4, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={14} color="#6B7280" />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>Carregando perfil...</div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Pedidos ativos', value: active.length, color: '#6366F1' },
              { label: 'Total gasto', value: `R$${totalSpent.toFixed(0)}`, color: '#10B981' },
              { label: 'Ticket médio', value: `R$${avgTicket.toFixed(0)}`, color: '#F2A800' },
            ].map(s => (
              <div key={s.label} style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 6px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</p>
                <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 1 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Extended stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Cancelamentos', value: `${cancelled.length} (${cancelRate}%)`, color: cancelled.length > 0 ? '#EF4444' : '#9CA3AF' },
              avgDays !== null && { label: 'Freq. média', value: `${avgDays}d`, color: '#6B7280' },
              topNbh && { label: 'Bairro fav.', value: topNbh, color: '#6B7280' },
            ].filter(Boolean).map(s => (
              <div key={s.label} style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 6px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: s.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</p>
                <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 1 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Dates row */}
          {firstOrder && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              <div style={{ background: '#F9FAFB', borderRadius: 5, padding: '7px 9px', border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>PRIMEIRO PEDIDO</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
                  {new Date(firstOrder.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                </p>
              </div>
              <div style={{ background: '#F9FAFB', borderRadius: 5, padding: '7px 9px', border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>ÚLTIMO PEDIDO</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
                  {new Date(lastOrder.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                </p>
              </div>
            </div>
          )}

          {/* Pgto favorito */}
          {Object.keys(pmMap).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>FORMA DE PAGAMENTO</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Object.entries(pmMap).sort((a, b) => b[1] - a[1]).map(([pm, cnt]) => (
                  <span key={pm} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#F3F4F6', color: '#374151' }}>
                    {pmLabels[pm] || pm} {cnt}×
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Produtos favoritos */}
          {profile?.topItems?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>MAIS PEDIDO</p>
              {profile.topItems.slice(0, 4).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: 11, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: i === 0 ? '#F2A800' : '#9CA3AF' }}>#{i+1}</span>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#F2A800' }}>{item.qty}×</span>
                </div>
              ))}
            </div>
          )}

          {/* Histórico completo */}
          <p style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>HISTÓRICO COMPLETO ({orders.length} pedidos)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
            {orders.map(o => {
              const sc = statusCfg[o.status] || statusCfg.pending;
              return (
                <div key={o.id} style={{ padding: '6px 8px', background: '#F9FAFB', borderRadius: 5, border: '1px solid #E5E7EB' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>#{o.order_number || String(o.id).slice(-4).toUpperCase()}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: o.status === 'cancelled' ? '#EF4444' : '#111827' }}>
                      {o.status === 'cancelled' ? '—' : `R$${Number(o.total).toFixed(2).replace('.', ',')}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {new Date(o.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      {o.delivery_neighborhood ? ` · ${o.delivery_neighborhood}` : ''}
                    </span>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {pmLabels[o.payment_method] || o.payment_method || '—'}
                      {o.payment_status === 'approved' ? ' ✓' : ''}
                    </span>
                  </div>
                  {o.payment_status === 'approved' && (
                    <div style={{ marginTop: 2 }}>
                      <span style={{ fontSize: 9, color: '#6B7280', fontStyle: 'italic' }}>
                        {o.fiscal_note ? '📋 NF emitida' : ''}
                        {o.payment_notes ? ` · ${o.payment_notes}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Diálogo de tipo de impressão ──────────────────────────────────────────────

function PrintTypeDialog({ onSelect, onClose }) {
  const types = [
    { key: 'cozinha', label: '👨‍🍳 Via Cozinha',    desc: 'Itens + endereço, fonte grande' },
    { key: 'balcao',  label: '🧾 Via Balcão',      desc: 'Pedido completo com pagamento' },
    { key: 'fiscal',  label: '📋 Cupom Fiscal',    desc: 'Inclui CPF e dados fiscais' },
  ];
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 10, padding: '22px 24px', width: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Tipo de impressão</p>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} color="#6B7280" />
          </button>
        </div>
        {types.map(t => (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            style={{
              width: '100%', textAlign: 'left', padding: '11px 13px', marginBottom: 6,
              borderRadius: 7, border: '1px solid #E5E7EB', background: '#F9FAFB',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
            onMouseLeave={e => e.currentTarget.style.background = '#F9FAFB'}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{t.label}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Modal de Detalhes ─────────────────────────────────────────────────────────

// ── Payment methods available in admin ────────────────────────────────────────
const PAYMENT_METHODS = [
  { key: 'pix',          label: 'PIX',            color: '#0066CC', icon: '🔵' },
  { key: 'card',         label: 'Crédito',         color: '#9333EA', icon: '💳' },
  { key: 'debit',        label: 'Débito',          color: '#7C3AED', icon: '💳' },
  { key: 'card_delivery',label: 'Cartão/Entrega',  color: '#0E7490', icon: '🚚' },
  { key: 'cash',         label: 'Dinheiro',        color: '#059669', icon: '💵' },
  { key: 'voucher',      label: 'Vale Refeição',   color: '#D97706', icon: '🍽️' },
];

function PaymentPanel({ order, onSave }) {
  const [payMethod, setPayMethod]     = useState(order.payment_method || 'pix');
  const [payStatus, setPayStatus]     = useState(order.payment_status === 'approved' ? 'paid' : 'pending');
  const [fiscalNote, setFiscalNote]   = useState(order.fiscal_note || false);
  const [cashReceived, setCashReceived] = useState(String(order.cash_received || ''));
  const [payNotes, setPayNotes]       = useState(order.payment_notes || '');
  const [saving, setSaving]           = useState(false);

  const total = parseFloat(order.total) || 0;
  const cashNum = parseFloat(cashReceived) || 0;
  const change = cashNum > 0 ? Math.max(0, cashNum - total) : null;

  async function handleSave() {
    setSaving(true);
    await onSave({
      payment_method:  payMethod,
      payment_status:  payStatus === 'paid' ? 'approved' : 'pending',
      fiscal_note:     fiscalNote,
      cash_received:   cashNum > 0 ? cashNum : null,
      payment_notes:   payNotes.trim() || null,
    });
    setSaving(false);
  }

  return (
    <div style={{ background: '#F0FDF4', border: '2px solid #BBF7D0', borderRadius: 8, padding: '14px 14px 10px' }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: '#065F46', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
        💳 Registrar Pagamento
      </p>

      {/* Método */}
      <p style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginBottom: 5 }}>FORMA DE PAGAMENTO</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {PAYMENT_METHODS.map(m => (
          <button
            key={m.key}
            onClick={() => setPayMethod(m.key)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: payMethod === m.key ? `2px solid ${m.color}` : '2px solid #E5E7EB',
              background: payMethod === m.key ? m.color + '18' : '#fff',
              color: payMethod === m.key ? m.color : '#6B7280',
            }}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Dinheiro: valor recebido + troco */}
      {payMethod === 'cash' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>VALOR RECEBIDO (R$)</p>
            <input
              type="number" min="0" step="0.01" value={cashReceived}
              onChange={e => setCashReceived(e.target.value)}
              placeholder={`Min. ${total.toFixed(2).replace('.', ',')}`}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #D1FAE5', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {change !== null && change > 0 && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: '#065F46', fontWeight: 700 }}>TROCO</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#065F46' }}>R${change.toFixed(2).replace('.', ',')}</p>
            </div>
          )}
        </div>
      )}

      {/* Status + Nota Fiscal */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>STATUS DO PAGAMENTO</p>
          <div style={{ display: 'flex', gap: 5 }}>
            {[{ key: 'paid', label: '✓ Pago', color: '#059669' }, { key: 'pending', label: '⏳ Pendente', color: '#D97706' }].map(s => (
              <button key={s.key} onClick={() => setPayStatus(s.key)} style={{
                flex: 1, padding: '6px 4px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: payStatus === s.key ? `2px solid ${s.color}` : '2px solid #E5E7EB',
                background: payStatus === s.key ? s.color + '12' : '#fff',
                color: payStatus === s.key ? s.color : '#9CA3AF',
              }}>{s.label}</button>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>NOTA FISCAL</p>
          <button
            onClick={() => setFiscalNote(v => !v)}
            style={{
              padding: '6px 12px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              border: fiscalNote ? '2px solid #6366F1' : '2px solid #E5E7EB',
              background: fiscalNote ? '#EEF2FF' : '#fff',
              color: fiscalNote ? '#6366F1' : '#9CA3AF',
            }}
          >
            📋 {fiscalNote ? 'Emitir NF' : 'Sem NF'}
          </button>
        </div>
      </div>

      {/* Observações */}
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>OBSERVAÇÕES</p>
        <input
          type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)}
          placeholder="Ex: parcelado em 2×, pago via app..."
          style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #D1FAE5', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <button
        onClick={handleSave} disabled={saving}
        style={{ width: '100%', padding: '9px', borderRadius: 6, border: 'none', background: saving ? '#9CA3AF' : '#059669', color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}
      >
        {saving ? 'Salvando...' : '✓ Salvar Pagamento'}
      </button>
    </div>
  );
}

function OrderModal({ order, items, itemsLoading, onClose, onAction, onPaymentUpdate, onPrint, adminToken, customerOrderCount }) {
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [showPrintDialog, setShowPrintDialog]         = useState(false);
  const [editPayment, setEditPayment]                 = useState(false);

  if (!order) return null;
  const cfg  = S[order.status] || S.pending;
  const mins = elapsedMins(order.created_at);
  const pm   = PM[order.payment_method] || { label: order.payment_method, icon: CreditCard, color: '#6B7280' };
  const PMIcon = pm.icon;

  const totalOrders  = customerOrderCount?.[order.customer_phone || order.customer_name] ?? 1;
  const isNewCustomer = totalOrders === 1;

  const actionButtons = [
    order.status === 'scheduled'  && { label: '✓ Aceitar Agendado',     next: 'confirmed',  bg: S.confirmed.headerBg,  primary: true },
    (order.status === 'confirmed' || order.status === 'preparing')
                                  && { label: '🚚 Enviar para Entrega', next: 'delivering', bg: S.delivering.headerBg, primary: true },
    order.status === 'delivering' && { label: '✓ Finalizar Pedido',     next: 'delivered',  bg: S.delivered.headerBg,  primary: true },
    !['delivered','cancelled'].includes(order.status)
                                  && { label: '✕ Cancelar',            next: 'cancelled',  bg: '#EF4444',             primary: false },
  ].filter(Boolean);

  const sub   = parseFloat(order.subtotal)     || 0;
  const disc  = parseFloat(order.discount)     || 0;
  const fee   = parseFloat(order.delivery_fee) || 0;
  const total = parseFloat(order.total)        || 0;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 16 }}
        onClick={onClose}
      >
        <div
          style={{ background: '#fff', borderRadius: 8, width: 480, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', borderTop: `4px solid ${cfg.headerBg}`, position: 'relative' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Painel de perfil do cliente (sobrepõe) */}
          {showCustomerProfile && (
            <CustomerProfilePanel
              phone={order.customer_phone}
              name={order.customer_name}
              adminToken={adminToken}
              onClose={() => setShowCustomerProfile(false)}
            />
          )}

          {/* Header */}
          <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#111827', fontFamily: 'monospace' }}>
                  #{order.order_number || String(order.id).slice(-4).toUpperCase()}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 3, background: cfg.color + '16', color: cfg.color, border: `1px solid ${cfg.color}35`, letterSpacing: 0.4 }}>
                  {cfg.label}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6B7280' }}>
                <span>🕐 {fmtDateFull(order.created_at)}</span>
                <span style={{ color: timerColor(mins), fontWeight: 700 }}>⏱ {fmtElapsed(mins)}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 4, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={15} color="#6B7280" />
            </button>
          </div>

          <div style={{ padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Cliente — clicável para abrir mini CRM */}
            <Section label="Cliente" icon={<User size={12} />}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <button
                    onClick={() => setShowCustomerProfile(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                    title="Ver perfil do cliente"
                  >
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#2563EB', marginBottom: 4, textDecoration: 'underline dotted' }}>
                      {order.customer_name}
                    </p>
                  </button>
                  {isNewCustomer ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 4, padding: '2px 8px', display: 'inline-block', marginBottom: 5 }}>
                      🔵 Primeiro pedido
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#6B7280', display: 'inline-block', marginBottom: 5 }}>
                      🛍 {totalOrders} pedidos realizados
                    </span>
                  )}
                </div>
              </div>
              {order.customer_phone && (
                <a href={`tel:${order.customer_phone}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#2563EB', textDecoration: 'none', fontWeight: 600, background: '#EFF6FF', padding: '4px 10px', borderRadius: 4, border: '1px solid #BFDBFE' }}
                  onClick={e => e.stopPropagation()}>
                  <Phone size={12} /> {fmtPhone(order.customer_phone)}
                </a>
              )}
            </Section>

            {/* Endereço */}
            <Section label="Endereço" icon={<MapPin size={12} />}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                {order.delivery_street}, {order.delivery_number}
                {order.delivery_complement ? ` — ${order.delivery_complement}` : ''}
              </p>
              <p style={{ fontSize: 12, color: '#6B7280' }}>
                {order.delivery_neighborhood}{order.delivery_city ? `, ${order.delivery_city}` : ''}
                {order.delivery_zipcode ? ` · ${order.delivery_zipcode}` : ''}
              </p>
            </Section>

            {/* Timeline */}
            <Section label="Timeline do pedido" icon={<Timer size={12} />}>
              <OrderTimeline order={order} />
            </Section>

            {/* Itens */}
            <Section label="Itens do Pedido" icon={<List size={12} />}>
              {itemsLoading ? (
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  <div style={{ width: 13, height: 13, border: '2px solid #E5E7EB', borderTopColor: '#6B7280', borderRadius: '50%', animation: 'kdsSpin 0.8s linear infinite' }} />
                  Carregando...
                </div>
              ) : items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((item, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                          {item.quantity}× {item.product_name}
                          <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400, marginLeft: 5 }}>({fmtBRL(item.unit_price)} un.)</span>
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', marginLeft: 8 }}>
                          {fmtBRL(item.total_price)}
                        </span>
                      </div>
                      {item.observations && (
                        <p style={{ fontSize: 11, color: '#B45309', background: '#FFFBEB', padding: '2px 7px', borderRadius: 3, marginTop: 2, border: '1px solid #FDE68A' }}>
                          ⚠️ {item.observations}
                        </p>
                      )}
                    </div>
                  ))}
                  <div style={{ marginTop: 5, paddingTop: 8, borderTop: '1px dashed #E5E7EB', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Row label="Subtotal" value={fmtBRL(sub)} />
                    {disc > 0 && <Row label="Desconto" value={`-${fmtBRL(disc)}`} valueColor="#EF4444" />}
                    {fee > 0  && <Row label="Taxa de entrega" value={fmtBRL(fee)} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 5, borderTop: '1px solid #E5E7EB', marginTop: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>Total</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{fmtBRL(total)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#9CA3AF' }}>Nenhum item encontrado</p>
              )}
            </Section>

            {/* Obs */}
            {order.observations && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 5, padding: '10px 12px' }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#92400E', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                  ⚠️ Observações
                </p>
                <p style={{ fontSize: 13, color: '#78350F' }}>{order.observations}</p>
              </div>
            )}

            {/* Pagamento */}
            {editPayment ? (
              <div>
                <PaymentPanel
                  order={order}
                  onSave={async updates => {
                    await onPaymentUpdate(updates);
                    setEditPayment(false);
                  }}
                />
                <button onClick={() => setEditPayment(false)} style={{ marginTop: 6, fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <Section label="Pagamento" icon={<PMIcon size={12} />}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <PMIcon size={16} color={pm.color} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{pm.label}</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 3,
                    background: order.payment_status === 'approved' ? '#ECFDF5' : '#FFFBEB',
                    color:      order.payment_status === 'approved' ? '#059669' : '#D97706',
                    border: `1px solid ${order.payment_status === 'approved' ? '#A7F3D0' : '#FDE68A'}`,
                  }}>
                    {order.payment_status === 'approved' ? '● Pago' : '● Aguardando'}
                  </span>
                </div>
                {order.fiscal_note && (
                  <p style={{ fontSize: 11, color: '#6366F1', marginTop: 4 }}>📋 Nota fiscal será emitida</p>
                )}
                {order.payment_notes && (
                  <p style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>📝 {order.payment_notes}</p>
                )}
                {order.cash_received > 0 && (
                  <p style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>
                    💵 Recebido: {fmtBRL(order.cash_received)} · Troco: {fmtBRL(Math.max(0, order.cash_received - parseFloat(order.total || 0)))}
                  </p>
                )}
                {order.coupon_code && (
                  <p style={{ fontSize: 12, color: '#6B7280', marginTop: 5 }}>
                    🏷️ Cupom: <strong>{order.coupon_code}</strong> (-{fmtBRL(disc)})
                  </p>
                )}
                <button
                  onClick={() => setEditPayment(true)}
                  style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 5, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  ✏️ {order.payment_status === 'approved' ? 'Editar pagamento' : 'Registrar pagamento'}
                </button>
              </Section>
            )}

            {/* Botões */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {actionButtons.filter(a => a.primary).map(a => (
                  <button key={a.next} onClick={() => { onAction(order.id, 'status', a.next); onClose(); }}
                    style={{ flex: 1, padding: '12px', borderRadius: 5, border: 'none', background: a.bg, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                    {a.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowPrintDialog(true)}
                  style={{ flex: 1, padding: '9px', borderRadius: 5, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Printer size={13} /> Reimprimir
                </button>
                {actionButtons.filter(a => !a.primary).map(a => (
                  <button key={a.next} onClick={() => { onAction(order.id, 'status', a.next); onClose(); }}
                    style={{ flex: 1, padding: '9px', borderRadius: 5, border: `1px solid ${a.bg}40`, background: a.bg + '10', color: a.bg, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diálogo de tipo de impressão */}
      {showPrintDialog && (
        <PrintTypeDialog
          onSelect={type => { setShowPrintDialog(false); onPrint(type); }}
          onClose={() => setShowPrintDialog(false)}
        />
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, icon, children }) {
  return (
    <div style={{ background: '#F9FAFB', borderRadius: 5, padding: '11px 13px', border: '1px solid #E5E7EB' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <span style={{ color: '#6B7280' }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 12, color: valueColor || '#374151', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function QuickStat({ label, value, color, hidden }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 14px', background: color + '10', borderRadius: 4, border: `1px solid ${color}20` }}>
      <p style={{ fontSize: 15, fontWeight: 800, color, filter: hidden ? 'blur(6px)' : 'none', userSelect: hidden ? 'none' : 'auto' }}>{value}</p>
      <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{label}</p>
    </div>
  );
}

// ── KDS Board Principal ───────────────────────────────────────────────────────

export default function KDSBoard({
  orders, onUpdateStatus, onUpdatePayment, onRefresh, onRefreshOrders, adminToken, loading,
  products, drinks, hasMoreOrders, loadingMore, onLoadMore,
}) {
  const [modal, setModal]               = useState(null);
  const [items, setItems]               = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [soundOn, setSoundOn]           = useState(true);
  const [newIds, setNewIds]             = useState(new Set());
  const [countdown, setCountdown]       = useState(15);
  const [showRevenue, setShowRevenue]   = useState(true);
  const [dragging, setDragging]         = useState(null);
  const [showDrawer, setShowDrawer]     = useState(false);
  const [viewMode, setViewMode]         = useState('kanban'); // 'kanban' | 'lista'
  const seenIdsRef                      = useRef(null);
  const onUpdateRef                     = useRef(onUpdateStatus);
  const tick                            = useSecondTick();

  useEffect(() => { onUpdateRef.current = onUpdateStatus; }, [onUpdateStatus]);

  // Auto-close orders open for more than 24h
  useEffect(() => {
    if (!orders.length) return;
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    orders
      .filter(o => !['cancelled', 'delivered'].includes(o.status) && o.created_at < cutoff)
      .forEach(o => onUpdateRef.current(o.id, 'status', 'delivered'));
  }, [orders]);

  // Mapa telefone/nome → contagem de pedidos (todos os pedidos carregados)
  const customerOrderCount = {};
  for (const o of orders) {
    const key = o.customer_phone || o.customer_name;
    if (key) customerOrderCount[key] = (customerOrderCount[key] || 0) + 1;
  }

  const today = todaySP();
  const cutoff24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Show: today's orders + orders still open from last 24h (cross-midnight)
  const visible = orders.filter(o => {
    const isToday = orderDateSP(o.created_at) === today;
    const isOpenRecent = !['cancelled', 'delivered'].includes(o.status) && o.created_at >= cutoff24h;
    return isToday || isOpenRecent;
  });

  const todayOrders  = orders.filter(o => orderDateSP(o.created_at) === today);
  const activeToday  = todayOrders.filter(o => !['cancelled','delivered'].includes(o.status)).length;
  const doneToday    = todayOrders.filter(o => o.status === 'delivered').length;
  const revenueToday = todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (parseFloat(o.total) || 0), 0);

  // Detectar novos pedidos → beep + highlight
  useEffect(() => {
    if (!orders.length) return;
    const cur = new Set(orders.map(o => o.id));
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(cur);
      return;
    }
    const added = new Set([...cur].filter(id => !seenIdsRef.current.has(id)));
    cur.forEach(id => seenIdsRef.current.add(id));
    if (added.size > 0) {
      setNewIds(added);
      if (soundOn) playBeep();
      setTimeout(() => setNewIds(new Set()), 12000);
      orders
        .filter(o => added.has(o.id) && o.status === 'pending')
        .forEach(o => onUpdateRef.current(o.id, 'status', 'confirmed'));
    }
  }, [orders, soundOn]);

  // Auto-refresh a cada 15s
  const refreshOrders = onRefreshOrders || onRefresh;
  useEffect(() => {
    setCountdown(15);
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { refreshOrders(); return 15; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [refreshOrders]);

  async function openModal(order) {
    setModal(order);
    setItems([]);
    setItemsLoading(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'get_order_items', data: { order_id: order.id } }),
      });
      const d = await res.json();
      setItems(d.items || []);
    } catch { setItems([]); }
    finally { setItemsLoading(false); }
  }

  function handleAction(orderId, field, value) {
    onUpdateStatus(orderId, field, value);
    setModal(prev => prev?.id === orderId ? { ...prev, [field]: value } : prev);
  }

  async function handlePaymentUpdate(orderId, updates) {
    if (onUpdatePayment) {
      await onUpdatePayment(orderId, updates);
    } else {
      // fallback: update fields one by one
      for (const [field, value] of Object.entries(updates)) {
        onUpdateStatus(orderId, field, value);
      }
    }
    setModal(prev => prev?.id === orderId ? { ...prev, ...updates } : prev);
  }

  function handlePrint(type = 'balcao') {
    if (!modal) return;
    const body = items.map(i =>
      `  ${i.quantity}x ${i.product_name.padEnd(22)} ${fmtBRL(i.total_price)}`
    ).join('\n');

    let txt;
    if (type === 'cozinha') {
      txt = [
        `════════════════════════`,
        `  COZINHA — #${modal.order_number || modal.id.slice(-4)}`,
        `  ${fmtTime(modal.created_at)}`,
        `════════════════════════`,
        `  ${modal.delivery_street || ''}, ${modal.delivery_number || ''}${modal.delivery_complement ? ' — ' + modal.delivery_complement : ''}`,
        `  ${modal.delivery_neighborhood || ''}`,
        `────────────────────────`,
        body,
        `════════════════════════`,
        modal.observations ? `  OBS: ${modal.observations}` : '',
      ].filter(l => l !== undefined).join('\n');
    } else if (type === 'fiscal') {
      txt = [
        `════════════════════════`,
        `  PEDIDO #${modal.order_number || modal.id.slice(-4)}`,
        `  ${fmtDateFull(modal.created_at)}`,
        `════════════════════════`,
        `  ${modal.customer_name}`,
        modal.customer_cpf ? `  CPF: ${modal.customer_cpf}` : `  CPF: não informado`,
        `  ${fmtPhone(modal.customer_phone) || ''}`,
        ``,
        `  ${modal.delivery_street || ''}, ${modal.delivery_number || ''}${modal.delivery_complement ? ' — ' + modal.delivery_complement : ''}`,
        `  ${modal.delivery_neighborhood || ''}${modal.delivery_city ? ', ' + modal.delivery_city : ''}`,
        `════════════════════════`,
        body,
        `────────────────────────`,
        parseFloat(modal.discount) > 0     ? `  Desconto:     -${fmtBRL(modal.discount)}` : '',
        parseFloat(modal.delivery_fee) > 0 ? `  Taxa entrega:  ${fmtBRL(modal.delivery_fee)}` : '',
        `  TOTAL:         ${fmtBRL(modal.total)}`,
        `  ${PM[modal.payment_method]?.label || modal.payment_method || ''}`,
        `════════════════════════`,
        modal.observations ? `  OBS: ${modal.observations}` : '',
      ].filter(l => l !== undefined).join('\n');
    } else {
      // balcao (padrão)
      txt = [
        `════════════════════════`,
        `  PEDIDO #${modal.order_number || modal.id.slice(-4)}`,
        `  ${fmtDateFull(modal.created_at)}`,
        `════════════════════════`,
        `  ${modal.customer_name}`,
        `  ${fmtPhone(modal.customer_phone) || ''}`,
        ``,
        `  ${modal.delivery_street || ''}, ${modal.delivery_number || ''}${modal.delivery_complement ? ' — ' + modal.delivery_complement : ''}`,
        `  ${modal.delivery_neighborhood || ''}${modal.delivery_city ? ', ' + modal.delivery_city : ''}`,
        `════════════════════════`,
        body,
        `────────────────────────`,
        parseFloat(modal.discount) > 0     ? `  Desconto:     -${fmtBRL(modal.discount)}` : '',
        parseFloat(modal.delivery_fee) > 0 ? `  Taxa entrega:  ${fmtBRL(modal.delivery_fee)}` : '',
        `  TOTAL:         ${fmtBRL(modal.total)}`,
        `  ${PM[modal.payment_method]?.label || modal.payment_method || ''}`,
        `════════════════════════`,
        modal.observations ? `  OBS: ${modal.observations}` : '',
      ].filter(l => l !== undefined).join('\n');
    }

    const fontSize = type === 'cozinha' ? '16px' : '13px';
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`<html><body><pre style="font-family:monospace;font-size:${fontSize};padding:16px;white-space:pre">${txt}</pre><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }

  const hasScheduled = visible.some(o => o.status === 'scheduled');
  const cols = COLUMNS.filter(c => c.id !== 'agendados' || hasScheduled);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#F1F3F5', overflow: 'hidden' }}>

      {/* ── Barra superior ────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '9px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ShoppingBag size={18} color="#D97706" />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>PDV</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 7, marginLeft: 6 }}>
          <QuickStat label="Ativos"      value={activeToday}          color="#D97706" />
          <QuickStat label="Finalizados" value={doneToday}            color="#059669" />
          <QuickStat label="Faturado"    value={fmtBRL(revenueToday)} color="#2563EB" hidden={!showRevenue} />
          <button
            onClick={() => setShowRevenue(s => !s)}
            title={showRevenue ? 'Ocultar faturamento' : 'Mostrar faturamento'}
            style={{ display: 'flex', alignItems: 'center', padding: '4px 7px', borderRadius: 4, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', color: '#6B7280' }}
          >
            {showRevenue ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Toggle Kanban / Lista */}
        <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
          <button
            onClick={() => setViewMode('kanban')}
            title="Visualização Kanban"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: viewMode === 'kanban' ? '#111827' : '#fff',
              color: viewMode === 'kanban' ? '#fff' : '#6B7280',
            }}
          >
            <ChefHat size={13} /> Kanban
          </button>
          <button
            onClick={() => setViewMode('lista')}
            title="Lista de pedidos"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', border: 'none', borderLeft: '1px solid #E5E7EB', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: viewMode === 'lista' ? '#111827' : '#fff',
              color: viewMode === 'lista' ? '#fff' : '#6B7280',
            }}
          >
            <LayoutList size={13} /> Histórico
          </button>
        </div>

        {/* Indicador de data atual */}
        {viewMode === 'kanban' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#F3F4F6', borderRadius: 4 }}>
            <Calendar size={12} color="#6B7280" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>· pedidos de hoje + abertos &lt;24h</span>
          </div>
        )}

        {/* Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9CA3AF' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: loading ? '#F59E0B' : '#10B981' }} />
          {countdown}s
        </div>

        {/* Refresh */}
        <button onClick={() => { onRefresh(); setCountdown(10); }} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 4, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          <RefreshCw size={12} style={loading ? { animation: 'kdsSpin 1s linear infinite' } : {}} />
          Atualizar
        </button>

        {/* Som */}
        <button onClick={() => setSoundOn(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 4, border: '1px solid ' + (soundOn ? '#A7F3D0' : '#E5E7EB'), background: soundOn ? '#ECFDF5' : '#F9FAFB', color: soundOn ? '#059669' : '#9CA3AF', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
          {soundOn ? 'Som' : 'Mudo'}
        </button>

        {/* Novo Pedido */}
        <button onClick={() => setShowDrawer(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 4, border: 'none', background: '#111827', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
          <Plus size={13} /> Novo Pedido
        </button>
      </div>

      {/* ── Vista Kanban ──────────────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div
          style={{ flex: 1, overflowX: 'hidden', overflowY: 'hidden', padding: '12px 16px', display: 'flex', gap: 11, alignItems: 'stretch' }}
          onDragEnd={() => setDragging(null)}
        >
          {cols.map(col => (
            <KDSColumn
              key={col.id}
              col={col}
              orders={visible}
              onCardClick={openModal}
              onQuickAction={handleAction}
              newIds={newIds}
              onDragStart={order => setDragging(order)}
              customerOrderCount={customerOrderCount}
              onDrop={targetStatus => {
                if (dragging && dragging.status !== targetStatus) {
                  handleAction(dragging.id, 'status', targetStatus);
                }
                setDragging(null);
              }}
            />
          ))}
        </div>
      )}

      {/* ── Vista Lista / Histórico ──────────────────────────────────────── */}
      {viewMode === 'lista' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#1A1A1A' }}>
          <OrdersTab
            orders={orders}
            hasMoreOrders={hasMoreOrders}
            loadingMore={loadingMore}
            onUpdateStatus={handleAction}
            onLoadMore={onLoadMore}
          />
        </div>
      )}

      {/* ── Modal detalhes ───────────────────────────────────────────────── */}
      {modal && (
        <OrderModal
          order={modal}
          items={items}
          itemsLoading={itemsLoading}
          onClose={() => setModal(null)}
          onAction={handleAction}
          onPaymentUpdate={(updates) => handlePaymentUpdate(modal.id, updates)}
          onPrint={handlePrint}
          adminToken={adminToken}
          customerOrderCount={customerOrderCount}
        />
      )}

      {/* ── Drawer novo pedido manual ─────────────────────────────────────── */}
      {showDrawer && (
        <ManualOrderDrawer
          adminToken={adminToken}
          products={products || []}
          drinks={drinks || []}
          onClose={() => setShowDrawer(false)}
          onSuccess={() => { setShowDrawer(false); refreshOrders(); }}
        />
      )}

      <style>{`
        @keyframes kdsPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes kdsSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
