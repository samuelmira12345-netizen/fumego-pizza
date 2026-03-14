import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Delivery Persons ──────────────────────────────────────────────────────────

export async function handleGetDeliveryPersons(supabase: SupabaseClient): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('delivery_persons')
    .select('id, name, phone, email, is_active, created_at')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persons: data || [] });
}

export async function handleSaveDeliveryPerson(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { id, name, phone, email, password, is_active } = data || {};
  if (!name || !email) {
    return NextResponse.json({ error: 'Nome e email são obrigatórios' }, { status: 400 });
  }

  const record: Record<string, unknown> = {
    name:       String(name).trim(),
    phone:      phone ? String(phone).trim() : null,
    email:      String(email).toLowerCase().trim(),
    is_active:  is_active !== false,
    updated_at: new Date().toISOString(),
  };

  if (password) {
    // Dynamic import to avoid top-level type declaration requirement for bcryptjs
    const bcrypt = await import('bcryptjs');
    record.password_hash = await bcrypt.hash(String(password), 12);
  }

  let result: unknown;
  if (id) {
    const { data: updated, error } = await supabase
      .from('delivery_persons')
      .update(record)
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = updated;
  } else {
    if (!password) return NextResponse.json({ error: 'Senha é obrigatória para novo entregador' }, { status: 400 });
    const { data: created, error } = await supabase
      .from('delivery_persons')
      .insert(record)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = created;
  }

  return NextResponse.json({ person: result });
}

export async function handleDeleteDeliveryPerson(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { id } = data || {};
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  await supabase.from('delivery_persons').update({ is_active: false }).eq('id', id);
  return NextResponse.json({ success: true });
}

export async function handleGetDeliveryHistory(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { person_id, from, to } = data || {};
  if (!person_id) return NextResponse.json({ error: 'person_id obrigatório' }, { status: 400 });

  let q = supabase
    .from('orders')
    .select('id, order_number, customer_name, customer_phone, total, delivery_fee, delivery_street, delivery_number, delivery_neighborhood, status, delivering_at, delivered_at, driver_collected_at, driver_delivered_at, payment_method, created_at')
    .eq('delivery_person_id', person_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (from) q = q.gte('created_at', from as string);
  if (to)   q = q.lte('created_at', to as string);

  const { data: orders, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalEarned = (orders || []).filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + (parseFloat(o.delivery_fee) || 0), 0);

  return NextResponse.json({ orders: orders || [], totalEarned });
}

// ── Delivery Zones ────────────────────────────────────────────────────────────

export async function handleGetDeliveryZones(supabase: SupabaseClient): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .order('sort_order')
    .order('neighborhood');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data || [] });
}

export async function handleSaveDeliveryZone(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { id, neighborhood, city, fee, estimated_mins, is_active, sort_order } = data || {};
  if (!neighborhood) return NextResponse.json({ error: 'Bairro é obrigatório' }, { status: 400 });

  const record = {
    neighborhood:   String(neighborhood).trim(),
    city:           city ? String(city).trim() : '',
    fee:            parseFloat(String(fee)) || 0,
    estimated_mins: parseInt(String(estimated_mins)) || 30,
    is_active:      is_active !== false,
    sort_order:     parseInt(String(sort_order)) || 0,
  };

  let result: unknown;
  if (id) {
    const { data: updated, error } = await supabase
      .from('delivery_zones').update(record).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = updated;
  } else {
    const { data: created, error } = await supabase
      .from('delivery_zones').insert(record).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = created;
  }

  return NextResponse.json({ zone: result });
}

export async function handleDeleteDeliveryZone(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { id } = data || {};
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ── Assign delivery person to order ──────────────────────────────────────────

export async function handleAssignDelivery(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { order_id, delivery_person_id, start_delivery } = data || {};
  if (!order_id) return NextResponse.json({ error: 'order_id obrigatório' }, { status: 400 });

  const updates: Record<string, unknown> = {
    delivery_person_id: delivery_person_id || null,
  };

  if (delivery_person_id && start_delivery) {
    updates.status       = 'delivering';
    updates.delivering_at = new Date().toISOString();
  }

  if (delivery_person_id) {
    const { data: last } = await supabase
      .from('orders')
      .select('delivery_sort_order')
      .eq('delivery_person_id', delivery_person_id)
      .not('status', 'in', '("delivered","cancelled")')
      .order('delivery_sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    updates.delivery_sort_order = ((last?.delivery_sort_order as number) || 0) + 1;
  } else {
    updates.delivery_sort_order = null;
  }

  const { error } = await supabase.from('orders').update(updates).eq('id', order_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ── Delivery queue management ─────────────────────────────────────────────────

export async function handleGetDeliveryQueue(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { person_id } = data || {};
  if (!person_id) return NextResponse.json({ error: 'person_id obrigatório' }, { status: 400 });

  const todaySP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const todayStartISO = new Date(`${todaySP}T00:00:00-03:00`).toISOString();

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, delivery_street, delivery_number, delivery_neighborhood, status, delivery_sort_order, delivery_fee, total, delivering_at, driver_delivered_at, created_at')
    .eq('delivery_person_id', person_id)
    .not('status', 'in', '("cancelled")')
    .gte('created_at', todayStartISO)
    .order('delivery_sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: orders || [] });
}

export async function handleSetDeliveryPriority(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { ordered_ids } = data || {};
  if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
    return NextResponse.json({ error: 'ordered_ids obrigatório' }, { status: 400 });
  }
  await Promise.all(
    (ordered_ids as string[]).map((id, index) =>
      supabase.from('orders').update({ delivery_sort_order: index + 1 }).eq('id', id)
    )
  );
  return NextResponse.json({ success: true });
}

// ── Admin: get driver locations for tracking ──────────────────────────────────

export async function handleGetDriverLocations(supabase: SupabaseClient): Promise<NextResponse> {
  const { data: logs, error } = await supabase
    .from('delivery_locations')
    .select('delivery_person_id, lat, lng, recorded_at, delivery_persons(name)')
    .order('recorded_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const locations = (logs || []).filter(r => {
    if (!r.delivery_person_id || seen.has(r.delivery_person_id)) return false;
    seen.add(r.delivery_person_id);
    return true;
  }).map(r => ({
    delivery_person_id:  r.delivery_person_id,
    driver_location_lat: r.lat,
    driver_location_lng: r.lng,
    driver_location_at:  r.recorded_at,
    delivery_persons:    r.delivery_persons,
  }));

  return NextResponse.json({ locations });
}

// ── Admin: delivery metrics dashboard ────────────────────────────────────────

interface PersonMetric {
  delivery_person_id: string;
  name: string;
  is_active: boolean;
  assigned_count: number;
  delivered_count: number;
  cancelled_count: number;
  in_progress_count: number;
  delivery_fees_total: number;
  orders_total_value: number;
  avg_delivery_minutes: number | null;
  min_delivery_minutes: number | null;
  max_delivery_minutes: number | null;
  last_delivery_at: string | null;
}

export async function handleGetDeliveryMetrics(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const fromInput = typeof data?.from === 'string' ? data.from : null;
  const toInput   = typeof data?.to   === 'string' ? data.to   : null;
  const rawDays   = Number(data?.days);
  const days      = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 180) : 30;

  let fromDate: Date | null = null;
  let toDate:   Date | null = null;

  if (fromInput && toInput) {
    fromDate = new Date(`${fromInput}T00:00:00`);
    toDate   = new Date(`${toInput}T23:59:59.999`);
    if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime()) || fromDate > toDate) {
      fromDate = null;
      toDate   = null;
    }
  }

  if (!fromDate || !toDate) {
    fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    toDate = new Date();
  }

  const [{ data: persons, error: personsError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase.from('delivery_persons').select('id, name, is_active').order('name'),
    supabase.from('orders')
      .select('id, order_number, status, total, delivery_fee, delivery_person_id, delivering_at, delivered_at, driver_collected_at, driver_delivered_at, created_at')
      .not('delivery_person_id', 'is', null)
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString()),
  ]);

  if (personsError) return NextResponse.json({ error: personsError.message }, { status: 500 });
  if (ordersError)  return NextResponse.json({ error: ordersError.message  }, { status: 500 });

  const defaultMetric = (id: string, name: string, isActive: boolean): PersonMetric => ({
    delivery_person_id: id, name, is_active: isActive,
    assigned_count: 0, delivered_count: 0, cancelled_count: 0, in_progress_count: 0,
    delivery_fees_total: 0, orders_total_value: 0,
    avg_delivery_minutes: null, min_delivery_minutes: null, max_delivery_minutes: null,
    last_delivery_at: null,
  });

  const byPerson = new Map<string, PersonMetric>(
    (persons || []).map(p => [p.id, defaultMetric(p.id, p.name, p.is_active)])
  );
  const durationsByPerson = new Map<string, number[]>();

  for (const o of (orders || [])) {
    if (!o.delivery_person_id) continue;
    const item = byPerson.get(o.delivery_person_id) || defaultMetric(o.delivery_person_id, 'Entregador removido', false);

    item.assigned_count += 1;

    if (o.status === 'delivered') {
      item.delivered_count       += 1;
      item.delivery_fees_total   += parseFloat(o.delivery_fee || 0) || 0;
      item.orders_total_value    += parseFloat(o.total || 0) || 0;
      const deliveredAt = o.driver_delivered_at || o.delivered_at;
      if (!item.last_delivery_at || (deliveredAt && new Date(deliveredAt) > new Date(item.last_delivery_at))) {
        item.last_delivery_at = deliveredAt;
      }
      const from = o.driver_collected_at || o.delivering_at;
      const to   = o.driver_delivered_at || o.delivered_at;
      if (from && to) {
        const mins = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
        if (Number.isFinite(mins) && mins >= 0) {
          const list = durationsByPerson.get(o.delivery_person_id) || [];
          list.push(mins);
          durationsByPerson.set(o.delivery_person_id, list);
        }
      }
    } else if (o.status === 'cancelled') {
      item.cancelled_count += 1;
    } else if (o.status === 'delivering' || o.status === 'ready') {
      item.in_progress_count += 1;
    }

    byPerson.set(o.delivery_person_id, item);
  }

  const personsMetrics = Array.from(byPerson.values()).map(p => {
    const durations = durationsByPerson.get(p.delivery_person_id) || [];
    if (durations.length > 0) {
      const sum = durations.reduce((acc, n) => acc + n, 0);
      p.avg_delivery_minutes = Math.round(sum / durations.length);
      p.min_delivery_minutes = Math.min(...durations);
      p.max_delivery_minutes = Math.max(...durations);
    }
    p.delivery_fees_total = Number(p.delivery_fees_total.toFixed(2));
    p.orders_total_value  = Number(p.orders_total_value.toFixed(2));
    return p;
  }).sort((a, b) => b.delivered_count - a.delivered_count || b.delivery_fees_total - a.delivery_fees_total);

  const summary: Record<string, unknown> = {
    days,
    from: fromDate.toISOString(),
    to:   toDate.toISOString(),
    total_assigned:    personsMetrics.reduce((s, p) => s + p.assigned_count, 0),
    total_delivered:   personsMetrics.reduce((s, p) => s + p.delivered_count, 0),
    total_in_progress: personsMetrics.reduce((s, p) => s + p.in_progress_count, 0),
    total_cancelled:   personsMetrics.reduce((s, p) => s + p.cancelled_count, 0),
    total_delivery_fees:  Number(personsMetrics.reduce((s, p) => s + p.delivery_fees_total, 0).toFixed(2)),
    total_orders_value:   Number(personsMetrics.reduce((s, p) => s + p.orders_total_value, 0).toFixed(2)),
  };

  const allAverages = personsMetrics.map(p => p.avg_delivery_minutes).filter((v): v is number => v !== null && Number.isFinite(v));
  summary.avg_delivery_minutes = allAverages.length
    ? Math.round(allAverages.reduce((s, n) => s + n, 0) / allAverages.length)
    : null;

  return NextResponse.json({ summary, persons: personsMetrics });
}
