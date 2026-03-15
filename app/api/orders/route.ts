import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';
import { getAuthUser } from '../../../lib/auth';

const PAGE_LIMIT = 20;

/** GET /api/orders — retorna os pedidos do usuário autenticado (paginado).
 *  Query params:
 *    cursor  — ISO string do created_at do último item recebido (paginação via cursor)
 *    limit   — número de itens por página (padrão 20, máx 50)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(`orders:${ip}`, 30, 60_000);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: 'Muitas requisições' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  const decoded = getAuthUser(request);
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const userId = decoded.userId;

  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limitParam = parseInt(searchParams.get('limit') || String(PAGE_LIMIT), 10);
    const limit = Math.min(Math.max(1, limitParam), 50);

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Busca um extra para detectar se há próxima página

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const orders = data || [];
    const hasMore = orders.length > limit;
    if (hasMore) orders.pop(); // Remove o item extra

    const nextCursor = hasMore ? orders[orders.length - 1]?.created_at ?? null : null;

    return NextResponse.json({ orders, nextCursor, hasMore });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
