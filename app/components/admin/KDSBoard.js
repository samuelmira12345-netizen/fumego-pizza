'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone, MapPin, Clock, ChefHat, Truck, CheckCircle, XCircle,
  Printer, RefreshCw, Volume2, VolumeX, X, Bell, Calendar,
  CreditCard, Zap, Banknote, AlertTriangle, User, List,
  LayoutGrid, Edit2, Check,
} from 'lucide-react';

// ── Configuração de status ─────────────────────────────────────────────────────

const S = {
  pending: {
    label: 'NOVOS',        color: '#D97706', bg: '#FFFBEB', border: '#FDE68A',
    headerBg: '#F59E0B',   text: '#fff',     icon: Bell,
  },
  scheduled: {
    label: 'AGENDADOS',    color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4',
    headerBg: '#14B8A6',   text: '#fff',     icon: Calendar,
  },
  confirmed: {
    label: 'EM PREPARO',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE',
    headerBg: '#3B82F6',   text: '#fff',     icon: ChefHat,
  },
  preparing: {
    label: 'EM PREPARO',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE',
    headerBg: '#3B82F6',   text: '#fff',     icon: ChefHat,
  },
  delivering: {
    label: 'EM ENTREGA',   color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE',
    headerBg: '#8B5CF6',   text: '#fff',     icon: Truck,
  },
  delivered: {
    label: 'FINALIZADOS',  color: '#059669', bg: '#ECFDF5', border: '#A7F3D0',
    headerBg: '#10B981',   text: '#fff',     icon: CheckCircle,
  },
  cancelled: {
    label: 'CANCELADOS',   color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB',
    headerBg: '#9CA3AF',   text: '#fff',     icon: XCircle,
  },
};

// Colunas do Kanban (em ordem visual)
const COLUMNS = [
  { id: 'novos',       statuses: ['pending'],              cfg: S.pending },
  { id: 'agendados',   statuses: ['scheduled'],            cfg: S.scheduled },
  { id: 'preparo',     statuses: ['confirmed','preparing'], cfg: S.confirmed },
  { id: 'entrega',     statuses: ['delivering'],            cfg: S.delivering },
  { id: 'finalizados', statuses: ['delivered'],             cfg: S.delivered },
];

// ── Formas de pagamento ───────────────────────────────────────────────────────

const PM = {
  pix:          { label: 'PIX',    icon: Zap,        color: '#2563EB' },
  cash:         { label: 'Dinheiro', icon: Banknote, color: '#059669' },
  card_delivery:{ label: 'Cartão', icon: CreditCard,  color: '#7C3AED' },
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

// Beep simples via Web Audio API
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [1100, 0.15], [880, 0.3]].forEach(([freq, t]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.12);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.13);
    });
  } catch {}
}

// ── Timer que força re-render a cada 30s ──────────────────────────────────────

function useMinuteTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);
  return tick;
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({ order, onClick, onQuickAction, isNew }) {
  const cfg  = S[order.status] || S.pending;
  const mins = elapsedMins(order.created_at);
  const pm   = PM[order.payment_method];

  // Próxima ação rápida disponível
  const quickAction = {
    pending:    { label: 'Aceitar',     next: 'confirmed',  bg: S.pending.headerBg },
    scheduled:  { label: 'Aceitar',     next: 'confirmed',  bg: S.scheduled.headerBg },
    confirmed:  { label: '→ Entrega',   next: 'delivering', bg: S.delivering.headerBg },
    preparing:  { label: '→ Entrega',   next: 'delivering', bg: S.delivering.headerBg },
    delivering: { label: '✓ Finalizar', next: 'delivered',  bg: S.delivered.headerBg },
  }[order.status];

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 10,
        border: `1px solid ${isNew ? cfg.color : '#E5E7EB'}`,
        borderLeft: `5px solid ${cfg.color}`,
        padding: '13px 13px 11px',
        cursor: 'pointer',
        boxShadow: isNew
          ? `0 0 0 2px ${cfg.color}50, 0 2px 8px rgba(0,0,0,0.08)`
          : '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s, transform 0.1s',
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = isNew ? `0 0 0 2px ${cfg.color}50` : '0 1px 3px rgba(0,0,0,0.06)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Indicador de novo pedido */}
      {isNew && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 9, height: 9, borderRadius: '50%', background: '#EF4444',
          boxShadow: '0 0 0 3px #FEE2E2',
          animation: 'kdsPulse 1.2s ease-in-out infinite',
        }} />
      )}

      {/* Linha 1: número + timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: '#111827', fontFamily: 'monospace', letterSpacing: -0.5 }}>
          #{order.order_number || String(order.id).slice(-4).toUpperCase()}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
          background: timerColor(mins) + '18',
          color: timerColor(mins),
          border: `1px solid ${timerColor(mins)}40`,
        }}>
          ⏱ {fmtElapsed(mins)}
        </span>
      </div>

      {/* Linha 2: cliente */}
      <p style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {order.customer_name}
      </p>

      {/* Linha 3: bairro */}
      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        📍 {order.delivery_neighborhood || '—'}
      </p>

      {/* Observações (destaque laranja) */}
      {order.observations && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '5px 8px', marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: '#92400E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ⚠️ {order.observations}
          </p>
        </div>
      )}

      {/* Linha footer: pagamento + ação rápida */}
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
              padding: '5px 11px', borderRadius: 8, border: 'none',
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

function KDSColumn({ col, orders, onCardClick, onQuickAction, newIds }) {
  const cards = orders
    .filter(o => col.statuses.includes(o.status))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // FIFO

  const Icon = col.cfg.icon;

  // Compact mode for finalizados (shows last 5 only)
  const isFinalized = col.id === 'finalizados';
  const visible = isFinalized ? cards.slice(-8) : cards;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: '0 0 286px', minWidth: 286,
      background: col.cfg.bg,
      borderRadius: 14,
      border: `1px solid ${col.cfg.border}`,
      maxHeight: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: col.cfg.headerBg,
        padding: '11px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, borderRadius: '13px 13px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={15} color="#fff" />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>
            {col.cfg.label}
          </span>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.25)', color: '#fff',
          fontSize: 13, fontWeight: 900, minWidth: 26, height: 26, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
        }}>
          {cards.length}
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: col.cfg.color + '80', fontSize: 13 }}>
            <Icon size={28} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
            Nenhum pedido
          </div>
        ) : (
          <>
            {isFinalized && cards.length > 8 && (
              <p style={{ textAlign: 'center', fontSize: 11, color: col.cfg.color, fontWeight: 600, padding: '4px 0' }}>
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
    order.status === 'pending'    && { label: '✓ Aceitar Pedido',         next: 'confirmed',  bg: S.confirmed.headerBg,  primary: true  },
    order.status === 'scheduled'  && { label: '✓ Aceitar Agendado',       next: 'confirmed',  bg: S.confirmed.headerBg,  primary: true  },
    (order.status === 'confirmed' || order.status === 'preparing')
                                  && { label: '🚚 Enviar para Entrega',   next: 'delivering', bg: S.delivering.headerBg, primary: true  },
    order.status === 'delivering' && { label: '✓ Finalizar Pedido',       next: 'delivered',  bg: S.delivered.headerBg,  primary: true  },
    !['delivered','cancelled'].includes(order.status)
                                  && { label: '✕ Cancelar',              next: 'cancelled',  bg: '#EF4444',             primary: false },
  ].filter(Boolean);

  const sub   = parseFloat(order.subtotal)     || 0;
  const disc  = parseFloat(order.discount)     || 0;
  const fee   = parseFloat(order.delivery_fee) || 0;
  const total = parseFloat(order.total)        || 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: 460, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', borderTop: `5px solid ${cfg.headerBg}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{ padding: '20px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#111827', fontFamily: 'monospace' }}>
                #{order.order_number || String(order.id).slice(-4).toUpperCase()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: cfg.color + '18', color: cfg.color, border: `1px solid ${cfg.color}40`, letterSpacing: 0.5 }}>
                {cfg.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#6B7280' }}>
              <span>🕐 {fmtDateFull(order.created_at)}</span>
              <span style={{ color: timerColor(mins), fontWeight: 700 }}>⏱ {fmtElapsed(mins)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} color="#6B7280" />
          </button>
        </div>

        <div style={{ padding: '16px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Cliente */}
          <Section label="Cliente" icon={<User size={13} />}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{order.customer_name}</p>
            {order.customer_phone && (
              <a href={`tel:${order.customer_phone}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2563EB', textDecoration: 'none', fontWeight: 600, background: '#EFF6FF', padding: '5px 12px', borderRadius: 20, border: '1px solid #BFDBFE' }}
                onClick={e => e.stopPropagation()}>
                <Phone size={13} /> {fmtPhone(order.customer_phone)}
              </a>
            )}
          </Section>

          {/* Endereço */}
          <Section label="Endereço de Entrega" icon={<MapPin size={13} />}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
              {order.delivery_street}, {order.delivery_number}
              {order.delivery_complement ? ` — ${order.delivery_complement}` : ''}
            </p>
            <p style={{ fontSize: 13, color: '#6B7280' }}>
              {order.delivery_neighborhood}{order.delivery_city ? `, ${order.delivery_city}` : ''}
              {order.delivery_zipcode ? ` · ${order.delivery_zipcode}` : ''}
            </p>
          </Section>

          {/* Itens */}
          <Section label="Itens do Pedido" icon={<List size={13} />}>
            {itemsLoading ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#9CA3AF', fontSize: 13 }}>
                <div style={{ width: 14, height: 14, border: '2px solid #E5E7EB', borderTopColor: '#6B7280', borderRadius: '50%', animation: 'kdsSpinModal 0.8s linear infinite' }} />
                Carregando itens...
              </div>
            ) : items.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {items.map((item, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                          {item.quantity}× {item.product_name}
                        </span>
                        <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 6 }}>
                          ({fmtBRL(item.unit_price)} un.)
                        </span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', marginLeft: 10 }}>
                        {fmtBRL(item.total_price)}
                      </span>
                    </div>
                    {item.observations && (
                      <p style={{ fontSize: 11, color: '#B45309', background: '#FFFBEB', padding: '3px 8px', borderRadius: 5, marginTop: 3, border: '1px solid #FDE68A' }}>
                        ⚠️ {item.observations}
                      </p>
                    )}
                  </div>
                ))}

                {/* Totais */}
                <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px dashed #E5E7EB', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Row label="Subtotal" value={fmtBRL(sub)} />
                  {disc > 0 && <Row label="Desconto (cupom)" value={`-${fmtBRL(disc)}`} valueColor="#EF4444" />}
                  {fee > 0  && <Row label="Taxa de entrega"  value={fmtBRL(fee)} />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid #E5E7EB', marginTop: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Total</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{fmtBRL(total)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>Nenhum item encontrado</p>
            )}
          </Section>

          {/* Observações gerais */}
          {order.observations && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#92400E', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>
                ⚠️ Observações do Pedido
              </p>
              <p style={{ fontSize: 14, color: '#78350F', fontWeight: 500 }}>{order.observations}</p>
            </div>
          )}

          {/* Pagamento */}
          <Section label="Pagamento" icon={<PMIcon size={13} />}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PMIcon size={18} color={pm.color} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{pm.label}</span>
              <span style={{
                marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                background: order.payment_status === 'paid' ? '#ECFDF5' : '#FFFBEB',
                color:      order.payment_status === 'paid' ? '#059669'  : '#D97706',
                border: `1px solid ${order.payment_status === 'paid' ? '#A7F3D0' : '#FDE68A'}`,
              }}>
                {order.payment_status === 'paid' ? '● Pago' : '● Aguardando pagamento'}
              </span>
            </div>
            {order.coupon_code && (
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
                🏷️ Cupom: <strong>{order.coupon_code}</strong> (-{fmtBRL(disc)})
              </p>
            )}
          </Section>

          {/* Botões de ação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 4 }}>
            {/* Ações primárias */}
            <div style={{ display: 'flex', gap: 9 }}>
              {actionButtons.filter(a => a.primary).map(a => (
                <button key={a.next} onClick={() => { onAction(order.id, 'status', a.next); onClose(); }}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: a.bg, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: 0.3 }}>
                  {a.label}
                </button>
              ))}
            </div>

            {/* Ações secundárias */}
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={onPrint}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Printer size={14} /> Reimprimir
              </button>
              {actionButtons.filter(a => !a.primary).map(a => (
                <button key={a.next} onClick={() => { onAction(order.id, 'status', a.next); onClose(); }}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${a.bg}50`, background: a.bg + '12', color: a.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
    <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '13px 14px', border: '1px solid #E5E7EB' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
        <span style={{ color: '#6B7280' }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: 1.2, textTransform: 'uppercase' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 13, color: valueColor || '#374151', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ── Ticket médio rápido ────────────────────────────────────────────────────────

function QuickStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 16px', background: color + '12', borderRadius: 8, border: `1px solid ${color}25` }}>
      <p style={{ fontSize: 16, fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{label}</p>
    </div>
  );
}

// ── KDS Board Principal ───────────────────────────────────────────────────────

export default function KDSBoard({ orders, onUpdateStatus, onRefresh, adminToken, loading }) {
  const [modal, setModal]             = useState(null);   // order selecionado
  const [items, setItems]             = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [soundOn, setSoundOn]         = useState(true);
  const [newIds, setNewIds]           = useState(new Set());
  const [countdown, setCountdown]     = useState(30);
  const [filter, setFilter]           = useState('today'); // today | all
  const prevIdsRef                    = useRef(new Set());
  const tick                          = useMinuteTick();

  // Filtro por data
  const today = todaySP();
  const visible = filter === 'today'
    ? orders.filter(o => new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === today)
    : orders;

  // Estatísticas rápidas de hoje
  const todayOrders  = orders.filter(o => new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === today);
  const activeToday  = todayOrders.filter(o => !['cancelled','delivered'].includes(o.status)).length;
  const doneToday    = todayOrders.filter(o => o.status === 'delivered').length;
  const revenueToday = todayOrders.filter(o => o.status !== 'cancelled').reduce((s,o) => s + (parseFloat(o.total)||0), 0);

  // Detectar novos pedidos (para beep + highlight)
  useEffect(() => {
    const cur = new Set(orders.map(o => o.id));
    const added = new Set([...cur].filter(id => !prevIdsRef.current.has(id) && prevIdsRef.current.size > 0));
    if (added.size > 0) {
      setNewIds(added);
      if (soundOn) playBeep();
      setTimeout(() => setNewIds(new Set()), 12000);
    }
    prevIdsRef.current = cur;
  }, [orders, soundOn]);

  // Auto-refresh countdown
  useEffect(() => {
    setCountdown(30);
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { onRefresh(); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [onRefresh]);

  // Abrir modal e buscar itens
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
      `  ${modal.delivery_street}, ${modal.delivery_number}${modal.delivery_complement ? ' — ' + modal.delivery_complement : ''}`,
      `  ${modal.delivery_neighborhood}${modal.delivery_city ? ', ' + modal.delivery_city : ''}`,
      `════════════════════════`,
      body,
      `────────────────────────`,
      parseFloat(modal.discount) > 0 ? `  Desconto:        -${fmtBRL(modal.discount)}` : '',
      parseFloat(modal.delivery_fee) > 0 ? `  Taxa entrega:    ${fmtBRL(modal.delivery_fee)}` : '',
      `  TOTAL:           ${fmtBRL(modal.total)}`,
      `  ${PM[modal.payment_method]?.label || modal.payment_method}`,
      `════════════════════════`,
      modal.observations ? `  OBS: ${modal.observations}` : '',
    ].filter(l => l !== undefined).join('\n');

    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`<html><body><pre style="font-family:monospace;font-size:13px;padding:16px;white-space:pre">${txt}</pre><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }

  // Colunas visíveis (oculta "Agendados" se vazio)
  const hasScheduled = visible.some(o => o.status === 'scheduled');
  const cols = COLUMNS.filter(c => c.id !== 'agendados' || hasScheduled);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', background: '#F4F5F7', overflow: 'hidden' }}>

      {/* ── Barra superior ──────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '10px 22px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

        {/* Título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChefHat size={19} color="#F59E0B" />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>KDS · Pedidos</span>
        </div>

        {/* Stats rápidas */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
          <QuickStat label="Ativos"      value={activeToday}          color="#D97706" />
          <QuickStat label="Finalizados" value={doneToday}            color="#059669" />
          <QuickStat label="Faturado"    value={fmtBRL(revenueToday)} color="#2563EB" />
        </div>

        <div style={{ flex: 1 }} />

        {/* Filtro hoje / todos */}
        <div style={{ display: 'flex', gap: 3, background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
          {[{ k:'today',label:'Hoje'},{k:'all',label:'Todos'}].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === f.k ? '#fff' : 'transparent',
              color:      filter === f.k ? '#111827' : '#6B7280',
              boxShadow:  filter === f.k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Auto-refresh indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9CA3AF' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: loading ? '#F59E0B' : '#10B981' }} />
          Atualiza em {countdown}s
        </div>

        {/* Refresh manual */}
        <button onClick={() => { onRefresh(); setCountdown(30); }} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          <RefreshCw size={13} style={loading ? { animation: 'kdsSpinModal 1s linear infinite' } : {}} />
          Atualizar
        </button>

        {/* Som */}
        <button onClick={() => setSoundOn(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid ' + (soundOn ? '#A7F3D0' : '#E5E7EB'), background: soundOn ? '#ECFDF5' : '#F9FAFB', color: soundOn ? '#059669' : '#9CA3AF', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
          {soundOn ? 'Som' : 'Mudo'}
        </button>
      </div>

      {/* ── Kanban columns ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '14px 18px', display: 'flex', gap: 13, alignItems: 'stretch' }}>
        {cols.map(col => (
          <KDSColumn
            key={col.id}
            col={col}
            orders={visible}
            onCardClick={openModal}
            onQuickAction={handleAction}
            newIds={newIds}
          />
        ))}
      </div>

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
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

      <style>{`
        @keyframes kdsPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes kdsSpinModal {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
