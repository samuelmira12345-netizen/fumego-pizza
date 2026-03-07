import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';
import { logger } from '../../../lib/logger';
import { earnCashback } from '../../../lib/cashback';

function verifyAdminToken(request) {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const decoded = jwt.verify(token, secret);
    return decoded.role === 'admin';
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    // Admins autenticados podem fazer mais requisições (auto-refresh do KDS)
    const { allowed, retryAfterMs } = await checkRateLimit(`admin:${ip}`, 500, 15 * 60_000);
    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${retryAfterSec} segundos.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    // Autenticação via token JWT (obtido em POST /api/admin/session)
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    const supabase = getSupabaseAdmin();

    if (action === 'get_data') {
      // Suporta paginação: cursor = created_at do último item recebido
      const { cursor, pageSize = 50 } = data || {};
      let ordersQuery = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(pageSize);
      if (cursor) ordersQuery = ordersQuery.lt('created_at', cursor);

      const [products, drinks, coupons, settings, orders] = await Promise.all([
        supabase.from('products').select('*').order('sort_order'),
        supabase.from('drinks').select('*').order('name'),
        supabase.from('coupons').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*'),
        ordersQuery,
      ]);
      return NextResponse.json({
        products:   products.data || [],
        drinks:     drinks.data   || [],
        coupons:    coupons.data  || [],
        settings:   settings.data || [],
        orders:     orders.data   || [],
        hasMore:    (orders.data || []).length === pageSize,
      });
    }

    if (action === 'get_orders_only') {
      // Leve: apenas orders — usado pelo KDS no auto-refresh (não rebusca produtos/config)
      const { since } = data || {};
      let q = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      // Se 'since' fornecido, retorna apenas pedidos a partir daquele momento (mais leve ainda)
      if (since) q = q.gte('created_at', since);
      const { data: rows, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ orders: rows || [] });
    }

    if (action === 'get_more_orders') {
      const { cursor, pageSize = 50 } = data || {};
      let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(pageSize);
      if (cursor) q = q.lt('created_at', cursor);
      const { data: rows } = await q;
      return NextResponse.json({ orders: rows || [], hasMore: (rows || []).length === pageSize });
    }

    if (action === 'save_all') {
      const { products, drinks, settings } = data;
      if (products) for (const p of products) await supabase.from('products').upsert(p);
      if (drinks)   for (const d of drinks)   await supabase.from('drinks').upsert(d);
      if (settings) for (const s of settings) await supabase.from('settings').upsert(s, { onConflict: 'key' });
      return NextResponse.json({ success: true });
    }

    if (action === 'update_order') {
      const { id, status, payment_status } = data;
      const updates = {};
      if (status)         updates.status         = status;
      if (payment_status) updates.payment_status = payment_status;
      await supabase.from('orders').update(updates).eq('id', id);

      // Gera cashback quando loja finaliza o pedido manualmente (dinheiro/cartão na entrega)
      if (status === 'delivered') {
        const { data: order } = await supabase
          .from('orders')
          .select('user_id, total, payment_method')
          .eq('id', id)
          .single();
        if (order?.user_id && ['cash', 'card_delivery'].includes(order.payment_method)) {
          earnCashback(supabase, order.user_id, id, order.total)
            .catch(e => logger.error('[Cashback] Earn error on admin update_order', { id, err: e.message }));
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'add_coupon') {
      const { error } = await supabase.from('coupons').insert(data);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_coupon') {
      await supabase.from('coupons').delete().eq('id', data.id);
      return NextResponse.json({ success: true });
    }

    if (action === 'add_drink') {
      const { error, data: inserted } = await supabase.from('drinks').insert(data).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, drink: inserted });
    }

    if (action === 'delete_drink') {
      const { error } = await supabase.from('drinks').delete().eq('id', data.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'remove_logo') {
      await supabase.from('settings').upsert({ key: 'logo_url', value: '' }, { onConflict: 'key' });
      return NextResponse.json({ success: true });
    }

    if (action === 'get_order_items') {
      const { order_id } = data || {};
      if (!order_id) return NextResponse.json({ error: 'order_id obrigatório' }, { status: 400 });
      const { data: items, error } = await supabase
        .from('order_items')
        .select('product_name, quantity, unit_price, total_price, observations, drink_id')
        .eq('order_id', order_id)
        .order('created_at', { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: items || [] });
    }

    if (action === 'get_customers') {
      // Fetch all orders and aggregate by customer_phone
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, customer_name, customer_phone, total, status, created_at, delivery_neighborhood, delivery_city')
        .order('created_at', { ascending: false })
        .limit(10000);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const map = {};
      for (const o of (orders || [])) {
        const key = o.customer_phone || o.customer_name || 'unknown';
        if (!map[key]) {
          map[key] = {
            phone: o.customer_phone,
            name: o.customer_name,
            neighborhood: o.delivery_neighborhood,
            city: o.delivery_city,
            orders: 0,
            total_spent: 0,
            first_order: o.created_at,
            last_order: o.created_at,
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

    if (action === 'get_customer_profile') {
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
      let topItems = [];
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_name, quantity')
          .in('order_id', orderIds.slice(0, 100));
        if (items) {
          const itemMap = {};
          for (const i of items) {
            itemMap[i.product_name] = (itemMap[i.product_name] || 0) + (i.quantity || 1);
          }
          topItems = Object.entries(itemMap)
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);
        }
      }

      // Peak hour
      const hourMap = {};
      for (const o of (orders || [])) {
        const h = new Date(o.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit' });
        hourMap[h] = (hourMap[h] || 0) + 1;
      }
      const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      return NextResponse.json({ orders: orders || [], topItems, peakHour });
    }

    if (action === 'create_manual_order') {
      const {
        customer_name, customer_phone,
        delivery_street, delivery_number, delivery_complement,
        delivery_neighborhood, delivery_city, delivery_zipcode,
        subtotal, discount, delivery_fee, total,
        payment_method, payment_status, observations, items,
      } = data || {};

      if (!customer_name || !items?.length) {
        return NextResponse.json({ error: 'Nome do cliente e itens são obrigatórios' }, { status: 400 });
      }

      const orderNumber = Math.floor(Date.now() / 1000) % 100000;

      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_name, customer_phone: customer_phone || null,
          delivery_street: delivery_street || null,
          delivery_number: delivery_number || null,
          delivery_complement: delivery_complement || null,
          delivery_neighborhood: delivery_neighborhood || null,
          delivery_city: delivery_city || null,
          delivery_zipcode: delivery_zipcode || null,
          subtotal: parseFloat(subtotal) || 0,
          discount: parseFloat(discount) || 0,
          delivery_fee: parseFloat(delivery_fee) || 0,
          total: parseFloat(total) || 0,
          payment_method: payment_method || 'cash',
          payment_status: payment_status || 'pending',
          status: 'confirmed',
          observations: observations || null,
          source: 'manual',
        })
        .select()
        .single();

      if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

      if (items?.length) {
        const rows = items.map(i => ({
          order_id: order.id,
          product_name: i.product_name,
          quantity: i.quantity || 1,
          unit_price: parseFloat(i.unit_price) || 0,
          total_price: parseFloat(i.total_price) || 0,
          observations: i.observations || null,
        }));
        await supabase.from('order_items').insert(rows);
      }

      return NextResponse.json({ success: true, order });
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (e) {
    logger.error('Admin error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
