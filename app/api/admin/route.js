import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';
import { logger } from '../../../lib/logger';

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
    const { allowed, retryAfterMs } = await checkRateLimit(`admin:${ip}`, 20, 15 * 60_000);
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

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (e) {
    logger.error('Admin error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
