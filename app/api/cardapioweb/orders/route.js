import { NextResponse } from 'next/server';
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

/**
 * Verifica se a requisição carrega um JWT de admin válido.
 * Mesmo mecanismo usado em /api/admin/route.js.
 */
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

// ============================================================
// GET /api/cardapioweb/orders
// Lista pedidos do CardápioWeb armazenados localmente.
// ============================================================
export async function GET(request) {
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
    logger.error('[CW Orders GET] Erro', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ============================================================
// POST /api/cardapioweb/orders
// Ações de gerenciamento de pedidos do CardápioWeb.
//
// Body: { action, cw_order_id, cancellation_reason? }
//
// Ações disponíveis:
//   sync      – Sincroniza pedidos recentes da API do CardápioWeb
//   confirm   – Aceita o pedido
//   ready     – Marca como pronto para entrega/retirada
//   delivered – Marca como entregue (delivery apenas)
//   finalize  – Finaliza o pedido (ação final)
//   cancel    – Cancela o pedido (ação final)
// ============================================================
export async function POST(request) {
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

    // ── SYNC: busca pedidos recentes do CardápioWeb e persiste localmente ──
    if (action === 'sync') {
      const cwOrders = await getOrders();
      const list = Array.isArray(cwOrders) ? cwOrders : [];
      let synced = 0;
      let updated = 0;

      for (const summary of list) {
        const { data: existing } = await supabase
          .from('cardapioweb_orders')
          .select('id, status')
          .eq('cw_order_id', summary.id)
          .maybeSingle();

        if (existing) {
          // Atualizar status se mudou
          if (existing.status !== summary.status) {
            await supabase
              .from('cardapioweb_orders')
              .update({ status: summary.status, cw_updated_at: summary.updated_at })
              .eq('cw_order_id', summary.id);
            updated++;
          }
        } else {
          // Buscar pedido completo e inserir (rate limit: 400 req/min)
          try {
            const full = await getOrder(summary.id);
            await supabase.from('cardapioweb_orders').insert(buildInsertPayload(full));
            synced++;
          } catch (err) {
            logger.warn('[CW Sync] Falha ao buscar pedido', { id: summary.id, err: err.message });
          }
        }
      }

      return NextResponse.json({ success: true, synced, updated, total: list.length });
    }

    // ── Ações de status: requerem cw_order_id ──────────────────────────────
    if (!cw_order_id) {
      return NextResponse.json({ error: 'cw_order_id é obrigatório' }, { status: 400 });
    }

    let newStatus = null;

    switch (action) {
      case 'confirm':
        await confirmOrder(cw_order_id);
        newStatus = 'confirmed';
        break;

      case 'ready':
        await markOrderReady(cw_order_id);
        // Status depende do tipo: delivery → released, outros → waiting_to_catch
        // O status correto virá via webhook; por ora usamos 'released' como padrão
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

    // Atualizar status localmente após ação bem-sucedida na API do CW
    if (newStatus) {
      await supabase
        .from('cardapioweb_orders')
        .update({ status: newStatus, cw_updated_at: new Date().toISOString() })
        .eq('cw_order_id', cw_order_id);
    }

    return NextResponse.json({ success: true, newStatus });

  } catch (e) {
    logger.error('[CW Orders POST] Erro', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * Monta o objeto de inserção na tabela cardapioweb_orders
 * a partir do payload completo retornado pela API do CardápioWeb.
 */
function buildInsertPayload(order) {
  return {
    cw_order_id:      order.id,
    cw_display_id:    order.display_id,
    status:           order.status,
    order_type:       order.order_type,
    customer_name:    order.customer?.name  || null,
    customer_phone:   order.customer?.phone || null,
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
