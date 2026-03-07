'use client';

import { useMemo } from 'react';
import {
  ShoppingBag, DollarSign, TrendingUp, ChefHat,
  Truck, CheckCircle, XCircle, Clock, BarChart2, RefreshCw,
} from 'lucide-react';

// ── Helpers de data no fuso de São Paulo ────────────────────────────────────

function toSPDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function toSPHour(isoStr) {
  return parseInt(
    new Date(isoStr).toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    })
  );
}

function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function fmtBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(yyyymmdd) {
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}`;
}

// ── Mini Bar Chart (CSS puro, sem dependências) ───────────────────────────────

function BarChart({ data, labelKey, valueKey, color = '#F2A800', formatValue, height = 140 }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, paddingTop: 8 }}>
      {data.map((item, i) => {
        const pct = max > 0 ? (item[valueKey] / max) * 100 : 0;
        return (
          <div
            key={i}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}
            title={`${item[labelKey]}: ${formatValue ? formatValue(item[valueKey]) : item[valueKey]}`}
          >
            <div
              style={{
                width: '100%',
                height: `${Math.max(pct, pct > 0 ? 4 : 0)}%`,
                background: item[valueKey] > 0 ? color : '#E5E7EB',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.4s ease',
                minHeight: item[valueKey] > 0 ? 4 : 0,
                cursor: 'default',
              }}
            />
            <span style={{ fontSize: 9, color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', textAlign: 'center' }}>
              {item[labelKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, iconColor, iconBg, label, value, sub, highlight }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '20px 24px',
      border: '1px solid #E5E7EB',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: iconBg || 'rgba(242,168,0,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={22} color={iconColor || '#F2A800'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 2 }}>{label}</p>
        <p style={{
          fontSize: 22, fontWeight: 700, color: highlight || '#111827',
          lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {value}
        </p>
        {sub && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Dashboard Principal ───────────────────────────────────────────────────────

export default function Dashboard({ orders, onRefresh, loading }) {
  const today = todaySP();

  const {
    todayOrders,
    revenue,
    avgTicket,
    inProduction,
    inDelivery,
    delivered,
    cancelled,
    pending,
    hourlyData,
    weeklyData,
  } = useMemo(() => {
    const todayOrders = orders.filter(o => toSPDate(o.created_at) === today);
    const activeOrders = todayOrders.filter(o => o.status !== 'cancelled');
    const revenue = activeOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const avgTicket = activeOrders.length > 0 ? revenue / activeOrders.length : 0;

    const inProduction = todayOrders.filter(o => ['confirmed', 'preparing'].includes(o.status)).length;
    const inDelivery   = todayOrders.filter(o => o.status === 'delivering').length;
    const delivered    = todayOrders.filter(o => o.status === 'delivered').length;
    const cancelled    = todayOrders.filter(o => o.status === 'cancelled').length;
    const pending      = todayOrders.filter(o => o.status === 'pending').length;

    // Vendas por hora — apenas horas de 10h às 23h para focar no período operacional
    const hourlyData = Array.from({ length: 14 }, (_, i) => {
      const h = i + 10; // 10h → 23h
      const total = todayOrders
        .filter(o => o.status !== 'cancelled')
        .filter(o => toSPHour(o.created_at) === h)
        .reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
      return { hour: `${String(h).padStart(2, '0')}h`, total };
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

    return { todayOrders, revenue, avgTicket, inProduction, inDelivery, delivered, cancelled, pending, hourlyData, weeklyData };
  }, [orders, today]);

  const now = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>

      {/* ── Header do Dashboard ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: '#6B7280' }}>{now}</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 8,
            background: '#fff', border: '1px solid #E5E7EB',
            fontSize: 13, fontWeight: 500, color: '#374151',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* ── KPI Cards — linha 1 ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
        <KpiCard
          icon={ShoppingBag}
          iconColor="#6366F1"
          iconBg="rgba(99,102,241,0.1)"
          label="Pedidos do dia"
          value={todayOrders.length}
          sub={`${pending} pendente${pending !== 1 ? 's' : ''}`}
        />
        <KpiCard
          icon={DollarSign}
          iconColor="#10B981"
          iconBg="rgba(16,185,129,0.1)"
          label="Faturamento do dia"
          value={fmtBRL(revenue)}
          sub="pedidos não cancelados"
        />
        <KpiCard
          icon={TrendingUp}
          iconColor="#F2A800"
          iconBg="rgba(242,168,0,0.1)"
          label="Ticket médio"
          value={fmtBRL(avgTicket)}
          sub="por pedido ativo"
        />
        <KpiCard
          icon={CheckCircle}
          iconColor="#10B981"
          iconBg="rgba(16,185,129,0.1)"
          label="Pedidos finalizados"
          value={delivered}
          highlight="#10B981"
        />
      </div>

      {/* ── KPI Cards — linha 2 ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard
          icon={ChefHat}
          iconColor="#F97316"
          iconBg="rgba(249,115,22,0.1)"
          label="Em produção"
          value={inProduction}
          sub="confirmados + preparando"
          highlight={inProduction > 0 ? '#F97316' : '#111827'}
        />
        <KpiCard
          icon={Truck}
          iconColor="#8B5CF6"
          iconBg="rgba(139,92,246,0.1)"
          label="Em entrega"
          value={inDelivery}
          highlight={inDelivery > 0 ? '#8B5CF6' : '#111827'}
        />
        <KpiCard
          icon={XCircle}
          iconColor="#EF4444"
          iconBg="rgba(239,68,68,0.1)"
          label="Cancelados"
          value={cancelled}
          highlight={cancelled > 0 ? '#EF4444' : '#111827'}
        />
        <KpiCard
          icon={Clock}
          iconColor="#6B7280"
          iconBg="rgba(107,114,128,0.1)"
          label="Tempo méd. entrega"
          value="—"
          sub="em breve"
        />
      </div>

      {/* ── Gráficos ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Vendas por hora */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '20px 24px',
          border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <BarChart2 size={16} color="#F2A800" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Vendas por hora</h3>
          </div>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>Faturamento de hoje por hora (10h–23h)</p>

          {hourlyData.every(d => d.total === 0) ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: 13 }}>
              Nenhuma venda registrada hoje
            </div>
          ) : (
            <BarChart
              data={hourlyData}
              labelKey="hour"
              valueKey="total"
              color="#F2A800"
              formatValue={fmtBRL}
              height={140}
            />
          )}
        </div>

        {/* Pedidos nos últimos 7 dias */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '20px 24px',
          border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <BarChart2 size={16} color="#6366F1" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Pedidos — últimos 7 dias</h3>
          </div>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>Contagem diária (pedidos não cancelados)</p>

          {weeklyData.every(d => d.count === 0) ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: 13 }}>
              Nenhum pedido nos últimos 7 dias
            </div>
          ) : (
            <BarChart
              data={weeklyData}
              labelKey="date"
              valueKey="count"
              color="#6366F1"
              height={140}
            />
          )}
        </div>

      </div>

      {/* ── Rodapé informativo ───────────────────────────────────────────── */}
      <p style={{ textAlign: 'center', fontSize: 11, color: '#D1D5DB', marginTop: 32 }}>
        Dados baseados nos pedidos carregados · Clique em "Atualizar" para sincronizar
      </p>
    </div>
  );
}
