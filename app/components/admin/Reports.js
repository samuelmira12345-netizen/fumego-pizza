'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Package, MapPin, Clock, TrendingUp, Users,
  RefreshCw, ChevronDown, Calendar, AlertCircle,
} from 'lucide-react';

// ── Paleta ────────────────────────────────────────────────────────────────────

const C = {
  gold:      '#F2A800',
  bg:        '#F4F5F7',
  card:      '#ffffff',
  border:    '#E5E7EB',
  text:      '#111827',
  muted:     '#6B7280',
  light:     '#9CA3AF',
  success:   '#10B981',
  danger:    '#EF4444',
  purple:    '#8B5CF6',
  blue:      '#3B82F6',
  orange:    '#F97316',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(yyyymmdd) {
  if (!yyyymmdd) return '';
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}/${y}`;
}

function fmtPhone(phone) {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
}

function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── Mini Bar Chart ─────────────────────────────────────────────────────────────

function fmtShort(v, isCurrency) {
  if (!v) return '—';
  if (isCurrency) {
    if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
    return `R$${v.toFixed(0)}`;
  }
  return String(v);
}

function MiniBar({ data, labelKey, valueKey, color = C.gold, height = 160, formatValue, isCurrency = false }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: height + 28, paddingTop: 24 }}>
      {data.map((item, i) => {
        const pct  = (item[valueKey] / max) * 100;
        const hasV = item[valueKey] > 0;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 3, position: 'relative' }}>
            {hasV && (
              <span style={{ position: 'absolute', bottom: `calc(${Math.max(pct, 3)}% + 16px)`, fontSize: 9, fontWeight: 600, color, whiteSpace: 'nowrap', textAlign: 'center' }}>
                {fmtShort(item[valueKey], isCurrency)}
              </span>
            )}
            <div style={{ width: '100%', height: `${Math.max(pct > 0 ? pct : 0, pct > 0 ? 3 : 0)}%`, background: hasV ? color : '#F3F4F6', borderRadius: '4px 4px 0 0', minHeight: hasV ? 3 : 0, maxHeight: height }} />
            <span style={{ fontSize: 10, color: C.light, whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', textAlign: 'center' }}>
              {item[labelKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Card wrapper ───────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

// ── Stat Badge ─────────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 16px', background: color + '12', borderRadius: 8, border: `1px solid ${color}30` }}>
      <p style={{ fontSize: 18, fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</p>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function Empty({ label = 'Nenhum dado para o período selecionado' }) {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center', color: C.light }}>
      <BarChart2 size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
      <p style={{ fontSize: 14 }}>{label}</p>
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────────────────────

function Table({ columns, rows, getKey }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid ' + C.border }}>
            {columns.map(col => (
              <th key={col.key} style={{ padding: '10px 12px', textAlign: col.align || 'left', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={getKey ? getKey(row) : i} style={{ borderBottom: '1px solid ' + C.border, background: i % 2 === 0 ? '#FAFAFA' : C.card }}>
              {columns.map(col => (
                <td key={col.key} style={{ padding: '10px 12px', textAlign: col.align || 'left', color: col.color ? col.color(row) : C.text, fontWeight: col.bold ? 600 : 400, whiteSpace: col.noWrap ? 'nowrap' : 'normal' }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Period Selector ────────────────────────────────────────────────────────────

const PERIODS = [
  { key: 'today',  label: 'Hoje',       from: () => todaySP(),      to: () => todaySP() },
  { key: '7d',     label: '7 dias',     from: () => daysAgo(6),     to: () => todaySP() },
  { key: '30d',    label: '30 dias',    from: () => daysAgo(29),    to: () => todaySP() },
  { key: 'month',  label: 'Este mês',   from: () => firstOfMonth(), to: () => todaySP() },
  { key: 'custom', label: 'Personalizado' },
];

function PeriodSelector({ period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {PERIODS.map(p => (
        <button
          key={p.key}
          onClick={() => setPeriod(p.key)}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: period === p.key ? C.gold : C.card,
            color:      period === p.key ? '#000'  : C.muted,
            border:     period === p.key ? `1px solid ${C.gold}` : '1px solid ' + C.border,
          }}
        >
          {p.label}
        </button>
      ))}
      {period === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ border: '1px solid ' + C.border, borderRadius: 8, padding: '5px 10px', fontSize: 13, color: C.text, background: C.card }} />
          <span style={{ color: C.muted, fontSize: 13 }}>até</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ border: '1px solid ' + C.border, borderRadius: 8, padding: '5px 10px', fontSize: 13, color: C.text, background: C.card }} />
        </div>
      )}
    </div>
  );
}

// ── Report tabs ────────────────────────────────────────────────────────────────

const REPORT_TABS = [
  { key: 'products',      icon: Package,    label: 'Produtos'     },
  { key: 'neighborhoods', icon: MapPin,     label: 'Bairros'      },
  { key: 'hours',         icon: Clock,      label: 'Horários'     },
  { key: 'ticket',        icon: TrendingUp, label: 'Ticket Médio' },
  { key: 'ltv',           icon: Users,      label: 'LTV Clientes' },
];

// ── Report: Produtos ──────────────────────────────────────────────────────────

function ProductsReport({ result }) {
  if (!result?.data?.length) return <Empty />;
  const { data, total_orders } = result;
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatBadge label="Pedidos no período" value={total_orders} color={C.blue} />
        <StatBadge label="Itens vendidos" value={data.reduce((s,r) => s + r.qty, 0)} color={C.orange} />
        <StatBadge label="Faturamento (produtos)" value={fmtBRL(totalRevenue)} color={C.success} />
        <StatBadge label="Produtos diferentes" value={data.length} color={C.purple} />
      </div>

      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.border }}>
          <p style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>Ranking de Produtos por Faturamento</p>
        </div>
        <div style={{ padding: '8px 20px 20px' }}>
          <MiniBar data={data.slice(0, 12)} labelKey="product_name" valueKey="revenue" color={C.gold} height={200} formatValue={fmtBRL} isCurrency />
        </div>
        <Table
          rows={data}
          getKey={r => r.product_name}
          columns={[
            { key: 'rank',         label: '#',           align: 'center', bold: true, render: r => `#${r.rank}` },
            { key: 'product_name', label: 'Produto',     bold: true },
            { key: 'qty',          label: 'Qtd. vendida',align: 'right', render: r => r.qty.toLocaleString('pt-BR') },
            { key: 'revenue',      label: 'Faturamento', align: 'right', bold: true, render: r => fmtBRL(r.revenue), color: () => C.success },
            { key: 'share',        label: 'Share',       align: 'right', render: r => `${((r.revenue / totalRevenue) * 100).toFixed(1)}%`, color: () => C.muted },
          ]}
        />
      </Card>
    </div>
  );
}

// ── Report: Bairros ───────────────────────────────────────────────────────────

function NeighborhoodsReport({ result }) {
  if (!result?.data?.length) return <Empty />;
  const { data, total_orders } = result;
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatBadge label="Pedidos no período" value={total_orders} color={C.blue} />
        <StatBadge label="Bairros atendidos" value={data.length} color={C.purple} />
        <StatBadge label="Faturamento total" value={fmtBRL(totalRevenue)} color={C.success} />
        <StatBadge label="Taxas de entrega" value={fmtBRL(data.reduce((s,r) => s + r.delivery_fee, 0))} color={C.orange} />
      </div>

      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.border }}>
          <p style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>Pedidos por Bairro</p>
        </div>
        <div style={{ padding: '8px 20px 20px' }}>
          <MiniBar data={data.slice(0, 15)} labelKey="neighborhood" valueKey="count" color={C.purple} height={200} />
        </div>
        <Table
          rows={data}
          getKey={r => r.neighborhood}
          columns={[
            { key: 'rank',         label: '#',            align: 'center', bold: true, render: r => `#${r.rank}` },
            { key: 'neighborhood', label: 'Bairro',       bold: true },
            { key: 'count',        label: 'Pedidos',      align: 'right', render: r => r.count.toLocaleString('pt-BR') },
            { key: 'avg_ticket',   label: 'Ticket Médio', align: 'right', render: r => fmtBRL(r.avg_ticket) },
            { key: 'revenue',      label: 'Faturamento',  align: 'right', bold: true, render: r => fmtBRL(r.revenue), color: () => C.success },
            { key: 'delivery_fee', label: 'Taxa Entrega', align: 'right', render: r => fmtBRL(r.delivery_fee), color: () => C.muted },
          ]}
        />
      </Card>
    </div>
  );
}

// ── Report: Horários ──────────────────────────────────────────────────────────

function HoursReport({ result }) {
  if (!result?.data) return <Empty />;
  const { data, peak_hour, total_orders } = result;
  const active = data.filter(h => h.count > 0);
  const totalRevenue = data.reduce((s, h) => s + h.revenue, 0);

  // Show only operational hours (10h–23h) for the chart but full table
  const chartData = data.filter(h => h.hour >= 10 && h.hour <= 23);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatBadge label="Pedidos no período" value={total_orders} color={C.blue} />
        <StatBadge label="Hora de pico" value={peak_hour?.label || '—'} color={C.orange} />
        <StatBadge label="Pedidos no pico" value={peak_hour?.count || 0} color={C.danger} />
        <StatBadge label="Horas com movimento" value={active.length} color={C.purple} />
      </div>

      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.border }}>
          <p style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>Pedidos por Hora do Dia (10h–23h)</p>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Horário de Brasília</p>
        </div>
        <div style={{ padding: '12px 20px 20px' }}>
          <MiniBar data={chartData} labelKey="label" valueKey="count" color={C.orange} height={200} />
        </div>
      </Card>

      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.border }}>
          <p style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>Detalhamento por Hora</p>
        </div>
        <Table
          rows={active.sort((a, b) => b.count - a.count)}
          getKey={r => r.hour}
          columns={[
            { key: 'label',      label: 'Hora',       bold: true },
            { key: 'count',      label: 'Pedidos',    align: 'right', render: r => r.count.toLocaleString('pt-BR') },
            { key: 'revenue',    label: 'Faturamento',align: 'right', render: r => fmtBRL(r.revenue), color: () => C.success },
            { key: 'avg_ticket', label: 'Ticket Médio',align: 'right', render: r => fmtBRL(r.count > 0 ? r.revenue / r.count : 0) },
            { key: 'share',      label: 'Share',      align: 'right', render: r => `${total_orders > 0 ? ((r.count / total_orders) * 100).toFixed(1) : 0}%`, color: () => C.muted },
          ]}
        />
      </Card>
    </div>
  );
}

// ── Report: Ticket Médio ──────────────────────────────────────────────────────

const PM_COLORS = { pix: C.blue, cash: C.success, card_delivery: C.purple };
const PM_ICONS  = { pix: '⚡', cash: '💵', card_delivery: '💳' };

function TicketReport({ result }) {
  if (!result?.totals) return <Empty />;
  const { days, payment_methods, totals } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatBadge label="Pedidos no período" value={totals.total_orders.toLocaleString('pt-BR')} color={C.blue} />
        <StatBadge label="Ticket Médio" value={fmtBRL(totals.avg_ticket)} color={C.gold} />
        <StatBadge label="Faturamento Bruto" value={fmtBRL(totals.total_revenue)} color={C.success} />
        <StatBadge label="Descontos Aplicados" value={fmtBRL(totals.total_discount)} color={C.danger} />
        <StatBadge label="Taxas de Entrega" value={fmtBRL(totals.total_delivery_fee)} color={C.orange} />
        <StatBadge label="Receita Líquida" value={fmtBRL(totals.net_revenue)} color={C.purple} />
      </div>

      {/* Ticket médio por dia */}
      {days.length > 1 && (
        <Card>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.border }}>
            <p style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>Ticket Médio Diário</p>
          </div>
          <div style={{ padding: '12px 20px 20px' }}>
            <MiniBar data={days} labelKey="day" valueKey="avg_ticket" color={C.gold} height={200} formatValue={fmtBRL} isCurrency />
          </div>
          <Table
            rows={[...days].reverse()}
            getKey={r => r.day}
            columns={[
              { key: 'day',         label: 'Data',          render: r => fmtDate(r.day) },
              { key: 'count',       label: 'Pedidos',       align: 'right' },
              { key: 'avg_ticket',  label: 'Ticket Médio',  align: 'right', bold: true, render: r => fmtBRL(r.avg_ticket), color: () => C.gold },
              { key: 'revenue',     label: 'Faturamento',   align: 'right', render: r => fmtBRL(r.revenue), color: () => C.success },
              { key: 'discount',    label: 'Descontos',     align: 'right', render: r => r.discount > 0 ? fmtBRL(r.discount) : '—', color: r => r.discount > 0 ? C.danger : C.light },
              { key: 'delivery_fee',label: 'Taxa Entrega',  align: 'right', render: r => fmtBRL(r.delivery_fee), color: () => C.muted },
            ]}
          />
        </Card>
      )}

      {/* Formas de pagamento */}
      {payment_methods?.length > 0 && (
        <Card style={{ padding: '20px 24px' }}>
          <p style={{ fontWeight: 600, color: C.text, fontSize: 14, marginBottom: 16 }}>Formas de Pagamento</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {payment_methods.map(pm => {
              const color = PM_COLORS[pm.method] || C.muted;
              const pct = totals.total_orders > 0 ? ((pm.count / totals.total_orders) * 100).toFixed(1) : 0;
              return (
                <div key={pm.method} style={{ padding: 16, borderRadius: 10, background: color + '10', border: `1px solid ${color}30` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color }}>{PM_ICONS[pm.method] || '💰'} {pm.label}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{pct}%</span>
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 2 }}>{pm.count}</p>
                  <p style={{ fontSize: 12, color: C.muted }}>pedidos · {fmtBRL(pm.revenue)}</p>
                  <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: C.border }}>
                    <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Report: LTV ───────────────────────────────────────────────────────────────

function LTVReport({ result }) {
  if (!result?.data?.length) return <Empty />;
  const { data, stats } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatBadge label="Clientes únicos" value={stats.total_customers.toLocaleString('pt-BR')} color={C.blue} />
        <StatBadge label="Clientes recorrentes" value={stats.recurrent_customers.toLocaleString('pt-BR')} color={C.success} />
        <StatBadge label="Taxa de recorrência" value={`${stats.recurrence_rate.toFixed(1)}%`} color={C.purple} />
        <StatBadge label="LTV médio (Top 100)" value={fmtBRL(stats.avg_ltv)} color={C.gold} />
      </div>

      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.border }}>
          <p style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>Top 100 Clientes por Lifetime Value</p>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Todos os pedidos — sem filtro de data</p>
        </div>
        <Table
          rows={data}
          getKey={r => r.customer_phone}
          columns={[
            { key: 'rank',           label: '#',          align: 'center', bold: true, render: (r, i) => `#${data.indexOf(r) + 1}` },
            { key: 'customer_name',  label: 'Cliente',    bold: true, render: r => r.customer_name || '—' },
            { key: 'customer_phone', label: 'Telefone',   render: r => fmtPhone(r.customer_phone), noWrap: true },
            { key: 'order_count',    label: 'Pedidos',    align: 'right', render: r => r.order_count.toLocaleString('pt-BR') },
            { key: 'avg_ticket',     label: 'Ticket Méd.', align: 'right', render: r => fmtBRL(r.avg_ticket) },
            { key: 'orders_month',   label: 'Ped./mês',   align: 'right', render: r => r.orders_month.toFixed(1) },
            { key: 'lifetime_value', label: 'LTV Total',  align: 'right', bold: true, render: r => fmtBRL(r.lifetime_value), color: () => C.success },
            { key: 'last_order',     label: 'Último pedido', render: r => fmtDate(r.last_order?.slice(0,10)), noWrap: true, color: () => C.muted },
          ]}
        />
      </Card>
    </div>
  );
}

// ── Main Reports Component ─────────────────────────────────────────────────────

export default function Reports({ adminToken }) {
  const [period, setPeriod]       = useState('30d');
  const [customFrom, setCustomFrom] = useState(daysAgo(29));
  const [customTo, setCustomTo]   = useState(todaySP());
  const [reportType, setReportType] = useState('products');
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Resolve the actual from/to dates
  function getRange() {
    if (period === 'custom') return { from: customFrom, to: customTo };
    const p = PERIODS.find(x => x.key === period);
    return p ? { from: p.from(), to: p.to() } : { from: daysAgo(29), to: todaySP() };
  }

  const fetchReport = useCallback(async (type, prd, cf, ct) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const range = prd === 'custom'
        ? { from: cf, to: ct }
        : (() => { const p = PERIODS.find(x => x.key === prd); return p ? { from: p.from(), to: p.to() } : { from: daysAgo(29), to: todaySP() }; })();

      // LTV doesn't use date range (all-time)
      const params = type === 'ltv'
        ? `type=${type}`
        : `type=${type}&from=${range.from}&to=${range.to}`;

      const res = await fetch(`/api/admin/reports?${params}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || 'Erro ao carregar'); return; }
      setResult(data);
    } catch (e) {
      setError('Erro de conexão: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  // Auto-fetch when type or period changes
  useEffect(() => {
    fetchReport(reportType, period, customFrom, customTo);
  }, [reportType, period, customFrom, customTo, fetchReport]);

  const { from, to } = getRange();

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Cabeçalho ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4 }}>Relatórios</h1>
          {reportType !== 'ltv' && (
            <p style={{ fontSize: 13, color: C.muted }}>
              Período: <strong style={{ color: C.text }}>{fmtDate(from)}</strong> até <strong style={{ color: C.text }}>{fmtDate(to)}</strong>
            </p>
          )}
        </div>
        <button
          onClick={() => fetchReport(reportType, period, customFrom, customTo)}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: '#fff', border: '1px solid ' + C.border, fontSize: 13, fontWeight: 500, color: C.text, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {/* ── Seletor de período ──────────────────────────────────────────────── */}
      {reportType !== 'ltv' && (
        <div style={{ marginBottom: 20 }}>
          <PeriodSelector
            period={period} setPeriod={setPeriod}
            customFrom={customFrom} setCustomFrom={setCustomFrom}
            customTo={customTo} setCustomTo={setCustomTo}
          />
        </div>
      )}

      {/* ── Tabs dos relatórios ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: C.card, borderRadius: 10, padding: 4, border: '1px solid ' + C.border, width: 'fit-content' }}>
        {REPORT_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = reportType === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setReportType(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: isActive ? C.gold : 'transparent',
                color: isActive ? '#000' : C.muted,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Erro ────────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: 20, color: C.danger, fontSize: 13 }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* ── Skeleton de carregamento ────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[140, 240, 80].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 12, background: '#E5E7EB', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
        </div>
      )}

      {/* ── Conteúdo do relatório ───────────────────────────────────────────── */}
      {!loading && !error && (
        <>
          {reportType === 'products'      && <ProductsReport      result={result} />}
          {reportType === 'neighborhoods' && <NeighborhoodsReport result={result} />}
          {reportType === 'hours'         && <HoursReport         result={result} />}
          {reportType === 'ticket'        && <TicketReport        result={result} />}
          {reportType === 'ltv'           && <LTVReport           result={result} />}
        </>
      )}
    </div>
  );
}
