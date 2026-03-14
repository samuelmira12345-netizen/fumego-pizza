import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../../lib/supabase';

function verifyDeliveryToken(request: NextRequest): jwt.JwtPayload | null {
  const auth  = request.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    if (decoded.role === 'delivery') return decoded;
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const person = verifyDeliveryToken(request);
    if (!person) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const supabase = getSupabaseAdmin();

    const todaySP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const todayStartISO = new Date(`${todaySP}T00:00:00-03:00`).toISOString();

    const [{ data: todayOrders, error: e1 }, { data: openOrders, error: e2 }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, delivery_persons(name, phone)')
        .eq('delivery_person_id', person.id)
        .in('status', ['ready', 'delivering', 'delivered'])
        .gte('created_at', todayStartISO),
      supabase
        .from('orders')
        .select('*, delivery_persons(name, phone)')
        .eq('delivery_person_id', person.id)
        .in('status', ['ready', 'delivering']),
    ]);

    if (e1 || e2) return NextResponse.json({ error: (e1 || e2)!.message }, { status: 500 });

    const orderMap = new Map<string, Record<string, unknown>>();
    [...(todayOrders || []), ...(openOrders || [])].forEach((o: Record<string, unknown>) => orderMap.set(o.id as string, o));
    const orders = Array.from(orderMap.values()).sort((a, b) => {
      const as = (a.delivery_sort_order as number) ?? 999999;
      const bs = (b.delivery_sort_order as number) ?? 999999;
      if (as !== bs) return as - bs;
      return new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime();
    });

    if (!orders.length) return NextResponse.json({ orders: [] });

    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const { data: items } = await supabase
        .from('order_items')
        .select('product_name, quantity, unit_price, total_price, observations')
        .eq('order_id', order.id);
      return { ...order, order_items: items || [] };
    }));

    return NextResponse.json({ orders: ordersWithItems });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const person = verifyDeliveryToken(request);
    if (!person) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { order_id, action, lat, lng } = body;

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (action === 'collected') {
      await supabase.from('orders').update({
        status: 'delivering',
        delivering_at: now,
        driver_collected_at: now,
      }).eq('id', order_id).eq('delivery_person_id', person.id);

    } else if (action === 'delivered') {
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

      await supabase.from('orders')
        .update({ driver_location_lat: parsedLat, driver_location_lng: parsedLng, driver_location_at: now })
        .eq('delivery_person_id', person.id)
        .in('status', ['ready', 'delivering']);

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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
