'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingBag, Tag, Bike,
  Wallet, AlertTriangle, RefreshCw, Search, Printer, X, Plus,
  Minus, Clock, CreditCard, Banknote, ChevronDown, BarChart2,
  ArrowUpRight, ArrowDownRight, Package, Calendar, FileText,
  Receipt, Percent, Activity,
} from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import LancamentosTab from './FinancialLancamentos';
import FluxoCaixaTab from './FinancialFluxoCaixa';
import { AnalisePagamentosTab, AnaliseRecebimentosTab } from './FinancialAnalise';
import CustosTab from './FinancialCustos';

// ── Constantes ────────────────────────────────────────────────────────────────

const C = {
  gold:    '#F2A800', goldL:  '#FFD060', goldDim: 'rgba(242,168,0,0.12)',
  bg:      '#F4F5F7', card:   '#ffffff', border:  '#E5E7EB',
  text:    '#111827', muted:  '#6B7280', light:   '#9CA3AF',
  success: '#10B981', danger: '#EF4444', blue:    '#3B82F6',
  orange:  '#F97316', purple: '#8B5CF6', teal:    '#14B8A6',
};

const PM_LABELS: Record<string, string> = {
  pix:           'PIX',
  card:          'Cartão de Crédito',
  cash:          'Dinheiro',
  card_delivery: 'Cartão na Entrega',
};

const PM_COLORS: Record<string, string> = {
  pix:           C.gold,
  card:          C.blue,
  cash:          C.success,
  card_delivery: C.orange,
};

const TYPE_LABELS: Record<string, string> = { venda: 'Venda', sangria: 'Sangria', suprimento: 'Suprimento', cancelled: 'Cancelado' };
const TYPE_COLORS: Record<string, string> = { venda: C.success, sangria: C.danger, suprimento: C.blue, cancelled: C.light };

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (v: any) => (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = (v: any) => {
  const n = parseFloat(v) || 0;
  if (n >= 1000) return 'R$' + (n / 1000).toFixed(1) + 'k';
  return fmtBRL(n);
};

function todaySP() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function fmtDT(iso: any) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDateShort(yyyymmdd: any) {
  if (!yyyymmdd) return '';
  const [, m, d] = yyyymmdd.split('-');
  return `${d}/${m}`;
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────

function RevenueBarChart({ data }: { data: any }) {
  const [hovered, setHovered] = useState<any>(null);
  if (!data?.length) return <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.light, fontSize: 13 }}>Sem dados</div>;

  const W = 800, H = 180, padL = 48, padR = 12, padT = 12, padB = 28;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const maxV = Math.max(...data.map((d: any) => d.revenue), 1);
  const barW = Math.max(4, cW / data.length * 0.65);
  const gap  = cW / data.length;

  function bx(i: number) { return padL + i * gap + gap / 2; }
  function bh(v: number) { return (v / maxV) * cH; }

  const yTicks = [0, maxV * 0.5, maxV].map((v: number) => Math.round(v));

  return (
    <div style={{ position: 'relative' }}>
      {hovered !== null && data[hovered] && (
        <div style={{
          position: 'absolute', top: 4,
          left: `clamp(60px, ${padL + hovered * gap + gap / 2}px, calc(100% - 120px))`,
          transform: 'translateX(-50%)',
          background: '#1C1917', color: '#fff',
          padding: '8px 12px', borderRadius: 8, fontSize: 11, zIndex: 10,
          pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          border: '1px solid rgba(242,168,0,0.3)',
        }}>
          <p style={{ color: C.gold, fontWeight: 700, marginBottom: 3 }}>{fmtDateShort(data[hovered].date)}</p>
          <p style={{ color: '#D1D5DB' }}>Faturamento: <b style={{ color: '#fff' }}>{fmtBRL(data[hovered].revenue)}</b></p>
          <p style={{ color: '#D1D5DB' }}>Pedidos: <b style={{ color: '#fff' }}>{data[hovered].orders}</b></p>
          {data[hovered].cancelled > 0 && <p style={{ color: C.danger }}>Cancelados: {data[hovered].cancelled}</p>}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 190, display: 'block' }} onMouseLeave={() => setHovered(null)}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.gold} stopOpacity="1" />
            <stop offset="100%" stopColor={C.goldL} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => {
          const y = padT + cH - (v / maxV) * cH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F3F4F6" strokeWidth={i === 0 ? 1.5 : 1} strokeDasharray={i === 0 ? 'none' : '4 3'} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={9} fill={C.light}>{fmtShort(v)}</text>
            </g>
          );
        })}
        {data.map((d: any, i: any) => {
          const h = bh(d.revenue);
          const x = bx(i);
          const isHov = hovered === i;
          return (
            <g key={i}>
              <rect
                x={x - barW / 2} y={padT + cH - h} width={barW} height={Math.max(h, 2)}
                rx={3} fill={isHov ? C.gold : 'url(#barGrad)'}
                opacity={hovered !== null && !isHov ? 0.45 : 1}
              />
              {d.cancelled > 0 && (
                <rect x={x - barW / 2} y={padT + cH - h - 5} width={barW} height={4} rx={2} fill={C.danger} />
              )}
            </g>
          );
        })}
        {data.map((d: any, i: any) => {
          const show = data.length <= 14 || i % Math.ceil(data.length / 14) === 0 || i === data.length - 1;
          return show ? (
            <text key={i} x={bx(i)} y={H - 4} textAnchor="middle" fontSize={9} fill={C.light}>
              {fmtDateShort(d.date)}
            </text>
          ) : null;
        })}
        {data.map((_: any, i: any) => (
          <rect key={i}
            x={padL + i * gap} y={padT} width={gap} height={cH}
            fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHovered(i)}
          />
        ))}
      </svg>
    </div>
  );
}

// ── SVG Donut Chart ───────────────────────────────────────────────────────────

function DonutChart({ data }: { data: any }) {
  const [hovered, setHovered] = useState<any>(null);
  if (!data?.length) return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.light, fontSize: 13 }}>Sem dados</div>;

  const total = data.reduce((s: any, d: any) => s + d.value, 0);
  const cx = 80, cy = 80, R = 68, r = 44;
  let angle = -Math.PI / 2;

  const slices = data.map((d: any, i: any) => {
    const pct  = total > 0 ? d.value / total : 0;
    const span = pct * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle),          y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + span),   y2 = cy + R * Math.sin(angle + span);
    const ix1 = cx + r * Math.cos(angle),          iy1 = cy + r * Math.sin(angle);
    const ix2 = cx + r * Math.cos(angle + span),   iy2 = cy + r * Math.sin(angle + span);
    const large = span > Math.PI ? 1 : 0;
    const mid = angle + span / 2;
    const lx = cx + (R + 8) * Math.cos(mid), ly = cy + (R + 8) * Math.sin(mid);
    const path = `M ${x1},${y1} A ${R},${R} 0 ${large} 1 ${x2},${y2} L ${ix2},${iy2} A ${r},${r} 0 ${large} 0 ${ix1},${iy1} Z`;
    angle += span;
    const color = (PM_COLORS as any)[d.method] || `hsl(${i * 60}, 60%, 55%)`;
    return { ...d, path, pct, color, lx, ly, mid };
  });

  const hov = hovered !== null ? slices[hovered] : null;

  return (
    <svg viewBox="0 0 160 160" style={{ width: '100%', maxWidth: 180, display: 'block' }}>
      {slices.map((s: any, i: any) => (
        <path key={i} d={s.path}
          fill={s.color}
          opacity={hovered !== null && hovered !== i ? 0.4 : 1}
          style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        />
      ))}
      {hov ? (
        <>
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={9} fill={C.muted}>{hov.label}</text>
          <text x={cx} y={cy + 7} textAnchor="middle" fontSize={11} fontWeight="700" fill={C.text}>{(hov.pct * 100).toFixed(1)}%</text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={8} fill={C.light}>TOTAL</text>
          <text x={cx} y={cy + 7} textAnchor="middle" fontSize={10} fontWeight="700" fill={C.text}>{fmtShort(total)}</text>
        </>
      )}
    </svg>
  );
}

// ── Day-of-Week chart ─────────────────────────────────────────────────────────

function DowChart({ data }: { data: any }) {
  if (!data?.length) return null;
  const maxV = Math.max(...data.map((d: any) => d.revenue), 1);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
      {data.map((d: any, i: any) => {
        const h = Math.max(4, (d.revenue / maxV) * 70);
        return (
          <div key={i} title={`${d.label}: ${fmtBRL(d.revenue)}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}>
            <div style={{ width: '100%', height: h, background: d.revenue > 0 ? C.gold : C.border, borderRadius: '4px 4px 0 0', opacity: d.revenue > 0 ? 1 : 0.4 }} />
            <span style={{ fontSize: 10, color: C.light }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, color = C.gold, negative = false, warning = false }: { icon: any, label: any, value: any, sub?: any, color?: any, negative?: any, warning?: any }) {
  return (
    <div style={{
      background: warning ? 'rgba(239,68,68,0.03)' : C.card, borderRadius: 12, padding: '18px 20px',
      border: `1px solid ${warning ? 'rgba(239,68,68,0.3)' : C.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: negative ? C.danger : C.text, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: any }) {
  return <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>{children}</p>;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: any, onClose: any, children: any }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.card, borderRadius: 14, padding: '28px 32px', width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{title}</p>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.light }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InputRow({ label, children }: { label: any, children: any }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: 13, color: C.text, outline: 'none',
  boxSizing: 'border-box',
};

// ── FATURAMENTO TAB ───────────────────────────────────────────────────────────

function FaturamentoTab({ adminToken, refreshTick }: { adminToken: any, refreshTick: any }) {
  const today = todaySP();
  const [dateRange, setDateRange]   = useState({ from: firstOfMonth(), to: today, fromTime: '00:00', toTime: '23:59' });
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [lastUpdate, setLastUpdate] = useState<any>(null);
  const [search, setSearch]         = useState('');
  const [pmFilter, setPmFilter]     = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/financial?action=overview&from=${dateRange.from}&to=${dateRange.to}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const d = await res.json();
      if (!d.error) { setData(d); setLastUpdate(new Date() as any); }
    } catch {}
    setLoading(false);
  }, [adminToken, dateRange.from, dateRange.to]);

  useEffect(() => { load(); }, [load, refreshTick]);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const ov = data?.overview || {};

  const filteredOrders = (data?.orders || []).filter((o: any) => {
    const matchSearch = !search || o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      String(o.order_number).includes(search);
    const matchPm = pmFilter === 'all' || o.payment_method === pmFilter;
    return matchSearch && matchPm;
  });

  const cancelledRecent = (data?.orders || []).filter((o: any) => o.status === 'cancelled').slice(0, 3);

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 2 }}>Faturamento</h2>
          {lastUpdate && <p style={{ fontSize: 11, color: C.light }}>Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DateRangePicker value={dateRange} onChange={v => setDateRange(v)} />
          <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.gold, border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Cancelled warning */}
      {cancelledRecent.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertTriangle size={16} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.danger, marginBottom: 4 }}>
              {ov.cancelledCount} pedido(s) cancelado(s) — {fmtBRL(ov.cancelledValue)} não contabilizado(s)
            </p>
            <p style={{ fontSize: 11, color: C.muted }}>
              Esses valores foram removidos do faturamento. Verifique o histórico de pedidos.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
        <KPICard icon={DollarSign}  label="Faturamento Bruto"  value={fmtBRL(ov.grossRevenue)}  sub={`${ov.ordersCount || 0} pedidos`} />
        <KPICard icon={TrendingUp}  label="Lucro Estimado"     value={fmtBRL(ov.estimatedProfit)} sub="Após CMV 35% e motoboy" color={C.success} />
        <KPICard icon={ShoppingBag} label="Ticket Médio"       value={fmtBRL(ov.avgTicket)}       sub="Por pedido entregue" color={C.blue} />
        <KPICard icon={BarChart2}   label="Projeção do Mês"   value={fmtBRL(ov.monthlyProjection)} sub="Base no ritmo atual" color={C.purple} />
      </div>

      {/* KPI Cards Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KPICard icon={Bike}    label="Taxas de Entrega"  value={fmtBRL(ov.deliveryFees)}  sub="Cobradas dos clientes" color={C.orange} />
        <KPICard icon={Tag}     label="Descontos Cupons"  value={fmtBRL(ov.couponsUsed)}   sub="Total aplicado" color={C.teal} negative={false} />
        <KPICard icon={Wallet}  label="Cashback Usado"    value={fmtBRL(ov.cashbackUsed)}  sub="Total resgatado" color={C.purple} />
        <KPICard icon={Package} label="CMV Estimado"      value={fmtBRL(ov.estimatedCogs)} sub="~35% do faturamento" color={C.muted} />
        {ov.cancelledCount > 0 && (
          <KPICard icon={AlertTriangle} label="Cancelamentos" value={fmtBRL(ov.cancelledValue)} sub={`${ov.cancelledCount} pedido(s)`} color={C.danger} warning />
        )}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16, marginBottom: 24 }}>
        {/* Revenue Bar Chart */}
        <div style={{ background: C.card, borderRadius: 12, padding: '20px 24px', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Faturamento por dia</p>
            {ov.cancelledCount > 0 && <span style={{ fontSize: 11, color: C.danger }}>▪ vermelho = cancelamentos</span>}
          </div>
          <RevenueBarChart data={data?.timeSeries} />
        </div>

        {/* Payment Donut */}
        <div style={{ background: C.card, borderRadius: 12, padding: '20px 18px', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Formas de Pagamento</p>
          <DonutChart data={data?.paymentBreakdown} />
          <div style={{ marginTop: 10 }}>
            {(data?.paymentBreakdown || []).map((p: any, i: any) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: (PM_COLORS as any)[p.method] || C.gold }} />
                  <span style={{ fontSize: 11, color: C.muted }}>{p.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{fmtBRL(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day-of-week chart */}
      {data?.dowBreakdown && (
        <div style={{ background: C.card, borderRadius: 12, padding: '20px 24px', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Faturamento por dia da semana</p>
          <DowChart data={data.dowBreakdown} />
        </div>
      )}

      {/* Orders Table */}
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Extrato de Pedidos</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F9FAFB', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px' }}>
              <Search size={12} color={C.light} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedido" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: C.text, width: 140 }} />
            </div>
            <select value={pmFilter} onChange={e => setPmFilter(e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: C.text, background: '#F9FAFB', outline: 'none' }}>
              <option value="all">Todos pagamentos</option>
              {Object.entries(PM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Data/Hora', 'Nº', 'Cliente', 'Forma de Pgto', 'Taxa Entrega', 'Desconto', 'Cashback', 'Total', 'Status'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: i > 3 ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '28px', textAlign: 'center', color: C.light, fontSize: 13 }}>Nenhum pedido encontrado</td></tr>
              ) : filteredOrders.map((o: any, i: any) => {
                const isCancelled = o.status === 'cancelled';
                return (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: isCancelled ? 0.55 : 1, background: isCancelled ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>{fmtDT(o.created_at)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: C.text }}>#{o.order_number}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: C.text }}>{o.customer_name || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: `${PM_COLORS[o.payment_method] || C.gold}18`, color: PM_COLORS[o.payment_method] || C.gold, fontWeight: 600 }}>
                        {PM_LABELS[o.payment_method] || o.payment_method}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: C.muted }}>{fmtBRL(o.delivery_fee)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: C.danger }}>{parseFloat(o.discount) > 0 ? `-${fmtBRL(o.discount)}` : '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: C.purple }}>{parseFloat(o.cashback_used) > 0 ? `-${fmtBRL(o.cashback_used)}` : '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: isCancelled ? C.danger : C.text }}>{fmtBRL(o.total)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600, background: isCancelled ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: isCancelled ? C.danger : C.success }}>
                        {isCancelled ? 'Cancelado' : 'Concluído'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── CAIXA TAB ─────────────────────────────────────────────────────────────────

function CaixaTab({ adminToken, refreshTick }: { adminToken: any, refreshTick: any }) {
  const [data, setData]               = useState<any>(null);
  const [loading, setLoading]         = useState(false);
  const [lastUpdate, setLastUpdate]   = useState<any>(null);
  const [search, setSearch]           = useState('');
  const [pmFilter, setPmFilter]       = useState('all');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [modal, setModal]             = useState<any>(null); // 'open'|'close'|'sangria'|'suprimento'|'previous'
  const [modalData, setModalData]     = useState<any>({});
  const [submitting, setSubmitting]   = useState(false);
  const [prevSessions, setPrevSessions] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/financial?action=caixa', { headers: { Authorization: `Bearer ${adminToken}` } });
      const d = await res.json();
      if (!d.error) { setData(d); setLastUpdate(new Date() as any); }
    } catch {}
    setLoading(false);
  }, [adminToken]);

  useEffect(() => { load(); }, [load, refreshTick]);
  useEffect(() => { const iv = setInterval(load, 20000); return () => clearInterval(iv); }, [load]);

  async function loadPrevious() {
    const res = await fetch('/api/admin/financial?action=previous_sessions', { headers: { Authorization: `Bearer ${adminToken}` } });
    const d = await res.json();
    setPrevSessions(d.sessions || []);
    setModal('previous');
  }

  async function submitAction(action: any) {
    setSubmitting(true);
    try {
      const body = { action, session_id: data?.currentSession?.id, ...modalData };
      const res = await fetch('/api/admin/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setModal(null);
      setModalData({});
      await load();
    } catch { alert('Erro de conexão'); }
    setSubmitting(false);
  }

  const session = data?.currentSession;
  const summary = data?.summary || {};
  const entries = (data?.entries || []).filter((e: any) => {
    const matchSearch = !search || e.description?.toLowerCase().includes(search.toLowerCase());
    const matchPm = pmFilter === 'all' || e.payment_method === pmFilter;
    const matchType = typeFilter === 'all' || e.type === typeFilter;
    return matchSearch && matchPm && matchType;
  });

  if (!session) {
    return (
      <div style={{ padding: '40px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ background: C.card, borderRadius: 14, padding: '40px', border: `1px solid ${C.border}`, maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: C.goldDim, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Wallet size={26} color={C.gold} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Nenhum caixa aberto</h3>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
            Abra o caixa para registrar as operações do dia. Todos os pedidos recebidos durante a sessão serão listados automaticamente.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setModal('open')} style={{ padding: '10px 28px', background: C.gold, border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Abrir Caixa
            </button>
            <button onClick={loadPrevious} style={{ padding: '10px 20px', background: '#F9FAFB', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Caixas Anteriores
            </button>
          </div>
          {loading && <p style={{ fontSize: 11, color: C.light, marginTop: 12 }}>Verificando…</p>}
          <p style={{ fontSize: 11, color: C.light, marginTop: 16 }}>
            Se as tabelas de caixa ainda não foram criadas no Supabase, execute a migration <code>20260309_cash_register.sql</code>.
          </p>
        </div>

        {/* Open modal */}
        {modal === 'open' && (
          <Modal title="Abrir Caixa" onClose={() => setModal(null)}>
            <InputRow label="Saldo inicial em dinheiro (R$)">
              <input type="number" step="0.01" min="0" placeholder="0,00"
                value={modalData.initial_balance || ''}
                onChange={e => setModalData((p: any) => ({ ...p, initial_balance: e.target.value }))}
                style={inputStyle} />
            </InputRow>
            <button onClick={() => submitAction('open_session')} disabled={submitting}
              style={{ width: '100%', padding: '11px', background: C.gold, border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Abrindo…' : 'Abrir Caixa'}
            </button>
          </Modal>
        )}

        {/* Previous sessions modal */}
        {modal === 'previous' && (
          <Modal title="Caixas Anteriores" onClose={() => setModal(null)}>
            {prevSessions.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nenhum caixa anterior encontrado.</p>
            ) : (
              <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prevSessions.map(s => (
                  <div key={s.id} style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Aberto em {fmtDT(s.opened_at)}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>Fechado {fmtDT(s.closed_at)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ fontSize: 12, color: C.muted }}>Saldo inicial: <b style={{ color: C.text }}>{fmtBRL(s.initial_balance)}</b></span>
                      {s.final_balance != null && <span style={{ fontSize: 12, color: C.muted }}>Saldo final: <b style={{ color: C.success }}>{fmtBRL(s.final_balance)}</b></span>}
                    </div>
                    {s.notes && <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{s.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', flex: 1, minWidth: 200 }}>
          <Search size={12} color={C.light} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquise pela descrição"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: C.text, width: '100%' }} />
        </div>
        <select value={pmFilter} onChange={e => setPmFilter(e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: C.text, background: C.card, outline: 'none' }}>
          <option value="all">Formas de pagamento</option>
          {Object.entries(PM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: C.text, background: C.card, outline: 'none' }}>
          <option value="all">Tipo de operação</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setModal('close')} style={{ padding: '8px 14px', background: C.danger, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Fechar Caixa</button>
          <button onClick={() => setModal('sangria')} style={{ padding: '8px 14px', background: '#FFF7ED', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 8, color: C.orange, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Sangria</button>
          <button onClick={() => setModal('suprimento')} style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: C.blue, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Suprimento</button>
          <button onClick={loadPrevious} style={{ padding: '8px 14px', background: '#F9FAFB', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Caixas Anteriores</button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
        {/* Transaction list */}
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              Lançamentos {lastUpdate && <span style={{ fontWeight: 400, color: C.light, fontSize: 11 }}>· atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
            </p>
            <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.light }}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', position: 'sticky', top: 0 }}>
                  {['Data/Hora', 'Descrição', 'Valor', 'Pagamento', 'Tipo'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 14px', textAlign: i > 1 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '28px', textAlign: 'center', color: C.light, fontSize: 13 }}>Nenhum lançamento</td></tr>
                ) : entries.map((e: any, i: any) => {
                  const isSangria = e.type === 'sangria';
                  const isCancelled = e.type === 'cancelled';
                  const typeColor = TYPE_COLORS[e.type] || C.muted;
                  return (
                    <tr key={e.id || i} style={{ borderBottom: `1px solid ${C.border}`, background: isCancelled ? 'rgba(239,68,68,0.03)' : 'transparent', opacity: isCancelled ? 0.6 : 1 }}>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{fmtDT(e.created_at)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: C.text, maxWidth: 240 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: isSangria ? C.danger : isCancelled ? C.light : C.text }}>
                        {isSangria ? '-' : ''}{fmtBRL(e.amount)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {e.payment_method && (
                          <span style={{ fontSize: 11, color: PM_COLORS[e.payment_method] || C.muted }}>
                            {PM_LABELS[e.payment_method] || e.payment_method}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: `${typeColor}18`, color: typeColor, fontWeight: 600 }}>
                          {TYPE_LABELS[e.type] || e.type}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Session info */}
          <div style={{ background: C.card, borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>Resumo</p>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: C.success, fontWeight: 700 }}>ABERTO</span>
            </div>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Aberto em {fmtDT(session.opened_at)}</p>

            <SectionTitle>Resumo do Caixa</SectionTitle>
            {[
              { label: 'Saldo Inicial',       value: fmtBRL(summary.initialBalance) },
              { label: 'Suprimentos',          value: fmtBRL(summary.totalSuprimentos), color: C.blue },
              { label: 'Sangrias',             value: summary.totalSangrias > 0 ? `-${fmtBRL(summary.totalSangrias)}` : fmtBRL(0), color: C.danger },
              { label: 'Vendas em Dinheiro',   value: fmtBRL(summary.cashVendas), color: C.success },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: color || C.text }}>{value}</span>
              </div>
            ))}
            <div style={{ height: 1, background: C.border, margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Valor em Caixa</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.success }}>{fmtBRL(summary.cashInHand)}</span>
            </div>
          </div>

          {/* Sales summary */}
          <div style={{ background: C.card, borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <SectionTitle>Resumo das Vendas</SectionTitle>
            {(summary.paymentBreakdown || []).map((p: any) => (
              <div key={p.method} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: PM_COLORS[p.method] || C.gold }} />
                  <span style={{ fontSize: 12, color: C.muted }}>{p.label}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{fmtBRL(p.value)}</span>
              </div>
            ))}
            {(summary.paymentBreakdown || []).length === 0 && <p style={{ fontSize: 12, color: C.light }}>Sem vendas ainda</p>}
            <div style={{ height: 1, background: C.border, margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Total</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{fmtBRL(summary.totalVendas)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'sangria' && (
        <Modal title="Sangria" onClose={() => { setModal(null); setModalData({}); }}>
          <InputRow label="Valor (R$)">
            <input type="number" step="0.01" min="0.01" placeholder="0,00" value={modalData.amount || ''} onChange={e => setModalData((p: any) => ({ ...p, amount: e.target.value }))} style={inputStyle} />
          </InputRow>
          <InputRow label="Descrição (opcional)">
            <input placeholder="Ex: Pagamento freelancer" value={modalData.description || ''} onChange={e => setModalData((p: any) => ({ ...p, description: e.target.value }))} style={inputStyle} />
          </InputRow>
          <button onClick={() => submitAction('sangria')} disabled={submitting || !modalData.amount}
            style={{ width: '100%', padding: '11px', background: C.danger, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: (!submitting && modalData.amount) ? 'pointer' : 'not-allowed', opacity: (!modalData.amount) ? 0.5 : 1 }}>
            {submitting ? 'Registrando…' : 'Registrar Sangria'}
          </button>
        </Modal>
      )}

      {modal === 'suprimento' && (
        <Modal title="Suprimento" onClose={() => { setModal(null); setModalData({}); }}>
          <InputRow label="Valor (R$)">
            <input type="number" step="0.01" min="0.01" placeholder="0,00" value={modalData.amount || ''} onChange={e => setModalData((p: any) => ({ ...p, amount: e.target.value }))} style={inputStyle} />
          </InputRow>
          <InputRow label="Descrição (opcional)">
            <input placeholder="Ex: Reforço de troco" value={modalData.description || ''} onChange={e => setModalData((p: any) => ({ ...p, description: e.target.value }))} style={inputStyle} />
          </InputRow>
          <button onClick={() => submitAction('suprimento')} disabled={submitting || !modalData.amount}
            style={{ width: '100%', padding: '11px', background: C.blue, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: (!submitting && modalData.amount) ? 'pointer' : 'not-allowed', opacity: (!modalData.amount) ? 0.5 : 1 }}>
            {submitting ? 'Registrando…' : 'Registrar Suprimento'}
          </button>
        </Modal>
      )}

      {modal === 'close' && (
        <Modal title="Fechar Caixa" onClose={() => { setModal(null); setModalData({}); }}>
          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Valor esperado em caixa</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{fmtBRL(summary.cashInHand)}</p>
          </div>
          <InputRow label="Saldo final conferido (R$)">
            <input type="number" step="0.01" placeholder={String(summary.cashInHand || '0.00')} value={modalData.final_balance || ''} onChange={e => setModalData((p: any) => ({ ...p, final_balance: e.target.value }))} style={inputStyle} />
          </InputRow>
          <InputRow label="Observações (opcional)">
            <textarea placeholder="Anotações do fechamento" value={modalData.notes || ''} onChange={e => setModalData((p: any) => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, height: 72, resize: 'vertical' } as React.CSSProperties} />
          </InputRow>
          <button onClick={() => submitAction('close_session')} disabled={submitting}
            style={{ width: '100%', padding: '11px', background: C.danger, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {submitting ? 'Fechando…' : 'Confirmar Fechamento'}
          </button>
        </Modal>
      )}

      {modal === 'previous' && (
        <Modal title="Caixas Anteriores" onClose={() => setModal(null)}>
          {prevSessions.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nenhum caixa anterior.</p>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {prevSessions.map(s => (
                <div key={s.id} style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Aberto em {fmtDT(s.opened_at)}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>Fechado {fmtDT(s.closed_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>Inicial: <b style={{ color: C.text }}>{fmtBRL(s.initial_balance)}</b></span>
                    {s.final_balance != null && <span style={{ fontSize: 12, color: C.muted }}>Final: <b style={{ color: C.success }}>{fmtBRL(s.final_balance)}</b></span>}
                  </div>
                  {s.notes && <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{s.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── DRE HELPERS ───────────────────────────────────────────────────────────────

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function pctChange(curr: any, prev: any) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function PctBadge({ curr, prev, inverse = false }: { curr: any, prev: any, inverse?: any }) {
  const chg = pctChange(curr, prev);
  if (chg === null) return null;
  const positive = inverse ? chg < 0 : chg > 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 6,
      background: positive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      color: positive ? C.success : C.danger,
    }}>
      {chg > 0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
      {Math.abs(chg).toFixed(1)}%
    </span>
  );
}

function DreRow({ label, value, indent = 0, bold = false, result = false, margin = null, sub = false, color = null, prevValue = null, inverse = false }: { label: any, value: any, indent?: any, bold?: any, result?: any, margin?: any, sub?: any, color?: any, prevValue?: any, inverse?: any }) {
  const fg = color || (result ? C.text : bold ? C.text : C.muted);
  const bg = result ? (value >= 0 ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)') : 'transparent';
  const valColor = value < 0 ? C.danger : (value > 0 ? (result ? C.success : C.text) : C.light);
  return (
    <tr style={{ background: bg, borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: `${result ? 10 : 7}px 16px`, paddingLeft: 16 + indent * 20 }}>
        <span style={{ fontSize: sub ? 12 : 13, fontWeight: bold || result ? 700 : 400, color: fg, display: 'flex', alignItems: 'center', gap: 6 }}>
          {label}
          {margin !== null && (
            <span style={{ fontSize: 11, fontWeight: 600, color: margin >= 0 ? C.success : C.danger, background: margin >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 10 }}>
              {margin.toFixed(1)}%
            </span>
          )}
        </span>
      </td>
      <td style={{ padding: `${result ? 10 : 7}px 16px`, textAlign: 'right', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: sub ? 12 : 13, fontWeight: bold || result ? 700 : 400, color: valColor }}>
          {fmtBRL(value)}
        </span>
      </td>
      <td style={{ padding: `${result ? 10 : 7}px 16px`, textAlign: 'right', width: 90 }}>
        {prevValue !== null && <PctBadge curr={value} prev={prevValue} inverse={inverse} />}
      </td>
    </tr>
  );
}

function DreSeparator({ label }: { label: any }) {
  return (
    <tr>
      <td colSpan={3} style={{ padding: '6px 16px', background: '#F8F9FA', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 1 }}>
          {label}
        </span>
      </td>
    </tr>
  );
}

function DreBarChart({ data }: { data: any }) {
  if (!data || data.length === 0) return null;
  const maxV = Math.max(...data.map((d: any) => Math.max(d.revenue, d.expenses, 0.01)));
  const W = 600, H = 160, padL = 8, padR = 8, padT = 10, padB = 30;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const n = data.length;
  const groupW = cW / n;
  const barW = Math.max(3, Math.min(12, groupW * 0.35));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {data.map((d: any, i: any) => {
        const x = padL + i * groupW + groupW / 2;
        const rh = (d.revenue / maxV) * cH;
        const eh = (d.expenses / maxV) * cH;
        const ry = padT + cH - rh;
        const ey = padT + cH - eh;
        const showLabel = n <= 14 || i % Math.ceil(n / 7) === 0;
        return (
          <g key={d.date}>
            {rh > 0 && <rect x={x - barW - 1} y={ry} width={barW} height={rh} fill={C.success} rx={2} opacity={0.85} />}
            {eh > 0 && <rect x={x + 1} y={ey} width={barW} height={eh} fill={C.danger} rx={2} opacity={0.85} />}
            {showLabel && (
              <text x={x} y={H - 6} textAnchor="middle" fontSize={9} fill={C.light}>
                {d.date.slice(8)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={padL} y1={padT + cH} x2={W - padR} y2={padT + cH} stroke={C.border} strokeWidth={1} />
    </svg>
  );
}

// ── DRE TAB ───────────────────────────────────────────────────────────────────

function DreCompareModal({ c, p, dateRange, onClose }: { c: any, p: any, dateRange: any, onClose: any }) {
  if (!p) return null;
  const rows = [
    { label: '(+) Receita Bruta de Vendas',     cVal: c.grossRevenue,  pVal: p.grossRevenue,  bold: true },
    { label: 'Vendas (Pedidos)',                 cVal: c.salesRevenue,  pVal: p.salesRevenue,  indent: true },
    { label: 'Taxas de Entrega',                 cVal: c.deliveryFees,  pVal: p.deliveryFees,  indent: true },
    { label: '(-) Deduções da Receita',          cVal: -c.deductions,   pVal: -p.deductions,   bold: true, danger: true },
    { label: '(=) RECEITA LÍQUIDA',             cVal: c.netRevenue,    pVal: p.netRevenue,    result: true },
    { label: '(-) CMV (~35%)',                   cVal: -c.cmv,          pVal: -p.cmv,          danger: true },
    { label: '(=) LUCRO BRUTO',                 cVal: c.grossProfit,   pVal: p.grossProfit,   result: true },
    { label: '(-) Despesas Operacionais',        cVal: -c.expenses,     pVal: -p.expenses,     danger: true },
    { label: '(=) RESULTADO OPERACIONAL (EBITDA)', cVal: c.ebitda,     pVal: p.ebitda,        result: true },
    { label: '(=) RESULTADO DO PERÍODO',         cVal: c.netProfit,    pVal: p.netProfit,     result: true },
  ];

  const fmtPeriodLabel = (from: any, to: any) => `${from.split('-').reverse().join('/')} — ${to.split('-').reverse().join('/')}`;

  // Estimate previous period dates
  const currDays = (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000 + 1;
  const prevTo   = new Date(new Date(dateRange.from).getTime() - 86400000).toISOString().split('T')[0];
  const prevFrom = new Date(new Date(dateRange.from).getTime() - currDays * 86400000).toISOString().split('T')[0];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 860, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Comparativo — DRE</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Período atual vs. período anterior de mesmo tamanho</div>
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8F9FA' }}>
              <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Linha DRE</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: C.blue, borderBottom: `1px solid ${C.border}` }}>
                Período Atual<br /><span style={{ fontSize: 10, fontWeight: 400 }}>{fmtPeriodLabel(dateRange.from, dateRange.to)}</span>
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: C.muted, borderBottom: `1px solid ${C.border}` }}>
                Período Anterior<br /><span style={{ fontSize: 10, fontWeight: 400 }}>{fmtPeriodLabel(prevFrom, prevTo)}</span>
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: C.muted, borderBottom: `1px solid ${C.border}`, width: 90 }}>Var. %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const chg = pctChange(row.cVal, row.pVal);
              const positive = row.danger ? (chg ?? 0) <= 0 : (chg ?? 0) >= 0;
              const bg = row.result ? (row.cVal >= 0 ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)') : 'transparent';
              return (
                <tr key={i} style={{ background: bg, borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: `${row.result ? 10 : 7}px 20px`, paddingLeft: row.indent ? 36 : 20 }}>
                    <span style={{ fontSize: row.indent ? 12 : 13, fontWeight: row.bold || row.result ? 700 : 400, color: row.danger ? C.danger : row.result ? C.text : C.muted }}>
                      {row.label}
                    </span>
                  </td>
                  <td style={{ padding: `${row.result ? 10 : 7}px 16px`, textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: row.bold || row.result ? 700 : 400, color: row.cVal < 0 ? C.danger : row.result ? C.success : C.text }}>
                      {fmtBRL(row.cVal)}
                    </span>
                  </td>
                  <td style={{ padding: `${row.result ? 10 : 7}px 16px`, textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: row.bold || row.result ? 700 : 400, color: C.muted }}>
                      {fmtBRL(row.pVal)}
                    </span>
                  </td>
                  <td style={{ padding: `${row.result ? 10 : 7}px 16px`, textAlign: 'right' }}>
                    {chg !== null && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: positive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: positive ? C.success : C.danger }}>
                        {chg > 0 ? '+' : ''}{chg.toFixed(1)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '14px 20px', background: '#FAFAFA', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.light, borderRadius: '0 0 12px 12px' }}>
          * CMV estimado em 35% da receita líquida. Período anterior calculado com o mesmo número de dias imediatamente antes do período atual.
        </div>
      </div>
    </div>
  );
}

function DreTab({ adminToken, refreshTick }: { adminToken: any, refreshTick: any }) {
  const [data, setData]           = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const last  = new Date(year, month, 0).getDate();
    const to    = `${year}-${String(month).padStart(2,'0')}-${last}`;
    return { from, to, fromTime: '00:00', toTime: '23:59' };
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/financial?action=dre&from=${dateRange.from}&to=${dateRange.to}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const d = await res.json();
      if (!d.error) setData(d);
    } catch {}
    setLoading(false);
  }, [adminToken, dateRange.from, dateRange.to]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const EMPTY_CURRENT = {
    ordersCount: 0, cancelledCount: 0, cancelledValue: 0,
    salesRevenue: 0, deliveryFees: 0, grossRevenue: 0,
    coupons: 0, cashback: 0, deductions: 0,
    netRevenue: 0, cmv: 0, grossProfit: 0, grossMargin: 0,
    expenses: 0, expenseEntries: [],
    ebitda: 0, ebitdaMargin: 0, netProfit: 0, netMargin: 0,
  };
  const c = data?.current || EMPTY_CURRENT;
  const p = data?.previous;

  return (
    <>
    {showCompare && <DreCompareModal c={c} p={p} dateRange={dateRange} onClose={() => setShowCompare(false)} />}
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={20} color={C.gold} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>DRE — Demonstração do Resultado</div>
            <div style={{ fontSize: 12, color: C.muted }}>Resultado financeiro do período selecionado</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DateRangePicker value={dateRange} onChange={v => setDateRange(v)} />
          <button onClick={load} disabled={loading} style={{ padding: '8px 12px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 13 }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={() => window.print()} style={{ padding: '8px 14px', background: C.gold, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          <div>Carregando DRE...</div>
        </div>
      )}

      {/* ── DRE Content ── */}
      {true && (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <KPICard icon={DollarSign}   label="Receita Bruta"    value={fmtBRL(c.grossRevenue)} sub={`${c.ordersCount} pedidos`}  color={C.blue} />
            <KPICard icon={Receipt}      label="Receita Líquida"  value={fmtBRL(c.netRevenue)}   sub={`Deduzido R$ ${(c.deductions).toFixed(2).replace('.',',')}`} color={C.teal} />
            <KPICard icon={TrendingUp}   label="Lucro Bruto"      value={fmtBRL(c.grossProfit)}  sub={`Margem ${c.grossMargin.toFixed(1)}%`} color={c.grossProfit >= 0 ? C.success : C.danger} />
            <KPICard icon={Activity}     label="Resultado do Período" value={fmtBRL(c.netProfit)} sub={`Margem ${c.netMargin.toFixed(1)}%`} color={c.netProfit >= 0 ? C.success : C.danger} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
            {/* ── DRE Table ── */}
            <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Demonstração do Resultado do Exercício</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {dateRange.from.split('-').reverse().join('/')} — {dateRange.to.split('-').reverse().join('/')}
                  </div>
                </div>
                <button
                  onClick={() => setShowCompare(true)}
                  disabled={!p}
                  style={{ fontSize: 11, color: p ? C.blue : C.light, fontWeight: p ? 600 : 400, background: p ? '#EFF6FF' : 'transparent', border: p ? '1px solid #BFDBFE' : 'none', borderRadius: 5, padding: p ? '3px 10px' : 0, cursor: p ? 'pointer' : 'default' }}
                >
                  {p ? '📊 vs. período anterior' : 'vs. período anterior'}
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '100%' }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 90 }} />
                </colgroup>
                <tbody>
                  <DreSeparator label="Receitas" />
                  <DreRow label="(+) Receita Bruta de Vendas"  value={c.grossRevenue}  bold prevValue={p?.grossRevenue} />
                  <DreRow label="Vendas (Pedidos)"             value={c.salesRevenue}  indent={1} sub />
                  <DreRow label="Taxas de Entrega"             value={c.deliveryFees}  indent={1} sub />
                  {c.cancelledValue > 0 && (
                    <DreRow label={`Cancelamentos (${c.cancelledCount})`} value={-c.cancelledValue} indent={1} sub color={C.danger} />
                  )}

                  <DreSeparator label="Deduções" />
                  <DreRow label="(-) Deduções da Receita"      value={-c.deductions}   bold color={C.danger} inverse />
                  <DreRow label="Descontos / Cupons"           value={-c.coupons}      indent={1} sub color={C.danger} />
                  <DreRow label="Cashback Concedido"           value={-c.cashback}     indent={1} sub color={C.danger} />

                  <DreSeparator label="Receita Líquida" />
                  <DreRow label="(=) RECEITA LÍQUIDA"          value={c.netRevenue}    result bold prevValue={p?.netRevenue} />

                  <DreSeparator label="Custo das Mercadorias Vendidas" />
                  <DreRow label="(-) CMV — Custo das Mercadorias Vendidas" value={-c.cmv} bold color={C.orange} />
                  <DreRow label="CMV Estimado (~35% da Receita Líquida)" value={-c.cmv} indent={1} sub color={C.orange} />

                  <DreSeparator label="Lucro Bruto" />
                  <DreRow label="(=) LUCRO BRUTO"              value={c.grossProfit}   result bold margin={c.grossMargin} prevValue={p?.grossProfit} />

                  <DreSeparator label="Despesas Operacionais" />
                  <DreRow label="(-) Despesas Operacionais"    value={-c.expenses}     bold color={C.danger} inverse />
                  {c.expenseEntries.length === 0 ? (
                    <DreRow label="Sem despesas lançadas no período" value={0} indent={1} sub color={C.light} />
                  ) : (
                    c.expenseEntries.map((e: any) => (
                      <DreRow
                        key={e.id}
                        label={e.description || 'Sangria de caixa'}
                        value={-parseFloat(e.amount || 0)}
                        indent={1} sub color={C.danger}
                      />
                    ))
                  )}

                  <DreSeparator label="Resultado Operacional" />
                  <DreRow label="(=) RESULTADO OPERACIONAL (EBITDA)" value={c.ebitda} result bold margin={c.ebitdaMargin} />

                  <DreSeparator label="Resultado do Período" />
                  <DreRow label="(=) RESULTADO DO PERÍODO"     value={c.netProfit}     result bold margin={c.netMargin} prevValue={p?.netProfit} />
                </tbody>
              </table>
              <div style={{ padding: '10px 16px', background: '#FAFAFA', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.light }}>
                * CMV estimado em 35% da receita líquida (padrão setor pizzaria). Despesas operacionais originadas das sangrias de caixa.
              </div>
            </div>

            {/* ── Right panel ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Comparison with previous */}
              <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>vs. Período Anterior</div>
                {[
                  { label: 'Receita Bruta',    curr: c.grossRevenue,  prev: p?.grossRevenue },
                  { label: 'Receita Líquida',  curr: c.netRevenue,    prev: p?.netRevenue },
                  { label: 'Lucro Bruto',      curr: c.grossProfit,   prev: p?.grossProfit },
                  { label: 'Resultado',        curr: c.netProfit,     prev: p?.netProfit },
                ].map(row => {
                  const chg = pctChange(row.curr, row.prev);
                  const positive = (chg ?? 0) >= 0;
                  return (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 12, color: C.muted }}>{row.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: row.curr >= 0 ? C.text : C.danger }}>{fmtBRL(row.curr)}</span>
                        {chg !== null && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: positive ? C.success : C.danger }}>
                            {positive ? '+' : ''}{chg.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Margins summary */}
              <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Margens do Período</div>
                {[
                  { label: 'Margem Bruta',     value: c.grossMargin,  color: C.success },
                  { label: 'Margem EBITDA',    value: c.ebitdaMargin, color: C.blue },
                  { label: 'Margem Líquida',   value: c.netMargin,    color: c.netMargin >= 0 ? C.teal : C.danger },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: C.muted }}>{row.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.value.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 6, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, row.value))}%`, background: row.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Revenue composition */}
              <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Composição da Receita</div>
                {[
                  { label: 'Vendas',         value: c.salesRevenue,  color: C.blue,    pct: c.grossRevenue > 0 ? (c.salesRevenue / c.grossRevenue) * 100 : 0 },
                  { label: 'Taxas Entrega',  value: c.deliveryFees,  color: C.orange,  pct: c.grossRevenue > 0 ? (c.deliveryFees / c.grossRevenue) * 100 : 0 },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: C.muted }}>{row.label}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: row.color, fontWeight: 600 }}>{row.pct.toFixed(1)}%</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{fmtBRL(row.value)}</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Chart ── */}
          {data?.timeSeries && data.timeSeries.length > 1 && (
            <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Receitas vs. Despesas — Diário</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.muted }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.success, display: 'inline-block' }} /> Receita</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.danger, display: 'inline-block' }} /> Despesas</span>
                </div>
              </div>
              <DreBarChart data={data?.timeSeries} />
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}

// ── MAIN FINANCIAL COMPONENT ──────────────────────────────────────────────────

export default function Financial({ adminToken, orders }: { adminToken: any, orders: any }) {
  const [tab, setTab]           = useState('faturamento');
  const [refreshTick, setRefreshTick] = useState(0);

  // Bump refreshTick whenever orders list changes (new order arrived)
  const prevOrderCount = useRef<number | null>(null);
  useEffect(() => {
    if (prevOrderCount.current !== null && orders?.length !== prevOrderCount.current) {
      setRefreshTick(t => t + 1);
    }
    prevOrderCount.current = orders?.length ?? 0;
  }, [orders?.length]);

  const tabs = [
    { key: 'faturamento',    label: 'Faturamento'        },
    { key: 'caixa',          label: 'Caixa'              },
    { key: 'lancamentos',    label: 'Lançamentos'        },
    { key: 'fluxo',          label: 'Fluxo de Caixa'    },
    { key: 'analise_pgto',   label: 'Análise Pgtos'     },
    { key: 'analise_receb',  label: 'Análise Recebim.'  },
    { key: 'dre',            label: 'DRE'                },
    { key: 'custos',         label: 'Custos & Impostos' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F4F5F7', minHeight: 0, overflowY: 'auto' }}>
      {/* Tab bar */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '0 28px', display: 'flex', gap: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '14px 20px', border: 'none', background: 'none',
            fontSize: 14, fontWeight: tab === t.key ? 700 : 500,
            color: tab === t.key ? C.gold : C.muted,
            borderBottom: tab === t.key ? `2px solid ${C.gold}` : '2px solid transparent',
            cursor: 'pointer', transition: 'color 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'faturamento'   && <FaturamentoTab          adminToken={adminToken} refreshTick={refreshTick} />}
      {tab === 'caixa'         && <CaixaTab               adminToken={adminToken} refreshTick={refreshTick} />}
      {tab === 'lancamentos'   && <LancamentosTab          adminToken={adminToken} refreshTick={refreshTick} />}
      {tab === 'fluxo'         && <FluxoCaixaTab           adminToken={adminToken} refreshTick={refreshTick} />}
      {tab === 'analise_pgto'  && <AnalisePagamentosTab    adminToken={adminToken} refreshTick={refreshTick} />}
      {tab === 'analise_receb' && <AnaliseRecebimentosTab  adminToken={adminToken} refreshTick={refreshTick} />}
      {tab === 'dre'           && <DreTab                  adminToken={adminToken} refreshTick={refreshTick} />}
      {tab === 'custos'        && <CustosTab               adminToken={adminToken} refreshTick={refreshTick} />}
    </div>
  );
}
