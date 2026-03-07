'use client';

import { useMemo } from 'react';
import {
  ShoppingBag, DollarSign, TrendingUp, ChefHat,
  Truck, CheckCircle, XCircle, Clock, BarChart2, RefreshCw,
  Percent, CreditCard, Tag, AlertTriangle, Banknote, Zap,
  TrendingDown, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';

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
function fmtBRL(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(yyyymmdd) {
  if (!yyyymmdd) return '';
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}`;
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function fmtShort(v, isCurrency) {
  if (!v) return '—';
  if (isCurrency) {
    if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
    return `R$${v.toFixed(0)}`;
  }
  return String(v);
}

function BarChart({ data, labelKey, valueKey, color = '#F2A800', formatValue, height = 220, isCurrency = false }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  const hasAnyValue = data.some(d => d[valueKey] > 0);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: height + 32, paddingTop: 28 }}>
      {data.map((item, i) => {
        const pct = max > 0 ? (item[valueKey] / max) * 100 : 0;
        const hasValue = item[valueKey] > 0;
        return (
          <div key={i}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end', position: 'relative' }}
          >
            {/* Value label above bar */}
            {hasValue && (
              <span style={{
                position: 'absolute',
                bottom: `calc(${Math.max(pct, 4)}% + 20px)`,
                fontSize: 9, fontWeight: 600, color: color,
                whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1,
              }}>
                {fmtShort(item[valueKey], isCurrency)}
              </span>
            )}
            {/* Bar */}
            <div style={{
              width: '100%',
              height: `${Math.max(pct, hasValue ? 3 : 0)}%`,
              background: hasValue ? color : '#F3F4F6',
              borderRadius: '5px 5px 0 0',
              transition: 'height 0.4s ease',
              minHeight: hasValue ? 3 : 0,
              maxHeight: height,
            }} />
            {/* X-axis label */}
            <span style={{ fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', textAlign: 'center', paddingBottom: 2 }}>
              {item[labelKey]}
            </span>
          </div>
        );
      })}
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

export default function Dashboard({ orders, onRefresh, loading }) {
  const today     = todaySP();
  const yesterday = yesterdaySP();

  const metrics = useMemo(() => {
    const todayOrders     = orders.filter(o => toSPDate(o.created_at) === today);
    const yesterdayOrders = orders.filter(o => toSPDate(o.created_at) === yesterday);

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

      // Pedidos por status
      const byStatus = (s) => list.filter(o => o.status === s).length;

      // Pedidos por forma de pagamento
      const byPayment = {};
      for (const o of active) {
        const pm = o.payment_method || 'pix';
        if (!byPayment[pm]) byPayment[pm] = { count: 0, revenue: 0 };
        byPayment[pm].count++;
        byPayment[pm].revenue += parseFloat(o.total) || 0;
      }

      // Aguardando pagamento PIX (pedido existe mas pagamento pending)
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
    const yd = agg(yesterdayOrders);

    // Delta % vs ontem (returns null se ontem = 0)
    function delta(todayV, yestV) {
      if (yestV === 0) return null;
      return ((todayV - yestV) / yestV) * 100;
    }

    // Vendas por hora (10h–23h)
    const hourlyData = Array.from({ length: 14 }, (_, i) => {
      const h = i + 10;
      const total = todayOrders
        .filter(o => o.status !== 'cancelled')
        .filter(o => toSPHour(o.created_at) === h)
        .reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
      return { hour: `${String(h).padStart(2,'0')}h`, total };
    });

    // Pedidos nos últimos 7 dias
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    });
    const weeklyData = last7.map(date => ({
      date: fmtDate(date),
      count: orders.filter(o => toSPDate(o.created_at) === date && o.status !== 'cancelled').length,
    }));

    // Receita por dia (últimos 7)
    const weeklyRevenue = last7.map(date => ({
      date: fmtDate(date),
      total: orders
        .filter(o => toSPDate(o.created_at) === date && o.status !== 'cancelled')
        .reduce((s, o) => s + (parseFloat(o.total) || 0), 0),
    }));

    return { td, yd, delta, hourlyData, weeklyData, weeklyRevenue };
  }, [orders, today, yesterday]);

  const { td, yd, delta, hourlyData, weeklyData, weeklyRevenue } = metrics;

  const now = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>

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

      {/* ── OPERAÇÃO DO DIA ────────────────────────────────────────────────── */}
      <SectionTitle>Operação do dia</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>

        <KpiCard icon={ShoppingBag} iconColor="#6366F1" iconBg="rgba(99,102,241,0.1)"
          label="Pedidos do dia" value={td.total}
          sub={`${td.pending} pendente${td.pending !== 1 ? 's' : ''}`}
          delta={delta(td.total, yd.total)} deltaLabel={`ontem: ${yd.total}`}
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
          delta={delta(td.delivered, yd.delivered)} deltaLabel={`ontem: ${yd.delivered}`}
        />
        <KpiCard icon={XCircle} iconColor="#EF4444" iconBg="rgba(239,68,68,0.1)"
          label="Cancelados" value={td.cancelled}
          highlight={td.cancelled > 0 ? '#EF4444' : '#111827'}
        />
        <KpiCard icon={Clock} iconColor="#6B7280" iconBg="rgba(107,114,128,0.1)"
          label="Tempo méd. entrega" value="—" sub="em breve"
        />
      </div>

      {/* ── FINANCEIRO DO DIA ─────────────────────────────────────────────── */}
      <SectionTitle>Financeiro do dia</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>

        <KpiCard icon={DollarSign} iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"
          label="Faturamento bruto" value={fmtBRL(td.revenue)}
          sub="pedidos não cancelados"
          delta={delta(td.revenue, yd.revenue)} deltaLabel={`ontem: ${fmtBRL(yd.revenue)}`}
        />
        <KpiCard icon={TrendingUp} iconColor="#F2A800" iconBg="rgba(242,168,0,0.1)"
          label="Ticket médio" value={fmtBRL(td.avgTicket)}
          sub="por pedido ativo"
          delta={delta(td.avgTicket, yd.avgTicket)} deltaLabel={`ontem: ${fmtBRL(yd.avgTicket)}`}
        />
        <KpiCard icon={Truck} iconColor="#3B82F6" iconBg="rgba(59,130,246,0.1)"
          label="Taxa de entrega" value={fmtBRL(td.delivFee)}
          sub="arrecadada hoje"
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
          <SectionTitle>Formas de pagamento — hoje</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
            {Object.entries(td.byPayment).map(([method, { count, revenue }]) => (
              <PaymentMethodCard key={method} method={method} count={count} revenue={revenue} total={td.active} />
            ))}
          </div>
        </>
      )}

      {/* ── GRÁFICOS ──────────────────────────────────────────────────────── */}
      <SectionTitle>Gráficos</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 12 }}>

        {/* Faturamento por hora — hoje */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px 20px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} color="#F2A800" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Faturamento por hora — hoje</h3>
            </div>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>10h–23h · pedidos ativos</span>
          </div>
          {hourlyData.every(d => d.total === 0)
            ? <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: 14 }}>Nenhuma venda registrada hoje</div>
            : <BarChart data={hourlyData} labelKey="hour" valueKey="total" color="#F2A800" formatValue={fmtBRL} height={220} isCurrency />
          }
        </div>

        {/* Faturamento bruto — últimos 7 dias */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px 20px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} color="#10B981" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Faturamento bruto — últimos 7 dias</h3>
            </div>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>pedidos não cancelados</span>
          </div>
          {weeklyRevenue.every(d => d.total === 0)
            ? <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: 14 }}>Nenhum faturamento nos últimos 7 dias</div>
            : <BarChart data={weeklyRevenue} labelKey="date" valueKey="total" color="#10B981" formatValue={fmtBRL} height={220} isCurrency />
          }
        </div>

        {/* Pedidos — últimos 7 dias */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px 20px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} color="#6366F1" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Pedidos — últimos 7 dias</h3>
            </div>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>pedidos não cancelados</span>
          </div>
          {weeklyData.every(d => d.count === 0)
            ? <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: 14 }}>Nenhum pedido nos últimos 7 dias</div>
            : <BarChart data={weeklyData} labelKey="date" valueKey="count" color="#6366F1" height={220} />
          }
        </div>

      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: '#D1D5DB' }}>
        Métricas calculadas a partir dos pedidos carregados · Clique em "Atualizar" para sincronizar · Para análises detalhadas acesse Relatórios
      </p>
    </div>
  );
}
