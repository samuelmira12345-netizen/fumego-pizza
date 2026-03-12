import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

// ── Delivery Persons ──────────────────────────────────────────────────────────

export async function handleGetDeliveryPersons(supabase) {
  const { data, error } = await supabase
    .from('delivery_persons')
    .select('id, name, phone, email, is_active, created_at')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persons: data || [] });
}

export async function handleSaveDeliveryPerson(supabase, data) {
  const { id, name, phone, email, password, is_active } = data || {};
  if (!name || !email) {
    return NextResponse.json({ error: 'Nome e email são obrigatórios' }, { status: 400 });
  }

  const record = {
    name: name.trim(),
    phone: phone?.trim() || null,
    email: email.toLowerCase().trim(),
    is_active: is_active !== false,
    updated_at: new Date().toISOString(),
  };

  if (password) {
    record.password_hash = await bcrypt.hash(password, 12);
  }

  let result;
  if (id) {
    // Update existing
    const { data: updated, error } = await supabase
      .from('delivery_persons')
      .update(record)
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = updated;
  } else {
    // Create new
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

export async function handleDeleteDeliveryPerson(supabase, data) {
  const { id } = data || {};
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  await supabase.from('delivery_persons').update({ is_active: false }).eq('id', id);
  return NextResponse.json({ success: true });
}

export async function handleGetDeliveryHistory(supabase, data) {
  const { person_id, from, to } = data || {};
  if (!person_id) return NextResponse.json({ error: 'person_id obrigatório' }, { status: 400 });

  let q = supabase
    .from('orders')
    .select('id, order_number, customer_name, customer_phone, total, delivery_fee, delivery_street, delivery_number, delivery_neighborhood, status, delivering_at, delivered_at, driver_collected_at, driver_delivered_at, payment_method, created_at')
    .eq('delivery_person_id', person_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (from) q = q.gte('created_at', from);
  if (to)   q = q.lte('created_at', to);

  const { data: orders, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalEarned = (orders || []).filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + (parseFloat(o.delivery_fee) || 0), 0);

  return NextResponse.json({ orders: orders || [], totalEarned });
}

// ── Delivery Zones ────────────────────────────────────────────────────────────

export async function handleGetDeliveryZones(supabase) {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .order('sort_order')
    .order('neighborhood');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data || [] });
}

export async function handleSaveDeliveryZone(supabase, data) {
  const { id, neighborhood, city, fee, estimated_mins, is_active, sort_order } = data || {};
  if (!neighborhood) return NextResponse.json({ error: 'Bairro é obrigatório' }, { status: 400 });

  const record = {
    neighborhood: neighborhood.trim(),
    city: city?.trim() || '',
    fee: parseFloat(fee) || 0,
    estimated_mins: parseInt(estimated_mins) || 30,
    is_active: is_active !== false,
    sort_order: parseInt(sort_order) || 0,
  };

  let result;
  if (id) {
    const { data: updated, error } = await supabase
      .from('delivery_zones')
      .update(record)
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = updated;
  } else {
    const { data: created, error } = await supabase
      .from('delivery_zones')
      .insert(record)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = created;
  }

  return NextResponse.json({ zone: result });
}

export async function handleDeleteDeliveryZone(supabase, data) {
  const { id } = data || {};
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ── Assign delivery person to order ──────────────────────────────────────────

export async function handleAssignDelivery(supabase, data) {
  const { order_id, delivery_person_id, start_delivery } = data || {};
  if (!order_id) return NextResponse.json({ error: 'order_id obrigatório' }, { status: 400 });

  const updates = {
    delivery_person_id: delivery_person_id || null,
  };

  if (delivery_person_id && start_delivery) {
    updates.status = 'delivering';
    updates.delivering_at = new Date().toISOString();
  }

  const { error } = await supabase.from('orders').update(updates).eq('id', order_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ── Admin: get driver locations for tracking ──────────────────────────────────

export async function handleGetDriverLocations(supabase) {
  const { data: logs, error } = await supabase
    .from('delivery_locations')
    .select('delivery_person_id, lat, lng, recorded_at, delivery_persons(name)')
    .order('recorded_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set();
  const locations = (logs || []).filter(r => {
    if (!r.delivery_person_id || seen.has(r.delivery_person_id)) return false;
    seen.add(r.delivery_person_id);
    return true;
  }).map(r => ({
    delivery_person_id: r.delivery_person_id,
    driver_location_lat: r.lat,
    driver_location_lng: r.lng,
    driver_location_at: r.recorded_at,
    delivery_persons: r.delivery_persons,
  }));

  return NextResponse.json({ locations });
}

// ── Admin: delivery metrics dashboard ────────────────────────────────────────

export async function handleGetDeliveryMetrics(supabase, data) {
  const rawDays = Number(data?.days);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 180) : 30;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const [{ data: persons, error: personsError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase
      .from('delivery_persons')
      .select('id, name, is_active')
      .order('name'),
    supabase
      .from('orders')
      .select('id, order_number, status, total, delivery_fee, delivery_person_id, delivering_at, delivered_at, driver_collected_at, driver_delivered_at, created_at')
      .not('delivery_person_id', 'is', null)
      .gte('created_at', fromDate.toISOString()),
  ]);

  if (personsError) return NextResponse.json({ error: personsError.message }, { status: 500 });
  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  const byPerson = new Map((persons || []).map(p => [p.id, {
    delivery_person_id: p.id,
    name: p.name,
    is_active: p.is_active,
    assigned_count: 0,
    delivered_count: 0,
    cancelled_count: 0,
    in_progress_count: 0,
    delivery_fees_total: 0,
    orders_total_value: 0,
    avg_delivery_minutes: null,
    min_delivery_minutes: null,
    max_delivery_minutes: null,
    last_delivery_at: null,
  }]));

  const durationsByPerson = new Map();

  for (const o of (orders || [])) {
    if (!o.delivery_person_id) continue;
    const item = byPerson.get(o.delivery_person_id) || {
      delivery_person_id: o.delivery_person_id,
      name: 'Entregador removido',
      is_active: false,
      assigned_count: 0,
      delivered_count: 0,
      cancelled_count: 0,
      in_progress_count: 0,
      delivery_fees_total: 0,
      orders_total_value: 0,
      avg_delivery_minutes: null,
      min_delivery_minutes: null,
      max_delivery_minutes: null,
      last_delivery_at: null,
    };

    item.assigned_count += 1;

    if (o.status === 'delivered') {
      item.delivered_count += 1;
      item.delivery_fees_total += parseFloat(o.delivery_fee || 0) || 0;
      item.orders_total_value += parseFloat(o.total || 0) || 0;
      const deliveredAt = o.driver_delivered_at || o.delivered_at;
      if (!item.last_delivery_at || (deliveredAt && new Date(deliveredAt) > new Date(item.last_delivery_at))) {
        item.last_delivery_at = deliveredAt;
      }
      const from = o.driver_collected_at || o.delivering_at;
      const to = o.driver_delivered_at || o.delivered_at;
      if (from && to) {
        const mins = Math.round((new Date(to) - new Date(from)) / 60000);
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
    p.orders_total_value = Number(p.orders_total_value.toFixed(2));
    return p;
  }).sort((a, b) => b.delivered_count - a.delivered_count || b.delivery_fees_total - a.delivery_fees_total);

  const summary = {
    days,
    total_assigned: personsMetrics.reduce((sum, p) => sum + p.assigned_count, 0),
    total_delivered: personsMetrics.reduce((sum, p) => sum + p.delivered_count, 0),
    total_in_progress: personsMetrics.reduce((sum, p) => sum + p.in_progress_count, 0),
    total_cancelled: personsMetrics.reduce((sum, p) => sum + p.cancelled_count, 0),
    total_delivery_fees: Number(personsMetrics.reduce((sum, p) => sum + p.delivery_fees_total, 0).toFixed(2)),
    total_orders_value: Number(personsMetrics.reduce((sum, p) => sum + p.orders_total_value, 0).toFixed(2)),
  };

  const allAverages = personsMetrics.map(p => p.avg_delivery_minutes).filter(v => Number.isFinite(v));
  summary.avg_delivery_minutes = allAverages.length
    ? Math.round(allAverages.reduce((sum, n) => sum + n, 0) / allAverages.length)
    : null;

  return NextResponse.json({ summary, persons: personsMetrics });
}
