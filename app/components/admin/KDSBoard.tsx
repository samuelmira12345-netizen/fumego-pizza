'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Phone, MapPin, Clock, ChefHat, Truck, Bike, CheckCircle, XCircle,
  Printer, RefreshCw, Volume2, VolumeX, X, Bell, Calendar,
  CreditCard, Zap, Banknote, AlertTriangle, User, List,
  EyeOff, Eye, ChevronDown, Plus, ShoppingBag, Star,
  ArrowRight, PackageCheck, Timer, LayoutList, FilePenLine,
} from 'lucide-react';
import ManualOrderDrawer, { ProductPicker } from './ManualOrderDrawer';
import OrdersTab from './OrdersTab';
import DeliveryQueueTab from './DeliveryQueueTab';
import {
  S, COLUMNS, PM,
  fmtBRL, fmtPhone, fmtTime, fmtDateFull, fmtElapsed,
  getNameInitials, buildAddress, getMapsLinks,
  elapsedMins, timerColor, diffMins,
  todaySP, daysAgoSP, weekStartSP, orderDateSP,
  playBeep, playReadyChime,
} from './kds/kdsUtils';
import OrderCard from './kds/OrderCard';
import KDSColumn from './kds/KDSColumn';

function useSecondTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);
  return tick;
}


// ── Timeline do pedido ────────────────────────────────────────────────────────

function OrderTimeline({ order }: { order: any }) {
  const steps = [
    { label: 'Pedido recebido',       time: order.created_at,    icon: Bell,         color: '#D97706' },
    { label: 'Entrou em preparo',      time: order.confirmed_at,  icon: ChefHat,      color: '#2563EB' },
    { label: 'Pronto para entrega',    time: order.ready_at,      icon: PackageCheck, color: '#F59E0B' },
    { label: 'Saiu para entrega',      time: order.delivering_at, icon: Truck,        color: '#7C3AED' },
    { label: 'Pedido entregue',        time: order.delivered_at,  icon: CheckCircle,  color: '#059669' },
  ];

  const durations = [
    { label: 'Produção',  from: order.created_at,   to: order.ready_at      },
    { label: 'Espera',    from: order.ready_at,      to: order.delivering_at },
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

function CustomerProfilePanel({ phone, name, adminToken, onClose }: { phone: any, name: any, adminToken: any, onClose: any }) {
  const [profile, setProfile] = useState<any>(null);
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
  const active     = orders.filter((o: any) => o.status !== 'cancelled');
  const cancelled  = orders.filter((o: any) => o.status === 'cancelled');
  const totalSpent = active.reduce((s: any, o: any) => s + (parseFloat(o.total) || 0), 0);
  const avgTicket  = active.length > 0 ? totalSpent / active.length : 0;
  const firstOrder = orders.length > 0 ? orders[orders.length - 1] : null;
  const lastOrder  = orders.length > 0 ? orders[0] : null;
  const cancelRate = orders.length > 0 ? (cancelled.length / orders.length * 100).toFixed(0) : 0;

  // Average days between orders
  let avgDays = null;
  if (active.length >= 2) {
    const sorted = [...active].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let totalDiff = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalDiff += (new Date(sorted[i].created_at).getTime() - new Date(sorted[i-1].created_at).getTime()) / 86400000;
    }
    avgDays = Math.round(totalDiff / (sorted.length - 1));
  }

  // Top neighborhood
  const nbhMap: Record<string, any> = {};
  active.forEach((o: any) => { if (o.delivery_neighborhood) nbhMap[o.delivery_neighborhood] = (nbhMap[o.delivery_neighborhood] || 0) + 1; });
  const topNbh = Object.entries(nbhMap).sort((a, b) => (b[1] as any) - (a[1] as any))[0]?.[0];

  // Payment method breakdown
  const pmMap: Record<string, any> = {};
  active.forEach((o: any) => { if (o.payment_method) pmMap[o.payment_method] = (pmMap[o.payment_method] || 0) + 1; });
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
            ].filter(Boolean).map((s: any) => (
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
                {Object.entries(pmMap).sort((a, b) => (b[1] as any) - (a[1] as any)).map(([pm, cnt]) => (
                  <span key={pm} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#F3F4F6', color: '#374151' }}>
                    {(pmLabels as any)[pm] || pm} {cnt as any}×
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Produtos favoritos */}
          {profile?.topItems?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>MAIS PEDIDO</p>
              {profile.topItems.slice(0, 4).map((item: any, i: any) => (
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
            {orders.map((o: any) => {
              const sc = (statusCfg as any)[o.status] || statusCfg.pending;
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
                      {(pmLabels as any)[o.payment_method] || o.payment_method || '—'}
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

function PrintTypeDialog({ onSelect, onClose }: { onSelect: any, onClose: any }) {
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

function PaymentPanel({ order, onSave }: { order: any, onSave: any }) {
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
            onClick={() => setFiscalNote((v: any) => !v)}
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

function OrderModal({ order, items, itemsLoading, onClose, onAction, onPaymentUpdate, onPrint, onAddressUpdate, onItemsUpdate, adminToken, customerOrderCount, deliveryPersons, onAssignDeliveryPerson, onEnsureDeliveryPersons, products, drinks }: { order: any, items: any, itemsLoading: any, onClose: any, onAction: any, onPaymentUpdate: any, onPrint: any, onAddressUpdate: any, onItemsUpdate: any, adminToken: any, customerOrderCount: any, deliveryPersons: any, onAssignDeliveryPerson: any, onEnsureDeliveryPersons: any, products: any, drinks: any }) {
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [showPrintDialog, setShowPrintDialog]         = useState(false);
  const [showPaymentFlow, setShowPaymentFlow]         = useState(false);
  const [paymentStep, setPaymentStep]                 = useState('method');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(order?.payment_method || 'pix');
  const [selectedFiscalNote, setSelectedFiscalNote]   = useState(order?.fiscal_note || false);
  const [savingPaymentFlow, setSavingPaymentFlow]     = useState(false);

  const [showDangerDialog, setShowDangerDialog]       = useState(false);
  const [dangerAction, setDangerAction]               = useState('cancel');
  const [adminPassword, setAdminPassword]             = useState('');
  const [dangerSaving, setDangerSaving]               = useState(false);

  const [showScheduleDialog, setShowScheduleDialog]   = useState(false);
  const [scheduledFor, setScheduledFor]               = useState('');
  const [savingSchedule, setSavingSchedule]           = useState(false);
  const [editingAddress, setEditingAddress]             = useState(false);
  const [savingAddress, setSavingAddress]               = useState(false);
  const [addressDraft, setAddressDraft]                 = useState({
    delivery_street: order?.delivery_street || '',
    delivery_number: order?.delivery_number || '',
    delivery_complement: order?.delivery_complement || '',
    delivery_neighborhood: order?.delivery_neighborhood || '',
    delivery_city: order?.delivery_city || '',
    delivery_zipcode: order?.delivery_zipcode || '',
  });
  const [editingItems, setEditingItems]                 = useState(false);
  const [savingItems, setSavingItems]                   = useState(false);
  const [itemsDraft, setItemsDraft]                     = useState<any[]>([]);
  const [showItemPicker, setShowItemPicker]             = useState(false);
  const [historyRows, setHistoryRows]                   = useState<any[]>([]);
  const [historyLoading, setHistoryLoading]             = useState(false);

  useEffect(() => {
    setAddressDraft({
      delivery_street: order?.delivery_street || '',
      delivery_number: order?.delivery_number || '',
      delivery_complement: order?.delivery_complement || '',
      delivery_neighborhood: order?.delivery_neighborhood || '',
      delivery_city: order?.delivery_city || '',
      delivery_zipcode: order?.delivery_zipcode || '',
    });
  }, [
    order?.id,
    order?.delivery_street,
    order?.delivery_number,
    order?.delivery_complement,
    order?.delivery_neighborhood,
    order?.delivery_city,
    order?.delivery_zipcode,
  ]);

  useEffect(() => {
    setItemsDraft((items || []).map((item: any) => ({
      product_name: item.product_name || '',
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      observations: item.observations || '',
    })));
  }, [order?.id, items]);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      if (!order?.id || !adminToken) return;
      setHistoryLoading(true);
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'get_order_change_history', data: { order_id: order.id } }),
        });
        const d = await res.json();
        if (!res.ok || d.error) throw new Error(d.error || 'Erro ao buscar histórico');
        if (!cancelled) setHistoryRows(Array.isArray(d.history) ? d.history : []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setHistoryRows([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [order?.id, adminToken]);

  if (!order) return null;
  const cfg  = (S as any)[order.status] || S.pending;
  const mins = elapsedMins(order.created_at);
  const pm   = (PM as any)[order.payment_method] || { label: order.payment_method, icon: CreditCard, color: '#6B7280' };
  const PMIcon = pm.icon;

  const totalOrders  = customerOrderCount?.[order.customer_phone || order.customer_name] ?? 1;
  const isNewCustomer = totalOrders === 1;

  const actionButtons = [
    order.status === 'pending'    && { label: '✓ Confirmar Pedido',     next: 'confirmed',  bg: S.confirmed.headerBg,  primary: true },
    order.status === 'scheduled'  && { label: '✓ Aceitar Agendado',     next: 'confirmed',  bg: S.confirmed.headerBg,  primary: true },
    (order.status === 'confirmed' || order.status === 'preparing')
                                  && { label: '✅ Marcar Pronto',       next: 'ready',      bg: S.ready.headerBg,      primary: true },
    order.status === 'ready'      && { label: '🚚 Enviar para Entrega', next: 'delivering', bg: S.delivering.headerBg, primary: true },
    order.status === 'delivering' && { label: '✓ Finalizar Pedido',     next: 'delivered',  bg: S.delivered.headerBg,  primary: true },
    !['delivered','cancelled'].includes(order.status)
                                  && { label: '✕ Cancelar',            next: 'cancelled',  bg: '#EF4444',             primary: false },
  ].filter(Boolean);

  const sub   = parseFloat(order.subtotal)     || 0;
  const disc  = parseFloat(order.discount)     || 0;
  const fee   = parseFloat(order.delivery_fee) || 0;
  const total = parseFloat(order.total)        || 0;
  const maps = getMapsLinks(order);

  const paymentOptions = [
    { key: 'pix', label: 'PIX', icon: Zap, color: '#2563EB' },
    { key: 'card', label: 'Cartão (online)', icon: CreditCard, color: '#7C3AED' },
    { key: 'card_credit', label: 'Cartão (crédito)', icon: CreditCard, color: '#6D28D9' },
    { key: 'card_debit', label: 'Cartão (débito)', icon: CreditCard, color: '#7C3AED' },
    { key: 'cash', label: 'Dinheiro', icon: Banknote, color: '#059669' },
    { key: 'card_delivery', label: 'Cartão na entrega', icon: CreditCard, color: '#0E7490' },
    { key: 'voucher', label: 'Vale refeição', icon: CreditCard, color: '#D97706' },
  ];

  function openPaymentFlow() {
    setSelectedPaymentMethod(order.payment_method || 'pix');
    setSelectedFiscalNote(!!order.fiscal_note);
    setPaymentStep('method');
    setShowPaymentFlow(true);
  }

  async function handleScheduleOrder() {
    if (!scheduledFor) { alert('Selecione a data e hora do agendamento.'); return; }
    setSavingSchedule(true);
    try {
      // Convert local datetime-local value to ISO with SP timezone offset
      const spOffset = -3 * 60; // BRT = UTC-3
      const localDate = new Date(scheduledFor);
      const utcMs = localDate.getTime() - (localDate.getTimezoneOffset() - spOffset) * 60000;
      const isoSP = new Date(utcMs).toISOString();
      await onAction(order.id, 'schedule', { scheduled_for: isoSP });
      setShowScheduleDialog(false);
      onClose();
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleReopenOrder() {
    const ok = await onAction(order.id, 'reopen', null);
    if (ok) onClose();
  }

  async function confirmPaymentFlow() {
    setSavingPaymentFlow(true);
    try {
      await onPaymentUpdate({
        payment_method: selectedPaymentMethod,
        payment_status: 'approved',
        fiscal_note: selectedFiscalNote,
      });
      setShowPaymentFlow(false);
    } finally {
      setSavingPaymentFlow(false);
    }
  }

  async function saveAddress() {
    setSavingAddress(true);
    try {
      await onAddressUpdate(addressDraft);
      setEditingAddress(false);
    } finally {
      setSavingAddress(false);
    }
  }

  function removeItemDraft(index: any) {
    setItemsDraft((prev: any) => prev.filter((_: any, i: any) => i !== index));
  }

  function addPickedItem(item: any) {
    setItemsDraft((prev: any) => ([
      ...prev,
      {
        product_name: item.product_name || '',
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        unit_price: Math.max(0, parseFloat(item.unit_price) || 0),
        observations: item.observations || '',
      },
    ]));
  }

  async function saveItems() {
    setSavingItems(true);
    try {
      const cleaned = itemsDraft
        .map(item => ({
          product_name: String(item.product_name || '').trim(),
          quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
          unit_price: Math.max(0, parseFloat(item.unit_price) || 0),
          observations: String(item.observations || '').trim(),
        }))
        .filter(item => item.product_name);
      if (cleaned.length === 0) {
        alert('O pedido precisa ter ao menos um item.');
        return;
      }
      await onItemsUpdate(cleaned);
      setEditingItems(false);
    } finally {
      setSavingItems(false);
    }
  }

  async function submitDangerAction() {
    if (!adminPassword.trim()) {
      alert('Digite a senha de admin para confirmar.');
      return;
    }
    setDangerSaving(true);
    const ok = await onAction(order.id, dangerAction, adminPassword);
    setDangerSaving(false);
    if (ok) {
      setAdminPassword('');
      setShowDangerDialog(false);
      onClose();
    }
  }

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
              {!editingAddress && (maps.googleMaps ? (
                <a href={maps.googleMaps} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color: '#2563EB', marginBottom: 2, textDecoration: 'underline' }}>
                  {order.delivery_street}, {order.delivery_number}
                  {order.delivery_complement ? ` — ${order.delivery_complement}` : ''}
                </a>
              ) : (
                <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                  {order.delivery_street}, {order.delivery_number}
                  {order.delivery_complement ? ` — ${order.delivery_complement}` : ''}
                </p>
              ))}
              {!editingAddress && (
                <p style={{ fontSize: 12, color: '#6B7280' }}>
                  {order.delivery_neighborhood}{order.delivery_city ? `, ${order.delivery_city}` : ''}
                  {order.delivery_zipcode ? ` · ${order.delivery_zipcode}` : ''}
                </p>
              )}
              {editingAddress && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
                  <input value={addressDraft.delivery_street} onChange={e => setAddressDraft((prev: any) => ({ ...prev, delivery_street: e.target.value }))} placeholder="Rua" style={{ padding: '7px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12 }} />
                  <input value={addressDraft.delivery_number} onChange={e => setAddressDraft((prev: any) => ({ ...prev, delivery_number: e.target.value }))} placeholder="Número" style={{ padding: '7px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12 }} />
                  <input value={addressDraft.delivery_complement} onChange={e => setAddressDraft((prev: any) => ({ ...prev, delivery_complement: e.target.value }))} placeholder="Complemento" style={{ gridColumn: '1 / -1', padding: '7px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12 }} />
                  <input value={addressDraft.delivery_neighborhood} onChange={e => setAddressDraft((prev: any) => ({ ...prev, delivery_neighborhood: e.target.value }))} placeholder="Bairro" style={{ padding: '7px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12 }} />
                  <input value={addressDraft.delivery_zipcode} onChange={e => setAddressDraft((prev: any) => ({ ...prev, delivery_zipcode: e.target.value }))} placeholder="CEP" style={{ padding: '7px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12 }} />
                  <input value={addressDraft.delivery_city} onChange={e => setAddressDraft((prev: any) => ({ ...prev, delivery_city: e.target.value }))} placeholder="Cidade" style={{ gridColumn: '1 / -1', padding: '7px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12 }} />
                </div>
              )}
              {maps.googleMaps && !editingAddress && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <a href={maps.googleMaps} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '4px 8px', textDecoration: 'none' }}>Google Maps</a>
                  <a href={maps.waze} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, color: '#0C4A6E', background: '#ECFEFF', border: '1px solid #A5F3FC', borderRadius: 6, padding: '4px 8px', textDecoration: 'none' }}>Waze</a>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {!editingAddress ? (
                  <button onClick={() => setEditingAddress(true)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 11, fontWeight: 700, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><FilePenLine size={12} /> Editar endereço</button>
                ) : (
                  <>
                    <button onClick={() => { setEditingAddress(false); setAddressDraft({ delivery_street: order?.delivery_street || '', delivery_number: order?.delivery_number || '', delivery_complement: order?.delivery_complement || '', delivery_neighborhood: order?.delivery_neighborhood || '', delivery_city: order?.delivery_city || '', delivery_zipcode: order?.delivery_zipcode || '' }); }} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', fontSize: 11, fontWeight: 700, color: '#6B7280', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={saveAddress} disabled={savingAddress} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: savingAddress ? '#9CA3AF' : '#059669', color: '#fff', fontSize: 11, fontWeight: 700, cursor: savingAddress ? 'not-allowed' : 'pointer' }}>{savingAddress ? 'Salvando...' : 'Salvar endereço'}</button>
                  </>
                )}
              </div>
            </Section>

            {['ready', 'delivering'].includes(order.status) && (
              <Section label="Entregador" icon={<Truck size={12} />} collapsible defaultExpanded={false}>
                <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
                  Se necessário, altere o entregador responsável por este pedido.
                </p>
                <select
                  value={order.delivery_person_id || ''}
                  onFocus={onEnsureDeliveryPersons}
                  onChange={async e => {
                    const nextDeliveryPersonId = e.target.value || null;
                    const ok = await onAssignDeliveryPerson(order.id, nextDeliveryPersonId, order.status === 'delivering');
                    if (!ok) return;
                    onAction(order.id, 'delivery_person_id', nextDeliveryPersonId);
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, background: '#fff' }}
                >
                  <option value="">— Selecione o entregador —</option>
                  {(deliveryPersons || []).map((dp: any) => (
                    <option key={dp.id} value={dp.id}>{dp.name}</option>
                  ))}
                </select>
              </Section>
            )}

            {/* Timeline */}
            <Section label="Timeline do pedido" icon={<Timer size={12} />} collapsible defaultExpanded={false}>
              <OrderTimeline order={order} />
            </Section>

            {/* Itens */}
            <Section label="Itens do Pedido" icon={<List size={12} />} collapsible defaultExpanded={false}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {!editingItems ? (
                  <button onClick={() => setEditingItems(true)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 11, fontWeight: 700, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><FilePenLine size={12} /> Editar itens</button>
                ) : (
                  <>
                    <button onClick={() => setShowItemPicker(true)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #BFDBFE', background: '#EFF6FF', fontSize: 11, fontWeight: 700, color: '#2563EB', cursor: 'pointer' }}>+ Item</button>
                    <button onClick={() => { setEditingItems(false); setShowItemPicker(false); setItemsDraft((items || []).map((item: any) => ({ product_name: item.product_name || '', quantity: item.quantity || 1, unit_price: item.unit_price || 0, observations: item.observations || '' }))); }} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', fontSize: 11, fontWeight: 700, color: '#6B7280', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={saveItems} disabled={savingItems} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: savingItems ? '#9CA3AF' : '#059669', color: '#fff', fontSize: 11, fontWeight: 700, cursor: savingItems ? 'not-allowed' : 'pointer' }}>{savingItems ? 'Salvando...' : 'Salvar itens'}</button>
                  </>
                )}
              </div>
              {editingItems ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>
                    Os itens são tratados como únicos. Você pode remover itens existentes e adicionar novos via mini cardápio.
                  </p>
                  {itemsDraft.map((item, i) => (
                    <div key={`item-draft-${i}`} style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: 8, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{item.quantity}× {item.product_name}</p>
                        <p style={{ fontSize: 11, color: '#6B7280' }}>{fmtBRL(item.unit_price)} un. · Total {fmtBRL((item.quantity || 1) * (item.unit_price || 0))}</p>
                        {item.observations && <p style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>⚠️ {item.observations}</p>}
                      </div>
                      <button onClick={() => removeItemDraft(i)} style={{ padding: '6px 8px', borderRadius: 5, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remover</button>
                    </div>
                  ))}
                  {itemsDraft.length === 0 && <p style={{ fontSize: 12, color: '#9CA3AF' }}>Sem itens no rascunho. Use + Item para adicionar.</p>}
                </div>
              ) : itemsLoading ? (
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  <div style={{ width: 13, height: 13, border: '2px solid #E5E7EB', borderTopColor: '#6B7280', borderRadius: '50%', animation: 'kdsSpin 0.8s linear infinite' }} />
                  Carregando...
                </div>
              ) : items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((item: any, i: any) => (
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
                <p style={{ fontSize: 13, color: '#9CA3AF' }}>Sem itens para este pedido.</p>
              )}
            </Section>

            <Section label="Histórico de alterações" icon={<Timer size={12} />} collapsible defaultExpanded={false}>
              {historyLoading ? (
                <p style={{ fontSize: 12, color: '#9CA3AF' }}>Carregando histórico...</p>
              ) : historyRows.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9CA3AF' }}>Nenhuma alteração registrada ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historyRows.map((entry: any) => {
                    const details = entry?.details || {};
                    const removed = Array.isArray(details.removed_items) ? details.removed_items : [];
                    const added = Array.isArray(details.added_items) ? details.added_items : [];
                    const address = Array.isArray(details.address_changes) ? details.address_changes : [];
                    return (
                      <div key={entry.id} style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: 8 }}>
                        <p style={{ fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 4 }}>{entry.action_type} · {fmtDateFull(entry.created_at)}</p>
                        {removed.map((r: any, idx: any) => <p key={`r-${idx}`} style={{ fontSize: 11, color: '#B91C1C' }}>- Removido: {r.quantity}× {r.product_name}</p>)}
                        {added.map((a: any, idx: any) => <p key={`a-${idx}`} style={{ fontSize: 11, color: '#065F46' }}>+ Adicionado: {a.quantity}× {a.product_name}</p>)}
                        {address.map((a: any, idx: any) => <p key={`ad-${idx}`} style={{ fontSize: 11, color: '#1D4ED8' }}>• Endereço: {a.field} de "{a.from || ''}" para "{a.to || ''}"</p>)}
                        {!removed.length && !added.length && !address.length && details.message && (
                          <p style={{ fontSize: 11, color: '#6B7280' }}>{details.message}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {showItemPicker && (
              <div style={{ border: '1px solid #DBEAFE', background: '#EFF6FF', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: '#1D4ED8' }}>Mini cardápio — adicionar item</p>
                  <button onClick={() => setShowItemPicker(false)} style={{ border: 'none', background: 'transparent', fontSize: 12, color: '#1D4ED8', cursor: 'pointer', fontWeight: 700 }}>Fechar</button>
                </div>
                <ProductPicker
                  products={(products || []).filter((p: any) => !p.is_hidden)}
                  drinks={(drinks || []).filter((d: any) => !d.is_hidden)}
                  onAdd={addPickedItem}
                  onClose={() => setShowItemPicker(false)}
                />
              </div>
            )}

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
                onClick={openPaymentFlow}
                style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 5, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                ✏️ {order.payment_status === 'approved' ? 'Editar pagamento' : 'Registrar pagamento'}
              </button>
            </Section>

            {/* Botões */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {actionButtons.filter((a: any) => a.primary).map((a: any) => (
                  <button key={a.next} onClick={() => { onAction(order.id, 'status', a.next); onClose(); }}
                    style={{ flex: 1, padding: '12px', borderRadius: 5, border: 'none', background: a.bg, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                    {a.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setShowPrintDialog(true)}
                  style={{ flex: 1, padding: '9px', borderRadius: 5, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Printer size={13} /> Reimprimir
                </button>
                {/* Agendar pedido — disponível para pedidos não finalizados */}
                {!['delivered', 'cancelled'].includes(order.status) && (
                  <button
                    onClick={() => {
                      // Pre-fill with 1 hour from now in SP timezone
                      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                      now.setHours(now.getHours() + 1, 0, 0, 0);
                      const pad = (n: any) => String(n).padStart(2, '0');
                      setScheduledFor(`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`);
                      setShowScheduleDialog(true);
                    }}
                    style={{ flex: 1, padding: '9px', borderRadius: 5, border: '1px solid #8B5CF640', background: '#8B5CF610', color: '#6D28D9', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  >
                    <Calendar size={13} /> Agendar
                  </button>
                )}
                {actionButtons.filter((a: any) => !a.primary).map((a: any) => (
                  <button key={a.next} onClick={() => { setDangerAction('cancel'); setShowDangerDialog(true); }}
                    style={{ flex: 1, padding: '9px', borderRadius: 5, border: `1px solid ${a.bg}40`, background: a.bg + '10', color: a.bg, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {a.label}
                  </button>
                ))}
                <button
                  onClick={() => { setDangerAction('delete'); setShowDangerDialog(true); }}
                  style={{ flex: 1, padding: '9px', borderRadius: 5, border: '1px solid #7F1D1D40', background: '#7F1D1D10', color: '#991B1B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  🗑️ Deletar
                </button>
              </div>
              {/* Reabrir pedido — disponível para pedidos finalizados ou cancelados */}
              {['delivered', 'cancelled'].includes(order.status) && (
                <button
                  onClick={handleReopenOrder}
                  style={{ width: '100%', padding: '10px', borderRadius: 5, border: '2px solid #059669', background: '#ECFDF5', color: '#065F46', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  ↩ Reabrir Pedido
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Diálogo de tipo de impressão */}
      {showPrintDialog && (
        <PrintTypeDialog
          onSelect={(type: any) => { setShowPrintDialog(false); onPrint(type); }}
          onClose={() => setShowPrintDialog(false)}
        />
      )}

      {showPaymentFlow && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowPaymentFlow(false)}>
          <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16 }} onClick={e => e.stopPropagation()}>
            {paymentStep === 'method' ? (
              <>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Confirmar forma de pagamento</p>
                <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Qual foi a forma de pagamento correta deste pedido?</p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {paymentOptions.map(opt => {
                    const Icon = opt.icon;
                    const selected = selectedPaymentMethod === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setSelectedPaymentMethod(opt.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 7, border: selected ? `2px solid ${opt.color}` : '1px solid #E5E7EB', background: selected ? `${opt.color}14` : '#fff', color: selected ? opt.color : '#374151', padding: '9px 11px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <Icon size={15} /> {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setShowPaymentFlow(false)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#6B7280', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={() => setPaymentStep('invoice')} style={{ padding: '8px 10px', borderRadius: 6, border: 'none', background: '#111827', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Continuar</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Emitir nota fiscal?</p>
                <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Deseja emitir nota fiscal para este pedido?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSelectedFiscalNote(true)} style={{ flex: 1, padding: '10px', borderRadius: 7, border: selectedFiscalNote ? '2px solid #4F46E5' : '1px solid #E5E7EB', background: selectedFiscalNote ? '#EEF2FF' : '#fff', color: selectedFiscalNote ? '#4338CA' : '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Sim, emitir NF</button>
                  <button onClick={() => setSelectedFiscalNote(false)} style={{ flex: 1, padding: '10px', borderRadius: 7, border: !selectedFiscalNote ? '2px solid #9CA3AF' : '1px solid #E5E7EB', background: !selectedFiscalNote ? '#F3F4F6' : '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Não emitir</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setPaymentStep('method')} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#6B7280', fontSize: 12, cursor: 'pointer' }}>Voltar</button>
                  <button onClick={confirmPaymentFlow} disabled={savingPaymentFlow} style={{ padding: '8px 10px', borderRadius: 6, border: 'none', background: savingPaymentFlow ? '#9CA3AF' : '#059669', color: '#fff', fontSize: 12, fontWeight: 700, cursor: savingPaymentFlow ? 'not-allowed' : 'pointer' }}>{savingPaymentFlow ? 'Salvando...' : 'Confirmar pagamento'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showDangerDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowDangerDialog(false)}>
          <div style={{ width: '100%', maxWidth: 430, background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 800, color: dangerAction === 'delete' ? '#991B1B' : '#B91C1C', marginBottom: 6 }}>
              {dangerAction === 'delete' ? '🗑️ Inativar pedido' : '✕ Cancelar pedido'}
            </p>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
              {dangerAction === 'delete'
                ? 'O pedido ficará inativo e visível apenas no histórico. Pode ser reativado depois. Digite a senha de admin para confirmar.'
                : 'Esta ação altera o status para cancelado. Digite a senha de admin para confirmar.'}
            </p>
            <input
              type="password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitDangerAction()}
              placeholder="Senha de admin"
              autoFocus
              style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowDangerDialog(false)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#6B7280', fontSize: 12, cursor: 'pointer' }}>Voltar</button>
              <button onClick={submitDangerAction} disabled={dangerSaving} style={{ padding: '8px 10px', borderRadius: 6, border: 'none', background: dangerSaving ? '#9CA3AF' : (dangerAction === 'delete' ? '#991B1B' : '#DC2626'), color: '#fff', fontSize: 12, fontWeight: 700, cursor: dangerSaving ? 'not-allowed' : 'pointer' }}>
                {dangerSaving ? 'Confirmando...' : (dangerAction === 'delete' ? 'Confirmar inativação' : 'Confirmar cancelamento')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de agendamento */}
      {showScheduleDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowScheduleDialog(false)}>
          <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#6D28D9', marginBottom: 4 }}>📅 Agendar Pedido</p>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
              O pedido voltará para a coluna <strong>Agendados</strong>. As métricas de tempo só começarão a contar quando o pedido entrar em preparo.
            </p>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>DATA E HORA DE ENTREGA PREVISTA</p>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={e => setScheduledFor(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowScheduleDialog(false)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#6B7280', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleScheduleOrder} disabled={savingSchedule || !scheduledFor} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: (savingSchedule || !scheduledFor) ? '#9CA3AF' : '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: (savingSchedule || !scheduledFor) ? 'not-allowed' : 'pointer' }}>
                {savingSchedule ? 'Agendando...' : '✓ Confirmar Agendamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, icon, children, collapsible = false, defaultExpanded = true }: { label: any, icon: any, children: any, collapsible?: any, defaultExpanded?: any }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{ background: '#F9FAFB', borderRadius: 5, padding: '11px 13px', border: '1px solid #E5E7EB' }}>
      <button
        type="button"
        onClick={() => collapsible && setExpanded((prev: any) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: expanded ? 8 : 0,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: collapsible ? 'pointer' : 'default',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#6B7280' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
        </span>
        {collapsible && (
          <ChevronDown
            size={14}
            color="#6B7280"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
          />
        )}
      </button>
      {(!collapsible || expanded) && children}
    </div>
  );
}

function Row({ label, value, valueColor }: { label: any, value: any, valueColor?: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 12, color: valueColor || '#374151', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function QuickStat({ label, value, color, hidden }: { label: any, value: any, color: any, hidden?: any }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 14px', background: color + '10', borderRadius: 4, border: `1px solid ${color}20` }}>
      <p style={{ fontSize: 15, fontWeight: 800, color, filter: hidden ? 'blur(6px)' : 'none', userSelect: hidden ? 'none' : 'auto' }}>{value}</p>
      <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{label}</p>
    </div>
  );
}

// ── Kitchen KDS (tablet/iPad de cozinha) ─────────────────────────────────────

function KitchenOrderDetailsModal({ order, onClose }: { order: any, onClose: any }) {
  if (!order) return null;
  const kitchenItems = (order.order_items || []).filter((item: any) => !item?.drink_id);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ width: 'min(640px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 18 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Detalhes para cozinha</p>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#111827', fontFamily: 'monospace' }}>#{order.order_number || String(order.id).slice(-4).toUpperCase()}</p>
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, width: 32, height: 32, cursor: 'pointer' }}>
            <X size={15} color="#6B7280" />
          </button>
        </div>

        <div style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{order.customer_name}</p>
          <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            ⏱ {fmtElapsed(elapsedMins(order.created_at))} · entrou às {fmtTime(order.created_at)}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {kitchenItems.length > 0 ? kitchenItems.map((item: any, i: any) => (
            <div key={`${order.id}-kitchen-item-${i}`} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#D97706', minWidth: 28, fontFamily: 'monospace' }}>{item.quantity}×</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{item.product_name}</span>
              </div>
              {item.observations && (
                <p style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '4px 8px', marginTop: 6, marginLeft: 26 }}>
                  ⚠️ {item.observations}
                </p>
              )}
            </div>
          )) : (
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Itens não disponíveis.</p>
          )}
        </div>

        {order.observations && (
          <div style={{ marginTop: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: 0.8 }}>Observações gerais</p>
            <p style={{ fontSize: 13, color: '#7F1D1D', marginTop: 4 }}>{order.observations}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KitchenOrderCard({ order, onMarkReady, onOpenDetails, minCardHeight }: { order: any, onMarkReady: any, onOpenDetails: any, minCardHeight: any }) {
  const isItemsLoading = !!order.order_items_loading;
  const [marking, setMarking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checkedItems, setCheckedItems] = useState<any>({});
  const mins = elapsedMins(order.created_at);
  const urgentColor = mins >= 30 ? '#EF4444' : mins >= 20 ? '#D97706' : '#10B981';
  const urgentBg    = mins >= 30 ? '#FEF2F2' : mins >= 20 ? '#FFFBEB' : '#ECFDF5';
  const kitchenItems = (order.order_items || []).filter((item: any) => !item?.drink_id);

  useEffect(() => {
    setCheckedItems({});
  }, [order.id, kitchenItems.length]);

  const isEveryKitchenItemChecked = kitchenItems.length > 0 && kitchenItems.every((item: any, idx: any) => {
    const itemKey = `${item.product_name || 'item'}-${idx}-${item.quantity || 1}`;
    return !!checkedItems[itemKey];
  });

  async function confirmReady() {
    setShowConfirm(false);
    setMarking(true);
    await onMarkReady();
    setMarking(false);
  }

  async function handleToggleItem(item: any, idx: any) {
    const itemKey = `${item.product_name || 'item'}-${idx}-${item.quantity || 1}`;
    const nextChecked = !checkedItems[itemKey];
    const nextState = { ...checkedItems, [itemKey]: nextChecked };
    setCheckedItems(nextState);

    const allChecked = kitchenItems.length > 0 && kitchenItems.every((kItem: any, kIdx: any) => {
      const key = `${kItem.product_name || 'item'}-${kIdx}-${kItem.quantity || 1}`;
      return key === itemKey ? nextChecked : !!nextState[key];
    });

    if (allChecked && !marking) {
      setMarking(true);
      await onMarkReady();
      setMarking(false);
    }
  }

  return (
    <div
      onClick={onOpenDetails}
      style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${urgentColor}35`,
      borderLeft: `5px solid ${urgentColor}`,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: minCardHeight || 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      cursor: 'pointer',
    }}>
      {/* Número + timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 32, fontWeight: 900, color: '#111827', fontFamily: 'monospace', letterSpacing: -1 }}>
          #{order.order_number || String(order.id).slice(-4).toUpperCase()}
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 20, fontWeight: 800, fontFamily: 'monospace',
            color: urgentColor,
            background: urgentBg,
            padding: '4px 10px', borderRadius: 6,
            border: `1px solid ${urgentColor}25`,
          }}>
            ⏱ {fmtElapsed(mins)}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
            Chegou: {fmtTime(order.created_at)}
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{order.customer_name}</span>
        {order.delivery_neighborhood && (
          <span style={{ fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '2px 7px', borderRadius: 4 }}>
            📍 {order.delivery_neighborhood}
          </span>
        )}
      </div>

      {/* Preview de itens para cozinha */}
      <div style={{ marginTop: 4, borderTop: '1px dashed #E5E7EB', paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isItemsLoading ? (
          <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Carregando itens...</p>
        ) : kitchenItems.length === 0 ? (
          <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Sem itens para este pedido.</p>
        ) : (
          kitchenItems.map((item: any, idx: any) => {
            const itemKey = `${item.product_name || 'item'}-${idx}-${item.quantity || 1}`;
            const isChecked = !!checkedItems[itemKey];
            return (
            <div key={`${order.id}-kitchen-preview-item-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={isChecked}
                onClick={e => e.stopPropagation()}
                onChange={() => handleToggleItem(item, idx)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: '#2563EB', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 15, fontWeight: 900, color: '#D97706', minWidth: 26, fontFamily: 'monospace' }}>
                {parseInt(item.quantity, 10) || 1}x
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 14, color: isChecked ? '#2563EB' : '#111827', lineHeight: 1.3, fontWeight: 800, wordBreak: 'break-word' }}>
                  {item.product_name || 'Item'}
                </p>
                {item.observations && (
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2, lineHeight: 1.25, wordBreak: 'break-word' }}>
                    Obs: {item.observations}
                  </p>
                )}
              </div>
            </div>
          )})
        )}
      </div>

      {/* Observações do pedido */}
      {order.observations && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px' }}>
          <p style={{ fontSize: 13, color: '#92400E', fontWeight: 600 }}>⚠️ {order.observations}</p>
        </div>
      )}

      {/* Confirmação */}
      {showConfirm ? (
        <div style={{ background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#15803D', marginBottom: 12 }}>
            ✅ Confirmar que o pedido está pronto?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={e => {
                e.stopPropagation();
                confirmReady();
              }}
              style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
            >
              Sim, está pronto!
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                setShowConfirm(false);
              }}
              style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        /* Botão PRONTO */
        <button
          disabled={marking || isEveryKitchenItemChecked}
          onClick={e => {
            e.stopPropagation();
            setShowConfirm(true);
          }}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            fontSize: 16, fontWeight: 900, cursor: marking || isEveryKitchenItemChecked ? 'not-allowed' : 'pointer',
            background: marking || isEveryKitchenItemChecked ? '#9CA3AF' : '#10B981',
            color: '#fff', letterSpacing: 0.5, transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {marking
            ? 'Registrando...'
            : isEveryKitchenItemChecked
              ? 'Pedido finalizado'
            : <><PackageCheck size={20} /> MARCAR PRONTO</>
          }
        </button>
      )}
    </div>
  );
}

function KitchenKDS({ orders, onMarkReady, soundOn, setSoundOn }: { orders: any, onMarkReady: any, soundOn: any, setSoundOn: any }) {
  const [clockTick, setClockTick] = useState(0);
  const [detailOrderId, setDetailOrderId] = useState<any>(null);
  useEffect(() => {
    const iv = setInterval(() => setClockTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  // Only show orders that need kitchen action (not 'ready' — they disappear after marking)
  const kitchenOrders = orders
    .filter((o: any) => ['confirmed', 'preparing'].includes(o.status))
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const maxItemsInKitchen = Math.max(1, ...kitchenOrders.map((o: any) => (o.order_items || []).filter((item: any) => !item?.drink_id).length || 1));
  const minKitchenCardHeight = 180 + (maxItemsInKitchen * 28);
  const detailOrder = kitchenOrders.find((o: any) => o.id === detailOrderId) || null;

  return (
    <div style={{ flex: 1, background: '#F8FAFC', overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header da cozinha */}
      <div style={{ background: '#fff', borderBottom: '2px solid #E5E7EB', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={22} color="#D97706" />
          </div>
          <div>
            <span style={{ fontSize: 17, fontWeight: 900, color: '#111827', letterSpacing: 0.3 }}>COZINHA — KDS</span>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
              {kitchenOrders.length === 0 ? 'Nenhum pedido em preparo' : `${kitchenOrders.length} pedido${kitchenOrders.length !== 1 ? 's' : ''} em preparo`}
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Clock */}
        <div style={{ textAlign: 'right', padding: '4px 12px', background: '#F3F4F6', borderRadius: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', fontFamily: 'monospace' }}>
            {new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
            {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit' })}
          </div>
        </div>
        <button onClick={() => setSoundOn((s: any) => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: '1px solid ' + (soundOn ? '#A7F3D0' : '#E5E7EB'), background: soundOn ? '#ECFDF5' : '#F9FAFB', color: soundOn ? '#059669' : '#9CA3AF', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />} Som
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {kitchenOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9CA3AF' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ChefHat size={40} color="#D1D5DB" />
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Cozinha liberada!</p>
            <p style={{ fontSize: 14, color: '#9CA3AF' }}>Nenhum pedido aguardando preparo.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <ChefHat size={16} color="#2563EB" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#2563EB', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Em Preparo ({kitchenOrders.length})
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {kitchenOrders.map((o: any) => (
                <KitchenOrderCard
                  key={o.id}
                  order={o}
                  onMarkReady={() => onMarkReady(o.id)}
                  onOpenDetails={() => setDetailOrderId(o.id)}
                  minCardHeight={minKitchenCardHeight}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {detailOrder && (
        <KitchenOrderDetailsModal
          order={detailOrder}
          onClose={() => setDetailOrderId(null)}
        />
      )}
    </div>
  );
}

// ── KDS Board Principal ───────────────────────────────────────────────────────

const KDSBoard = React.memo(function KDSBoard({
  orders, onUpdateStatus, onUpdatePayment, onRefresh, onRefreshOrders, adminToken, loading,
  products, drinks, hasMoreOrders, loadingMore, onLoadMore,
}: { orders: any, onUpdateStatus: any, onUpdatePayment: any, onRefresh: any, onRefreshOrders: any, adminToken: any, loading: any, products: any, drinks: any, hasMoreOrders: any, loadingMore: any, onLoadMore: any }) {
  const [modal, setModal]               = useState<any>(null);
  const [items, setItems]               = useState<any[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<any>({});
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsLoadingByOrder, setItemsLoadingByOrder] = useState<any>({});
  const [soundOn, setSoundOn]           = useState(true);
  const [newIds, setNewIds]             = useState(new Set());
  const [readyIds, setReadyIds]         = useState(new Set());
  const [countdown, setCountdown]       = useState(15);
  const [showRevenue, setShowRevenue]   = useState(true);
  const [dragging, setDragging]         = useState<any>(null);
  const [showDrawer, setShowDrawer]     = useState(false);
  const [viewMode, setViewMode]         = useState('kanban'); // 'kanban' | 'lista' | 'cozinha'
  const [deliveryPersons, setDeliveryPersons] = useState<any[]>([]);
  const [deliveryPrompt, setDeliveryPrompt] = useState({ open: false, orderId: null, deliveryPersonId: '' });
  const [assigningDelivery, setAssigningDelivery] = useState(false);
  const deliveryPersonsLoadedRef         = useRef(false);
  const fetchingItemsRef                = useRef(new Set());
  const seenIdsRef                      = useRef<Set<any> | null>(null);
  const prevStatusRef                   = useRef<Record<string, any>>({});
  const onUpdateRef                     = useRef(onUpdateStatus);
  const tick                            = useSecondTick();

  useEffect(() => { onUpdateRef.current = onUpdateStatus; }, [onUpdateStatus]);

  // Auto-close orders open for more than 24h
  useEffect(() => {
    if (!orders.length) return;
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    orders
      .filter((o: any) => !['cancelled', 'delivered'].includes(o.status) && o.created_at < cutoff)
      .forEach((o: any) => onUpdateRef.current(o.id, 'status', 'delivered'));
  }, [orders]);

  // Mapa telefone/nome → contagem de pedidos (todos os pedidos carregados)
  const customerOrderCount: Record<string, any> = useMemo(() => {
    const map: Record<string, any> = {};
    for (const o of orders) {
      const key = o.customer_phone || o.customer_name;
      if (key) map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [orders]);

  const today = todaySP();
  const cutoff24h = useMemo(() => new Date(Date.now() - 24 * 3600 * 1000).toISOString(), [tick]);

  // Show: today's orders + orders still open from last 24h (cross-midnight)
  // 'delivered' orders with pending payment stay visible until payment is registered
  // 'delivered' + paid (approved) orders move to history only
  const visible = useMemo(() => orders.filter((o: any) => {
    if (o.status === 'cancelled') return false;
    // Delivered + paid → only in history (hidden from kanban)
    if (o.status === 'delivered' && o.payment_status === 'approved') return false;
    const isToday = orderDateSP(o.created_at) === today;
    const isOpenRecent = o.created_at >= cutoff24h;
    // Unpaid delivered orders stay visible regardless of date (to avoid losing track)
    const isUnpaidDelivered = o.status === 'delivered' && o.payment_status !== 'approved';
    return isToday || isOpenRecent || isUnpaidDelivered;
  }), [orders, today, cutoff24h]);

  const fetchOrderItems = useCallback(async (orderId: any) => {
    if (!orderId || fetchingItemsRef.current.has(orderId)) return null;
    fetchingItemsRef.current.add(orderId);
    setItemsLoadingByOrder((prev: any) => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'get_order_items', data: { order_id: orderId } }),
      });
      const d = await res.json();
      const nextItems = Array.isArray(d.items) ? d.items : [];
      setItemsByOrder((prev: any) => ({ ...prev, [orderId]: nextItems }));
      return nextItems;
    } catch {
      setItemsByOrder((prev: any) => ({ ...prev, [orderId]: [] }));
      return [];
    } finally {
      fetchingItemsRef.current.delete(orderId);
      setItemsLoadingByOrder((prev: any) => ({ ...prev, [orderId]: false }));
    }
  }, [adminToken]);

  function getOrderItems(order: any) {
    const cached = itemsByOrder[order.id];
    if (Array.isArray(cached) && cached.length > 0) return cached;
    if (Array.isArray(order.order_items) && order.order_items.length > 0) return order.order_items;
    return Array.isArray(cached) ? cached : [];
  }

  useEffect(() => {
    const ids = visible
      .filter((o: any) => !Object.prototype.hasOwnProperty.call(itemsByOrder, o.id))
      .map((o: any) => o.id)
      .slice(0, 10);

    if (ids.length === 0) return;
    ids.forEach((id: any) => { fetchOrderItems(id); });
  }, [visible, itemsByOrder, fetchOrderItems]);

  const visibleWithItems = visible.map((o: any) => ({
    ...o,
    order_items: getOrderItems(o),
    order_items_loading: !!itemsLoadingByOrder[o.id],
  }));

  const deliveryPersonsById = useMemo(() => deliveryPersons.reduce((acc: any, person: any) => {
    acc[String(person.id)] = person.name || '';
    return acc;
  }, {}), [deliveryPersons]);

  useEffect(() => {
    if (!adminToken || deliveryPersonsLoadedRef.current) return;
    ensureDeliveryPersons();
  }, [adminToken]);

  const todayOrders  = useMemo(() => orders.filter((o: any) => orderDateSP(o.created_at) === today), [orders, today]);
  const activeToday  = useMemo(() => todayOrders.filter((o: any) => !['cancelled','delivered'].includes(o.status)).length, [todayOrders]);
  const doneToday    = useMemo(() => todayOrders.filter((o: any) => o.status === 'delivered').length, [todayOrders]);
  const revenueToday = useMemo(() => todayOrders.filter((o: any) => o.status !== 'cancelled').reduce((s: any, o: any) => s + (parseFloat(o.total) || 0), 0), [todayOrders]);

  // Detectar novos pedidos → beep + highlight
  useEffect(() => {
    if (!orders.length) return;
    const cur = new Set(orders.map((o: any) => o.id));
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(cur) as any;
      return;
    }
    const added = new Set([...cur].filter((id: any) => !(seenIdsRef.current as any).has(id)));
    cur.forEach((id: any) => (seenIdsRef.current as any).add(id));
    if (added.size > 0) {
      setNewIds(added);
      if (soundOn) playBeep();
      setTimeout(() => setNewIds(new Set()), 12000);
      orders
        .filter((o: any) => added.has(o.id) && o.status === 'pending')
        .forEach((o: any) => onUpdateRef.current(o.id, 'status', 'confirmed'));
    }
  }, [orders, soundOn]);

  // Detectar pedidos que entraram em 'ready' → campainha
  useEffect(() => {
    if (!orders.length) return;
    const newReady = new Set();
    orders.forEach((o: any) => {
      const prev = (prevStatusRef.current as any)[o.id];
      if (o.status === 'ready' && prev !== undefined && prev !== 'ready') {
        newReady.add(o.id);
      }
      (prevStatusRef.current as any)[o.id] = o.status;
    });
    if (newReady.size > 0) {
      setReadyIds(newReady);
      if (soundOn) playReadyChime();
      setTimeout(() => setReadyIds(new Set()), 10000);
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

  async function openModal(order: any) {
    setModal(order);
    setItems(getOrderItems(order));
    setItemsLoading(true);
    try {
      const fresh = await fetchOrderItems(order.id);
      setItems(Array.isArray(fresh) ? fresh : []);
    } finally {
      setItemsLoading(false);
    }
  }

  async function ensureDeliveryPersons() {
    if (deliveryPersonsLoadedRef.current || !adminToken) return;
    deliveryPersonsLoadedRef.current = true;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'get_delivery_persons', data: {} }),
      });
      const d = await res.json();
      setDeliveryPersons((d.persons || []).filter((p: any) => p.is_active));
    } catch (e) {
      console.error(e);
      deliveryPersonsLoadedRef.current = false;
    }
  }

  async function assignDeliveryPerson(orderId: any, personId: any, startDelivery = false) {
    if (!adminToken || !orderId) return false;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'assign_delivery', data: { order_id: orderId, delivery_person_id: personId || null, start_delivery: startDelivery } }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Erro ao atribuir entregador');
      return true;
    } catch (e) {
      console.error(e);
      alert('Erro ao atribuir entregador: ' + ((e as Error).message || 'erro desconhecido'));
      return false;
    }
  }

  async function verifyAdminPassword(password: any) {
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) return false;
      const d = await res.json();
      return !!d.token;
    } catch {
      return false;
    }
  }

  async function handleAction(orderId: any, field: any, value: any) {
    if (field === 'cancel' || field === 'delete') {
      const validPass = await verifyAdminPassword(value);
      if (!validPass) {
        alert('Senha de admin inválida.');
        return false;
      }

      if (field === 'cancel') {
        onUpdateStatus(orderId, 'status', 'cancelled');
        setModal((prev: any) => prev?.id === orderId ? { ...prev, status: 'cancelled' } : prev);
        return true;
      }

      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'delete_order', data: { id: orderId } }),
        });
        const d = await res.json();
        if (!res.ok || d.error) throw new Error(d.error || 'Erro ao inativar pedido');
        await refreshOrders();
        return true;
      } catch (e) {
        alert('Erro ao inativar pedido: ' + ((e as Error).message || 'erro desconhecido'));
        return false;
      }
    }

    // Reabrir pedido (delivered ou cancelled → confirmed)
    if (field === 'reopen') {
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'restore_order', data: { id: orderId } }),
        });
        const d = await res.json();
        if (!res.ok || d.error) throw new Error(d.error || 'Erro ao reabrir pedido');
        // Optimistic update
        onUpdateStatus(orderId, 'status', 'confirmed');
        setModal((prev: any) => prev?.id === orderId ? { ...prev, status: 'confirmed', delivered_at: null } : prev);
        await refreshOrders();
        return true;
      } catch (e) {
        alert('Erro ao reabrir pedido: ' + ((e as Error).message || 'erro desconhecido'));
        return false;
      }
    }

    // Agendar pedido (any active status → scheduled)
    if (field === 'schedule') {
      try {
        const { scheduled_for } = value || {};
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'update_order', data: { id: orderId, status: 'scheduled', scheduled_for } }),
        });
        const d = await res.json();
        if (!res.ok || d.error) throw new Error(d.error || 'Erro ao agendar pedido');
        onUpdateStatus(orderId, 'status', 'scheduled');
        onUpdateStatus(orderId, 'scheduled_for', scheduled_for);
        setModal((prev: any) => prev?.id === orderId ? { ...prev, status: 'scheduled', scheduled_for } : prev);
        return true;
      } catch (e) {
        alert('Erro ao agendar pedido: ' + ((e as Error).message || 'erro desconhecido'));
        return false;
      }
    }

    if (field === 'status' && value === 'delivering') {
      const order = orders.find((o: any) => o.id === orderId);
      await ensureDeliveryPersons();
      setDeliveryPrompt({
        open: true,
        orderId,
        deliveryPersonId: order?.delivery_person_id || '',
      });
      return true;
    }
    onUpdateStatus(orderId, field, value);
    setModal((prev: any) => prev?.id === orderId ? { ...prev, [field]: value } : prev);
    return true;
  }

  async function confirmStartDelivery() {
    if (!deliveryPrompt.orderId || !deliveryPrompt.deliveryPersonId || assigningDelivery) return;
    setAssigningDelivery(true);
    const ok = await assignDeliveryPerson(deliveryPrompt.orderId, deliveryPrompt.deliveryPersonId, true);
    if (ok) {
      onUpdateStatus(deliveryPrompt.orderId, 'delivery_person_id', deliveryPrompt.deliveryPersonId);
      onUpdateStatus(deliveryPrompt.orderId, 'status', 'delivering');
      setModal((prev: any) => prev?.id === deliveryPrompt.orderId
        ? { ...prev, delivery_person_id: deliveryPrompt.deliveryPersonId, status: 'delivering' }
        : prev);
      setDeliveryPrompt({ open: false, orderId: null, deliveryPersonId: '' });
    }
    setAssigningDelivery(false);
  }

  async function handlePaymentUpdate(orderId: any, updates: any) {
    if (onUpdatePayment) {
      await onUpdatePayment(orderId, updates);
    } else {
      // fallback: update fields one by one
      for (const [field, value] of Object.entries(updates)) {
        onUpdateStatus(orderId, field, value);
      }
    }
    setModal((prev: any) => prev?.id === orderId ? { ...prev, ...updates } : prev);
  }

  async function handleAddressUpdate(orderId: any, updates: any) {
    onUpdateStatus(orderId, 'delivery_street', updates.delivery_street || null);
    onUpdateStatus(orderId, 'delivery_number', updates.delivery_number || null);
    onUpdateStatus(orderId, 'delivery_complement', updates.delivery_complement || null);
    onUpdateStatus(orderId, 'delivery_neighborhood', updates.delivery_neighborhood || null);
    onUpdateStatus(orderId, 'delivery_city', updates.delivery_city || null);
    onUpdateStatus(orderId, 'delivery_zipcode', updates.delivery_zipcode || null);
    setModal((prev: any) => prev?.id === orderId ? { ...prev, ...updates } : prev);
  }

  async function handleItemsUpdate(orderId: any, nextItems: any) {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'update_order_items', data: { id: orderId, items: nextItems } }),
    });
    const d = await res.json();
    if (!res.ok || d.error) {
      throw new Error(d.error || 'Erro ao atualizar itens');
    }

    const refreshedItems = Array.isArray(d.items) ? d.items : [];
    setItems(refreshedItems);
    setItemsByOrder((prev: any) => ({ ...prev, [orderId]: refreshedItems }));

    const totalsUpdate = {
      subtotal: d.subtotal,
      total: d.total,
    };
    onUpdateStatus(orderId, 'subtotal', d.subtotal);
    onUpdateStatus(orderId, 'total', d.total);
    setModal((prev: any) => prev?.id === orderId ? { ...prev, ...totalsUpdate } : prev);

    if (onRefreshOrders) onRefreshOrders();
  }

  function handlePrint(type = 'balcao') {
    if (!modal) return;
    const body = items.map((i: any) =>
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
        `  ${(PM as any)[modal.payment_method]?.label || modal.payment_method || ''}`,
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
        `  ${(PM as any)[modal.payment_method]?.label || modal.payment_method || ''}`,
        `════════════════════════`,
        modal.observations ? `  OBS: ${modal.observations}` : '',
      ].filter(l => l !== undefined).join('\n');
    }

    const fontSize = type === 'cozinha' ? '16px' : '13px';
    const w = window.open('', '_blank', 'width=400,height=600');
    if (w) {
      w.document.write(`<html><body><pre style="font-family:monospace;font-size:${fontSize};padding:16px;white-space:pre">${txt}</pre><script>window.onload=()=>window.print()<\/script></body></html>`);
      w.document.close();
    }
  }

  const hasScheduled   = visible.some((o: any) => o.status === 'scheduled');
  const preparing_count = visible.filter((o: any) => ['confirmed', 'preparing', 'ready'].includes(o.status)).length;
  const cols = COLUMNS.filter((c: any) => c.id !== 'agendados' || hasScheduled);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#F1F3F5', overflow: 'hidden' }}>

      {/* ── Barra superior ────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '9px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 8, overflowX: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ShoppingBag size={18} color="#D97706" />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>PDV</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 7, marginLeft: 6, flexShrink: 0 }}>
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

        {/* Toggle Kanban / Cozinha / Histórico / Entregas */}
        <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid #E5E7EB', flexShrink: 0, marginLeft: 'auto' }}>
          {[
            { key: 'kanban',   label: 'Kanban',    icon: <ChefHat size={13} /> },
            { key: 'cozinha',  label: 'Cozinha',   icon: <PackageCheck size={13} /> },
            { key: 'lista',    label: 'Histórico', icon: <LayoutList size={13} /> },
            { key: 'entregas', label: '🚴 Entregas', icon: null },
          ].map((m, i) => (
            <button key={m.key}
              onClick={() => setViewMode(m.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', border: 'none', borderLeft: i > 0 ? '1px solid #E5E7EB' : 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: viewMode === m.key ? (m.key === 'cozinha' ? '#1C1C1E' : m.key === 'entregas' ? '#7C3AED' : '#111827') : '#fff',
                color: viewMode === m.key ? (m.key === 'cozinha' ? '#F59E0B' : '#fff') : '#6B7280',
              }}
            >
              {m.icon} {m.label}
              {m.key === 'cozinha' && preparing_count > 0 && (
                <span style={{ fontSize: 9, fontWeight: 900, background: '#2563EB', color: '#fff', borderRadius: 8, padding: '1px 5px', marginLeft: 2 }}>
                  {preparing_count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Indicador de data atual */}
        {viewMode === 'kanban' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#F3F4F6', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap' }}>
            <Calendar size={12} color="#6B7280" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>· pedidos de hoje + abertos &lt;24h</span>
          </div>
        )}

        {/* Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9CA3AF', minWidth: 52, justifyContent: 'flex-end', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: loading ? '#F59E0B' : '#10B981' }} />
          {countdown}s
        </div>

        {/* Refresh */}
        <button onClick={() => { onRefresh(); setCountdown(10); }} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 4, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
          <RefreshCw size={12} style={loading ? { animation: 'kdsSpin 1s linear infinite' } : {}} />
          Atualizar
        </button>

        {/* Som */}
        <button onClick={() => setSoundOn(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 4, border: '1px solid ' + (soundOn ? '#A7F3D0' : '#E5E7EB'), background: soundOn ? '#ECFDF5' : '#F9FAFB', color: soundOn ? '#059669' : '#9CA3AF', fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
          {soundOn ? 'Som' : 'Mudo'}
        </button>

        {/* Novo Pedido */}
        <button onClick={() => setShowDrawer(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 4, border: 'none', background: '#111827', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
          <Plus size={13} /> Novo Pedido
        </button>
      </div>

      {/* ── Vista Cozinha KDS ─────────────────────────────────────────────── */}
      {viewMode === 'cozinha' && (
        <KitchenKDS
          orders={visibleWithItems}
          onMarkReady={(id: any) => handleAction(id, 'status', 'ready')}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
        />
      )}

      {/* ── Vista Kanban ──────────────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div
          style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '12px 16px', display: 'flex', gap: 11, alignItems: 'stretch' }}
          onDragEnd={() => setDragging(null)}
        >
          {cols.map(col => (
            <KDSColumn
              key={col.id}
              col={col}
              orders={visibleWithItems}
              onCardClick={openModal}
              newIds={newIds}
              readyIds={readyIds}
              onDragStart={(order: any) => setDragging(order)}
              deliveryPersonsById={deliveryPersonsById}
              onDrop={(targetStatus: any) => {
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
            adminToken={adminToken}
          />
        </div>
      )}

      {/* ── Vista Gestão de Entregas ──────────────────────────────────────── */}
      {viewMode === 'entregas' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#1A1A1A' }}>
          <DeliveryQueueTab adminToken={adminToken} />
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
          onPaymentUpdate={(updates: any) => handlePaymentUpdate(modal.id, updates)}
          onAddressUpdate={(updates: any) => handleAddressUpdate(modal.id, updates)}
          onItemsUpdate={(nextItems: any) => handleItemsUpdate(modal.id, nextItems)}
          onPrint={handlePrint}
          adminToken={adminToken}
          customerOrderCount={customerOrderCount}
          deliveryPersons={deliveryPersons}
          onAssignDeliveryPerson={assignDeliveryPerson}
          onEnsureDeliveryPersons={ensureDeliveryPersons}
          products={products || []}
          drinks={drinks || []}
        />
      )}

      {deliveryPrompt.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 430, background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Atribuição obrigatória de entregador</h3>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
              Para mover o pedido para <strong>Em entrega</strong>, selecione quem saiu para entrega.
            </p>
            <select
              value={deliveryPrompt.deliveryPersonId}
              onChange={e => setDeliveryPrompt((prev: any) => ({ ...prev, deliveryPersonId: e.target.value }))}
              style={{ width: '100%', padding: '9px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, marginBottom: 12 }}
            >
              <option value="">— Selecione o entregador —</option>
              {deliveryPersons.map((dp: any) => (
                <option key={dp.id} value={dp.id}>{dp.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeliveryPrompt({ open: false, orderId: null, deliveryPersonId: '' })}
                style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#6B7280', cursor: 'pointer', fontSize: 12 }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmStartDelivery}
                disabled={!deliveryPrompt.deliveryPersonId || assigningDelivery}
                style={{ padding: '8px 12px', borderRadius: 7, border: 'none', background: (!deliveryPrompt.deliveryPersonId || assigningDelivery) ? '#9CA3AF' : '#7C3AED', color: '#fff', cursor: (!deliveryPrompt.deliveryPersonId || assigningDelivery) ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                {assigningDelivery ? 'Confirmando...' : 'Confirmar saída para entrega'}
              </button>
            </div>
          </div>
        </div>
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
        @keyframes kdsReadyPulse {
          0%, 100% { box-shadow: 0 0 0 2px #F59E0B40, 0 2px 8px rgba(245,158,11,0.25); }
          50%       { box-shadow: 0 0 0 4px #F59E0B60, 0 2px 12px rgba(245,158,11,0.4); }
        }
      `}</style>
    </div>
  );
});

export default KDSBoard;
