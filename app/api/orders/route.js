import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';

/** GET /api/orders — retorna os pedidos do usuário autenticado. */
export async function GET(request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(`orders:${ip}`, 30, 60_000);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: 'Muitas requisições' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 });
  }

  const userId = decoded.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ orders: data || [] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
