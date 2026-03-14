'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import DateRangePicker from './DateRangePicker';

// ── Local types ───────────────────────────────────────────────────────────────

type NumberLike = number | string;

interface DonutDataItem {
  name: string;
  value: number;
}

interface DonutSlice extends DonutDataItem {
  path: string;
  pct: number;
  color: string;
}

interface DailyDataItem {
  date: string;
  value: number;
}

interface RankedItem {
  name?: string;
  label?: string;
  count?: number;
  value: number;
}

interface PaymentMethodItem {
  method: string;
  label: string;
  value: number;
  count?: number;
}

interface PagamentosData {
  total: number;
  entries: unknown[];
  byCategory: DonutDataItem[];
  timeSeries: DailyDataItem[];
}

interface RecebimentosData {
  total: number;
  ordersCount: number;
  byPaymentMethod: PaymentMethodItem[];
  byCategory: DonutDataItem[];
  timeSeries: DailyDataItem[];
}

const C = {
  gold: '#F2A800', bg: '#F4F5F7', card: '#ffffff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  success: '#10B981', danger: '#EF4444', blue: '#3B82F6',
  orange: '#F97316', purple: '#8B5CF6', teal: '#14B8A6',
};

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const PALETTE = [C.blue, C.orange, C.success, C.purple, C.teal, C.danger, '#F59E0B', '#6366F1', '#EC4899', '#14B8A6'];

const fmtBRL   = (v: NumberLike) => (parseFloat(String(v)) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = (v: NumberLike) => {
  const n = parseFloat(String(v)) || 0;
  if (Math.abs(n) >= 1000) return 'R$' + (Math.abs(n) / 1000).toFixed(1) + 'k';
  return fmtBRL(n);
};

// ── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ data, palette }: { data: DonutDataItem[]; palette?: string[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!data?.length) return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.light, fontSize: 13 }}>
      Sem dados
    </div>
  );

  const total = data.reduce((s: number, d: DonutDataItem) => s + d.value, 0);
  const cx = 90, cy = 90, R = 75, r = 50;
  let angle = -Math.PI / 2;

  const slices = data.map((d: DonutDataItem, i: number): DonutSlice => {
    const pct  = total > 0 ? d.value / total : 0;
    const span = pct * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle),          y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + span),   y2 = cy + R * Math.sin(angle + span);
    const ix1 = cx + r * Math.cos(angle),          iy1 = cy + r * Math.sin(angle);
    const ix2 = cx + r * Math.cos(angle + span),   iy2 = cy + r * Math.sin(angle + span);
    const large = span > Math.PI ? 1 : 0;
    const path = `M ${x1},${y1} A ${R},${R} 0 ${large} 1 ${x2},${y2} L ${ix2},${iy2} A ${r},${r} 0 ${large} 0 ${ix1},${iy1} Z`;
    angle += span;
    return { ...d, path, pct, color: (palette || PALETTE)[i % (palette || PALETTE).length] };
  });

  const hov = hovered !== null ? slices[hovered] : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <svg viewBox="0 0 180 180" style={{ width: 160, height: 160, flexShrink: 0 }}>
        {slices.map((s: DonutSlice, i: number) => (
          <path key={i} d={s.path} fill={s.color}
            opacity={hovered !== null && hovered !== i ? 0.4 : 1}
            style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        {hov ? (
          <>
            <text x={cx} y={cy - 8}  textAnchor="middle" fontSize={9}  fill={C.muted}>{hov.name?.slice(0, 16)}</text>
            <text x={cx} y={cy + 6}  textAnchor="middle" fontSize={13} fontWeight="700" fill={C.text}>{(hov.pct * 100).toFixed(1)}%</text>
            <text x={cx} y={cy + 20} textAnchor="middle" fontSize={9}  fill={C.muted}>{fmtShort(hov.value)}</text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize={9}  fill={C.light}>TOTAL</text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontSize={13} fontWeight="700" fill={C.text}>{fmtShort(total)}</text>
          </>
        )}
      </svg>
      {/* Legend — single column, scrollable if many items */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
        {slices.map((s: DonutSlice, i: number) => (
          <div key={i}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'default', minWidth: 0, padding: '2px 0' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: C.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {s.name}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8 }}>{(s.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bar chart (daily) ─────────────────────────────────────────────────────────
function DailyBarChart({ data, color }: { data: DailyDataItem[]; color?: string }) {
  if (!data?.length) return null;
  const maxV = Math.max(...data.map((d: DailyDataItem) => d.value), 0.01);
  const W = 700, H = 140, padL = 8, padR = 8, padT = 10, padB = 28;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const n  = data.length;
  const barW = Math.max(4, Math.min(16, (cW / n) * 0.6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {data.map((d: DailyDataItem, i: number) => {
        const x  = padL + (i + 0.5) * (cW / n);
        const h  = (d.value / maxV) * cH;
        const y  = padT + cH - h;
        const show = n <= 14 || i % Math.ceil(n / 7) === 0 || i === n - 1;
        return (
          <g key={i}>
            {h > 0 && <rect x={x - barW / 2} y={y} width={barW} height={h} fill={color || C.gold} rx={3} opacity={0.85} />}
            {show && <text x={x} y={H - 4} textAnchor="middle" fontSize={9} fill={C.light}>{d.date?.slice(8)}/{d.date?.slice(5,7)}</text>}
          </g>
        );
      })}
      <line x1={padL} y1={padT + cH} x2={W - padR} y2={padT + cH} stroke={C.border} strokeWidth={1} />
    </svg>
  );
}

// ── Table with rank ───────────────────────────────────────────────────────────
function RankedTable({ items, total, labelCol }: { items: RankedItem[]; total: number; labelCol?: string }) {
  if (!items?.length) return (
    <div style={{ padding: 24, textAlign: 'center', color: C.light, fontSize: 13 }}>Sem dados</div>
  );
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#F9FAFB', borderBottom: `1px solid ${C.border}` }}>
          <th style={{ padding: '9px 14px', textAlign: 'left',   fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.4 }}>{labelCol || 'Categoria'}</th>
          <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.4, width: 60 }}>Qtd</th>
          <th style={{ padding: '9px 14px', textAlign: 'right',  fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.4 }}>Valor</th>
          <th style={{ padding: '9px 14px', textAlign: 'right',  fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.4, width: 90 }}>Percentual</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item: RankedItem, i: number) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          const color = PALETTE[i % PALETTE.length];
          return (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: C.text }}>{item.name || item.label}</span>
                </div>
                <div style={{ marginTop: 4, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, color: C.muted }}>{item.count || '—'}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: C.text }}>{fmtBRL(item.value)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.muted }}>{pct.toFixed(1)}%</td>
            </tr>
          );
        })}
        <tr style={{ background: '#F9FAFB', borderTop: `2px solid ${C.border}` }}>
          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: C.text }} colSpan={2}>Total</td>
          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: C.text }}>{fmtBRL(total)}</td>
          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.muted }}>100%</td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Period picker ─────────────────────────────────────────────────────────────
function PeriodPicker({ period, onPrev, onNext }: { period: { year: number; month: number }; onPrev: () => void; onNext: () => void }) {
  const now = new Date();
  const isCurrent = period.year === now.getFullYear() && period.month === now.getMonth() + 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <button onClick={onPrev} style={{ padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}>
        <ChevronLeft size={16} />
      </button>
      <span style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, color: C.text, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, minWidth: 130, textAlign: 'center' }}>
        {MONTHS_PT[period.month - 1]} {period.year}
      </span>
      <button onClick={onNext} style={{ padding: '8px 10px', border: 'none', background: 'none', cursor: isCurrent ? 'default' : 'pointer', color: isCurrent ? C.light : C.muted, display: 'flex' }}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function firstOfMonthSP() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
}
function todaySP2() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// ── Análise de Pagamentos ─────────────────────────────────────────────────────
export function AnalisePagamentosTab({ adminToken, refreshTick }: { adminToken: string; refreshTick: number }) {
  const [subTab, setSubTab] = useState('categorias');
  const [data, setData]     = useState<PagamentosData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: firstOfMonthSP(), to: todaySP2(), fromTime: '00:00', toTime: '23:59' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/financial?action=analise_pagamentos&from=${dateRange.from}&to=${dateRange.to}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const d = await res.json();
      if (!d.error) setData(d);
    } catch {}
    setLoading(false);
  }, [adminToken, dateRange.from, dateRange.to]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const SUBTABS = [
    { key: 'categorias', label: 'Categorias' },
    { key: 'diario',     label: 'Evolução Diária' },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {SUBTABS.map(t => (
            <button key={t.key} onClick={() => setSubTab(t.key)} style={{
              padding: '8px 18px', border: 'none',
              background: subTab === t.key ? C.gold : 'none',
              color: subTab === t.key ? '#fff' : C.muted,
              fontSize: 13, fontWeight: subTab === t.key ? 700 : 500, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <DateRangePicker value={dateRange} onChange={v => setDateRange(v)} />
          <button onClick={load} style={{ padding: '8px 12px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', display: 'flex', color: C.muted }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* KPI */}
      {data && (
        <div style={{ background: C.card, borderRadius: 10, padding: '14px 20px', border: `1px solid ${C.border}`, display: 'flex', gap: 32 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Total de Despesas</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.danger }}>{fmtBRL(data.total)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Número de Lançamentos</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{(data.entries || []).length}</div>
          </div>
        </div>
      )}

      {subTab === 'categorias' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Distribuição por Categoria</div>
            <DonutChart data={data?.byCategory} palette={PALETTE.map((_, i) => PALETTE[i])} />
          </div>
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>
              Categorias de Despesas
            </div>
            <RankedTable items={data?.byCategory} total={data?.total} labelCol="Categoria" />
          </div>
        </div>
      )}

      {subTab === 'diario' && (
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Despesas por Dia</div>
          <DailyBarChart data={data?.timeSeries} color={C.danger} />
        </div>
      )}
    </div>
  );
}

// ── Análise de Recebimentos ───────────────────────────────────────────────────
export function AnaliseRecebimentosTab({ adminToken, refreshTick }: { adminToken: string; refreshTick: number }) {
  const [subTab, setSubTab] = useState('forma_pagamento');
  const [data, setData]     = useState<RecebimentosData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: firstOfMonthSP(), to: todaySP2(), fromTime: '00:00', toTime: '23:59' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/financial?action=analise_recebimentos&from=${dateRange.from}&to=${dateRange.to}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const d = await res.json();
      if (!d.error) setData(d);
    } catch {}
    setLoading(false);
  }, [adminToken, dateRange.from, dateRange.to]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const SUBTABS = [
    { key: 'forma_pagamento', label: 'Forma de Pagamento' },
    { key: 'categorias',      label: 'Categorias' },
    { key: 'diario',          label: 'Evolução Diária' },
  ];

  const pmPalette: Record<string, string> = { pix: C.gold, card: C.blue, cash: C.success, card_delivery: C.orange };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {SUBTABS.map(t => (
            <button key={t.key} onClick={() => setSubTab(t.key)} style={{
              padding: '8px 18px', border: 'none',
              background: subTab === t.key ? C.gold : 'none',
              color: subTab === t.key ? '#fff' : C.muted,
              fontSize: 13, fontWeight: subTab === t.key ? 700 : 500, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <DateRangePicker value={dateRange} onChange={v => setDateRange(v)} />
          <button onClick={load} style={{ padding: '8px 12px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', display: 'flex', color: C.muted }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* KPI */}
      {data && (
        <div style={{ background: C.card, borderRadius: 10, padding: '14px 20px', border: `1px solid ${C.border}`, display: 'flex', gap: 32 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Total Recebido</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.success }}>{fmtBRL(data.total)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Pedidos</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{data.ordersCount || 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Ticket Médio</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>
              {fmtBRL(data.ordersCount > 0 ? data.total / data.ordersCount : 0)}
            </div>
          </div>
        </div>
      )}

      {subTab === 'forma_pagamento' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Formas de Pagamento</div>
            <DonutChart
              data={data?.byPaymentMethod?.map((p: PaymentMethodItem) => ({ ...p, name: p.label }))}
              palette={data?.byPaymentMethod?.map((p: PaymentMethodItem) => pmPalette[p.method] || C.gold)}
            />
          </div>
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>
              Receitas por Forma de Pagamento
            </div>
            <RankedTable
              items={data?.byPaymentMethod?.map((p: PaymentMethodItem) => ({ ...p, name: p.label }))}
              total={data?.total}
              labelCol="Forma de Pagamento"
            />
          </div>
        </div>
      )}

      {subTab === 'categorias' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Categorias de Receita</div>
            <DonutChart data={data?.byCategory} />
          </div>
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>
              Categorias de Receitas
            </div>
            <RankedTable items={data?.byCategory} total={data?.total} labelCol="Categoria" />
          </div>
        </div>
      )}

      {subTab === 'diario' && (
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Receitas por Dia</div>
          <DailyBarChart data={data?.timeSeries} color={C.success} />
        </div>
      )}
    </div>
  );
}
