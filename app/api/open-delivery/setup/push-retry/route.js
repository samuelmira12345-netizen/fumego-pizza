import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../../../lib/supabase';
import { isCWPushEnabled, pushEventToCardapioWeb } from '../../../../../lib/open-delivery';
import { logger } from '../../../../../lib/logger';

function verifyAdminToken(request) {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const d = jwt.verify(token, secret);
    return d.role === 'admin';
  } catch { return false; }
}

/**
 * POST /api/open-delivery/setup/push-retry
 *
 * Reenvia manualmente um pedido ao CardápioWeb.
 * Útil para recuperar pedidos que não chegaram ao painel por falha no push.
 *
 * Requer autenticação de admin (Bearer token do painel).
 *
 * Body: { orderId: string }
 *
 * Response: { ok, orderId, result }
 */
export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!isCWPushEnabled()) {
    return NextResponse.json(
      { ok: false, error: 'OD_CW_BASE_URL não configurado — push desativado.' },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { orderId } = body;

  if (!orderId) {
    return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 });
  }

  // Verifica se o pedido existe no banco
  const supabase = getSupabaseAdmin();
  const { data: order, error: findErr } = await supabase
    .from('orders')
    .select('id, status, order_number, created_at')
    .eq('id', orderId)
    .single();

  if (findErr || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
  }

  // Garante que há um evento na fila de polling para este pedido
  // (caso a tabela od_events exista e não tenha o evento)
  const { error: evErr } = await supabase
    .from('od_events')
    .upsert(
      { order_id: orderId, event_type: 'CREATED' },
      { onConflict: 'order_id,event_type', ignoreDuplicates: false }
    );
  if (evErr) {
    // Não bloqueia: pode ser que a tabela não exista ou já haja entrada
    logger.warn('[OD Push-Retry] Não foi possível garantir od_events', { orderId, error: evErr.message });
  }

  // Reenvia o push ao CardápioWeb
  const result = await pushEventToCardapioWeb(orderId, 'CREATED');

  logger.info('[OD Push-Retry] Resultado do reenvio', { orderId, result });

  return NextResponse.json(
    { ok: result.ok, orderId, order_number: order.order_number, result },
    { status: result.ok ? 200 : 502 }
  );
}
