import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger';
import { earnCashback } from '../cashback';
import { parseCatalogVisibilityOverrides, applyCatalogVisibilityOverrides } from '../catalog-visibility';

// ── Tipos internos ────────────────────────────────────────────────────────────

interface OrderHistoryDetails {
  message?: string;
  address_changes?: Array<{ field: string; from: string; to: string }>;
  removed_items?: NormalizedItem[];
  added_items?: NormalizedItem[];
  [key: string]: unknown;
}

interface NormalizedItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  observations: string | null;
}

interface RawItem {
  product_name?: string;
  quantity?: number | string;
  unit_price?: number | string;
  observations?: string | null;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

async function logOrderHistory(
  supabase: SupabaseClient,
  orderId: string,
  actionType: string,
  details: OrderHistoryDetails
): Promise<void> {
  try {
    await supabase.from('order_change_history').insert({
      order_id: orderId,
      action_type: actionType,
      details: details || {},
    });
  } catch (e) {
    logger.error('[OrderHistory] Erro ao registrar histórico', { orderId, actionType, err: (e as Error).message });
  }
}

function normalizeItemForDiff(item: RawItem): NormalizedItem {
  return {
    product_name: String(item?.product_name || '').trim(),
    quantity: Math.max(1, parseInt(String(item?.quantity), 10) || 1),
    unit_price: Math.max(0, parseFloat(String(item?.unit_price)) || 0),
    observations: String(item?.observations || '').trim() || null,
  };
}

function buildItemDiff(before: RawItem[] = [], after: RawItem[] = []): { removed: NormalizedItem[]; added: NormalizedItem[] } {
  const byKey = (arr: RawItem[]) => {
    const map = new Map<string, number>();
    arr.forEach((item) => {
      const norm = normalizeItemForDiff(item);
      if (!norm.product_name) return;
      const key = `${norm.product_name}|${norm.quantity}|${norm.unit_price}|${norm.observations || ''}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  };

  const prevMap = byKey(before);
  const nextMap = byKey(after);
  const removed: NormalizedItem[] = [];
  const added: NormalizedItem[] = [];

  for (const [key, count] of prevMap.entries()) {
    const rest = (nextMap.get(key) || 0) - count;
    if (rest < 0) {
      const [product_name, quantity, unit_price, observations] = key.split('|');
      for (let i = 0; i < Math.abs(rest); i += 1) {
        removed.push({ product_name, quantity: Number(quantity), unit_price: Number(unit_price), observations: observations || null });
      }
    }
  }

  for (const [key, count] of nextMap.entries()) {
    const rest = (prevMap.get(key) || 0) - count;
    if (rest < 0) {
      const [product_name, quantity, unit_price, observations] = key.split('|');
      for (let i = 0; i < Math.abs(rest); i += 1) {
        added.push({ product_name, quantity: Number(quantity), unit_price: Number(unit_price), observations: observations || null });
      }
    }
  }

  return { removed, added };
}

// ── Handlers exportados ───────────────────────────────────────────────────────

export async function handleGetData(supabase: SupabaseClient): Promise<NextResponse> {
  const since8days = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  const [products, drinks, coupons, settings, orders] = await Promise.all([
    supabase.from('products').select('*').order('sort_order'),
    supabase.from('drinks').select('*').order('name'),
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    supabase.from('settings').select('*'),
    supabase.from('orders').select('*').eq('is_active', true).gte('created_at', since8days).order('created_at', { ascending: false }).limit(2000),
  ]);
  const settingsData = settings.data || [];
  const overrides = parseCatalogVisibilityOverrides(settingsData);
  const merged = applyCatalogVisibilityOverrides(products.data || [], drinks.data || [], overrides);

  return NextResponse.json({
    products: merged.products,
    drinks:   merged.drinks,
    coupons:  coupons.data  || [],
    settings: settingsData,
    orders:   orders.data   || [],
    hasMore:  (orders.data || []).length >= 2000,
  });
}

export async function handleGetOrdersOnly(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { since } = data || {};
  const defaultSince = (since as string) || new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from('orders')
    .select('*')
    .eq('is_active', true)
    .gte('created_at', defaultSince)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: rows || [] });
}

export async function handleGetMoreOrders(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { cursor, pageSize = 50 } = data || {};
  let q = supabase.from('orders').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(Number(pageSize));
  if (cursor) q = q.lt('created_at', cursor as string);
  const { data: rows } = await q;
  return NextResponse.json({ orders: rows || [], hasMore: (rows || []).length === Number(pageSize) });
}

export async function handleGetOrderItems(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
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

export async function handleGetOrderChangeHistory(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { order_id } = data || {};
  if (!order_id) return NextResponse.json({ error: 'order_id obrigatório' }, { status: 400 });
  const { data: history, error } = await supabase
    .from('order_change_history')
    .select('id, order_id, action_type, details, created_at')
    .eq('order_id', order_id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: history || [] });
}

export async function handleUpdateOrder(supabase: SupabaseClient, data: Record<string, unknown>): Promise<NextResponse> {
  const {
    id, status, payment_status, payment_method, fiscal_note, cash_received, payment_notes,
    delivery_street, delivery_number, delivery_complement, delivery_neighborhood, delivery_city, delivery_zipcode,
    scheduled_for,
  } = data;

  const addressFields = ['delivery_street', 'delivery_number', 'delivery_complement', 'delivery_neighborhood', 'delivery_city', 'delivery_zipcode'];
  let previousOrder: Record<string, unknown> | null = null;

  if (id && addressFields.some((f) => data[f] !== undefined)) {
    const { data: prev } = await supabase
      .from('orders')
      .select('delivery_street, delivery_number, delivery_complement, delivery_neighborhood, delivery_city, delivery_zipcode')
      .eq('id', id)
      .single();
    previousOrder = prev || null;
  }

  const updates: Record<string, unknown> = {};
  if (status)                       updates.status          = status;
  if (payment_status)               updates.payment_status  = payment_status;
  if (payment_method !== undefined) updates.payment_method  = payment_method;
  if (fiscal_note    !== undefined) updates.fiscal_note     = fiscal_note;
  if (cash_received  !== undefined) updates.cash_received   = cash_received;
  if (payment_notes  !== undefined) updates.payment_notes   = payment_notes;
  if (delivery_street      !== undefined) updates.delivery_street      = delivery_street      || null;
  if (delivery_number      !== undefined) updates.delivery_number      = delivery_number      || null;
  if (delivery_complement  !== undefined) updates.delivery_complement  = delivery_complement  || null;
  if (delivery_neighborhood !== undefined) updates.delivery_neighborhood = delivery_neighborhood || null;
  if (delivery_city        !== undefined) updates.delivery_city        = delivery_city        || null;
  if (delivery_zipcode     !== undefined) updates.delivery_zipcode     = delivery_zipcode     || null;
  if (scheduled_for        !== undefined) updates.scheduled_for        = scheduled_for        || null;

  const now = new Date().toISOString();
  if (status === 'confirmed' || status === 'preparing') updates.confirmed_at  = now;
  if (status === 'ready')                               updates.ready_at      = now;
  if (status === 'delivering')                          updates.delivering_at = now;
  if (status === 'delivered')                           updates.delivered_at  = now;

  await supabase.from('orders').update(updates).eq('id', id);

  if (previousOrder) {
    const addressChanges: Array<{ field: string; from: string; to: string }> = [];
    addressFields.forEach((field) => {
      if (data[field] === undefined) return;
      const prevVal = String(previousOrder?.[field] || '');
      const nextVal = String(updates[field] || '');
      if (prevVal !== nextVal) {
        addressChanges.push({ field, from: prevVal, to: nextVal });
      }
    });
    if (addressChanges.length > 0) {
      await logOrderHistory(supabase, id as string, 'address_updated', {
        address_changes: addressChanges,
        message: 'Endereço atualizado no Kanban',
      });
    }
  }

  if (status === 'confirmed') {
    try {
      const { data: existingMov } = await supabase
        .from('stock_movements').select('id').eq('reference_id', id).eq('movement_type', 'sale').limit(1);

      if (!existingMov || existingMov.length === 0) {
        const { data: orderItems } = await supabase
          .from('order_items').select('product_id, quantity, product_name').eq('order_id', id);

        for (const oi of (orderItems || [])) {
          if (!oi.product_id) continue;
          const { data: recipe } = await supabase
            .from('recipe_items')
            .select('quantity, recipe_unit, ingredient_id, ingredients(id, unit, current_stock, name)')
            .eq('product_id', oi.product_id);

          for (const ri of (recipe || [])) {
            const ing = ri.ingredients as unknown as { id: string; unit: string; current_stock: number; name: string } | null;
            if (!ing) continue;
            const needsConv = (ing.unit === 'kg' && ri.recipe_unit === 'g') || (ing.unit === 'L' && ri.recipe_unit === 'ml');
            const toDeduct = (parseFloat(String(ri.quantity)) || 0) * (needsConv ? 0.001 : 1) * (parseInt(String(oi.quantity), 10) || 1);
            if (toDeduct <= 0) continue;

            const newStock = Math.max(0, (parseFloat(String(ing.current_stock)) || 0) - toDeduct);
            await supabase.from('ingredients').update({ current_stock: newStock }).eq('id', ing.id);
            await supabase.from('stock_movements').insert({
              ingredient_id: ing.id, movement_type: 'sale', quantity: toDeduct,
              reason: 'order', reference_id: id, notes: `Venda: ${oi.product_name || 'produto'}`,
            });
          }
        }
      }
    } catch (stockErr) {
      logger.error('[Stock] Erro ao deduzir ingredientes', { id, err: (stockErr as Error).message });
    }
  }

  if (status === 'delivered') {
    const { data: order } = await supabase
      .from('orders').select('user_id, total, payment_method').eq('id', id).single();
    if (order?.user_id && ['cash', 'card_delivery'].includes(order.payment_method)) {
      earnCashback(supabase, order.user_id, id as string, order.total)
        .catch(e => logger.error('[Cashback] Earn error on update_order', { id, err: (e as Error).message }));
    }
  }

  return NextResponse.json({ success: true });
}

export async function handleUpdateOrderItems(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { id, items } = data || {};
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Informe ao menos um item' }, { status: 400 });
  }

  const normalized = (items as RawItem[])
    .map((item) => {
      const quantity  = Math.max(1, parseInt(String(item.quantity), 10) || 1);
      const unitPrice = Math.max(0, parseFloat(String(item.unit_price)) || 0);
      const totalPrice = quantity * unitPrice;
      return {
        order_id:     id as string,
        product_name: String(item.product_name || '').trim(),
        quantity,
        unit_price:   unitPrice,
        total_price:  totalPrice,
        observations: String(item.observations || '').trim() || null,
      };
    })
    .filter((item) => item.product_name);

  if (normalized.length === 0) {
    return NextResponse.json({ error: 'Os itens devem ter nome' }, { status: 400 });
  }

  const subtotal = normalized.reduce((sum, item) => sum + item.total_price, 0);
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('discount, delivery_fee')
    .eq('id', id)
    .single();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  const discount    = parseFloat(String(order?.discount))    || 0;
  const deliveryFee = parseFloat(String(order?.delivery_fee)) || 0;
  const total       = Math.max(0, subtotal - discount + deliveryFee);

  const { data: previousItems } = await supabase
    .from('order_items')
    .select('product_name, quantity, unit_price, observations')
    .eq('order_id', id);

  const { error: delErr } = await supabase.from('order_items').delete().eq('order_id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const { error: insErr } = await supabase.from('order_items').insert(normalized);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const { error: updErr } = await supabase.from('orders').update({ subtotal, total }).eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const diff = buildItemDiff(previousItems || [], normalized);
  if (diff.removed.length > 0 || diff.added.length > 0) {
    await logOrderHistory(supabase, id as string, 'items_updated', {
      removed_items: diff.removed,
      added_items: diff.added,
      message: 'Itens editados no Kanban',
    });
  }

  return NextResponse.json({ success: true, items: normalized, subtotal, total });
}

export async function handleDeleteOrder(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { id } = data || {};
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const { error } = await supabase.from('orders').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logOrderHistory(supabase, id as string, 'order_deleted', { message: 'Pedido marcado como inativo pelo admin' });

  return NextResponse.json({ success: true });
}

export async function handleRestoreOrder(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { id } = data || {};
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const { error } = await supabase.from('orders').update({ is_active: true, status: 'confirmed', delivered_at: null, payment_status: 'pending' }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logOrderHistory(supabase, id as string, 'order_restored', { message: 'Pedido reaberto/restaurado pelo admin' });

  return NextResponse.json({ success: true });
}

export async function handleGetInactiveOrders(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { pageSize = 50, cursor } = data || {};
  let q = supabase.from('orders').select('*').eq('is_active', false).order('created_at', { ascending: false }).limit(Number(pageSize));
  if (cursor) q = q.lt('created_at', cursor as string);
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: rows || [], hasMore: (rows || []).length === Number(pageSize) });
}

export async function handleCreateManualOrder(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const {
    customer_name, customer_phone,
    delivery_street, delivery_number, delivery_complement,
    delivery_neighborhood, delivery_city, delivery_zipcode,
    subtotal, discount, delivery_fee, total,
    payment_method, payment_status, observations, items,
  } = data || {};

  if (!customer_name || !(items as unknown[])?.length) {
    return NextResponse.json({ error: 'Nome do cliente e itens são obrigatórios' }, { status: 400 });
  }

  const orderNumber = Math.floor(Date.now() / 1000) % 100000;

  const { data: order, error: oErr } = await supabase.from('orders').insert({
    order_number: orderNumber,
    customer_name, customer_phone: customer_phone || null,
    delivery_street: delivery_street || null, delivery_number: delivery_number || null,
    delivery_complement: delivery_complement || null, delivery_neighborhood: delivery_neighborhood || null,
    delivery_city: delivery_city || null, delivery_zipcode: delivery_zipcode || null,
    subtotal: parseFloat(String(subtotal)) || 0, discount: parseFloat(String(discount)) || 0,
    delivery_fee: parseFloat(String(delivery_fee)) || 0, total: parseFloat(String(total)) || 0,
    payment_method: payment_method || 'cash', payment_status: payment_status || 'pending',
    status: 'confirmed', observations: observations || null,
  }).select().single();

  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  if ((items as RawItem[])?.length) {
    const rows = (items as RawItem[]).map(i => ({
      order_id: order.id, product_name: i.product_name,
      quantity: Number(i.quantity) || 1, unit_price: parseFloat(String(i.unit_price)) || 0,
      total_price: parseFloat(String((i as Record<string, unknown>).total_price)) || 0,
      observations: i.observations || null,
    }));
    await supabase.from('order_items').insert(rows);
  }

  return NextResponse.json({ success: true, order });
}
