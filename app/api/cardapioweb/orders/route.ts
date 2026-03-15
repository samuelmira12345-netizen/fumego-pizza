import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import {
  getOrders,
  getOrder,
  confirmOrder,
  markOrderReady,
  markOrderDelivered,
  finalizeOrder,
  cancelOrder,
  isIntegrationEnabled,
} from '../../../../lib/cardapioweb';
import { logger } from '../../../../lib/logger';

function verifyAdminToken(request: NextRequest): boolean {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    return decoded.role === 'admin';
  } catch {
    return false;
  }
}

function buildInsertPayload(order: Record<string, unknown>): Record<string, unknown> {
  const customer = order.customer as Record<string, unknown> | null;
  return {
    cw_order_id:      order.id,
    cw_display_id:    order.display_id,
    status:           order.status,
    order_type:       order.order_type,
    customer_name:    customer?.name  || null,
    customer_phone:   customer?.phone || null,
    delivery_address: order.delivery_address || null,
    items:            order.items    || [],
    payments:         order.payments || [],
    total:            order.total,
    delivery_fee:     order.delivery_fee   || 0,
    observation:      order.observation    || null,
    raw_data:         order,
    cw_created_at:    order.created_at,
    cw_updated_at:    order.updated_at,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: orders, error } = await supabase
      .from('cardapioweb_orders')
      .select('*')
      .order('cw_created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      orders: orders || [],
      integrationEnabled: isIntegrationEnabled(),
    });
  } catch (e) {
    logger.error('[CW Orders GET] Erro', e as Error);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!isIntegrationEnabled()) {
    return NextResponse.json(
      { error: 'Integração CardápioWeb não configurada. Adicione CARDAPIOWEB_API_KEY.' },
      { status: 503 }
    );
  }

  try {
    const { action, cw_order_id, cancellation_reason } = await request.json();
    const supabase = getSupabaseAdmin();

    if (action === 'sync') {
      const cwOrders = await getOrders();
      const list = Array.isArray(cwOrders) ? cwOrders as Record<string, unknown>[] : [];
      let synced = 0;
      let updated = 0;

      for (const summary of list) {
        const { data: existing } = await supabase
          .from('cardapioweb_orders')
          .select('id, status')
          .eq('cw_order_id', summary.id)
          .maybeSingle();

        if (existing) {
          if (existing.status !== summary.status) {
            await supabase
              .from('cardapioweb_orders')
              .update({ status: summary.status, cw_updated_at: summary.updated_at })
              .eq('cw_order_id', summary.id);
            updated++;
          }
        } else {
          try {
            const full = await getOrder(summary.id as string) as Record<string, unknown>;
            await supabase.from('cardapioweb_orders').insert(buildInsertPayload(full));
            synced++;
          } catch (err) {
            logger.warn('[CW Sync] Falha ao buscar pedido', { id: summary.id, err: (err as Error).message });
          }
        }
      }

      return NextResponse.json({ success: true, synced, updated, total: list.length });
    }

    if (!cw_order_id) {
      return NextResponse.json({ error: 'cw_order_id é obrigatório' }, { status: 400 });
    }

    let newStatus: string | null = null;

    switch (action) {
      case 'confirm':
        await confirmOrder(cw_order_id);
        newStatus = 'confirmed';
        break;
      case 'ready':
        await markOrderReady(cw_order_id);
        newStatus = 'released';
        break;
      case 'delivered':
        await markOrderDelivered(cw_order_id);
        newStatus = 'delivered';
        break;
      case 'finalize':
        await finalizeOrder(cw_order_id);
        newStatus = 'closed';
        break;
      case 'cancel':
        await cancelOrder(cw_order_id, cancellation_reason || null);
        newStatus = 'canceled';
        break;
      default:
        return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
    }

    if (newStatus) {
      await supabase
        .from('cardapioweb_orders')
        .update({ status: newStatus, cw_updated_at: new Date().toISOString() })
        .eq('cw_order_id', cw_order_id);
    }

    return NextResponse.json({ success: true, newStatus });

  } catch (e) {
    logger.error('[CW Orders POST] Erro', e as Error);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
