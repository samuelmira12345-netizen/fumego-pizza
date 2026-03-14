'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Check, Loader2, X, Trash2, RefreshCw,
  Tag, BarChart2, Clock, Users, TrendingUp, TrendingDown,
  DollarSign, Gift, Calendar, ChevronDown, ChevronUp,
  Truck, CreditCard, Smartphone, Banknote, AlertTriangle,
  Copy, Eye, EyeOff, Filter, Edit2,
} from 'lucide-react';
import DateRangePicker from './DateRangePicker';

const C = {
  bg: '#F4F5F7', card: '#fff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  gold: '#F2A800', success: '#10B981', danger: '#EF4444',
  purple: '#7C3AED', blue: '#2563EB',
};

function fmtBRL(v: any): string {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: any): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(iso: any): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const PAYMENT_OPTIONS = [
  { key: 'pix',           label: 'PIX',              icon: Smartphone },
  { key: 'cash',          label: 'Dinheiro',          icon: Banknote },
  { key: 'card_delivery', label: 'Cartão (entrega)',  icon: CreditCard },
  { key: 'card_online',   label: 'Cartão (online)',   icon: CreditCard },
];

const BLANK_COUPON = {
  name: '',
  code: '',
  discount_type: 'percent',  // 'percent' | 'fixed' | 'free_delivery'
  discount_percent: '',
  discount_fixed: '',
  min_order_value: '',
  usage_limit: '',
  max_uses_per_cpf: '',
  valid_until: '',
  is_active: true,
  is_first_order_only: false,
  new_customers_only: false,
  is_free_delivery: false,
  available_days: [],         // [] = all days
  payment_methods: [],        // [] = all methods
};

// ── Mini bar chart ──────────────────────────────────────────────────────────

function BarChartSimple({ data, color = C.gold, height = 60 }: { data: { label: string; value: number }[]; color?: string; height?: number }) {
  if (!data || data.length === 0) return <p style={{ fontSize: 12, color: C.light, textAlign: 'center', padding: 16 }}>Sem dados</p>;
  const max = Math.max(...data.map((d: { label: string; value: number }) => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: color, height: Math.max((d.value / max) * (height - 16), d.value > 0 ? 2 : 0) }} title={`${d.label}: ${d.value}`} />
          <span style={{ fontSize: 9, color: C.light, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Coupon form ──────────────────────────────────────────────────────────────

function CouponForm({ initial, onSave, onCancel, saving }: { initial: any, onSave: any, onCancel: any, saving: any }) {
  const [form, setForm] = useState(() => {
    const base = initial || { ...BLANK_COUPON };
    return {
      ...base,
      available_days: Array.isArray(base.available_days) ? base.available_days : [],
      payment_methods: Array.isArray(base.payment_methods) ? base.payment_methods : [],
    };
  });

  function set(field: any, value: any) { setForm((prev: any) => ({ ...prev, [field]: value })); }

  function toggleDay(day: any) {
    setForm((prev: any) => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter((d: any) => d !== day)
        : [...prev.available_days, day],
    }));
  }

  function togglePayment(method: any) {
    setForm((prev: any) => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(method)
        ? prev.payment_methods.filter((m: any) => m !== method)
        : [...prev.payment_methods, method],
    }));
  }

  function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    set('code', code);
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', background: '#F9FAFB', color: C.text, boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 };

  return (
    <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, padding: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag size={16} color={C.gold} /> {initial?.id ? 'Editar Cupom' : 'Novo Cupom'}
      </h3>

      {/* Row 1: Name + Code */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Nome do Cupom *</label>
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex: Black Friday 20%" />
        </div>
        <div>
          <label style={labelStyle}>Código do Cupom *</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={{ ...inputStyle, flex: 1, textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: 2 }}
              value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="BLACKFRIDAY20" />
            <button onClick={generateCode} title="Gerar código aleatório"
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, background: '#F3F4F6', cursor: 'pointer', color: C.muted, fontSize: 11 }}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Discount type + value */}
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Tipo de Desconto</label>
          <select style={inputStyle} value={form.discount_type} onChange={e => set('discount_type', e.target.value)}>
            <option value="percent">Percentual (%)</option>
            <option value="fixed">Valor fixo (R$)</option>
            <option value="free_delivery">Entrega grátis</option>
          </select>
        </div>
        {form.discount_type === 'percent' && (
          <div>
            <label style={labelStyle}>Desconto (%)</label>
            <input style={inputStyle} type="number" min="0" max="100" step="0.01" value={form.discount_percent} onChange={e => set('discount_percent', e.target.value)} placeholder="10" />
          </div>
        )}
        {form.discount_type === 'fixed' && (
          <div>
            <label style={labelStyle}>Valor do Desconto (R$)</label>
            <input style={inputStyle} type="number" min="0" step="0.01" value={form.discount_fixed} onChange={e => set('discount_fixed', e.target.value)} placeholder="15,00" />
          </div>
        )}
        {form.discount_type === 'free_delivery' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
            <Truck size={16} color={C.success} />
            <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>Entrega grátis para o cliente</span>
          </div>
        )}
        <div>
          <label style={labelStyle}>Pedido Mínimo (R$)</label>
          <input style={inputStyle} type="number" min="0" step="0.01" value={form.min_order_value} onChange={e => set('min_order_value', e.target.value)} placeholder="Sem mínimo" />
        </div>
      </div>

      {/* Row 3: Limits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Total de Cupons Disponíveis</label>
          <input style={inputStyle} type="number" min="0" step="1" value={form.usage_limit} onChange={e => set('usage_limit', e.target.value)} placeholder="Ilimitado" />
        </div>
        <div>
          <label style={labelStyle}>Máx. Usos por CPF</label>
          <input style={inputStyle} type="number" min="0" step="1" value={form.max_uses_per_cpf} onChange={e => set('max_uses_per_cpf', e.target.value)} placeholder="Ilimitado" />
        </div>
        <div>
          <label style={labelStyle}>Validade (data/hora limite)</label>
          <input style={inputStyle} type="datetime-local" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
        </div>
      </div>

      {/* Row 4: Restrictions */}
      <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 14, marginBottom: 14, border: '1px solid ' + C.border }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Restrições</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: C.text }}>
            <input type="checkbox" checked={form.new_customers_only} onChange={e => set('new_customers_only', e.target.checked)} />
            Apenas novos clientes
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: C.text }}>
            <input type="checkbox" checked={form.is_first_order_only} onChange={e => set('is_first_order_only', e.target.checked)} />
            Apenas primeiro pedido
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: C.text }}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Cupom ativo
          </label>
        </div>
      </div>

      {/* Row 5: Available days */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Disponível nos Dias (vazio = todos os dias)</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAY_KEYS.map((day, i) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              style={{
                padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid ' + (form.available_days.includes(day) ? C.purple : C.border),
                background: form.available_days.includes(day) ? '#EDE9FE' : '#F9FAFB',
                color: form.available_days.includes(day) ? C.purple : C.muted,
              }}
            >
              {DAYS_PT[i]}
            </button>
          ))}
        </div>
      </div>

      {/* Row 6: Payment methods */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Formas de Pagamento (vazio = todas)</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PAYMENT_OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => togglePayment(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid ' + (form.payment_methods.includes(key) ? C.blue : C.border),
                background: form.payment_methods.includes(key) ? '#EFF6FF' : '#F9FAFB',
                color: form.payment_methods.includes(key) ? C.blue : C.muted,
              }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.code || !form.name}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', background: saving ? '#9CA3AF' : C.gold, color: '#000', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: (!form.code || !form.name) ? 0.5 : 1 }}
        >
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
          {saving ? 'Salvando...' : 'Salvar Cupom'}
        </button>
        {onCancel && (
          <button onClick={onCancel} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid ' + C.border, background: '#fff', color: C.text, fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Coupon Card (single coupon display) ──────────────────────────────────────

function CouponCard({ coupon, usage, onDelete, onToggle, onEdit }: { coupon: any, usage: any, onDelete: any, onToggle: any, onEdit: any }) {
  const [expanded, setExpanded] = useState(false);

  const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
  const usageCount = coupon.times_used || 0;
  const limitPct = coupon.usage_limit ? Math.min((usageCount / coupon.usage_limit) * 100, 100) : null;

  function discountLabel() {
    if (coupon.discount_type === 'free_delivery' || coupon.is_free_delivery) return '🚚 Entrega Grátis';
    if (coupon.discount_percent > 0) return `${parseFloat(coupon.discount_percent).toFixed(0)}% OFF`;
    if (coupon.discount_fixed > 0) return `${fmtBRL(coupon.discount_fixed)} OFF`;
    return '—';
  }

  const statusColor = !coupon.is_active ? C.muted : isExpired ? C.danger : C.success;
  const statusLabel = !coupon.is_active ? 'Inativo' : isExpired ? 'Expirado' : 'Ativo';

  return (
    <div style={{
      background: C.card, borderRadius: 10, border: `1px solid ${coupon.is_active && !isExpired ? C.border : '#FECACA'}`,
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* Header row */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Discount badge */}
        <div style={{ background: coupon.is_active && !isExpired ? 'rgba(242,168,0,0.12)' : '#F3F4F6', borderRadius: 8, padding: '8px 12px', textAlign: 'center', minWidth: 80, flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: coupon.is_active && !isExpired ? C.gold : C.muted }}>{discountLabel()}</p>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coupon.name || coupon.code}</p>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: statusColor + '20', color: statusColor }}>{statusLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{ fontSize: 12, fontWeight: 700, color: C.purple, background: '#EDE9FE', padding: '2px 8px', borderRadius: 4, letterSpacing: 1 }}>{coupon.code}</code>
            <button onClick={() => navigator.clipboard?.writeText(coupon.code)} title="Copiar código" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.light, padding: 2 }}>
              <Copy size={12} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{usageCount} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>uso{usageCount !== 1 ? 's' : ''}</span></p>
          {coupon.usage_limit && <p style={{ fontSize: 11, color: C.muted }}>/ {coupon.usage_limit} disponíveis</p>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onToggle(coupon)} title={coupon.is_active ? 'Desativar' : 'Ativar'} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid ' + C.border, background: '#fff', cursor: 'pointer', color: C.muted }}>
            {coupon.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button onClick={() => onEdit && onEdit(coupon)} title="Editar cupom" style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid ' + C.border, background: '#fff', cursor: 'pointer', color: C.muted }}>
            <Edit2 size={13} />
          </button>
          <button onClick={() => setExpanded(v => !v)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid ' + C.border, background: '#fff', cursor: 'pointer', color: C.muted }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={() => onDelete(coupon.id)} title="Excluir" style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', color: C.danger }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Usage bar */}
      {limitPct !== null && (
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ height: 4, borderRadius: 2, background: '#F3F4F6', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${limitPct}%`, background: limitPct >= 90 ? C.danger : limitPct >= 70 ? '#D97706' : C.success, borderRadius: 2 }} />
          </div>
          <p style={{ fontSize: 10, color: C.light, marginTop: 3 }}>{usageCount} de {coupon.usage_limit} usos utilizados ({limitPct.toFixed(0)}%)</p>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: '1px solid ' + C.border, padding: '12px 16px', background: '#FAFAFA' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: C.muted }}>
            {coupon.min_order_value > 0 && <span>Pedido mínimo: <strong style={{ color: C.text }}>{fmtBRL(coupon.min_order_value)}</strong></span>}
            {coupon.max_uses_per_cpf > 0 && <span>Máx. por CPF: <strong style={{ color: C.text }}>{coupon.max_uses_per_cpf}</strong></span>}
            {coupon.valid_until && <span>Válido até: <strong style={{ color: isExpired ? C.danger : C.text }}>{fmtDate(coupon.valid_until)}</strong></span>}
            {(coupon.new_customers_only || coupon.is_first_order_only) && <span style={{ color: C.purple, fontWeight: 600 }}>Apenas {coupon.new_customers_only ? 'novos clientes' : 'primeiro pedido'}</span>}
            {coupon.available_days?.length > 0 && (
              <span>Dias: <strong style={{ color: C.text }}>{coupon.available_days.map((d: any) => DAYS_PT[DAY_KEYS.indexOf(d)]).join(', ')}</strong></span>
            )}
            {coupon.payment_methods?.length > 0 && (
              <span>Pagamento: <strong style={{ color: C.text }}>{coupon.payment_methods.map((m: any) => PAYMENT_OPTIONS.find(p => p.key === m)?.label || m).join(', ')}</strong></span>
            )}
          </div>

          {/* Usage history */}
          {usage && usage.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Histórico de Uso</p>
              <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid ' + C.border, borderRadius: 6, overflow: 'hidden' }}>
                {usage.slice(0, 20).map((u: any, i: any) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, padding: '7px 10px', borderBottom: i < usage.length - 1 ? '1px solid ' + C.border + '60' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFAFA', fontSize: 11 }}>
                    <span style={{ color: C.text }}>{u.customer_name || 'Cliente'}</span>
                    <span style={{ color: C.muted }}>{u.cpf ? '***.' + u.cpf.slice(-6) : '—'}</span>
                    <span style={{ color: C.muted }}>{fmtDateShort(u.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main CouponsTab ──────────────────────────────────────────────────────────

export default function CouponsTab({ adminToken }: { adminToken: any }) {
  const [coupons, setCoupons]       = useState<any[]>([]);
  const [usage, setUsage]           = useState<any[]>([]);     // coupon_usage records
  const [orders, setOrders]         = useState<any[]>([]);     // orders with coupon
  const [loading, setLoading]       = useState(true);
  const [analyticsTab, setAnalyticsTab] = useState('overview'); // 'overview' | 'history' | 'charts'
  const [formMode, setFormMode]     = useState<any>(null); // null | 'new' | coupon_object (editing)
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'inactive' | 'expired'

  // Period selector for analytics
  const defaultEnd   = new Date().toISOString().slice(0, 10);
  const defaultStart = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [periodRange, setPeriodRange] = useState({ from: defaultStart, to: defaultEnd });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [couponRes, analyticsRes] = await Promise.all([
        fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'get_data' }),
        }),
        fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'get_coupon_analytics' }),
        }),
      ]);
      const couponData    = await couponRes.json();
      const analyticsData = await analyticsRes.json();
      setCoupons(couponData.coupons || []);
      setUsage(analyticsData.usage || []);
      setOrders(analyticsData.orders || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  // ── Analytics derived data ─────────────────────────────────────────────────

  const periodStartDt = periodRange.from ? new Date(periodRange.from + 'T00:00:00') : null;
  const periodEndDt   = periodRange.to   ? new Date(periodRange.to   + 'T23:59:59') : null;

  const ordersInPeriod = orders.filter(o => {
    const d = new Date(o.created_at);
    if (periodStartDt && d < periodStartDt) return false;
    if (periodEndDt   && d > periodEndDt)   return false;
    return true;
  });

  const totalDiscountGiven = ordersInPeriod.reduce((s, o) => s + (parseFloat(o.discount) || 0), 0);
  const totalRevenue = ordersInPeriod.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
  const couponOrders = ordersInPeriod.filter(o => o.coupon_code);
  const couponConversionRate = ordersInPeriod.length > 0 ? (couponOrders.length / ordersInPeriod.length * 100) : 0;
  const avgDiscountPerOrder = couponOrders.length > 0 ? totalDiscountGiven / couponOrders.length : 0;

  // Usage by coupon code in period
  const usageByCoupon: Record<string, any> = {};
  for (const o of couponOrders) {
    const code = o.coupon_code?.toUpperCase();
    if (!usageByCoupon[code]) usageByCoupon[code] = { count: 0, totalDiscount: 0, totalRevenue: 0 };
    usageByCoupon[code].count++;
    usageByCoupon[code].totalDiscount += parseFloat(o.discount) || 0;
    usageByCoupon[code].totalRevenue  += parseFloat(o.total) || 0;
  }

  // Usage by hour in period
  const usageByHour = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, '0')}h`, value: 0 }));
  for (const o of couponOrders) {
    const h = new Date(o.created_at).getHours();
    usageByHour[h].value++;
  }

  // Usage by day of week in period
  const usageByDay = DAYS_PT.map(d => ({ label: d, value: 0 }));
  for (const o of couponOrders) {
    const dow = new Date(o.created_at).getDay();
    usageByDay[dow].value++;
  }

  // Daily trend in period (last 14 days default)
  const dailyTrend: Record<string, any> = {};
  for (const o of couponOrders) {
    const day = o.created_at.slice(0, 10);
    if (!dailyTrend[day]) dailyTrend[day] = { count: 0, discount: 0 };
    dailyTrend[day].count++;
    dailyTrend[day].discount += parseFloat(o.discount) || 0;
  }
  const trendDays = Object.keys(dailyTrend).sort().slice(-14);
  const trendData = trendDays.map(d => ({
    label: new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    value: dailyTrend[d].count,
  }));

  // ── Coupon CRUD ───────────────────────────────────────────────────────────

  async function handleSaveCoupon(form: any) {
    setSaving(true);
    try {
      const payload = {
        name:                form.name,
        code:                form.code.toUpperCase(),
        discount_type:       form.discount_type,
        discount_percent:    form.discount_type === 'percent' ? parseFloat(form.discount_percent) || 0 : 0,
        discount_fixed:      form.discount_type === 'fixed'   ? parseFloat(form.discount_fixed)   || 0 : 0,
        is_free_delivery:    form.discount_type === 'free_delivery',
        min_order_value:     parseFloat(form.min_order_value) || null,
        usage_limit:         parseInt(form.usage_limit) || null,
        max_uses_per_cpf:    parseInt(form.max_uses_per_cpf) || null,
        valid_until:         form.valid_until || null,
        is_active:           form.is_active,
        is_first_order_only: form.is_first_order_only,
        new_customers_only:  form.new_customers_only,
        available_days:      form.available_days.length > 0 ? form.available_days : null,
        payment_methods:     form.payment_methods.length > 0 ? form.payment_methods : null,
      };
      const action = form.id ? 'update_coupon' : 'add_coupon';
      if (form.id) (payload as any).id = form.id;
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action, data: payload }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setMsg('✅ Cupom salvo!');
      setTimeout(() => setMsg(''), 3000);
      setFormMode(null);
      await load();
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDeleteCoupon(id: any) {
    if (!confirm('Excluir este cupom? Esta ação não pode ser desfeita.')) return;
    try {
      await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'delete_coupon', data: { id } }) });
      setCoupons(prev => prev.filter(c => c.id !== id));
      setMsg('✅ Cupom excluído');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) { alert('Erro: ' + (e as Error).message); }
  }

  async function handleToggleCoupon(coupon: any) {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'update_coupon', data: { id: coupon.id, is_active: !coupon.is_active } }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
    } catch (e) { alert('Erro: ' + (e as Error).message); }
  }

  // ── Filtered coupon list ──────────────────────────────────────────────────

  const filteredCoupons = coupons.filter(c => {
    const isExpired = c.valid_until && new Date(c.valid_until) < new Date();
    if (filterStatus === 'active'   && (!c.is_active || isExpired)) return false;
    if (filterStatus === 'inactive' && c.is_active) return false;
    if (filterStatus === 'expired'  && !isExpired) return false;
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <RefreshCw size={22} color={C.muted} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 10, color: C.muted }}>Carregando cupons...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag size={20} color={C.gold} /> Cupons
          </h2>
          <p style={{ fontSize: 13, color: C.muted }}>Gerencie descontos, analise o desempenho e acompanhe o histórico de uso.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: '1px solid ' + C.border, background: '#fff', fontSize: 13, cursor: 'pointer', color: C.text }}>
            <RefreshCw size={13} /> Atualizar
          </button>
          <button onClick={() => setFormMode('new')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: C.gold, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={14} /> Novo Cupom
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#065F46', fontWeight: 600 }}>{msg}</div>
      )}

      {/* Coupon form — new or editing */}
      {formMode !== null && (
        <div style={{ marginBottom: 24 }}>
          <CouponForm
            initial={formMode !== 'new' ? formMode : undefined}
            onSave={handleSaveCoupon}
            onCancel={() => setFormMode(null)}
            saving={saving}
          />
        </div>
      )}

      {/* ── Analytics KPI Cards ───────────────────────────────────────────── */}

      {/* Period selector */}
      <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Calendar size={14} color={C.gold} />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Análise do período:</span>
        <DateRangePicker value={periodRange} onChange={setPeriodRange} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 7 }}>
            <Tag size={14} color={C.gold} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cupons Ativos</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{coupons.filter(c => c.is_active && !(c.valid_until && new Date(c.valid_until) < new Date())).length}</p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{coupons.length} total cadastrados</p>
        </div>

        <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 7 }}>
            <DollarSign size={14} color={C.danger} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Desconto Dado</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.danger }}>{fmtBRL(totalDiscountGiven)}</p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>no período selecionado</p>
        </div>

        <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 7 }}>
            <TrendingUp size={14} color={C.success} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pedidos c/ Cupom</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{couponOrders.length}</p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{couponConversionRate.toFixed(1)}% dos pedidos</p>
        </div>

        <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 7 }}>
            <Gift size={14} color={C.purple} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Desconto Médio</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.purple }}>{fmtBRL(avgDiscountPerOrder)}</p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>por pedido com cupom</p>
        </div>
      </div>

      {/* ── Analytics Tab bar ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid ' + C.border, marginBottom: 20 }}>
        {[
          { key: 'overview', label: 'Visão Geral' },
          { key: 'charts',   label: 'Gráficos' },
          { key: 'history',  label: 'Histórico de Uso' },
        ].map(t => (
          <button key={t.key} onClick={() => setAnalyticsTab(t.key)} style={{
            padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: analyticsTab === t.key ? 700 : 500,
            color: analyticsTab === t.key ? C.text : C.muted,
            borderBottom: `2px solid ${analyticsTab === t.key ? C.gold : 'transparent'}`,
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {analyticsTab === 'overview' && (
        <>
          {/* Coupon performance table */}
          {Object.keys(usageByCoupon).length > 0 && (
            <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + C.border, background: '#F9FAFB' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Desempenho dos Cupons no Período</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 120px', background: '#F9FAFB', borderBottom: '1px solid ' + C.border, padding: '7px 16px' }}>
                {['Cupom', 'Usos', 'Desconto Total', 'Receita Gerada'].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.light, textTransform: 'uppercase', textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {Object.entries(usageByCoupon).sort((a: any, b: any) => b[1].count - a[1].count).map(([code, stats]: [string, any], i) => (
                <div key={code} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 120px', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid ' + C.border + '60', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <div>
                    <code style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>{code}</code>
                    {coupons.find(c => c.code === code) && (
                      <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{coupons.find(c => c.code === code)?.name}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'right' }}>{stats.count}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.danger, textAlign: 'right' }}>{fmtBRL(stats.totalDiscount)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.success, textAlign: 'right' }}>{fmtBRL(stats.totalRevenue)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Coupon list */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <Filter size={14} color={C.muted} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Filtrar:</span>
            {[
              { key: 'all',      label: 'Todos' },
              { key: 'active',   label: 'Ativos' },
              { key: 'inactive', label: 'Inativos' },
              { key: 'expired',  label: 'Expirados' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterStatus(f.key)} style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid ' + (filterStatus === f.key ? C.gold : C.border), background: filterStatus === f.key ? 'rgba(242,168,0,0.1)' : '#fff', color: filterStatus === f.key ? '#92400E' : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>{filteredCoupons.length} cupom{filteredCoupons.length !== 1 ? 'ões' : ''}</span>
          </div>

          {filteredCoupons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.light }}>
              <Tag size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhum cupom encontrado.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Crie seu primeiro cupom clicando em "Novo Cupom".</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredCoupons.map(coupon => (
                <CouponCard
                  key={coupon.id}
                  coupon={coupon}
                  usage={usage.filter(u => u.coupon_id === coupon.id)}
                  onDelete={handleDeleteCoupon}
                  onToggle={handleToggleCoupon}
                  onEdit={(c: any) => { setFormMode(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CHARTS TAB ────────────────────────────────────────────────────── */}
      {analyticsTab === 'charts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {/* Daily trend */}
          <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Uso de Cupons por Dia</p>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Pedidos com cupom nos últimos {trendDays.length} dias do período.</p>
            <BarChartSimple data={trendData} color={C.gold} height={80} />
            {trendData.length === 0 && <p style={{ fontSize: 12, color: C.light, textAlign: 'center', padding: 16 }}>Sem dados no período.</p>}
          </div>

          {/* Usage by hour */}
          <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Uso por Horário do Dia</p>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Concentração de pedidos com cupom por hora.</p>
            <BarChartSimple data={usageByHour} color={C.purple} height={80} />
          </div>

          {/* Usage by day of week */}
          <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Uso por Dia da Semana</p>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Distribuição semanal de uso de cupons.</p>
            <BarChartSimple data={usageByDay} color={C.blue} height={80} />
          </div>

          {/* Coupon comparison */}
          <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Comparação de Cupons</p>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Quantidade de usos por cupom no período.</p>
            <BarChartSimple
              data={Object.entries(usageByCoupon).sort((a: any, b: any) => b[1].count - a[1].count).slice(0, 10).map(([code, stats]: [string, any]) => ({ label: code, value: stats.count }))}
              color={C.success}
              height={80}
            />
          </div>

          {/* Financial impact */}
          <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Impacto Financeiro</p>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Receita vs Desconto dado no período.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Receita total (pedidos c/ cupom)', value: fmtBRL(couponOrders.reduce((s, o) => s + parseFloat(o.total || 0), 0) + totalDiscountGiven), color: C.success },
                { label: 'Desconto concedido', value: fmtBRL(totalDiscountGiven), color: C.danger },
                { label: 'Receita líquida', value: fmtBRL(couponOrders.reduce((s, o) => s + parseFloat(o.total || 0), 0)), color: C.text },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F9FAFB', borderRadius: 6 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Conversion rate card */}
          <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>Taxa de Conversão de Cupons</p>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 48, fontWeight: 900, color: couponConversionRate > 20 ? C.success : couponConversionRate > 5 ? C.gold : C.muted }}>{couponConversionRate.toFixed(1)}%</p>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>dos pedidos utilizaram cupom</p>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{couponOrders.length} de {ordersInPeriod.length} pedidos no período</p>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ───────────────────────────────────────────────────── */}
      {analyticsTab === 'history' && (
        <div style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + C.border, background: '#F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Histórico de Uso de Cupons</p>
            <span style={{ fontSize: 11, color: C.muted }}>{couponOrders.length} pedido{couponOrders.length !== 1 ? 's' : ''} com cupom no período</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 100px 120px', background: '#F9FAFB', borderBottom: '1px solid ' + C.border, padding: '7px 16px' }}>
            {['Data', 'Cliente', 'Cupom', 'Desconto', 'Total do Pedido'].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          {couponOrders.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: C.light }}>
              <p style={{ fontSize: 13 }}>Nenhum pedido com cupom no período selecionado.</p>
            </div>
          ) : (
            couponOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((order: any, i: any) => (
              <div key={order.id || i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 100px 120px', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid ' + C.border + '60', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{fmtDate(order.created_at)}</span>
                <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{order.customer_name || '—'}</span>
                <div>
                  <code style={{ fontSize: 12, fontWeight: 700, color: C.purple, background: '#EDE9FE', padding: '1px 6px', borderRadius: 4 }}>{order.coupon_code}</code>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.danger, textAlign: 'right' }}>{fmtBRL(order.discount)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'right' }}>{fmtBRL(order.total)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
