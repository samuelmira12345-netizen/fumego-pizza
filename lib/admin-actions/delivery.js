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
    .select('id, order_number, customer_name, total, delivery_neighborhood, status, delivering_at, delivered_at, driver_collected_at, driver_delivered_at, payment_method')
    .eq('delivery_person_id', person_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (from) q = q.gte('created_at', from);
  if (to)   q = q.lte('created_at', to);

  const { data: orders, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalEarned = (orders || []).filter(o => o.status === 'delivered')
    .reduce((s, o) => s + (parseFloat(o.total) || 0), 0);

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
  const { order_id, delivery_person_id } = data || {};
  if (!order_id) return NextResponse.json({ error: 'order_id obrigatório' }, { status: 400 });

  const { error } = await supabase.from('orders').update({
    delivery_person_id: delivery_person_id || null,
    status: delivery_person_id ? 'delivering' : undefined,
  }).eq('id', order_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ── Admin: get driver locations for tracking ──────────────────────────────────

export async function handleGetDriverLocations(supabase) {
  // Get the latest location of each active delivery person
  const { data, error } = await supabase
    .from('orders')
    .select('delivery_person_id, driver_location_lat, driver_location_lng, driver_location_at, delivery_persons(name)')
    .in('status', ['delivering'])
    .not('driver_location_lat', 'is', null)
    .order('driver_location_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deduplicate by person (keep most recent)
  const seen = new Set();
  const locations = (data || []).filter(r => {
    if (seen.has(r.delivery_person_id)) return false;
    seen.add(r.delivery_person_id);
    return true;
  });

  return NextResponse.json({ locations });
}
