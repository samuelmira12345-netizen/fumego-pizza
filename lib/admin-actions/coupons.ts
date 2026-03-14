import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleAddCoupon(supabase: SupabaseClient, data: Record<string, unknown>): Promise<NextResponse> {
  const { error } = await supabase.from('coupons').insert(data);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function handleUpdateCoupon(supabase: SupabaseClient, data: Record<string, unknown>): Promise<NextResponse> {
  const { id, ...fields } = data;
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  const { error } = await supabase.from('coupons').update(fields).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function handleDeleteCoupon(supabase: SupabaseClient, data: Record<string, unknown>): Promise<NextResponse> {
  await supabase.from('coupons').delete().eq('id', data.id);
  return NextResponse.json({ success: true });
}

export async function handleGetCouponAnalytics(supabase: SupabaseClient): Promise<NextResponse> {
  const [usageRes, ordersRes] = await Promise.all([
    supabase.from('coupon_usage')
      .select('id, coupon_id, cpf, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase.from('orders')
      .select('id, order_number, customer_name, customer_cpf, coupon_code, discount, total, payment_method, created_at')
      .not('coupon_code', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);
  return NextResponse.json({ usage: usageRes.data || [], orders: ordersRes.data || [] });
}
