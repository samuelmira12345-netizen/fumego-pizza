import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../../lib/supabase';

function verifyDeliveryToken(request) {
  const auth  = request.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const decoded = jwt.verify(token, secret);
    if (decoded.role === 'delivery') return decoded;
    return null;
  } catch {
    return null;
  }
}

// GET: fetch orders assigned to this delivery person (or all pending for admin)
export async function GET(request) {
  try {
    const person = verifyDeliveryToken(request);
    if (!person) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const since48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, delivery_persons(name, phone)')
      .eq('delivery_person_id', person.id)
      .in('status', ['ready', 'delivering', 'delivered'])
      .gte('created_at', since48h)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get order items for each order
    const ordersWithItems = await Promise.all((orders || []).map(async order => {
      const { data: items } = await supabase
        .from('order_items')
        .select('product_name, quantity, unit_price, total_price, observations')
        .eq('order_id', order.id);
      return { ...order, order_items: items || [] };
    }));

    return NextResponse.json({ orders: ordersWithItems });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: update delivery status (collected / delivered) and location
export async function POST(request) {
  try {
    const person = verifyDeliveryToken(request);
    if (!person) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { order_id, action, lat, lng } = body;

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (action === 'collected') {
      // Driver picked up the order → status becomes 'delivering'
      await supabase.from('orders').update({
        status: 'delivering',
        delivering_at: now,
        driver_collected_at: now,
      }).eq('id', order_id).eq('delivery_person_id', person.id);

    } else if (action === 'delivered') {
      // Driver delivered → status becomes 'delivered'
      await supabase.from('orders').update({
        status: 'delivered',
        delivered_at: now,
        driver_delivered_at: now,
      }).eq('id', order_id).eq('delivery_person_id', person.id);

    } else if (action === 'update_location') {
      if (lat === undefined || lng === undefined) {
        return NextResponse.json({ error: 'lat/lng são obrigatórios' }, { status: 400 });
      }

      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        return NextResponse.json({ error: 'lat/lng inválidos' }, { status: 400 });
      }

      // Update current position on all active deliveries for this driver
      await supabase.from('orders')
        .update({ driver_location_lat: parsedLat, driver_location_lng: parsedLng, driver_location_at: now })
        .eq('delivery_person_id', person.id)
        .in('status', ['ready', 'delivering']);

      // Always persist heartbeat so admin can track rider even between orders
      await supabase.from('delivery_locations').insert({
        delivery_person_id: person.id,
        order_id: order_id || null,
        lat: parsedLat,
        lng: parsedLng,
        recorded_at: now,
      });
    } else {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
