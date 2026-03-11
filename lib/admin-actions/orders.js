import { NextResponse } from 'next/server';
import { logger } from '../logger';
import { earnCashback } from '../cashback';
import { parseCatalogVisibilityOverrides, applyCatalogVisibilityOverrides } from '../catalog-visibility';

export async function handleGetData(supabase) {
  const since8days = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  const [products, drinks, coupons, settings, orders] = await Promise.all([
    supabase.from('products').select('*').order('sort_order'),
    supabase.from('drinks').select('*').order('name'),
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    supabase.from('settings').select('*'),
    supabase.from('orders').select('*').gte('created_at', since8days).order('created_at', { ascending: false }).limit(2000),
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

export async function handleGetOrdersOnly(supabase, data) {
  const { since } = data || {};
  const defaultSince = since || new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', defaultSince)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: rows || [] });
}

export async function handleGetMoreOrders(supabase, data) {
  const { cursor, pageSize = 50 } = data || {};
  let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(pageSize);
  if (cursor) q = q.lt('created_at', cursor);
  const { data: rows } = await q;
  return NextResponse.json({ orders: rows || [], hasMore: (rows || []).length === pageSize });
}

export async function handleGetOrderItems(supabase, data) {
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

export async function handleUpdateOrder(supabase, data) {
  const { id, status, payment_status, payment_method, fiscal_note, cash_received, payment_notes } = data;
  const updates = {};
  if (status)                       updates.status          = status;
  if (payment_status)               updates.payment_status  = payment_status;
  if (payment_method !== undefined) updates.payment_method  = payment_method;
  if (fiscal_note    !== undefined) updates.fiscal_note     = fiscal_note;
  if (cash_received  !== undefined) updates.cash_received   = cash_received;
  if (payment_notes  !== undefined) updates.payment_notes   = payment_notes;

  const now = new Date().toISOString();
  if (status === 'confirmed' || status === 'preparing') updates.confirmed_at  = now;
  if (status === 'ready')                               updates.ready_at      = now;
  if (status === 'delivering')                          updates.delivering_at = now;
  if (status === 'delivered')                          updates.delivered_at  = now;

  await supabase.from('orders').update(updates).eq('id', id);

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
            const ing = ri.ingredients;
            if (!ing) continue;
            const needsConv = (ing.unit === 'kg' && ri.recipe_unit === 'g') || (ing.unit === 'L' && ri.recipe_unit === 'ml');
            const toDeduct = (parseFloat(ri.quantity) || 0) * (needsConv ? 0.001 : 1) * (parseInt(oi.quantity) || 1);
            if (toDeduct <= 0) continue;

            const newStock = Math.max(0, (parseFloat(ing.current_stock) || 0) - toDeduct);
            await supabase.from('ingredients').update({ current_stock: newStock }).eq('id', ing.id);
            await supabase.from('stock_movements').insert({
              ingredient_id: ing.id, movement_type: 'sale', quantity: toDeduct,
              reason: 'order', reference_id: id, notes: `Venda: ${oi.product_name || 'produto'}`,
            });
          }
        }
      }
    } catch (stockErr) {
      logger.error('[Stock] Erro ao deduzir ingredientes', { id, err: stockErr.message });
    }
  }

  if (status === 'delivered') {
    const { data: order } = await supabase
      .from('orders').select('user_id, total, payment_method').eq('id', id).single();
    if (order?.user_id && ['cash', 'card_delivery'].includes(order.payment_method)) {
      earnCashback(supabase, order.user_id, id, order.total)
        .catch(e => logger.error('[Cashback] Earn error on update_order', { id, err: e.message }));
    }
  }

  return NextResponse.json({ success: true });
}

export async function handleCreateManualOrder(supabase, data) {
  const {
    customer_name, customer_phone,
    delivery_street, delivery_number, delivery_complement,
    delivery_neighborhood, delivery_city, delivery_zipcode,
    subtotal, discount, delivery_fee, total,
    payment_method, payment_status, observations, items,
  } = data || {};

  if (!customer_name || !items?.length) {
    return NextResponse.json({ error: 'Nome do cliente e itens são obrigatórios' }, { status: 400 });
  }

  const orderNumber = Math.floor(Date.now() / 1000) % 100000;

  const { data: order, error: oErr } = await supabase.from('orders').insert({
    order_number: orderNumber,
    customer_name, customer_phone: customer_phone || null,
    delivery_street: delivery_street || null, delivery_number: delivery_number || null,
    delivery_complement: delivery_complement || null, delivery_neighborhood: delivery_neighborhood || null,
    delivery_city: delivery_city || null, delivery_zipcode: delivery_zipcode || null,
    subtotal: parseFloat(subtotal) || 0, discount: parseFloat(discount) || 0,
    delivery_fee: parseFloat(delivery_fee) || 0, total: parseFloat(total) || 0,
    payment_method: payment_method || 'cash', payment_status: payment_status || 'pending',
    status: 'confirmed', observations: observations || null,
  }).select().single();

  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  if (items?.length) {
    const rows = items.map(i => ({
      order_id: order.id, product_name: i.product_name,
      quantity: i.quantity || 1, unit_price: parseFloat(i.unit_price) || 0,
      total_price: parseFloat(i.total_price) || 0, observations: i.observations || null,
    }));
    await supabase.from('order_items').insert(rows);
  }

  return NextResponse.json({ success: true, order });
}
