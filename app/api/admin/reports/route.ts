import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import jwt from 'jsonwebtoken';

// ── Auth ──────────────────────────────────────────────────────────────────────

function verifyAdminToken(request: NextRequest): boolean {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    return decoded.role === 'admin';
  } catch { return false; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSPHour(isoStr: string): number {
  return parseInt(
    new Date(isoStr).toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false,
    })
  );
}

function toSPDay(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function chunks<T>(arr: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ── GET /api/admin/reports?type=...&from=YYYY-MM-DD&to=YYYY-MM-DD ─────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'products';
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  const fromISO = from ? new Date(`${from}T00:00:00-03:00`).toISOString() : null;
  const toISO   = to   ? new Date(`${to}T23:59:59-03:00`).toISOString()   : null;

  try {
    // ── PRODUTOS ─────────────────────────────────────────────────────────────
    if (type === 'products') {
      let q = supabase.from('orders').select('id').neq('status', 'cancelled');
      if (fromISO) q = q.gte('created_at', fromISO);
      if (toISO)   q = q.lte('created_at', toISO);
      const { data: orders, error: oErr } = await q;
      if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

      const orderIds = (orders || []).map((o: { id: string }) => o.id);
      if (orderIds.length === 0) return NextResponse.json({ data: [], total_orders: 0 });

      let items: { product_name: string; quantity: number; total_price: number }[] = [];
      for (const batch of chunks(orderIds)) {
        const { data, error } = await supabase
          .from('order_items')
          .select('product_name, quantity, total_price')
          .in('order_id', batch);
        if (!error && data) items = items.concat(data);
      }

      const map: Record<string, { product_name: string; qty: number; revenue: number }> = {};
      for (const item of items) {
        const name = item.product_name || 'Desconhecido';
        if (!map[name]) map[name] = { product_name: name, qty: 0, revenue: 0 };
        map[name].qty      += item.quantity  || 1;
        map[name].revenue  += parseFloat(String(item.total_price)) || 0;
      }

      const data = Object.values(map)
        .sort((a, b) => b.revenue - a.revenue)
        .map((r, i) => ({ ...r, rank: i + 1 }));

      return NextResponse.json({ data, total_orders: orderIds.length });
    }

    // ── BAIRROS ──────────────────────────────────────────────────────────────
    if (type === 'neighborhoods') {
      let q = supabase
        .from('orders')
        .select('delivery_neighborhood, total, delivery_fee')
        .neq('status', 'cancelled');
      if (fromISO) q = q.gte('created_at', fromISO);
      if (toISO)   q = q.lte('created_at', toISO);
      const { data: orders, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const map: Record<string, { neighborhood: string; count: number; revenue: number; delivery_fee: number }> = {};
      for (const o of orders || []) {
        const nb = (o.delivery_neighborhood || 'Não informado').trim();
        if (!map[nb]) map[nb] = { neighborhood: nb, count: 0, revenue: 0, delivery_fee: 0 };
        map[nb].count++;
        map[nb].revenue      += parseFloat(String(o.total))        || 0;
        map[nb].delivery_fee += parseFloat(String(o.delivery_fee)) || 0;
      }

      const data = Object.values(map)
        .map(r => ({ ...r, avg_ticket: r.count > 0 ? r.revenue / r.count : 0 }))
        .sort((a, b) => b.count - a.count)
        .map((r, i) => ({ ...r, rank: i + 1 }));

      return NextResponse.json({ data, total_orders: (orders || []).length });
    }

    // ── HORÁRIOS ─────────────────────────────────────────────────────────────
    if (type === 'hours') {
      let q = supabase
        .from('orders')
        .select('created_at, total, status')
        .neq('status', 'cancelled');
      if (fromISO) q = q.gte('created_at', fromISO);
      if (toISO)   q = q.lte('created_at', toISO);
      const { data: orders, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const map: Record<number, { hour: number; label: string; count: number; revenue: number }> = {};
      for (let h = 0; h < 24; h++) map[h] = { hour: h, label: `${String(h).padStart(2,'0')}h`, count: 0, revenue: 0 };
      for (const o of orders || []) {
        const h = toSPHour(o.created_at);
        if (map[h] !== undefined) {
          map[h].count++;
          map[h].revenue += parseFloat(String(o.total)) || 0;
        }
      }

      const data = Object.values(map).sort((a, b) => a.hour - b.hour);
      const peak = data.reduce((p, c) => c.count > p.count ? c : p, data[0]);

      return NextResponse.json({ data, peak_hour: peak, total_orders: (orders || []).length });
    }

    // ── TICKET MÉDIO ─────────────────────────────────────────────────────────
    if (type === 'ticket') {
      let q = supabase
        .from('orders')
        .select('created_at, total, payment_method, subtotal, delivery_fee, discount, status')
        .neq('status', 'cancelled');
      if (fromISO) q = q.gte('created_at', fromISO);
      if (toISO)   q = q.lte('created_at', toISO);
      const { data: orders, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const dayMap: Record<string, { day: string; count: number; revenue: number; subtotal: number; discount: number; delivery_fee: number }> = {};
      for (const o of orders || []) {
        const day = toSPDay(o.created_at);
        if (!dayMap[day]) dayMap[day] = { day, count: 0, revenue: 0, subtotal: 0, discount: 0, delivery_fee: 0 };
        dayMap[day].count++;
        dayMap[day].revenue      += parseFloat(String(o.total))        || 0;
        dayMap[day].subtotal     += parseFloat(String(o.subtotal))     || 0;
        dayMap[day].discount     += parseFloat(String(o.discount))     || 0;
        dayMap[day].delivery_fee += parseFloat(String(o.delivery_fee)) || 0;
      }

      const pmLabels: Record<string, string> = { pix: 'PIX', cash: 'Dinheiro', card_delivery: 'Cartão na Entrega' };
      const pmMap: Record<string, { method: string; label: string; count: number; revenue: number }> = {};
      for (const o of orders || []) {
        const pm = o.payment_method || 'pix';
        if (!pmMap[pm]) pmMap[pm] = { method: pm, label: pmLabels[pm] || pm, count: 0, revenue: 0 };
        pmMap[pm].count++;
        pmMap[pm].revenue += parseFloat(String(o.total)) || 0;
      }

      const days = Object.values(dayMap)
        .sort((a, b) => a.day.localeCompare(b.day))
        .map(d => ({ ...d, avg_ticket: d.count > 0 ? d.revenue / d.count : 0 }));

      const total_orders   = days.reduce((s, d) => s + d.count,        0);
      const total_revenue  = days.reduce((s, d) => s + d.revenue,      0);
      const total_discount = days.reduce((s, d) => s + d.discount,     0);
      const total_delivery = days.reduce((s, d) => s + d.delivery_fee, 0);

      return NextResponse.json({
        days,
        payment_methods: Object.values(pmMap),
        totals: {
          total_orders,
          total_revenue,
          total_discount,
          total_delivery_fee: total_delivery,
          avg_ticket: total_orders > 0 ? total_revenue / total_orders : 0,
          net_revenue: total_revenue - total_discount,
        },
      });
    }

    // ── LTV CLIENTES ─────────────────────────────────────────────────────────
    if (type === 'ltv') {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('customer_phone, customer_name, total, created_at, payment_method')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(10000);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const map: Record<string, {
        customer_phone: string;
        customer_name:  string;
        order_count:    number;
        lifetime_value: number;
        first_order:    string;
        last_order:     string;
      }> = {};
      for (const o of orders || []) {
        const phone = o.customer_phone || 'sem-telefone';
        if (!map[phone]) {
          map[phone] = {
            customer_phone: phone,
            customer_name:  o.customer_name,
            order_count:    0,
            lifetime_value: 0,
            first_order:    o.created_at,
            last_order:     o.created_at,
          };
        }
        map[phone].order_count++;
        map[phone].lifetime_value += parseFloat(String(o.total)) || 0;
        if (o.created_at < map[phone].first_order) map[phone].first_order = o.created_at;
        if (o.created_at > map[phone].last_order)  map[phone].last_order  = o.created_at;
      }

      const data = Object.values(map)
        .map(c => {
          const daySpan = Math.max(
            Math.ceil((new Date(c.last_order).getTime() - new Date(c.first_order).getTime()) / (1000 * 60 * 60 * 24)),
            1
          );
          const monthsActive = Math.max(daySpan / 30, 1);
          return {
            ...c,
            avg_ticket:    c.lifetime_value / c.order_count,
            orders_month:  c.order_count / monthsActive,
            days_active:   daySpan,
          };
        })
        .sort((a, b) => b.lifetime_value - a.lifetime_value)
        .slice(0, 100);

      const totalCustomers = Object.keys(map).length;
      const recurrent = Object.values(map).filter(c => c.order_count > 1).length;

      return NextResponse.json({
        data,
        stats: {
          total_customers: totalCustomers,
          recurrent_customers: recurrent,
          recurrence_rate: totalCustomers > 0 ? (recurrent / totalCustomers) * 100 : 0,
          avg_ltv: data.length > 0 ? data.reduce((s, c) => s + c.lifetime_value, 0) / data.length : 0,
        },
      });
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
