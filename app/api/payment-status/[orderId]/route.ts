import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';
import { restoreStockOnCancel } from '../../../../lib/stock-restore';
import { logger } from '../../../../lib/logger';

/** GET /api/payment-status/:orderId — retorna payment_status + status do pedido. */
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
): Promise<NextResponse> {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(`payment-status:${ip}`, 120, 60_000);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: 'Muitas requisições' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  const { orderId } = params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('orders')
      .select('payment_status, status')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ payment_status: data.payment_status, status: data.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST /api/payment-status/:orderId — cancela o pedido (chamado após timeout do PIX). */
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
): Promise<NextResponse> {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(`payment-cancel:${ip}`, 20, 60_000);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: 'Muitas requisições' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  const { orderId } = params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    if (body.action !== 'cancel') {
      return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: order } = await supabase
      .from('orders')
      .select('payment_status')
      .eq('id', orderId)
      .single();

    if (order?.payment_status !== 'approved') {
      const { data: cancelled } = await supabase
        .from('orders')
        .update({ payment_status: 'cancelled', status: 'cancelled' })
        .eq('id', orderId)
        .neq('status', 'cancelled')
        .select('id');

      // Devolve estoque somente se o pedido foi efetivamente cancelado agora
      if (cancelled && cancelled.length > 0) {
        restoreStockOnCancel(supabase, orderId)
          .catch((e: Error) => logger.error('[StockRestore] Erro ao restaurar estoque pós-timeout', { orderId, error: e.message }));
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
