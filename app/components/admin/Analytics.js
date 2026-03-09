'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Eye, ShoppingCart, CreditCard, CheckCircle2,
  Users, ArrowUpRight, ArrowDownRight, Minus, Search, Info,
  Clock, TrendingUp, Globe, Package,
} from 'lucide-react';
import DateRangePicker from './DateRangePicker';

// ── Cores ─────────────────────────────────────────────────────────────────────

const C = {
  bg:       '#F4F5F7',
  card:     '#ffffff',
  border:   '#E5E7EB',
  text:     '#111827',
  muted:    '#6B7280',
  light:    '#9CA3AF',
  purple:   '#F2A800',
  purpleL:  '#FFD060',
  purpleDim:'rgba(242,168,0,0.1)',
  success:  '#10B981',
  danger:   '#EF4444',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(a, b) {
  if (!b) return null;
  return ((a - b) / b) * 100;
}

function fmtSeconds(s) {
  if (!s || s === 0) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (m === 0) return `${sec}s`;
  return `${m}min ${sec > 0 ? sec + 's' : ''}`.trim();
}

function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function daysAgoSP(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// Format YYYYMMDD → "08/03"
function fmtGADate(d) {
  if (!d || d.length !== 8) return d;
  return `${d.slice(6, 8)}/${d.slice(4, 6)}`;
}

// ── Delta badge ───────────────────────────────────────────────────────────────

function DeltaBadge({ delta, suffix = '%', size = 11 }) {
  if (delta === null || delta === undefined) return null;
  const isUp   = delta > 0;
  const isFlat = delta === 0;
  const color  = isFlat ? C.light : isUp ? C.success : C.danger;
  const Icon   = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: size, fontWeight: 600, color }}>
      <Icon size={size} />
      {Math.abs(delta).toFixed(1)}{suffix} {isUp ? 'acima' : isFlat ? '' : 'abaixo'}
    </span>
  );
}

// ── Funnel Card ───────────────────────────────────────────────────────────────
// Each card shows the current value, delta %, and a purple trapezoid fill
// representing the conversion % of this step relative to total visits.

const FUNNEL_HEIGHT = 280; // total card height
const FILL_H       = 130;  // height of the purple fill area

function FunnelCard({ label, icon: Icon, value, desc, delta, convPct, prevConvPct, leftConvPct, rightConvPct }) {
  // leftConvPct = conversion % at entry of this step (shapes left edge of trapezoid)
  // rightConvPct = conversion % at exit (entry of next step, shapes right edge)
  const leftH  = Math.round((leftConvPct  / 100) * FILL_H);
  const rightH = Math.round((rightConvPct / 100) * FILL_H);
  const W = 200; // SVG viewBox width

  return (
    <div style={{
      background: C.card, borderRadius: 14, border: '1px solid ' + C.border,
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0,
    }}>
      {/* Top section */}
      <div style={{ padding: '18px 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{label}</span>
          <Info size={12} color={C.light} />
        </div>
        <p style={{ fontSize: 32, fontWeight: 800, color: C.text, lineHeight: 1, marginBottom: 4 }}>
          {value !== null && value !== undefined ? value.toLocaleString('pt-BR') : '—'}
        </p>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{desc}</p>
        <DeltaBadge delta={delta} />
      </div>

      {/* Purple trapezoid fill */}
      <div style={{ marginTop: 'auto', position: 'relative', height: FILL_H }}>
        <svg
          viewBox={`0 0 ${W} ${FILL_H}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={C.purple} />
              <stop offset="100%" stopColor={C.purpleL} />
            </linearGradient>
          </defs>
          {/* Trapezoid: top-left=(0, FILL_H-leftH), top-right=(W, FILL_H-rightH), bottom-right=(W, FILL_H), bottom-left=(0, FILL_H) */}
          <polygon
            points={`0,${FILL_H - leftH} ${W},${FILL_H - rightH} ${W},${FILL_H} 0,${FILL_H}`}
            fill={`url(#grad-${label})`}
          />
          {/* Conversion % label */}
          <text x="12" y={FILL_H - 10} fontSize="20" fontWeight="800" fill="rgba(255,255,255,0.95)">
            {convPct !== null ? `${convPct.toFixed(0)}%` : '—'}
          </text>
          {prevConvPct !== null && prevConvPct !== undefined && (
            <text x="12" y={FILL_H - 10 + 18} fontSize="11" fill="rgba(255,255,255,0.7)">
              {prevConvPct.toFixed(0)}% no período anterior
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

// ── Time Step Card ────────────────────────────────────────────────────────────

function TimeStepCard({ from, to, seconds, prevSeconds, icon: Icon, color }) {
  const delta = prevSeconds ? ((seconds - prevSeconds) / prevSeconds * 100) : null;
  const isPositive = delta !== null && delta > 0; // taking longer = bad (positive delta)
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
        <div>
          <p style={{ fontSize: 12, color: C.muted }}>
            {from} → {to} <Info size={10} color={C.light} style={{ verticalAlign: 'middle' }} />
          </p>
        </div>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 3 }}>{fmtSeconds(seconds)}</p>
      {delta !== null && (
        <p style={{ fontSize: 11, color: isPositive ? C.danger : C.success, display: 'flex', alignItems: 'center', gap: 2 }}>
          {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {isPositive ? '+' : ''}{fmtSeconds(Math.abs(seconds - (prevSeconds || 0)))} vs período anterior
        </p>
      )}
    </div>
  );
}

// ── Visitor Card ──────────────────────────────────────────────────────────────

function VisitorCard({ title, desc, value, pctOfTotal, prevValue }) {
  const d = pct(value, prevValue);
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: '20px 24px', border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flex: 1 }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.4 }}>{desc}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <p style={{ fontSize: 28, fontWeight: 800, color: C.text }}>
          {value !== null ? value.toLocaleString('pt-BR') : '—'}
        </p>
        {pctOfTotal !== null && (
          <p style={{ fontSize: 13, color: C.muted }}>({pctOfTotal.toFixed(1)}%)</p>
        )}
      </div>
      {d !== null && <DeltaBadge delta={d} size={12} />}
    </div>
  );
}

// ── Multi-line visit chart ─────────────────────────────────────────────────────

const CHART_COLORS = {
  sessions:       '#F2A800',
  newUsers:       '#FFD060',
  returningUsers: '#B87800',
};

function VisitLineChart({ data }) {
  const [hovered, setHovered] = useState(null);
  if (!data || data.length < 2) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.light, fontSize: 13 }}>
        Sem dados suficientes para o período selecionado
      </div>
    );
  }

  const W = 800, H = 210, padL = 44, padR = 16, padT = 20, padB = 34;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = data.length;

  const allVals = data.flatMap(d => [d.sessions, d.newUsers, d.returningUsers]);
  const maxV = Math.max(...allVals, 1);
  const yTicks = [0, Math.round(maxV * 0.33), Math.round(maxV * 0.66), maxV];

  function px(i) { return padL + (i / (n - 1)) * chartW; }
  function py(v) { return padT + chartH - (v / maxV) * chartH; }

  // Smooth cubic-bezier path (Catmull-Rom style tension)
  function smoothPath(key) {
    const pts = data.map((d, i) => [px(i), py(d[key])]);
    if (pts.length === 0) return '';
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const t = 0.25;
      const cp1x = p1[0] + (p2[0] - p0[0]) * t;
      const cp1y = p1[1] + (p2[1] - p0[1]) * t;
      const cp2x = p2[0] - (p3[0] - p1[0]) * t;
      const cp2y = p2[1] - (p3[1] - p1[1]) * t;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  // Area fill path (same curve + close at bottom)
  function areaPath(key) {
    const line = smoothPath(key);
    const lastX = px(n - 1);
    const baseY = padT + chartH;
    return `${line} L ${lastX},${baseY} L ${padL},${baseY} Z`;
  }

  const series = [
    { key: 'sessions',       label: 'Total de visitas',                color: CHART_COLORS.sessions,       gradId: 'gSessions'  },
    { key: 'newUsers',       label: 'Visitas de clientes novos',       color: CHART_COLORS.newUsers,       gradId: 'gNewUsers'  },
    { key: 'returningUsers', label: 'Visitas de clientes recorrentes', color: CHART_COLORS.returningUsers, gradId: 'gReturning' },
  ];

  const totals = {
    sessions:       data.reduce((s, d) => s + d.sessions, 0),
    newUsers:       data.reduce((s, d) => s + d.newUsers, 0),
    returningUsers: data.reduce((s, d) => s + d.returningUsers, 0),
  };

  return (
    <div>
      {/* Legend / totals */}
      <div style={{ display: 'flex', gap: 28, marginBottom: 18, flexWrap: 'wrap' }}>
        {series.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{totals[s.key].toLocaleString('pt-BR')}</p>
            {s.key !== 'sessions' && (
              <p style={{ fontSize: 12, color: C.muted }}>
                ({totals.sessions > 0 ? ((totals[s.key] / totals.sessions) * 100).toFixed(1) : 0}%)
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
              <span style={{ fontSize: 11, color: C.muted }}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ position: 'relative' }}>
        {/* Tooltip */}
        {hovered !== null && data[hovered] && (
          <div style={{
            position: 'absolute',
            top: 4,
            left: `clamp(80px, ${padL + (hovered / (n - 1)) * chartW}px, calc(100% - 130px))`,
            transform: 'translateX(-50%)',
            background: '#1C1917',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 12,
            zIndex: 10,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
            border: '1px solid rgba(242,168,0,0.25)',
          }}>
            <p style={{ fontWeight: 700, marginBottom: 6, color: '#F2A800', fontSize: 11, letterSpacing: 0.4 }}>
              {fmtGADate(data[hovered].date)}
            </p>
            {series.map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ color: '#D1D5DB', fontSize: 11 }}>
                  {s.label.split(' ').slice(-1)[0]}:
                </span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>
                  {data[hovered][s.key].toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 230, display: 'block' }}
          onMouseLeave={() => setHovered(null)}>

          <defs>
            {series.map(s => (
              <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.00" />
              </linearGradient>
            ))}
          </defs>

          {/* Y grid */}
          {yTicks.map((v, ti) => {
            const y = padT + chartH - (v / maxV) * chartH;
            return (
              <g key={ti}>
                <line x1={padL} y1={y} x2={W - padR} y2={y}
                  stroke={ti === 0 ? '#E5E7EB' : '#F3F4F6'}
                  strokeWidth={ti === 0 ? 1.5 : 1}
                  strokeDasharray={ti === 0 ? 'none' : '4 3'}
                />
                <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={9} fill={C.light}>{v}</text>
              </g>
            );
          })}

          {/* Hover vertical line */}
          {hovered !== null && (
            <line
              x1={px(hovered)} y1={padT}
              x2={px(hovered)} y2={padT + chartH}
              stroke="rgba(242,168,0,0.35)" strokeWidth={1.5} strokeDasharray="4 3"
            />
          )}

          {/* Area fills (behind lines) */}
          {series.map(s => (
            <path key={s.key + '_area'}
              d={areaPath(s.key)}
              fill={`url(#${s.gradId})`}
            />
          ))}

          {/* Smooth lines */}
          {series.map(s => (
            <path key={s.key + '_line'}
              d={smoothPath(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Dots — only on hover */}
          {hovered !== null && series.map(s => (
            <circle key={s.key + '_dot'}
              cx={px(hovered)} cy={py(data[hovered][s.key])}
              r={5}
              fill={s.color}
              stroke="#fff"
              strokeWidth={2}
            />
          ))}

          {/* X labels */}
          {data.map((d, i) => {
            const show = n <= 10 || i % Math.ceil(n / 10) === 0 || i === n - 1;
            if (!show) return null;
            return (
              <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize={9} fill={C.light}>
                {fmtGADate(d.date)}
              </text>
            );
          })}

          {/* Invisible hover zones */}
          {data.map((_, i) => (
            <rect key={i}
              x={i === 0 ? padL : (px(i - 1) + px(i)) / 2}
              y={padT}
              width={
                i === 0
                  ? (px(0) + px(1)) / 2 - padL
                  : i === n - 1
                    ? px(n - 1) - (px(n - 2) + px(n - 1)) / 2
                    : (px(i + 1) - px(i - 1)) / 2
              }
              height={chartH}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHovered(i)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Not-configured banner ─────────────────────────────────────────────────────

function SetupBanner() {
  return (
    <div style={{ padding: '40px 32px' }}>
      <div style={{ background: C.card, borderRadius: 14, padding: '36px 40px', border: '1px solid ' + C.border, maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: C.purpleDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={24} color={C.purple} />
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.text }}>Conecte o Google Analytics 4</p>
            <p style={{ fontSize: 13, color: C.muted }}>Configure as variáveis de ambiente para ativar a aba Analytics</p>
          </div>
        </div>

        <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '18px 20px', marginBottom: 20, border: '1px solid ' + C.border }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Variáveis necessárias no Vercel
          </p>
          {[
            { key: 'GA_PROPERTY_ID',  desc: 'ID da propriedade GA4 (ex: 123456789)' },
            { key: 'GA_CLIENT_EMAIL', desc: 'E-mail da service account (JSON baixado)' },
            { key: 'GA_PRIVATE_KEY',  desc: 'Chave privada da service account (JSON baixado)' },
          ].map(({ key, desc }) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.purple, marginBottom: 2 }}>{key}</p>
              <p style={{ fontSize: 11, color: C.muted }}>{desc}</p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          Siga o passo a passo acima (enviado antes desta implementação) para criar o projeto no Google Cloud,
          ativar a GA4 Data API, criar a service account e adicionar as variáveis no Vercel.
        </p>

        <div style={{ marginTop: 16, padding: '12px 16px', background: '#FFF7ED', borderRadius: 8, border: '1px solid rgba(249,115,22,0.2)' }}>
          <p style={{ fontSize: 12, color: '#D97706', fontWeight: 600 }}>
            ⚠️ Instale também o script GA4 no site (NEXT_PUBLIC_GA_MEASUREMENT_ID no Vercel) para começar a coletar dados de funil.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Analytics Component ──────────────────────────────────────────────────

export default function Analytics({ adminToken }) {
  const today = todaySP();

  const [dateRange, setDateRange] = useState({
    from:     daysAgoSP(6),
    to:       today,
    fromTime: '00:00',
    toTime:   '23:59',
  });

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [productSearch, setProductSearch] = useState('');

  // Compute previous period (same duration)
  const prevRange = useMemo(() => {
    const from = new Date(dateRange.from + 'T12:00:00');
    const to   = new Date(dateRange.to   + 'T12:00:00');
    const days = Math.round((to - from) / 86400000) + 1;
    const prevTo  = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1);
    return {
      from: prevFrom.toLocaleDateString('en-CA'),
      to:   prevTo.toLocaleDateString('en-CA'),
    };
  }, [dateRange.from, dateRange.to]);

  const fetchData = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from,
        endDate:   dateRange.to,
        prevStart: prevRange.from,
        prevEnd:   prevRange.to,
      });
      const res = await fetch(`/api/admin/analytics?${params}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const d = await res.json();
      if (d.error) { setError(d.error); return; }
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [adminToken, dateRange.from, dateRange.to, prevRange.from, prevRange.to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Not configured ──────────────────────────────────────────────────────────
  if (data?.notConfigured) return <SetupBanner />;

  // ── Funnel calculations ─────────────────────────────────────────────────────

  const funnel = data?.funnel;
  const steps = funnel ? [
    { key: 'sessions',       label: 'Visitas',        icon: Users,        desc: 'visitaram seu site',          value: funnel.current.sessions },
    { key: 'view_item',      label: 'Visualizações',  icon: Eye,          desc: 'visualizaram algum item',     value: funnel.current.view_item },
    { key: 'add_to_cart',    label: 'Sacola',         icon: ShoppingCart, desc: 'adicionaram itens na sacola', value: funnel.current.add_to_cart },
    { key: 'begin_checkout', label: 'Checkout',       icon: CreditCard,   desc: 'iniciaram o checkout',        value: funnel.current.begin_checkout },
    { key: 'purchase',       label: 'Pedidos',        icon: CheckCircle2, desc: 'concluíram o pedido',         value: funnel.current.purchase },
  ] : [];

  // Conversion % relative to sessions (top of funnel)
  function convPct(key) {
    if (!funnel || !funnel.current.sessions) return 0;
    return (funnel.current[key] / funnel.current.sessions) * 100;
  }
  function prevConvPct(key) {
    if (!funnel || !funnel.previous.sessions) return 0;
    return (funnel.previous[key] / funnel.previous.sessions) * 100;
  }

  // Trapezoid edges: leftConvPct = this step's %, rightConvPct = next step's %
  function trapEdges(idx) {
    const leftKey  = steps[idx]?.key;
    const rightKey = steps[idx + 1]?.key;
    const left  = leftKey  ? convPct(leftKey)  : 0;
    const right = rightKey ? convPct(rightKey) : Math.max(0, left - 2); // last card tapers slightly
    return { leftConvPct: left, rightConvPct: right };
  }

  // ── Filtered products ───────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    const q = productSearch.toLowerCase();
    return data.products.filter(p => !q || p.name.toLowerCase().includes(q));
  }, [data?.products, productSearch]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '28px 32px', background: C.bg, minHeight: '100%' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 3 }}>Analytics</h1>
          <p style={{ fontSize: 13, color: C.muted }}>Funil de vendas e comportamento de visitantes</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: C.purple, color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, color: C.danger, fontSize: 13 }}>
          Erro ao carregar dados do Analytics: {error}
        </div>
      )}

      {/* Skeleton while loading and no data yet */}
      {loading && !data && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ flex: 1, height: FUNNEL_HEIGHT, background: '#E9EAEC', borderRadius: 14, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* ── FUNIL ─────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
            {steps.map((step, idx) => {
              const d = pct(step.value, funnel?.previous[step.key]);
              const edges = trapEdges(idx);
              return (
                <FunnelCard
                  key={step.key}
                  label={step.label}
                  icon={step.icon}
                  value={step.value}
                  desc={step.desc}
                  delta={d}
                  convPct={funnel?.current.sessions ? (step.value / funnel.current.sessions) * 100 : 0}
                  prevConvPct={funnel?.previous.sessions ? (funnel.previous[step.key] / funnel.previous.sessions) * 100 : null}
                  leftConvPct={edges.leftConvPct}
                  rightConvPct={edges.rightConvPct}
                />
              );
            })}
          </div>

          {/* ── ANÁLISE DE TEMPO ────────────────────────────────────────────── */}
          {data.timing && (
            <div style={{ background: C.card, borderRadius: 12, padding: '22px 28px', border: '1px solid ' + C.border, marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Análise de tempo</p>
                <p style={{ fontSize: 12, color: C.muted }}>
                  Tempo médio estimado entre etapas do funil de conversão
                  <span style={{ marginLeft: 6, fontSize: 10, background: '#FFF7ED', color: '#D97706', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>estimado</span>
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
                <TimeStepCard from="Visita"        to="Visualização" seconds={data.timing.visitToView}      prevSeconds={data.timing.prevVisitToView}      icon={Eye}          color="#6366F1" />
                <TimeStepCard from="Visualização"  to="Sacola"       seconds={data.timing.viewToCart}       prevSeconds={data.timing.prevViewToCart}       icon={ShoppingCart} color="#F59E0B" />
                <TimeStepCard from="Sacola"        to="Checkout"     seconds={data.timing.cartToCheckout}   prevSeconds={data.timing.prevCartToCheckout}   icon={CreditCard}   color="#06B6D4" />
                <TimeStepCard from="Checkout"      to="Pedido"       seconds={data.timing.checkoutToOrder}  prevSeconds={data.timing.prevCheckoutToOrder}  icon={CheckCircle2} color="#10B981" />
              </div>
            </div>
          )}

          {/* ── VISITANTES ──────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            <VisitorCard
              title="Total de visitantes"
              desc="Número de pessoas únicas que acessaram o site no período selecionado"
              value={data.visitors?.current?.total}
              pctOfTotal={null}
              prevValue={data.visitors?.previous?.total}
            />
            <VisitorCard
              title="Visitantes novos"
              desc="Quantidade de pessoas únicas que visitaram o site pela primeira vez durante o período"
              value={data.visitors?.current?.newUsers}
              pctOfTotal={data.visitors?.current?.total ? (data.visitors.current.newUsers / data.visitors.current.total * 100) : null}
              prevValue={data.visitors?.previous?.newUsers}
            />
            <VisitorCard
              title="Visitantes recorrentes"
              desc="Quantidade de pessoas únicas que já haviam visitado o site anteriormente e retornaram no período"
              value={data.visitors?.current?.returning}
              pctOfTotal={data.visitors?.current?.total ? (data.visitors.current.returning / data.visitors.current.total * 100) : null}
              prevValue={data.visitors?.previous?.returning}
            />
          </div>

          {/* ── ANÁLISE DE VISITAS (chart) ───────────────────────────────────── */}
          <div style={{ background: C.card, borderRadius: 12, padding: '22px 28px', border: '1px solid ' + C.border, marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Análise de visitas</p>
            <VisitLineChart data={data.timeSeries} />
          </div>

          {/* ── DOMÍNIO DE ORIGEM ────────────────────────────────────────────── */}
          {data.sources?.length > 0 && (
            <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, overflow: 'hidden', marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={15} color={C.purple} />
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Domínio de origem</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Domínio de origem', 'Visitas ↓', 'Novos', 'Recorrentes'].map((h, i) => (
                      <th key={i} style={{ padding: '10px 20px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid ' + C.border }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((src, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid ' + C.border }}>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 500, color: C.purple }}>{src.source}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: C.text }}>{src.sessions.toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, color: C.muted }}>{src.newUsers.toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, color: C.muted }}>{src.returningUsers.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── PERFORMANCE DOS PRODUTOS ─────────────────────────────────────── */}
          <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, overflow: 'hidden', marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={15} color={C.purple} />
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Performance dos produtos</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 12px' }}>
                <Search size={13} color={C.light} />
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Pesquise por um produto"
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: C.text, width: 200 }}
                />
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div style={{ padding: '32px 22px', textAlign: 'center', color: C.light, fontSize: 13 }}>
                {data.products?.length === 0
                  ? 'Nenhum dado de produto. Verifique se os eventos de ecommerce estão configurados no site.'
                  : 'Nenhum produto encontrado para a pesquisa.'
                }
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Produto', 'Visitas', 'Sacola', 'Pedidos ↓'].map((h, i) => (
                      <th key={i} style={{ padding: '10px 20px', textAlign: i === 0 ? 'left' : 'left', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid ' + C.border }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, i) => {
                    const cartPct   = p.views > 0 ? (p.addToCarts / p.views * 100) : null;
                    const orderPct  = p.views > 0 ? (p.purchases  / p.views * 100) : null;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid ' + C.border }}>
                        <td style={{ padding: '12px 20px' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</p>
                        </td>
                        <td style={{ padding: '12px 20px', fontSize: 13, color: C.text }}>
                          {p.views.toLocaleString('pt-BR')}
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.addToCarts.toLocaleString('pt-BR')}</p>
                          {cartPct !== null && (
                            <p style={{ fontSize: 11, color: C.muted }}>{cartPct.toFixed(2)}% dos que viram o produto</p>
                          )}
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.purchases.toLocaleString('pt-BR')}</p>
                          {orderPct !== null && (
                            <p style={{ fontSize: 11, color: C.muted }}>{orderPct.toFixed(2)}% dos que viram o produto</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* GA4 events reminder */}
          {(data.funnel?.current.view_item === 0 && data.funnel?.current.sessions > 0) && (
            <div style={{ background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '14px 20px', color: '#D97706', fontSize: 12 }}>
              <strong>Dica:</strong> Os eventos de funil (view_item, add_to_cart, begin_checkout, purchase) ainda não foram detectados.
              Certifique-se de que o Measurement ID do GA4 está configurado no site ({' '}
              <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code>{' '}) e que os eventos estão sendo disparados.
            </div>
          )}
        </>
      )}
    </div>
  );
}
