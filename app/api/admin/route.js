import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase';

export async function POST(request) {
  try {
    const { password, action, data } = await request.json();
    const adminPwd = process.env.ADMIN_PASSWORD || 'admin123';
    if (password !== adminPwd) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    if (action === 'get_data') {
      const [products, drinks, coupons, settings, orders] = await Promise.all([
        supabase.from('products').select('*').order('sort_order'),
        supabase.from('drinks').select('*').order('name'),
        supabase.from('coupons').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      return NextResponse.json({
        products: products.data || [],
        drinks: drinks.data || [],
        coupons: coupons.data || [],
        settings: settings.data || [],
        orders: orders.data || [],
      });
    }

    if (action === 'save_all') {
      const { products, drinks, settings } = data;
      if (products) {
        for (const p of products) {
          await supabase.from('products').upsert(p);
        }
      }
      if (drinks) {
        for (const d of drinks) {
          await supabase.from('drinks').upsert(d);
        }
      }
      if (settings) {
        for (const s of settings) {
          await supabase.from('settings').upsert(s, { onConflict: 'key' });
        }
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'update_order') {
      const { id, status, payment_status } = data;
      const updates = {};
      if (status) updates.status = status;
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

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (e) {
    console.error('Admin error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
