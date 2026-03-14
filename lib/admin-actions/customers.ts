import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

interface CustomerSummary {
  phone: string | null;
  name: string;
  neighborhood: string | null;
  city: string | null;
  orders: number;
  total_spent: number;
  first_order: string;
  last_order: string;
  avg_ticket?: number;
}

export async function handleGetCustomers(supabase: SupabaseClient): Promise<NextResponse> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customer_name, customer_phone, total, status, created_at, delivery_neighborhood, delivery_city')
    .order('created_at', { ascending: false })
    .limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map: Record<string, CustomerSummary> = {};
  for (const o of (orders || [])) {
    const key = o.customer_phone || o.customer_name || 'unknown';
    if (!map[key]) {
      map[key] = {
        phone: o.customer_phone, name: o.customer_name,
        neighborhood: o.delivery_neighborhood, city: o.delivery_city,
        orders: 0, total_spent: 0, first_order: o.created_at, last_order: o.created_at,
      };
    }
    map[key].orders += 1;
    if (o.status !== 'cancelled') map[key].total_spent += parseFloat(o.total) || 0;
    if (o.created_at < map[key].first_order) map[key].first_order = o.created_at;
    if (o.created_at > map[key].last_order)  map[key].last_order  = o.created_at;
  }

  const customers = Object.values(map)
    .map(c => ({ ...c, avg_ticket: c.orders > 0 ? c.total_spent / c.orders : 0 }))
    .sort((a, b) => b.orders - a.orders);
  return NextResponse.json({ customers });
}

export async function handleGetCustomerProfile(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { phone } = data || {};
  if (!phone) return NextResponse.json({ error: 'phone obrigatório' }, { status: 400 });

  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('id, order_number, total, status, created_at, payment_method, delivery_neighborhood')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(200);
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  const orderIds = (orders || []).map(o => o.id);
  let topItems: Array<{ name: string; qty: number }> = [];
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from('order_items').select('product_name, quantity').in('order_id', orderIds.slice(0, 100));
    if (items) {
      const itemMap: Record<string, number> = {};
      for (const i of items) itemMap[i.product_name] = (itemMap[i.product_name] || 0) + (i.quantity || 1);
      topItems = Object.entries(itemMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
    }
  }

  const hourMap: Record<string, number> = {};
  for (const o of (orders || [])) {
    const h = new Date(o.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit' });
    hourMap[h] = (hourMap[h] || 0) + 1;
  }
  const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return NextResponse.json({ orders: orders || [], topItems, peakHour });
}

export async function handleSearchPhoneSuffix(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { suffix } = data || {};
  if (!suffix || String(suffix).length < 4) return NextResponse.json({ customers: [] });

  const { data: rows, error: sErr } = await supabase
    .from('orders')
    .select('customer_name, customer_phone, delivery_neighborhood, delivery_city, delivery_street, delivery_number, created_at')
    .like('customer_phone', `%${suffix}`)
    .order('created_at', { ascending: false })
    .limit(200);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const map: Record<string, unknown> = {};
  for (const r of (rows || [])) {
    const key = r.customer_phone || r.customer_name;
    if (!map[key]) map[key] = r;
  }
  return NextResponse.json({ customers: Object.values(map).slice(0, 8) });
}
