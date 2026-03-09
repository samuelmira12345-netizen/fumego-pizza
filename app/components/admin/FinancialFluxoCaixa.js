'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, TrendingUp, TrendingDown,
  DollarSign, BarChart2, Calendar, Table2, X,
} from 'lucide-react';
import DateRangePicker from './DateRangePicker';

const C = {
  gold: '#F2A800', bg: '#F4F5F7', card: '#ffffff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  success: '#10B981', danger: '#EF4444', blue: '#3B82F6',
  orange: '#F97316', purple: '#8B5CF6', teal: '#14B8A6',
};

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const fmtBRL = v => (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = v => {
  const n = parseFloat(v) || 0;
  if (Math.abs(n) >= 1000) return (n < 0 ? '-' : '') + 'R$' + (Math.abs(n) / 1000).toFixed(1) + 'k';
  return fmtBRL(n);
};

// ── Table view: columns=dates, rows=categories ─────────────────────────────────
function TableView({ data }) {
  const [expanded, setExpanded] = useState(false);
  if (!data?.timeSeries?.length) return <EmptyState />;
  const ts = data.timeSeries;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
        <colgroup>
          <col style={{ width: 180, minWidth: 180 }} />
          {ts.map(d => <col key={d.date} style={{ minWidth: 100 }} />)}
        </colgroup>
        <thead>
          <tr style={{ background: '#F9FAFB', borderBottom: `2px solid ${C.border}` }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.4, position: 'sticky', left: 0, background: '#F9FAFB', zIndex: 1 }}>
              Categoria
            </th>
            {ts.map(d => (
              <th key={d.date} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: C.muted, whiteSpace: 'nowrap' }}>
                {d.date.slice(8)}/{d.date.slice(5,7)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Saldo Inicial */}
          <StickyRow label="Saldo inicial do período" values={ts.map(d => d.opening)} color={C.blue} bold />

          {/* Receitas */}
          <StickyRow label="Total de receitas" values={ts.map(d => d.revenue)} color={C.success} bold />

          {/* Despesas */}
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <td
              onClick={() => setExpanded(e => !e)}
              style={{ padding: '8px 14px', fontWeight: 700, color: C.danger, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, position: 'sticky', left: 0, background: C.card, zIndex: 1, fontSize: 12 }}
            >
              <span style={{ fontSize: 10 }}>{expanded ? '▼' : '▶'}</span> Total de despesas
            </td>
            {ts.map(d => (
              <td key={d.date} style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: d.expenses > 0 ? C.danger : C.light }}>
                {d.expenses > 0 ? `- ${fmtShort(d.expenses)}` : '—'}
              </td>
            ))}
          </tr>
          {expanded && (
            <tr style={{ background: '#FAFAFA', borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '6px 14px 6px 30px', fontSize: 11, color: C.muted, position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 1 }}>
                Custos operacionais
              </td>
              {ts.map(d => (
                <td key={d.date} style={{ padding: '6px 12px', textAlign: 'center', fontSize: 11, color: d.expenses > 0 ? C.danger : C.light }}>
                  {d.expenses > 0 ? `- ${fmtShort(d.expenses)}` : '0,00'}
                </td>
              ))}
            </tr>
          )}

          {/* Saldo final */}
          <StickyRow label="Saldo final do período" values={ts.map(d => d.revenue - d.expenses)} color={C.text} bold signed />
          <StickyRow label="Saldo total"             values={ts.map(d => d.closing)}              color={C.blue} bold />
        </tbody>
      </table>
    </div>
  );
}

function StickyRow({ label, values, color, bold, signed }) {
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: '8px 14px', fontWeight: bold ? 700 : 400, color, position: 'sticky', left: 0, background: C.card, zIndex: 1, fontSize: 12 }}>
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} style={{ padding: '8px 12px', textAlign: 'center', fontWeight: bold ? 700 : 400, color: signed ? (v >= 0 ? C.success : C.danger) : (v > 0 ? color : C.light), fontSize: 12 }}>
          {v !== 0 ? (signed && v > 0 ? '+' : '') + fmtShort(v) : '—'}
        </td>
      ))}
    </tr>
  );
}

// ── Chart view ────────────────────────────────────────────────────────────────
function ChartView({ data }) {
  if (!data?.timeSeries?.length) return <EmptyState />;
  const ts = data.timeSeries;

  const maxVal = Math.max(...ts.map(d => d.closing), 1);
  const minVal = Math.min(...ts.map(d => d.closing), 0);
  const range  = Math.max(maxVal - minVal, 1);

  const W = 800, H = 200, padL = 60, padR = 20, padT = 20, padB = 30;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const n  = ts.length;

  function px(i) { return padL + (i / Math.max(n - 1, 1)) * cW; }
  function py(v) { return padT + cH - ((v - minVal) / range) * cH; }

  const points = ts.map((d, i) => `${px(i)},${py(d.closing)}`).join(' ');
  const fillPts = `${px(0)},${padT + cH} ${points} ${px(n-1)},${padT + cH}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Line Chart */}
      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Evolução do Saldo</div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
          <defs>
            <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue} stopOpacity="0.25" />
              <stop offset="100%" stopColor={C.blue} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Y ticks */}
          {[0, 0.5, 1].map((f, i) => {
            const v = minVal + f * range;
            const y = padT + cH - f * cH;
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F3F4F6" strokeWidth={1} strokeDasharray="4 3" />
                <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={9} fill={C.light}>{fmtShort(v)}</text>
              </g>
            );
          })}
          <polygon points={fillPts} fill="url(#fcGrad)" />
          <polyline points={points} fill="none" stroke={C.blue} strokeWidth={2.5} strokeLinejoin="round" />
          {ts.map((d, i) => (
            <circle key={i} cx={px(i)} cy={py(d.closing)} r={3} fill={C.blue} />
          ))}
          {ts.map((d, i) => {
            const show = n <= 14 || i % Math.ceil(n / 7) === 0 || i === n - 1;
            return show ? (
              <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize={9} fill={C.light}>
                {d.date.slice(8)}/{d.date.slice(5,7)}
              </text>
            ) : null;
          })}
        </svg>
      </div>

      {/* Summary table below chart */}
      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: `1px solid ${C.border}` }}>
              {['Data','Saldo inicial','Receitas','Despesas','Transferências','Saldo do período','Saldo final'].map((h, i) => (
                <th key={h} style={{ padding: '9px 12px', textAlign: i > 0 ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ts.map((d, i) => {
              const saldoPeriodo = d.revenue - d.expenses + d.transfers;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: C.text }}>{d.date.slice(8)}/{d.date.slice(5,7)}/{d.date.slice(0,4)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: C.blue   }}>{fmtBRL(d.opening)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: d.revenue   > 0 ? C.success : C.light }}>{d.revenue   > 0 ? fmtBRL(d.revenue)   : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: d.expenses  > 0 ? C.danger  : C.light }}>{d.expenses  > 0 ? `- ${fmtBRL(d.expenses)}`  : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: d.transfers > 0 ? C.purple  : C.light }}>{d.transfers > 0 ? fmtBRL(d.transfers)  : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: saldoPeriodo >= 0 ? C.success : C.danger, fontWeight: 600 }}>
                    {saldoPeriodo !== 0 ? (saldoPeriodo > 0 ? '+' : '') + fmtBRL(saldoPeriodo) : '—'}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: C.blue, fontWeight: 700 }}>{fmtBRL(d.closing)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Day Detail Modal ───────────────────────────────────────────────────────────
function DayDetailModal({ day, month, year, d, onClose }) {
  const saldoPeriodo = d.revenue - d.expenses + d.transfers;
  const dateStr = `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.border}` };
  const labelStyle = { fontSize: 14, color: C.muted };
  const valueStyle = { fontSize: 14, fontWeight: 700, color: C.text };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>Detalhes do dia {dateStr}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Saldo Inicial */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F9FAFB', borderRadius: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Saldo Inicial:</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{fmtBRL(d.opening)}</span>
          </div>

          {/* Receitas / Despesas side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Receitas */}
            <div style={{ borderLeft: `3px solid ${C.success}`, paddingLeft: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.success, marginBottom: 10 }}>Receitas</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Recebidas:</span>
                <span style={{ ...valueStyle, color: C.success }}>{fmtBRL(d.revenue)}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Pendentes:</span>
                <span style={valueStyle}>{fmtBRL(0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Total:</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.success }}>{fmtBRL(d.revenue)}</span>
              </div>
            </div>

            {/* Despesas */}
            <div style={{ borderLeft: `3px solid ${C.danger}`, paddingLeft: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.danger, marginBottom: 10 }}>Despesas</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Pagas:</span>
                <span style={{ ...valueStyle, color: C.danger }}>{fmtBRL(d.expenses)}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Pendentes:</span>
                <span style={valueStyle}>{fmtBRL(0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Total:</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.danger }}>{fmtBRL(d.expenses)}</span>
              </div>
            </div>
          </div>

          {/* Saldo do Período */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderRadius: 10,
            background: saldoPeriodo >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Saldo do Período:</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: saldoPeriodo >= 0 ? C.success : C.danger }}>
              {saldoPeriodo >= 0 ? '+' : ''}{fmtBRL(saldoPeriodo)}
            </span>
          </div>

          {/* Saldo Final */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(59,130,246,0.08)',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Saldo Final:</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{fmtBRL(d.closing)}</span>
          </div>

          {d.orders > 0 && (
            <div style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>
              {d.orders} pedido{d.orders !== 1 ? 's' : ''} no dia
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Calendar view ─────────────────────────────────────────────────────────────
function CalendarView({ data, period }) {
  const [selectedDay, setSelectedDay] = useState(null);

  if (!data?.timeSeries) return <EmptyState />;
  const ts = data.timeSeries;

  const { year, month } = period;
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Build map day -> data
  const dayMap = {};
  for (const d of ts) {
    const day = parseInt(d.date.slice(8), 10);
    dayMap[day] = d;
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <>
      {selectedDay && (
        <DayDetailModal
          day={selectedDay}
          month={month}
          year={year}
          d={dayMap[selectedDay]}
          onClose={() => setSelectedDay(null)}
        />
      )}
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {/* Calendar header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#F9FAFB', borderBottom: `1px solid ${C.border}` }}>
          {DAYS_PT.map(d => (
            <div key={d} style={{ padding: '10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {d}
            </div>
          ))}
        </div>
        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} style={{ minHeight: 90, border: `1px solid ${C.border}`, background: '#FAFAFA' }} />;
            const d = dayMap[day];
            const today = new Date();
            const isToday = today.getDate() === day && today.getMonth() + 1 === month && today.getFullYear() === year;
            const hasData = d && (d.revenue > 0 || d.expenses > 0);
            return (
              <div
                key={day}
                onClick={() => d && setSelectedDay(day)}
                style={{
                  minHeight: 90, border: `1px solid ${C.border}`, padding: 8,
                  background: isToday ? 'rgba(242,168,0,0.04)' : C.card,
                  position: 'relative',
                  cursor: d ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (d) e.currentTarget.style.background = '#F8FAFF'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isToday ? 'rgba(242,168,0,0.04)' : C.card; }}
              >
                <div style={{
                  fontSize: 12, fontWeight: isToday ? 800 : 500,
                  color: isToday ? C.gold : C.text,
                  width: 22, height: 22, borderRadius: '50%',
                  background: isToday ? C.gold + '22' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 4,
                }}>{day}</div>
                {d && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {d.revenue > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.success }}>
                        <TrendingUp size={9} /> {fmtShort(d.revenue)}
                      </div>
                    )}
                    {d.expenses > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.danger }}>
                        <TrendingDown size={9} /> {fmtShort(d.expenses)}
                      </div>
                    )}
                    {(d.revenue > 0 || d.expenses > 0) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.blue, marginTop: 2, borderTop: `1px solid ${C.border}`, paddingTop: 2 }}>
                        <DollarSign size={9} /> {fmtShort(d.closing)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 20, fontSize: 11, color: C.muted }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.success }}><TrendingUp size={11} /> Receitas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.danger }}><TrendingDown size={11} /> Despesas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.blue }}><DollarSign size={11} /> Saldo final</span>
          <span style={{ marginLeft: 'auto', color: C.light }}>Clique em um dia para ver detalhes</span>
        </div>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: C.light, fontSize: 13 }}>
      Sem dados para o período selecionado
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function FluxoCaixaTab({ adminToken, refreshTick }) {
  const [view, setView]       = useState('chart');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: firstOfMonthSP(), to: todaySP2(), fromTime: '00:00', toTime: '23:59' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/financial?action=fluxo_caixa&from=${dateRange.from}&to=${dateRange.to}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const d = await res.json();
      if (!d.error) setData(d);
    } catch {}
    setLoading(false);
  }, [adminToken, dateRange.from, dateRange.to]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const ts = data?.timeSeries || [];
  const totalReceitas = ts.reduce((s, d) => s + d.revenue, 0);
  const totalDespesas = ts.reduce((s, d) => s + d.expenses, 0);
  const saldoFinal    = ts.length ? ts[ts.length - 1].closing : (data?.openingBalance || 0);

  const VIEWS = [
    { key: 'table',    label: 'Tabela',    icon: Table2 },
    { key: 'chart',    label: 'Gráfico',   icon: BarChart2 },
    { key: 'calendar', label: 'Calendário', icon: Calendar },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        {/* View toggle */}
        <div style={{ display: 'flex', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', border: 'none',
              background: view === v.key ? C.gold : 'none',
              color: view === v.key ? '#fff' : C.muted,
              fontSize: 13, fontWeight: view === v.key ? 700 : 500, cursor: 'pointer',
            }}>
              <v.icon size={14} /> {v.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Period */}
          <DateRangePicker value={dateRange} onChange={v => setDateRange(v)} />
          <button onClick={load} style={{ padding: '8px 12px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.muted }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* KPI row */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
          {[
            { label: 'Saldo inicial',   value: data.openingBalance || 0, color: C.blue   },
            { label: 'Total receitas',  value: totalReceitas,             color: C.success },
            { label: 'Total despesas',  value: -totalDespesas,            color: C.danger  },
            { label: 'Saldo final',     value: saldoFinal,                color: saldoFinal >= 0 ? C.blue : C.danger },
          ].map(k => (
            <div key={k.label} style={{ background: C.card, borderRadius: 10, padding: '14px 18px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.value < 0 ? C.danger : k.color }}>{fmtBRL(k.value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* View content */}
      {loading && !data ? (
        <div style={{ padding: 48, textAlign: 'center', color: C.muted }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          {view === 'table'    && <TableView    data={data} />}
          {view === 'chart'    && <ChartView    data={data} />}
          {view === 'calendar' && <CalendarView data={data} period={{ year: parseInt(dateRange.from.split('-')[0]), month: parseInt(dateRange.from.split('-')[1]) }} />}
        </>
      )}
    </div>
  );
}
