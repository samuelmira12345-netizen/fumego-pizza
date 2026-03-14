'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  ShoppingBag, DollarSign, TrendingUp, ChefHat,
  Truck, CheckCircle, XCircle, Clock, BarChart2, RefreshCw,
  Percent, CreditCard, Tag, AlertTriangle, Banknote, Zap,
  TrendingDown, ArrowUpRight, ArrowDownRight, Minus, Target,
  Star,
} from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import { costWithFC } from '@/lib/correction-factor';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSPDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function toSPHour(isoStr) {
  return parseInt(
    new Date(isoStr).toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false,
    })
  );
}
function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function yesterdaySP() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function lastWeekSameDaySP() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function currentHourSP() {
  return parseInt(new Date().toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false,
  }));
}
function weekdayShortSP(yyyymmdd) {
  return new Date(yyyymmdd + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' });
}
function fmtBRL(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(yyyymmdd) {
  if (!yyyymmdd) return '';
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}`;
}
function fmtMinutes(mins) {
  if (mins === null || mins === undefined) return '—';
  if (mins < 60) return `${Math.round(mins)}min`;
  return `${Math.floor(mins / 60)}h${Math.round(mins % 60) > 0 ? Math.round(mins % 60) + 'm' : ''}`;
}

// ── Gráfico de barras simples ─────────────────────────────────────────────────

function fmtShort(v, isCurrency) {
  if (!v) return '—';
  if (isCurrency) {
    if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
    return `R$${v.toFixed(0)}`;
  }
  return String(v);
}

function BarChart({ data, labelKey, valueKey, color = '#F2A800', formatValue, height = 220, isCurrency = false }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  const n = data.length;

  return (
    <div style={{ position: 'relative' }}>
      {hovered !== null && (
        <div style={{
          position: 'absolute',
          bottom: `${height + 38}px`,
          left: `clamp(60px, ${((hovered + 0.5) / n) * 100}%, calc(100% - 60px))`,
          transform: 'translateX(-50%)',
          background: '#111827', color: '#fff',
          padding: '7px 12px', borderRadius: 7,
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          zIndex: 20, pointerEvents: 'none',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{data[hovered][labelKey]}</div>
          <div style={{ color }}>
            {isCurrency ? fmtBRL(data[hovered][valueKey]) : data[hovered][valueKey]}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: height + 32, paddingTop: 28 }}>
        {data.map((item, i) => {
          const pct = max > 0 ? (item[valueKey] / max) * 100 : 0;
          const hasValue = item[valueKey] > 0;
          return (
            <div key={i}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end', position: 'relative', cursor: hasValue ? 'crosshair' : 'default' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{
                width: '100%',
                height: `${Math.max(pct, hasValue ? 3 : 0)}%`,
                background: hasValue ? color : '#F3F4F6',
                borderRadius: '5px 5px 0 0',
                transition: 'height 0.4s ease, opacity 0.15s',
                minHeight: hasValue ? 3 : 0,
                maxHeight: height,
                opacity: hovered !== null && hovered !== i ? 0.4 : 1,
              }} />
              <span style={{
                fontSize: 10, color: hovered === i ? '#374151' : '#9CA3AF',
                fontWeight: hovered === i ? 700 : 400,
                whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', textAlign: 'center', paddingBottom: 2,
              }}>
                {item[labelKey]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Gráfico duplo (barras de faturamento + linha de pedidos) ──────────────────

function DualChart({ data, height = 200 }) {
  const [hovered, setHovered] = useState(null);
  const n = data.length;
  if (n === 0) return null;

  const maxRev = Math.max(...data.map(d => d.revenue), 1);
  const maxCnt = Math.max(...data.map(d => d.count), 1);

  const W = 700, padL = 8, padR = 8, padT = 24, padB = 26;
  const chartW = W - padL - padR;
  const chartH = height - padT - padB;
  const slotW  = chartW / n;
  const barW   = slotW * 0.35;
  const gap    = slotW * 0.05;

  function revBarX(i) { return padL + i * slotW + (slotW - 2 * barW - gap) / 2; }
  function cntBarX(i) { return revBarX(i) + barW + gap; }
  function revBarH(v) { return Math.max((v / maxRev) * chartH * 0.88, v > 0 ? 3 : 0); }
  function cntBarH(v) { return Math.max((v / maxCnt) * chartH * 0.88, v > 0 ? 3 : 0); }
  function labelX(i)  { return padL + i * slotW + slotW * 0.5; }

  return (
    <div style={{ position: 'relative' }}>
      {/* Legenda */}
      <div style={{ display: 'flex', gap: 18, marginBottom: 8, fontSize: 11, color: '#6B7280' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 10, background: '#F2A800', borderRadius: 2, display: 'inline-block' }} />
          Faturamento
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 10, background: '#6366F1', borderRadius: 2, display: 'inline-block' }} />
          Pedidos
        </span>
      </div>

      {/* Tooltip */}
      {hovered !== null && (
        <div style={{
          position: 'absolute',
          top: 32,
          left: `clamp(80px, ${((hovered + 0.5) / n) * 100}%, calc(100% - 80px))`,
          transform: 'translateX(-50%)',
          background: '#111827', color: '#fff',
          padding: '8px 13px', borderRadius: 7,
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          zIndex: 20, pointerEvents: 'none',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{data[hovered].date}</div>
          <div style={{ color: '#F2A800', marginBottom: 2 }}>{fmtBRL(data[hovered].revenue)}</div>
          <div style={{ color: '#A5B4FC' }}>{data[hovered].count} pedido{data[hovered].count !== 1 ? 's' : ''}</div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${height}`}
        style={{ width: '100%', height: height + 8, display: 'block' }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Linhas de grade */}
        {[0.25, 0.5, 0.75, 1].map(p => {
          const y = padT + chartH - p * chartH * 0.88;
          return <line key={p} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F3F4F6" strokeWidth="1" />;
        })}

        {/* Barras de faturamento (dourado) */}
        {data.map((d, i) => {
          const bh = revBarH(d.revenue);
          return (
            <rect key={`rev-${i}`}
              x={revBarX(i)} y={padT + chartH - bh}
              width={barW} height={bh} rx={3}
              fill={d.revenue > 0 ? '#F2A800' : '#F3F4F6'}
              opacity={hovered !== null && hovered !== i ? 0.3 : 0.9}
            />
          );
        })}

        {/* Barras de pedidos (índigo) */}
        {data.map((d, i) => {
          const bh = cntBarH(d.count);
          return (
            <rect key={`cnt-${i}`}
              x={cntBarX(i)} y={padT + chartH - bh}
              width={barW} height={bh} rx={3}
              fill={d.count > 0 ? '#6366F1' : '#F3F4F6'}
              opacity={hovered !== null && hovered !== i ? 0.3 : 0.9}
            />
          );
        })}

        {/* X labels */}
        {data.map((d, i) => (
          <text key={i} x={labelX(i)} y={height - 4} textAnchor="middle" fontSize="10"
            fill={hovered === i ? '#374151' : '#9CA3AF'}
            fontWeight={hovered === i ? '700' : '400'}>
            {d.date}
          </text>
        ))}

        {/* Zonas de hover transparentes (sobre tudo) */}
        {data.map((d, i) => (
          <rect key={`hz-${i}`}
            x={padL + i * slotW} y={padT}
            width={slotW} height={chartH}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHovered(i)}
          />
        ))}
      </svg>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, iconColor, iconBg, label, value, sub, highlight, delta, deltaLabel }) {
  const hasDelta = delta !== null && delta !== undefined;
  const isPositive = delta > 0;
  const isNeutral  = delta === 0;

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column',
      gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg || 'rgba(242,168,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={iconColor || '#F2A800'} />
        </div>
        {hasDelta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
            color: isNeutral ? '#9CA3AF' : isPositive ? '#10B981' : '#EF4444' }}>
            {isNeutral ? <Minus size={12} /> : isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta).toFixed(0)}%
          </div>
        )}
      </div>
      <div>
        <p style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: 21, fontWeight: 700, color: highlight || '#111827', lineHeight: 1.2, wordBreak: 'break-all' }}>
          {value}
        </p>
        {(sub || deltaLabel) && (
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{deltaLabel || sub}</p>
        )}
      </div>
    </div>
  );
}

// ── Section Title ─────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 }}>
      {children}
    </p>
  );
}

// ── Payment Method Card ───────────────────────────────────────────────────────

const PM_META = {
  pix:          { label: 'PIX',               icon: Zap,        color: '#3B82F6' },
  cash:         { label: 'Dinheiro',          icon: Banknote,   color: '#10B981' },
  card_delivery:{ label: 'Cartão na Entrega', icon: CreditCard, color: '#8B5CF6' },
};

function PaymentMethodCard({ method, count, revenue, total }) {
  const meta  = PM_META[method] || { label: method, icon: CreditCard, color: '#6B7280' };
  const Icon  = meta.icon;
  const pct   = total > 0 ? ((count / total) * 100) : 0;

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '16px 18px',
      border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: meta.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={meta.color} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{meta.label}</p>
          <p style={{ fontSize: 11, color: '#9CA3AF' }}>{pct.toFixed(0)}% dos pedidos</p>
        </div>
      </div>
      <p style={{ fontSize: 20, fontWeight: 700, color: meta.color, marginBottom: 2 }}>{count}</p>
      <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>pedidos · {fmtBRL(revenue)}</p>
      <div style={{ height: 4, borderRadius: 2, background: '#E5E7EB' }}>
        <div style={{ height: '100%', borderRadius: 2, background: meta.color, width: `${pct}%`, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard({ orders, onRefresh, loading, adminToken }) {
  const today     = todaySP();
  const yesterday = yesterdaySP();

  const [dateRange, setDateRange] = useState({ from: today, to: today, fromTime: '00:00', toTime: '23:59' });

  // ── Ingredients + Recipes for CMV ─────────────────────────────────────────
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes]         = useState({});

  useEffect(() => {
    if (!adminToken) return;
    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'get_catalog_extra' }),
    })
      .then(r => r.json())
      .then(extra => {
        setIngredients(extra.ingredients || []);
        const map = {};
        for (const item of (extra.recipes || [])) {
          if (!map[item.product_id]) map[item.product_id] = [];
          map[item.product_id].push({ ingredient_id: item.ingredient_id, quantity: item.quantity });
        }
        setRecipes(map);
      })
      .catch(() => {});
  }, [adminToken]);
  const dateFrom = dateRange.from;
  const dateTo   = dateRange.to;

  // Derived "mode" for comparativo lógico
  const filterMode = dateFrom === today && dateTo === today ? 'today'
    : dateFrom === yesterday && dateTo === yesterday ? 'yesterday'
    : 'custom';

  const periodLabel =
    filterMode === 'today'     ? 'hoje'  :
    filterMode === 'yesterday' ? 'ontem' :
    dateFrom === dateTo        ? fmtDate(dateFrom) :
    `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`;

  const metrics = useMemo(() => {
    const lastWeekDate  = lastWeekSameDaySP();
    const currentHour   = currentHourSP();
    const openHour  = 10;
    const closeHour = 23;

    // Pedidos do período selecionado
    let todayOrders;
    if (filterMode === 'today') {
      todayOrders = orders.filter(o => toSPDate(o.created_at) === today);
    } else if (filterMode === 'yesterday') {
      todayOrders = orders.filter(o => toSPDate(o.created_at) === yesterday);
    } else {
      todayOrders = orders.filter(o => { const d = toSPDate(o.created_at); return d >= dateFrom && d <= dateTo; });
    }

    // Comparativo: mesmo dia da semana anterior, mesmo horário (só no modo "hoje")
    const lastWeekOrders = filterMode === 'today'
      ? orders.filter(o => toSPDate(o.created_at) === lastWeekDate && toSPHour(o.created_at) <= currentHour)
      : [];

    // Todos os pedidos do mesmo dia da semana anterior (para projeção)
    const lastWeekAllOrders = filterMode === 'today'
      ? orders.filter(o => toSPDate(o.created_at) === lastWeekDate)
      : [];

    // ── Helpers de agregação ──────────────────────────────────────────────
    function agg(list) {
      const active    = list.filter(o => o.status !== 'cancelled');
      const revenue   = active.reduce((s, o) => s + (parseFloat(o.total)        || 0), 0);
      const subtotal  = active.reduce((s, o) => s + (parseFloat(o.subtotal)     || 0), 0);
      const discount  = active.reduce((s, o) => s + (parseFloat(o.discount)     || 0), 0);
      const delivFee  = active.reduce((s, o) => s + (parseFloat(o.delivery_fee) || 0), 0);
      const cancelled = list.filter(o => o.status === 'cancelled').length;
      const cancelPct = list.length > 0 ? (cancelled / list.length) * 100 : 0;
      const avgTicket = active.length > 0 ? revenue / active.length : 0;

      const byStatus  = (s) => list.filter(o => o.status === s).length;
      const byPayment = {};
      for (const o of active) {
        const pm = o.payment_method || 'pix';
        if (!byPayment[pm]) byPayment[pm] = { count: 0, revenue: 0 };
        byPayment[pm].count++;
        byPayment[pm].revenue += parseFloat(o.total) || 0;
      }
      const awaitingPix = list.filter(o =>
        o.payment_method === 'pix' &&
        o.payment_status === 'pending' &&
        !['cancelled', 'delivered'].includes(o.status)
      ).length;

      return {
        total: list.length, active: active.length, revenue, subtotal,
        discount, delivFee, cancelled, cancelPct, avgTicket, byStatus, byPayment,
        awaitingPix, pending: byStatus('pending'),
        inProduction: byStatus('confirmed') + byStatus('preparing'),
        inDelivery: byStatus('delivering'),
        delivered: byStatus('delivered'),
      };
    }

    const td = agg(todayOrders);
    const lw = agg(lastWeekOrders);       // mesma semana, mesmo horário
    const lwAll = agg(lastWeekAllOrders); // mesma semana, dia completo

    // Delta % vs semana passada (mesma hora)
    function delta(todayV, lwV) {
      if (lwV === 0) return null;
      return ((todayV - lwV) / lwV) * 100;
    }

    // Label do comparativo
    const lwDayShort  = weekdayShortSP(lastWeekDate);
    const deltaLabel  = filterMode === 'today' ? `${lwDayShort} passado` : null;

    // ── Tempo médio de produção ───────────────────────────────────────────
    const ordersWithProd = todayOrders.filter(o =>
      o.delivering_at && o.status !== 'cancelled'
    );
    const avgProductionMins = ordersWithProd.length > 0
      ? ordersWithProd.reduce((s, o) =>
          s + (new Date(o.delivering_at) - new Date(o.created_at)) / 60000, 0
        ) / ordersWithProd.length
      : null;

    // Produção semana passada (mesma janela de horário)
    const lwWithProd = lastWeekOrders.filter(o => o.delivering_at && o.status !== 'cancelled');
    const avgProductionMinsLW = lwWithProd.length > 0
      ? lwWithProd.reduce((s, o) =>
          s + (new Date(o.delivering_at) - new Date(o.created_at)) / 60000, 0
        ) / lwWithProd.length
      : null;

    // ── Projeção de faturamento (só em "hoje") ────────────────────────────
    const elapsedHours    = Math.max(0, currentHour - openHour);
    const remainingHours  = Math.max(0, closeHour - currentHour);
    const revenuePerHour  = elapsedHours >= 1 ? td.revenue / elapsedHours : 0;
    const projectedRevenue = filterMode === 'today' && elapsedHours >= 1
      ? td.revenue + revenuePerHour * remainingHours
      : null;
    const projectionDelta = projectedRevenue !== null && lwAll.revenue > 0
      ? ((projectedRevenue - lwAll.revenue) / lwAll.revenue) * 100
      : null;

    // ── Vendas por hora ───────────────────────────────────────────────────
    const isSingleDay = filterMode !== 'custom' || dateFrom === dateTo;
    const hourlyData = Array.from({ length: 14 }, (_, i) => {
      const h = i + 10;
      const total = isSingleDay
        ? todayOrders
            .filter(o => o.status !== 'cancelled' && toSPHour(o.created_at) === h)
            .reduce((s, o) => s + (parseFloat(o.total) || 0), 0)
        : 0;
      return { hour: `${String(h).padStart(2,'0')}h`, total };
    });

    // Receita por dia (período multi-dia)
    let dailyData = null;
    if (!isSingleDay) {
      const days = [];
      const start = new Date(dateFrom + 'T12:00:00');
      const end   = new Date(dateTo   + 'T12:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(d.toLocaleDateString('en-CA'));
      }
      dailyData = days.map(date => ({
        date: fmtDate(date),
        total: orders.filter(o => toSPDate(o.created_at) === date && o.status !== 'cancelled')
                     .reduce((s, o) => s + (parseFloat(o.total) || 0), 0),
      }));
    }

    // ── Últimos 7 dias — dados para o gráfico duplo ───────────────────────
    const refDate = filterMode === 'today' ? today : filterMode === 'yesterday' ? yesterday : dateTo;
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(refDate + 'T12:00:00');
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('en-CA');
    });
    const dualWeeklyData = last7.map(date => ({
      date:    fmtDate(date),
      revenue: orders
        .filter(o => toSPDate(o.created_at) === date && o.status !== 'cancelled')
        .reduce((s, o) => s + (parseFloat(o.total) || 0), 0),
      count: orders.filter(o => toSPDate(o.created_at) === date && o.status !== 'cancelled').length,
    }));

    return {
      td, lw, lwAll, delta, deltaLabel,
      avgProductionMins, avgProductionMinsLW,
      projectedRevenue, projectionDelta,
      hourlyData, isSingleDay, dailyData, dualWeeklyData,
    };
  }, [orders, today, yesterday, filterMode, dateFrom, dateTo]);

  const {
    td, lw, lwAll, delta, deltaLabel,
    avgProductionMins, avgProductionMinsLW,
    projectedRevenue, projectionDelta,
    hourlyData, isSingleDay, dailyData, dualWeeklyData,
  } = metrics;

  // ── Sabores mais rentáveis (CMV) ──────────────────────────────────────────
  const topFlavors = useMemo(() => {
    if (!ingredients.length || !Object.keys(recipes).length) return [];

    // Sales per product name in current period (from order items)
    const salesMap = {}; // productName → { qty, revenue }
    const periodOrders = (() => {
      if (filterMode === 'today') return orders.filter(o => toSPDate(o.created_at) === today);
      if (filterMode === 'yesterday') return orders.filter(o => toSPDate(o.created_at) === yesterday);
      return orders.filter(o => { const d = toSPDate(o.created_at); return d >= dateFrom && d <= dateTo; });
    })();
    for (const o of periodOrders.filter(o => o.status !== 'cancelled')) {
      const items = Array.isArray(o.items) ? o.items : (typeof o.items === 'string' ? (() => { try { return JSON.parse(o.items); } catch { return []; } })() : []);
      for (const it of items) {
        const name = it.name || it.productName || it.product_name || '';
        if (!name) continue;
        if (!salesMap[name]) salesMap[name] = { qty: 0, revenue: 0 };
        salesMap[name].qty     += (it.quantity || it.qty || 1);
        salesMap[name].revenue += (it.price || it.unit_price || 0) * (it.quantity || it.qty || 1);
      }
    }

    // For each product that has recipes, compute CMV
    const result = [];
    for (const [productIdStr, recipeItems] of Object.entries(recipes)) {
      const cmv = recipeItems.reduce((s, ri) => {
        const ing = ingredients.find(g => g.id === ri.ingredient_id || String(g.id) === String(ri.ingredient_id));
        return s + (parseFloat(ri.quantity) || 0) * costWithFC((parseFloat(ing?.cost_per_unit) || 0), ing?.correction_factor);
      }, 0);
      if (cmv <= 0) continue;

      // Try to match recipe product to a sales entry — we need a product name for this product_id
      // Use orders items to find a matching product_id or product_name
      let bestName = null;
      for (const o of periodOrders) {
        const items = Array.isArray(o.items) ? o.items : (typeof o.items === 'string' ? (() => { try { return JSON.parse(o.items); } catch { return []; } })() : []);
        const match = items.find(it => String(it.product_id || it.productId) === productIdStr);
        if (match) { bestName = match.name || match.productName || match.product_name; break; }
      }
      if (!bestName) continue;

      const sale = salesMap[bestName];
      const price = sale ? (sale.revenue / sale.qty) : 0;
      const margin = price > 0 ? ((price - cmv) / price * 100) : null;
      const lucroUnit = price > 0 ? (price - cmv) : null;

      result.push({
        name: bestName,
        cmv,
        price,
        margin,
        lucroUnit,
        qtySold: sale?.qty || 0,
        revenue: sale?.revenue || 0,
      });
    }

    return result
      .filter(r => r.margin !== null)
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 8);
  }, [ingredients, recipes, orders, filterMode, today, yesterday, dateFrom, dateTo]);

  const now = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{ padding: '28px 32px' }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: '#6B7280' }}>{now}</p>
        </div>
        <button onClick={onRefresh} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 8,
          background: '#fff', border: '1px solid #E5E7EB',
          fontSize: 13, fontWeight: 500, color: '#374151',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}>
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* ── Filtro de período ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        {filterMode === 'today' && deltaLabel && (
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
            comparado com {deltaLabel} (mesmo horário)
          </span>
        )}
      </div>

      {/* ── PROJEÇÃO DE FATURAMENTO (hoje) ────────────────────────────────── */}
      {projectedRevenue !== null && (
        <>
          <SectionTitle>Projeção do dia</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
            <KpiCard icon={Target} iconColor="#6366F1" iconBg="rgba(99,102,241,0.1)"
              label="Projeção de faturamento"
              value={fmtBRL(projectedRevenue)}
              sub={`Atual: ${fmtBRL(td.revenue)} · Projeção linear`}
              delta={projectionDelta}
              deltaLabel={lwAll.revenue > 0 ? `${deltaLabel}: ${fmtBRL(lwAll.revenue)}` : null}
            />
            <KpiCard icon={Clock} iconColor="#D97706" iconBg="rgba(217,119,6,0.1)"
              label="Tempo médio de produção"
              value={fmtMinutes(avgProductionMins)}
              sub={avgProductionMins !== null ? `${metrics.td?.inProduction ?? 0} em preparo` : 'sem dados ainda'}
              delta={avgProductionMins !== null && avgProductionMinsLW !== null
                ? delta(avgProductionMins, avgProductionMinsLW) * -1  // inverso: menor é melhor
                : null}
              deltaLabel={avgProductionMinsLW !== null ? `${deltaLabel}: ${fmtMinutes(avgProductionMinsLW)}` : null}
              highlight={avgProductionMins > 40 ? '#EF4444' : avgProductionMins > 25 ? '#D97706' : '#10B981'}
            />
          </div>
        </>
      )}

      {/* ── OPERAÇÃO DO DIA ────────────────────────────────────────────────── */}
      <SectionTitle>Operação — {periodLabel}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>

        <KpiCard icon={ShoppingBag} iconColor="#6366F1" iconBg="rgba(99,102,241,0.1)"
          label={`Pedidos — ${periodLabel}`} value={td.total}
          sub={`${td.pending} pendente${td.pending !== 1 ? 's' : ''}`}
          delta={delta(td.total, lw.total)}
          deltaLabel={deltaLabel ? `${deltaLabel}: ${lw.total}` : null}
        />
        <KpiCard icon={ChefHat} iconColor="#F97316" iconBg="rgba(249,115,22,0.1)"
          label="Em produção" value={td.inProduction}
          sub="confirmados + preparando"
          highlight={td.inProduction > 0 ? '#F97316' : '#111827'}
        />
        <KpiCard icon={Truck} iconColor="#8B5CF6" iconBg="rgba(139,92,246,0.1)"
          label="Em entrega" value={td.inDelivery}
          highlight={td.inDelivery > 0 ? '#8B5CF6' : '#111827'}
        />
        <KpiCard icon={CheckCircle} iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"
          label="Finalizados" value={td.delivered}
          highlight={td.delivered > 0 ? '#10B981' : '#111827'}
          delta={delta(td.delivered, lw.delivered)}
          deltaLabel={deltaLabel ? `${deltaLabel}: ${lw.delivered}` : null}
        />
        <KpiCard icon={XCircle} iconColor="#EF4444" iconBg="rgba(239,68,68,0.1)"
          label="Cancelados" value={td.cancelled}
          highlight={td.cancelled > 0 ? '#EF4444' : '#111827'}
        />
        {projectedRevenue === null && (
          <KpiCard icon={Clock} iconColor="#D97706" iconBg="rgba(217,119,6,0.1)"
            label="Tempo médio de produção"
            value={fmtMinutes(avgProductionMins)}
            sub={avgProductionMins !== null ? 'recebido → saiu p/ entrega' : 'sem dados ainda'}
            highlight={avgProductionMins !== null && avgProductionMins > 40 ? '#EF4444' : avgProductionMins > 25 ? '#D97706' : '#10B981'}
          />
        )}
      </div>

      {/* ── FINANCEIRO DO DIA ─────────────────────────────────────────────── */}
      <SectionTitle>Financeiro — {periodLabel}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>

        <KpiCard icon={DollarSign} iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"
          label="Faturamento bruto" value={fmtBRL(td.revenue)}
          sub="pedidos não cancelados"
          delta={delta(td.revenue, lw.revenue)}
          deltaLabel={deltaLabel ? `${deltaLabel}: ${fmtBRL(lw.revenue)}` : null}
        />
        <KpiCard icon={TrendingUp} iconColor="#F2A800" iconBg="rgba(242,168,0,0.1)"
          label="Ticket médio" value={fmtBRL(td.avgTicket)}
          sub="por pedido ativo"
          delta={delta(td.avgTicket, lw.avgTicket)}
          deltaLabel={deltaLabel ? `${deltaLabel}: ${fmtBRL(lw.avgTicket)}` : null}
        />
        <KpiCard icon={Truck} iconColor="#3B82F6" iconBg="rgba(59,130,246,0.1)"
          label="Taxa de entrega" value={fmtBRL(td.delivFee)}
          sub="arrecadada no período"
        />
        <KpiCard icon={Tag} iconColor="#EF4444" iconBg="rgba(239,68,68,0.1)"
          label="Descontos (cupons)" value={fmtBRL(td.discount)}
          highlight={td.discount > 0 ? '#EF4444' : '#111827'}
          sub={td.discount > 0 ? `${((td.discount / (td.revenue + td.discount)) * 100).toFixed(1)}% do bruto` : 'nenhum cupom'}
        />
        <KpiCard icon={Percent} iconColor="#F97316" iconBg="rgba(249,115,22,0.1)"
          label="Taxa de cancelamento" value={`${td.cancelPct.toFixed(1)}%`}
          highlight={td.cancelPct > 15 ? '#EF4444' : td.cancelPct > 8 ? '#F97316' : '#10B981'}
          sub={`${td.cancelled} de ${td.total} pedidos`}
        />
        {td.awaitingPix > 0 && (
          <KpiCard icon={AlertTriangle} iconColor="#D97706" iconBg="rgba(217,119,6,0.1)"
            label="Aguardando pagto. PIX" value={td.awaitingPix}
            highlight="#D97706"
            sub="PIX não confirmado"
          />
        )}
      </div>

      {/* ── FORMAS DE PAGAMENTO ────────────────────────────────────────────── */}
      {Object.keys(td.byPayment).length > 0 && (
        <>
          <SectionTitle>Formas de pagamento — {periodLabel}</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
            {Object.entries(td.byPayment).map(([method, { count, revenue }]) => (
              <PaymentMethodCard key={method} method={method} count={count} revenue={revenue} total={td.active} />
            ))}
          </div>
        </>
      )}

      {/* ── SABORES MAIS RENTÁVEIS ─────────────────────────────────────── */}
      {topFlavors.length > 0 && (
        <>
          <SectionTitle>Sabores mais rentáveis — {periodLabel}</SectionTitle>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 100px 100px 100px 90px', gap: 0, background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', padding: '10px 18px', alignItems: 'center' }}>
              {['#', 'Sabor', 'Margem', 'CMV', 'Lucro/unid.', 'Vendidos'].map((h, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i > 1 ? 'right' : 'left' }}>{h}</span>
              ))}
            </div>
            {topFlavors.map((f, idx) => {
              const marginColor = f.margin >= 65 ? '#059669' : f.margin >= 45 ? '#D97706' : '#EF4444';
              const marginBg    = f.margin >= 65 ? '#ECFDF5' : f.margin >= 45 ? '#FFFBEB' : '#FEF2F2';
              return (
                <div key={f.name} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 100px 100px 100px 90px', gap: 0, padding: '12px 18px', borderBottom: '1px solid #F3F4F6', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: idx === 0 ? '#F2A800' : '#9CA3AF' }}>
                    {idx === 0 ? '★' : idx + 1}
                  </span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{f.name}</p>
                    {f.price > 0 && <p style={{ fontSize: 11, color: '#9CA3AF' }}>Preço médio: {fmtBRL(f.price)}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: marginBg, color: marginColor }}>
                      {f.margin.toFixed(0)}%
                    </span>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textAlign: 'right' }}>{fmtBRL(f.cmv)}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#059669', textAlign: 'right' }}>{f.lucroUnit !== null ? fmtBRL(f.lucroUnit) : '—'}</p>
                  <p style={{ fontSize: 12, color: '#374151', textAlign: 'right' }}>{f.qtySold > 0 ? f.qtySold : '—'}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── GRÁFICOS ──────────────────────────────────────────────────────── */}
      <SectionTitle>Gráficos</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 12 }}>

        {/* Faturamento por hora ou por dia */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px 20px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} color="#F2A800" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                {isSingleDay ? `Faturamento por hora — ${periodLabel}` : `Faturamento por dia — ${periodLabel}`}
              </h3>
            </div>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{isSingleDay ? '10h–23h · pedidos ativos' : 'pedidos ativos'}</span>
          </div>
          {isSingleDay
            ? hourlyData.every(d => d.total === 0)
              ? <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: 14 }}>Nenhuma venda registrada</div>
              : <BarChart data={hourlyData} labelKey="hour" valueKey="total" color="#F2A800" height={220} isCurrency />
            : !dailyData || dailyData.every(d => d.total === 0)
              ? <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: 14 }}>Nenhuma venda no período</div>
              : <BarChart data={dailyData} labelKey="date" valueKey="total" color="#F2A800" height={220} isCurrency />
          }
        </div>

        {/* Gráfico unificado: faturamento + pedidos — últimos 7 dias */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px 20px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} color="#F2A800" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Faturamento e pedidos — últimos 7 dias</h3>
            </div>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>pedidos não cancelados</span>
          </div>
          {dualWeeklyData.every(d => d.revenue === 0 && d.count === 0)
            ? <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: 14 }}>Nenhum dado nos últimos 7 dias</div>
            : <DualChart data={dualWeeklyData} height={200} />
          }
        </div>

      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: '#D1D5DB' }}>
        Comparativos vs. mesmo dia da semana anterior · Clique em "Atualizar" para sincronizar · Para análises detalhadas acesse Relatórios
      </p>
    </div>
  );
}
