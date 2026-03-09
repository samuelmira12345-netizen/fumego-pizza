import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import jwt from 'jsonwebtoken';

// ── Auth ───────────────────────────────────────────────────────────────────────

function verifyAdminToken(request) {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const decoded = jwt.verify(token, secret);
    return decoded.role === 'admin';
  } catch { return false; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PM_LABELS = {
  pix:           'PIX',
  card:          'Cartão de Crédito',
  cash:          'Dinheiro',
  card_delivery: 'Cartão na Entrega',
};

function detectExpenseCategory(description) {
  const d = (description || '').toLowerCase();
  if (/salário|salario|funcionário|funcionario|vale|adiantamento|freelancer/i.test(d)) return 'Pessoal';
  if (/aluguel|condomínio|condominio|iptu/i.test(d)) return 'Imóvel';
  if (/energia|luz|eletric/i.test(d)) return 'Energia Elétrica';
  if (/água|agua/i.test(d)) return 'Água';
  if (/internet|telefo|wifi|g6|vivo|claro|oi /i.test(d)) return 'Telecom';
  if (/entrega|motoboy|delivery|ifood/i.test(d)) return 'Entregadores';
  if (/insumo|ingrediente|product|compra|fornecedor/i.test(d)) return 'Insumos';
  if (/marketing|publicidade|anúncio|propaganda/i.test(d)) return 'Marketing';
  if (/imposto|tax|iss|pis|cofins|simples/i.test(d)) return 'Impostos';
  if (/transferência|transferencia|sangria/i.test(d)) return 'Transferência';
  return 'Outros';
}


// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'overview';
  const from   = searchParams.get('from') || (() => {
    const d = new Date(); d.setDate(1);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  })();
  const to = searchParams.get('to') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const supabase = getSupabaseAdmin();

  // ── OVERVIEW + FATURAMENTO ──────────────────────────────────────────────────
  if (action === 'overview') {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, total, subtotal, delivery_fee, discount, cashback_used, payment_method, status, created_at, customer_name, customer_phone')
      .gte('created_at', from + 'T00:00:00-03:00')
      .lte('created_at', to   + 'T23:59:59-03:00')
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const active    = (orders || []).filter(o => o.status !== 'cancelled');
    const cancelled = (orders || []).filter(o => o.status === 'cancelled');

    const grossRevenue   = active.reduce((s, o) => s + parseFloat(o.total        || 0), 0);
    const deliveryFees   = active.reduce((s, o) => s + parseFloat(o.delivery_fee || 0), 0);
    const couponsUsed    = active.reduce((s, o) => s + parseFloat(o.discount     || 0), 0);
    const cashbackUsed   = active.reduce((s, o) => s + parseFloat(o.cashback_used|| 0), 0);
    const cancelledValue = cancelled.reduce((s, o) => s + parseFloat(o.total     || 0), 0);

    // Estimated food cost: ~35% of gross (pizza industry standard)
    const estimatedCogs   = grossRevenue * 0.35;
    const estimatedProfit = grossRevenue - estimatedCogs - deliveryFees;

    // Payment breakdown
    const pmMap = {};
    for (const o of active) {
      const m = o.payment_method || 'other';
      if (!pmMap[m]) pmMap[m] = { method: m, label: PM_LABELS[m] || m, value: 0, count: 0 };
      pmMap[m].value += parseFloat(o.total || 0);
      pmMap[m].count++;
    }
    const paymentBreakdown = Object.values(pmMap).sort((a, b) => b.value - a.value);

    // Daily time series — fill every day in range
    const dateMap = {};
    const cursor = new Date(from + 'T12:00:00');
    const end    = new Date(to   + 'T12:00:00');
    while (cursor <= end) {
      const k = cursor.toLocaleDateString('en-CA');
      dateMap[k] = { date: k, revenue: 0, orders: 0, cancelled: 0, deliveryFees: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const o of orders || []) {
      const d = toSPDay(o.created_at);
      if (!dateMap[d]) dateMap[d] = { date: d, revenue: 0, orders: 0, cancelled: 0, deliveryFees: 0 };
      if (o.status === 'cancelled') {
        dateMap[d].cancelled++;
      } else {
        dateMap[d].revenue    += parseFloat(o.total        || 0);
        dateMap[d].deliveryFees += parseFloat(o.delivery_fee || 0);
        dateMap[d].orders++;
      }
    }
    const timeSeries = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

    // Day-of-week revenue
    const DOW_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dowMap = Array.from({ length: 7 }, (_, i) => ({ dow: i, label: DOW_PT[i], revenue: 0, orders: 0 }));
    for (const o of active) {
      const dow = new Date(o.created_at).getDay();
      dowMap[dow].revenue += parseFloat(o.total || 0);
      dowMap[dow].orders++;
    }

    // Monthly projection (annualised from period)
    const periodDays = Math.max(1, timeSeries.length);
    const dailyAvg   = grossRevenue / periodDays;
    const daysInMonth = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0).getDate();
    const monthlyProjection = dailyAvg * daysInMonth;

    return NextResponse.json({
      overview: {
        grossRevenue,
        netRevenue: grossRevenue - couponsUsed - cashbackUsed,
        ordersCount: active.length,
        avgTicket: active.length > 0 ? grossRevenue / active.length : 0,
        deliveryFees,
        couponsUsed,
        cashbackUsed,
        cancelledCount: cancelled.length,
        cancelledValue,
        estimatedCogs,
        estimatedProfit,
        monthlyProjection,
      },
      timeSeries,
      paymentBreakdown,
      dowBreakdown: dowMap,
      orders: (orders || []).slice(-200).reverse(),
    });
  }

  // ── CAIXA ──────────────────────────────────────────────────────────────────
  if (action === 'caixa') {
    let currentSession = null;
    let entries        = [];

    try {
      const { data: sessions } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      currentSession = sessions?.[0] || null;

      if (currentSession) {
        const { data: manualEntries } = await supabase
          .from('cash_entries')
          .select('*')
          .eq('session_id', currentSession.id)
          .order('created_at', { ascending: false });

        const { data: sessionOrders } = await supabase
          .from('orders')
          .select('id, order_number, total, payment_method, status, created_at, customer_name')
          .gte('created_at', currentSession.opened_at)
          .order('created_at', { ascending: false });

        const orderEntries = (sessionOrders || []).map(o => ({
          id:             'order_' + o.id,
          type:           o.status === 'cancelled' ? 'cancelled' : 'venda',
          amount:         parseFloat(o.total || 0),
          description:    `Pedido Nº ${o.order_number}${o.customer_name ? ' — ' + o.customer_name : ''}`,
          payment_method: o.payment_method,
          created_at:     o.created_at,
          order_id:       o.id,
          status:         o.status,
        }));

        entries = [
          ...(manualEntries || []).map(e => ({ ...e, isManual: true })),
          ...orderEntries,
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
    } catch {
      // Tables don't exist yet — return no session
      currentSession = null;
    }

    const vendas      = entries.filter(e => e.type === 'venda');
    const sangrias    = entries.filter(e => e.type === 'sangria');
    const suprimentos = entries.filter(e => e.type === 'suprimento');

    const totalSangrias    = sangrias.reduce((s, e)    => s + parseFloat(e.amount || 0), 0);
    const totalSuprimentos = suprimentos.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const totalVendas      = vendas.reduce((s, e)      => s + parseFloat(e.amount || 0), 0);

    const pmMap = {};
    for (const e of vendas) {
      const m = e.payment_method || 'other';
      if (!pmMap[m]) pmMap[m] = { method: m, label: PM_LABELS[m] || m, value: 0, count: 0 };
      pmMap[m].value += parseFloat(e.amount || 0);
      pmMap[m].count++;
    }

    const initialBalance = parseFloat(currentSession?.initial_balance || 0);
    const cashVendas     = pmMap['cash']?.value || 0;
    const cashInHand     = initialBalance + cashVendas + totalSuprimentos - totalSangrias;

    return NextResponse.json({
      currentSession,
      entries,
      summary: {
        initialBalance,
        totalSuprimentos,
        totalSangrias,
        cashVendas,
        cashInHand,
        totalVendas,
        paymentBreakdown: Object.values(pmMap).sort((a, b) => b.value - a.value),
      },
    });
  }

  // ── PREVIOUS SESSIONS ────────────────────────────────────────────────────────
  if (action === 'previous_sessions') {
    try {
      const { data: sessions } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(30);
      return NextResponse.json({ sessions: sessions || [] });
    } catch {
      return NextResponse.json({ sessions: [] });
    }
  }

  // ── DRE (Demonstração do Resultado do Exercício) ─────────────────────────────
  if (action === 'dre') {
    // Current period orders
    const { data: orders, error: ordErr } = await supabase
      .from('orders')
      .select('id, total, subtotal, delivery_fee, discount, cashback_used, payment_method, status, created_at')
      .gte('created_at', from + 'T00:00:00-03:00')
      .lte('created_at', to   + 'T23:59:59-03:00')
      .order('created_at', { ascending: true });

    if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

    // Previous period — same duration, immediately before
    const periodDays = Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000) + 1;
    const prevToDate   = new Date(new Date(from + 'T00:00:00') - 86400000);
    const prevFromDate = new Date(prevToDate.getTime() - (periodDays - 1) * 86400000);
    const prevFrom = prevFromDate.toLocaleDateString('en-CA');
    const prevTo   = prevToDate.toLocaleDateString('en-CA');

    const { data: prevOrders } = await supabase
      .from('orders')
      .select('id, total, subtotal, delivery_fee, discount, cashback_used, status, created_at')
      .gte('created_at', prevFrom + 'T00:00:00-03:00')
      .lte('created_at', prevTo   + 'T23:59:59-03:00');

    // Cash entries (Sangrias = operational expenses)
    let cashEntries = [];
    try {
      const { data: entries } = await supabase
        .from('cash_entries')
        .select('id, type, amount, description, created_at')
        .eq('type', 'sangria')
        .gte('created_at', from + 'T00:00:00-03:00')
        .lte('created_at', to   + 'T23:59:59-03:00')
        .order('created_at', { ascending: true });
      cashEntries = entries || [];
    } catch { /* table may not exist */ }

    // ── Current period calculations ────────────────────────────────────────────
    const active    = (orders || []).filter(o => o.status !== 'cancelled');
    const cancelled = (orders || []).filter(o => o.status === 'cancelled');

    const salesRevenue   = active.reduce((s, o) => s + parseFloat(o.subtotal     || 0), 0);
    const deliveryFees   = active.reduce((s, o) => s + parseFloat(o.delivery_fee || 0), 0);
    const grossRevenue   = active.reduce((s, o) => s + parseFloat(o.total        || 0), 0);
    const cancelledValue = cancelled.reduce((s, o) => s + parseFloat(o.total     || 0), 0);

    const coupons  = active.reduce((s, o) => s + parseFloat(o.discount      || 0), 0);
    const cashback = active.reduce((s, o) => s + parseFloat(o.cashback_used || 0), 0);
    const deductions = coupons + cashback;

    const netRevenue  = grossRevenue - deductions;
    const cmv         = netRevenue * 0.35;          // ~35% pizza industry CMV
    const grossProfit = netRevenue - cmv;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    const totalExpenses = cashEntries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const ebitda        = grossProfit - totalExpenses;
    const ebitdaMargin  = netRevenue > 0 ? (ebitda / netRevenue) * 100 : 0;

    // Simplified: no depreciation/taxes in this model
    const netProfit = ebitda;
    const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    // ── Previous period calculations ────────────────────────────────────────────
    const prevActive      = (prevOrders || []).filter(o => o.status !== 'cancelled');
    const prevGrossRev    = prevActive.reduce((s, o) => s + parseFloat(o.total         || 0), 0);
    const prevDeductions  = prevActive.reduce((s, o) => s + parseFloat(o.discount      || 0) + parseFloat(o.cashback_used || 0), 0);
    const prevNetRevenue  = prevGrossRev - prevDeductions;
    const prevCmv         = prevNetRevenue * 0.35;
    const prevGrossProfit = prevNetRevenue - prevCmv;
    const prevNetProfit   = prevGrossProfit;

    // ── Daily time series ──────────────────────────────────────────────────────
    const dateMap = {};
    const cursor  = new Date(from + 'T12:00:00');
    const endDay  = new Date(to   + 'T12:00:00');
    while (cursor <= endDay) {
      const k = cursor.toLocaleDateString('en-CA');
      dateMap[k] = { date: k, revenue: 0, expenses: 0, profit: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const o of active) {
      const d = toSPDay(o.created_at);
      if (dateMap[d]) dateMap[d].revenue += parseFloat(o.total || 0);
    }
    for (const e of cashEntries) {
      const d = toSPDay(e.created_at);
      if (dateMap[d]) dateMap[d].expenses += parseFloat(e.amount || 0);
    }
    for (const k of Object.keys(dateMap)) {
      dateMap[k].profit = dateMap[k].revenue * 0.65 - dateMap[k].expenses;
    }

    return NextResponse.json({
      period: { from, to, prevFrom, prevTo },
      current: {
        ordersCount:    active.length,
        cancelledCount: cancelled.length,
        cancelledValue,
        salesRevenue,
        deliveryFees,
        grossRevenue,
        coupons,
        cashback,
        deductions,
        netRevenue,
        cmv,
        grossProfit,
        grossMargin,
        expenses: totalExpenses,
        expenseEntries: cashEntries,
        ebitda,
        ebitdaMargin,
        netProfit,
        netMargin,
      },
      previous: {
        grossRevenue: prevGrossRev,
        netRevenue:   prevNetRevenue,
        grossProfit:  prevGrossProfit,
        netProfit:    prevNetProfit,
      },
      timeSeries: Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  // ── LANÇAMENTOS ──────────────────────────────────────────────────────────────
  if (action === 'lancamentos') {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, total, subtotal, delivery_fee, discount, cashback_used, payment_method, status, created_at, customer_name')
      .gte('created_at', from + 'T00:00:00-03:00')
      .lte('created_at', to   + 'T23:59:59-03:00')
      .order('created_at', { ascending: false });

    let cashEntries = [];
    try {
      const { data: entries } = await supabase
        .from('cash_entries')
        .select('id, type, amount, description, payment_method, created_at, session_id')
        .gte('created_at', from + 'T00:00:00-03:00')
        .lte('created_at', to   + 'T23:59:59-03:00')
        .order('created_at', { ascending: false });
      cashEntries = entries || [];
    } catch {}

    const receitas = (orders || []).map(o => ({
      id:         'order_' + o.id,
      date:       toSPDay(o.created_at),
      created_at: o.created_at,
      description: `Venda Nº ${o.order_number}${o.customer_name ? ' — ' + o.customer_name : ''}`,
      category:   'Receitas de vendas',
      account:    'Conta padrão',
      value:      parseFloat(o.total || 0),
      type:       'receita',
      status:     o.status === 'cancelled' ? 'cancelado' : 'recebido',
      payment_method: o.payment_method,
    }));

    const despesas = cashEntries.map(e => ({
      id:         'cash_' + e.id,
      date:       toSPDay(e.created_at),
      created_at: e.created_at,
      description: e.description || (e.type === 'sangria' ? 'Sangria de caixa' : 'Suprimento de caixa'),
      category:   e.type === 'sangria' ? detectExpenseCategory(e.description) : 'Transferência',
      account:    'Caixa',
      value:      parseFloat(e.amount || 0),
      type:       e.type === 'sangria' ? 'despesa' : 'transferencia',
      status:     'pago',
      payment_method: e.payment_method,
    }));

    const todos = [...receitas, ...despesas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const receitasRecebidas = receitas.filter(r => r.status === 'recebido').reduce((s, r) => s + r.value, 0);
    const totalDespesas     = despesas.filter(d => d.type === 'despesa').reduce((s, d) => s + d.value, 0);

    return NextResponse.json({
      receitas,
      despesas,
      todos,
      summary: {
        receitasRecebidas,
        receitasAberto:  0,
        totalDespesas,
        despesasAberto:  0,
        totalPeriodo:    receitasRecebidas - totalDespesas,
      },
    });
  }

  // ── FLUXO DE CAIXA ────────────────────────────────────────────────────────────
  if (action === 'fluxo_caixa') {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, delivery_fee, payment_method, status, created_at')
      .gte('created_at', from + 'T00:00:00-03:00')
      .lte('created_at', to   + 'T23:59:59-03:00')
      .order('created_at', { ascending: true });

    let cashEntries = [];
    try {
      const { data: entries } = await supabase
        .from('cash_entries')
        .select('id, type, amount, description, created_at')
        .gte('created_at', from + 'T00:00:00-03:00')
        .lte('created_at', to   + 'T23:59:59-03:00')
        .order('created_at', { ascending: true });
      cashEntries = entries || [];
    } catch {}

    // Find opening balance (from the most recent closed session before this period)
    let openingBalance = 0;
    try {
      const { data: sessions } = await supabase
        .from('cash_sessions')
        .select('initial_balance, final_balance, opened_at, closed_at')
        .lte('opened_at', from + 'T23:59:59-03:00')
        .order('opened_at', { ascending: false })
        .limit(1);
      const sess = sessions?.[0];
      if (sess) openingBalance = parseFloat(sess.final_balance ?? sess.initial_balance ?? 0);
    } catch {}

    // Build daily map
    const dateMap = {};
    const cur = new Date(from + 'T12:00:00');
    const endD = new Date(to  + 'T12:00:00');
    while (cur <= endD) {
      const k = cur.toLocaleDateString('en-CA');
      dateMap[k] = { date: k, revenue: 0, expenses: 0, transfers: 0, orders: 0 };
      cur.setDate(cur.getDate() + 1);
    }

    const active = (orders || []).filter(o => o.status !== 'cancelled');
    for (const o of active) {
      const d = toSPDay(o.created_at);
      if (dateMap[d]) { dateMap[d].revenue += parseFloat(o.total || 0); dateMap[d].orders++; }
    }
    for (const e of cashEntries) {
      const d = toSPDay(e.created_at);
      if (dateMap[d]) {
        if (e.type === 'sangria')    dateMap[d].expenses   += parseFloat(e.amount || 0);
        if (e.type === 'suprimento') dateMap[d].transfers  += parseFloat(e.amount || 0);
      }
    }

    // Build cumulative time series
    let running = openingBalance;
    const timeSeries = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)).map(d => {
      const opening = running;
      running = running + d.revenue - d.expenses + d.transfers;
      return { ...d, opening, closing: running };
    });

    return NextResponse.json({ timeSeries, openingBalance });
  }

  // ── ANÁLISE DE PAGAMENTOS ─────────────────────────────────────────────────────
  if (action === 'analise_pagamentos') {
    let cashEntries = [];
    try {
      const { data: entries } = await supabase
        .from('cash_entries')
        .select('id, type, amount, description, payment_method, created_at')
        .eq('type', 'sangria')
        .gte('created_at', from + 'T00:00:00-03:00')
        .lte('created_at', to   + 'T23:59:59-03:00');
      cashEntries = entries || [];
    } catch {}

    const total = cashEntries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    const categoryMap = {};
    for (const e of cashEntries) {
      const cat = detectExpenseCategory(e.description);
      if (!categoryMap[cat]) categoryMap[cat] = { name: cat, value: 0, count: 0 };
      categoryMap[cat].value += parseFloat(e.amount || 0);
      categoryMap[cat].count++;
    }

    // Daily series
    const dateMap = {};
    const cur2 = new Date(from + 'T12:00:00');
    const end2  = new Date(to   + 'T12:00:00');
    while (cur2 <= end2) {
      const k = cur2.toLocaleDateString('en-CA');
      dateMap[k] = { date: k, value: 0 };
      cur2.setDate(cur2.getDate() + 1);
    }
    for (const e of cashEntries) {
      const d = toSPDay(e.created_at);
      if (dateMap[d]) dateMap[d].value += parseFloat(e.amount || 0);
    }

    return NextResponse.json({
      total,
      byCategory: Object.values(categoryMap).sort((a, b) => b.value - a.value),
      entries:    cashEntries,
      timeSeries: Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  // ── ANÁLISE DE RECEBIMENTOS ───────────────────────────────────────────────────
  if (action === 'analise_recebimentos') {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, subtotal, delivery_fee, discount, cashback_used, payment_method, status, created_at')
      .gte('created_at', from + 'T00:00:00-03:00')
      .lte('created_at', to   + 'T23:59:59-03:00')
      .order('created_at', { ascending: true });

    const active = (orders || []).filter(o => o.status !== 'cancelled');
    const total  = active.reduce((s, o) => s + parseFloat(o.total || 0), 0);

    const pmMap = {};
    for (const o of active) {
      const m = o.payment_method || 'other';
      if (!pmMap[m]) pmMap[m] = { method: m, label: PM_LABELS[m] || m, value: 0, count: 0 };
      pmMap[m].value += parseFloat(o.total || 0);
      pmMap[m].count++;
    }

    // Category breakdown (revenue types)
    const vendasTotal   = active.reduce((s, o) => s + parseFloat(o.subtotal || 0), 0);
    const entregasTotal = active.reduce((s, o) => s + parseFloat(o.delivery_fee || 0), 0);
    const byCategory = [
      { name: 'Vendas (Pedidos)',  value: vendasTotal,   count: active.length },
      { name: 'Taxas de Entrega',  value: entregasTotal, count: active.length },
    ].filter(c => c.value > 0);

    // Daily series
    const dateMap = {};
    const cur3 = new Date(from + 'T12:00:00');
    const end3  = new Date(to   + 'T12:00:00');
    while (cur3 <= end3) {
      const k = cur3.toLocaleDateString('en-CA');
      dateMap[k] = { date: k, value: 0, orders: 0 };
      cur3.setDate(cur3.getDate() + 1);
    }
    for (const o of active) {
      const d = toSPDay(o.created_at);
      if (dateMap[d]) { dateMap[d].value += parseFloat(o.total || 0); dateMap[d].orders++; }
    }

    return NextResponse.json({
      total,
      ordersCount: active.length,
      byPaymentMethod: Object.values(pmMap).sort((a, b) => b.value - a.value),
      byCategory,
      timeSeries: Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  // ── CUSTOS ────────────────────────────────────────────────────────────────────
  if (action === 'custos') {
    try {
      const { data: costs } = await supabase
        .from('financial_costs')
        .select('*')
        .order('type')
        .order('name');
      return NextResponse.json({ costs: costs || [] });
    } catch {
      return NextResponse.json({ costs: [] });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body     = await request.json();
  const { action } = body;
  const supabase = getSupabaseAdmin();

  if (action === 'open_session') {
    const { data, error } = await supabase
      .from('cash_sessions')
      .insert({ initial_balance: parseFloat(body.initial_balance || 0), status: 'open' })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  }

  if (action === 'close_session') {
    const { data, error } = await supabase
      .from('cash_sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString(), final_balance: parseFloat(body.final_balance || 0), notes: body.notes || '' })
      .eq('id', body.session_id)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  }

  if (action === 'sangria' || action === 'suprimento') {
    const { data, error } = await supabase
      .from('cash_entries')
      .insert({
        session_id:     body.session_id,
        type:           action,
        amount:         parseFloat(body.amount || 0),
        description:    body.description || '',
        payment_method: body.payment_method || 'cash',
      })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: data });
  }

  if (action === 'custos_save') {
    try {
      const payload = {
        name:        body.name,
        description: body.description || null,
        type:        body.type,
        amount:      body.amount != null ? parseFloat(body.amount) : null,
        rate:        body.rate   != null ? parseFloat(body.rate)   : null,
        base:        body.base   || 'gross',
        category:    body.category || null,
        is_active:   body.is_active !== false,
        updated_at:  new Date().toISOString(),
      };
      if (body.id) {
        const { data, error } = await supabase.from('financial_costs').update(payload).eq('id', body.id).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ cost: data });
      } else {
        const { data, error } = await supabase.from('financial_costs').insert(payload).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ cost: data });
      }
    } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  }

  if (action === 'custos_delete') {
    try {
      const { error } = await supabase.from('financial_costs').delete().eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
