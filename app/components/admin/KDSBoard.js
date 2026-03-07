'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone, MapPin, Clock, ChefHat, Truck, CheckCircle, XCircle,
  Printer, RefreshCw, Volume2, VolumeX, X, Bell, Calendar,
  CreditCard, Zap, Banknote, AlertTriangle, User, List,
  EyeOff, Eye, ChevronDown, Plus,
} from 'lucide-react';
import ManualOrderDrawer from './ManualOrderDrawer';

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

function orderDateSP(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// Beep estridente via Web Audio API (onda quadrada, mais alto)
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // 5 tons ascendentes em onda quadrada para máxima atenção
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

// Timer que força re-render a cada 10s para atualizar timers dos cards
function useSecondTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);
  return tick;
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({ order, onClick, onQuickAction, isNew, onDragStart }) {
  const cfg  = S[order.status] || S.pending;
  const mins = elapsedMins(order.created_at);
  const pm   = PM[order.payment_method];

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

      {/* Cliente */}
      <p style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {order.customer_name}
      </p>

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

// Mapeamento: qual status é atribuído ao soltar em cada coluna
const DROP_TARGET_STATUS = {
  novos:       'pending',
  agendados:   'scheduled',
  preparo:     'confirmed',
  entrega:     'delivering',
  finalizados: 'delivered',
};

function KDSColumn({ col, orders, onCardClick, onQuickAction, newIds, onDragStart, onDrop }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const cards = orders
    .filter(o => col.statuses.includes(o.status))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const Icon = col.cfg.icon;
  const isFinalized = col.id === 'finalizados';
  const visible = isFinalized ? cards.slice(-8) : cards;

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(DROP_TARGET_STATUS[col.id]);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      style={{
        display: 'flex', flexDirection: 'column',
        flex: '0 0 300px', minWidth: 300,
        background: isDragOver ? col.cfg.bg : '#F8FAFC',
        borderRadius: 6,
        border: `${isDragOver ? 2 : 1}px solid ${isDragOver ? col.cfg.headerBg : col.cfg.border}`,
        maxHeight: '100%',
        overflow: 'hidden',
        transition: 'border 0.12s, background 0.12s',
      }}
    >
      {/* Header */}
      <div style={{
        background: col.cfg.headerBg,
        padding: '10px 13px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, borderRadius: isDragOver ? '4px 4px 0 0' : '5px 5px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon size={14} color="#fff" />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 0.8 }}>
            {col.cfg.label}
          </span>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.22)', color: '#fff',
          fontSize: 13, fontWeight: 900, minWidth: 24, height: 24, borderRadius: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
        }}>
          {cards.length}
        </div>
      </div>

      {/* Drop hint */}
      {isDragOver && (
        <div style={{ padding: '8px 9px 0' }}>
          <div style={{ border: `2px dashed ${col.cfg.headerBg}`, borderRadius: 4, padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: col.cfg.headerBg }}>
            Soltar aqui → {col.cfg.label}
          </div>
        </div>
      )}

      {/* Cards */}
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
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Modal de Detalhes ─────────────────────────────────────────────────────────

function OrderModal({ order, items, itemsLoading, onClose, onAction, onPrint }) {
  if (!order) return null;
  const cfg  = S[order.status] || S.pending;
  const mins = elapsedMins(order.created_at);
  const pm   = PM[order.payment_method] || { label: order.payment_method, icon: CreditCard, color: '#6B7280' };
  const PMIcon = pm.icon;

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
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 8, width: 480, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', borderTop: `4px solid ${cfg.headerBg}` }}
        onClick={e => e.stopPropagation()}
      >
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

          {/* Cliente */}
          <Section label="Cliente" icon={<User size={12} />}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 5 }}>{order.customer_name}</p>
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
          <Section label="Pagamento" icon={<PMIcon size={12} />}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <PMIcon size={16} color={pm.color} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{pm.label}</span>
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 3,
                background: order.payment_status === 'paid' ? '#ECFDF5' : '#FFFBEB',
                color:      order.payment_status === 'paid' ? '#059669' : '#D97706',
                border: `1px solid ${order.payment_status === 'paid' ? '#A7F3D0' : '#FDE68A'}`,
              }}>
                {order.payment_status === 'paid' ? '● Pago' : '● Aguardando'}
              </span>
            </div>
            {order.coupon_code && (
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 5 }}>
                🏷️ Cupom: <strong>{order.coupon_code}</strong> (-{fmtBRL(disc)})
              </p>
            )}
          </Section>

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
              <button onClick={onPrint}
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

export default function KDSBoard({ orders, onUpdateStatus, onRefresh, onRefreshOrders, adminToken, loading, products, drinks }) {
  const [modal, setModal]               = useState(null);
  const [items, setItems]               = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [soundOn, setSoundOn]           = useState(true);
  const [newIds, setNewIds]             = useState(new Set());
  const [countdown, setCountdown]       = useState(15);
  const [filterMode, setFilterMode]     = useState('today');
  const [filterDate, setFilterDate]     = useState(todaySP());
  const [showRevenue, setShowRevenue]   = useState(true);
  const [dragging, setDragging]         = useState(null);
  const [showDrawer, setShowDrawer]     = useState(false);
  const prevIdsRef                      = useRef(new Set());
  const onUpdateRef                     = useRef(onUpdateStatus);
  const tick                            = useSecondTick();

  // Keep onUpdateStatus ref fresh to avoid stale closure in auto-accept
  useEffect(() => { onUpdateRef.current = onUpdateStatus; }, [onUpdateStatus]);

  // Filtro por data
  const today = todaySP();
  const activeDate = filterMode === 'today' ? today : filterDate;
  const visible = orders.filter(o => orderDateSP(o.created_at) === activeDate);

  // Stats do dia corrente (sempre hoje)
  const todayOrders  = orders.filter(o => orderDateSP(o.created_at) === today);
  const activeToday  = todayOrders.filter(o => !['cancelled','delivered'].includes(o.status)).length;
  const doneToday    = todayOrders.filter(o => o.status === 'delivered').length;
  const revenueToday = todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (parseFloat(o.total) || 0), 0);

  // Detectar novos pedidos → beep + highlight + auto-aceitar pending
  useEffect(() => {
    const cur = new Set(orders.map(o => o.id));
    const added = new Set([...cur].filter(id => !prevIdsRef.current.has(id) && prevIdsRef.current.size > 0));
    if (added.size > 0) {
      setNewIds(added);
      if (soundOn) playBeep();
      setTimeout(() => setNewIds(new Set()), 12000);
      // Auto-aceitar pedidos novos que não sejam agendados
      orders
        .filter(o => added.has(o.id) && o.status === 'pending')
        .forEach(o => onUpdateRef.current(o.id, 'status', 'confirmed'));
    }
    prevIdsRef.current = cur;
  }, [orders, soundOn]);

  // Auto-refresh a cada 15s usando get_orders_only (leve, sem rebuscar produtos/config)
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

  // Abrir modal
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

  function handlePrint() {
    if (!modal) return;
    const body = items.map(i =>
      `  ${i.quantity}x ${i.product_name.padEnd(22)} ${fmtBRL(i.total_price)}`
    ).join('\n');
    const txt = [
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

    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`<html><body><pre style="font-family:monospace;font-size:13px;padding:16px;white-space:pre">${txt}</pre><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }

  const hasScheduled = visible.some(o => o.status === 'scheduled');
  const cols = COLUMNS.filter(c => c.id !== 'agendados' || hasScheduled);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#F1F3F5', overflow: 'hidden' }}>

      {/* ── Barra superior ────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '9px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ChefHat size={18} color="#D97706" />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>KDS</span>
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

        {/* Filtro período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setFilterMode('today')}
            style={{
              padding: '5px 13px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: filterMode === 'today' ? '#111827' : '#F3F4F6',
              color: filterMode === 'today' ? '#fff' : '#6B7280',
            }}
          >
            HOJE
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: filterMode === 'custom' ? '#111827' : '#F3F4F6', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}
            onClick={() => setFilterMode('custom')}>
            <Calendar size={12} color={filterMode === 'custom' ? '#fff' : '#6B7280'} />
            <input
              type="date"
              value={filterDate}
              onChange={e => { setFilterDate(e.target.value); setFilterMode('custom'); }}
              onClick={e => e.stopPropagation()}
              style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, color: filterMode === 'custom' ? '#fff' : '#6B7280', cursor: 'pointer', outline: 'none', width: 110 }}
            />
          </div>
        </div>

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

      {/* ── Kanban ───────────────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '12px 16px', display: 'flex', gap: 11, alignItems: 'stretch' }}
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
            onDrop={targetStatus => {
              if (dragging && dragging.status !== targetStatus) {
                handleAction(dragging.id, 'status', targetStatus);
              }
              setDragging(null);
            }}
          />
        ))}
      </div>

      {/* ── Modal detalhes ───────────────────────────────────────────────── */}
      {modal && (
        <OrderModal
          order={modal}
          items={items}
          itemsLoading={itemsLoading}
          onClose={() => setModal(null)}
          onAction={handleAction}
          onPrint={handlePrint}
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
