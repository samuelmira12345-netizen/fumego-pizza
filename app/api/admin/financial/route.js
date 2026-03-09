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

function toSPDay(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
