import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';
import { logger } from '../../../lib/logger';
import { earnCashback } from '../../../lib/cashback';

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

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    // Admins autenticados podem fazer mais requisições (auto-refresh do KDS)
    const { allowed, retryAfterMs } = await checkRateLimit(`admin:${ip}`, 500, 15 * 60_000);
    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${retryAfterSec} segundos.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    // Autenticação via token JWT (obtido em POST /api/admin/session)
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    const supabase = getSupabaseAdmin();

    if (action === 'get_data') {
      // Carrega os últimos 8 dias para permitir comparativo com a semana anterior no Dashboard.
      // "Carregar mais" (get_more_orders) usa cursor para orders mais antigas.
      const since8days = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
      let ordersQuery = supabase
        .from('orders')
        .select('*')
        .gte('created_at', since8days)
        .order('created_at', { ascending: false })
        .limit(2000);

      const [products, drinks, coupons, settings, orders] = await Promise.all([
        supabase.from('products').select('*').order('sort_order'),
        supabase.from('drinks').select('*').order('name'),
        supabase.from('coupons').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*'),
        ordersQuery,
      ]);
      return NextResponse.json({
        products:   products.data || [],
        drinks:     drinks.data   || [],
        coupons:    coupons.data  || [],
        settings:   settings.data || [],
        orders:     orders.data   || [],
        hasMore:    (orders.data || []).length >= 2000,
      });
    }

    if (action === 'get_orders_only') {
      // Retorna os últimos 8 dias de orders para manter o Dashboard e o KDS sincronizados.
      const { since } = data || {};
      const defaultSince = since || new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
      let q = supabase
        .from('orders')
        .select('*')
        .gte('created_at', defaultSince)
        .order('created_at', { ascending: false })
        .limit(2000);
      const { data: rows, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ orders: rows || [] });
    }

    if (action === 'get_more_orders') {
      const { cursor, pageSize = 50 } = data || {};
      let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(pageSize);
      if (cursor) q = q.lt('created_at', cursor);
      const { data: rows } = await q;
      return NextResponse.json({ orders: rows || [], hasMore: (rows || []).length === pageSize });
    }

    if (action === 'save_setting') {
      const { key, value } = data;
      await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
      return NextResponse.json({ success: true });
    }

    if (action === 'save_all') {
      const { products, drinks, settings } = data;
      if (products) for (const p of products) await supabase.from('products').upsert(p);
      if (drinks)   for (const d of drinks)   await supabase.from('drinks').upsert(d);
      if (settings) for (const s of settings) await supabase.from('settings').upsert(s, { onConflict: 'key' });
      return NextResponse.json({ success: true });
    }

    if (action === 'update_order') {
      const { id, status, payment_status } = data;
      const updates = {};
      if (status)         updates.status         = status;
      if (payment_status) updates.payment_status = payment_status;

      // Registra timestamps da timeline ao mudar status
      const now = new Date().toISOString();
      if (status === 'confirmed' || status === 'preparing') updates.confirmed_at  = now;
      if (status === 'delivering')                          updates.delivering_at = now;
      if (status === 'delivered')                          updates.delivered_at  = now;

      await supabase.from('orders').update(updates).eq('id', id);

      // Gera cashback quando loja finaliza o pedido manualmente (dinheiro/cartão na entrega)
      if (status === 'delivered') {
        const { data: order } = await supabase
          .from('orders')
          .select('user_id, total, payment_method')
          .eq('id', id)
          .single();
        if (order?.user_id && ['cash', 'card_delivery'].includes(order.payment_method)) {
          earnCashback(supabase, order.user_id, id, order.total)
            .catch(e => logger.error('[Cashback] Earn error on admin update_order', { id, err: e.message }));
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'add_coupon') {
      const { error } = await supabase.from('coupons').insert(data);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'update_coupon') {
      const { id, ...fields } = data;
      if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
      const { error } = await supabase.from('coupons').update(fields).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_coupon') {
      await supabase.from('coupons').delete().eq('id', data.id);
      return NextResponse.json({ success: true });
    }

    if (action === 'get_coupon_analytics') {
      // Fetch coupon usage records and orders that used coupons
      const [usageRes, ordersRes] = await Promise.all([
        supabase
          .from('coupon_usage')
          .select('id, coupon_id, cpf, user_id, created_at')
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase
          .from('orders')
          .select('id, order_number, customer_name, customer_cpf, coupon_code, discount, total, payment_method, created_at')
          .not('coupon_code', 'is', null)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);
      return NextResponse.json({
        usage:  usageRes.data  || [],
        orders: ordersRes.data || [],
      });
    }

    if (action === 'add_drink') {
      const { error, data: inserted } = await supabase.from('drinks').insert(data).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, drink: inserted });
    }

    if (action === 'delete_drink') {
      const { error } = await supabase.from('drinks').delete().eq('id', data.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'duplicate_drink') {
      const { id } = data;
      const { data: src } = await supabase.from('drinks').select('*').eq('id', id).single();
      if (!src) return NextResponse.json({ error: 'Bebida não encontrada' }, { status: 404 });
      const { id: _id, created_at, ...rest } = src;
      const { data: inserted, error } = await supabase.from('drinks').insert({ ...rest, name: src.name + ' (cópia)', is_active: false }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, drink: inserted });
    }

    if (action === 'remove_logo') {
      await supabase.from('settings').upsert({ key: 'logo_url', value: '' }, { onConflict: 'key' });
      return NextResponse.json({ success: true });
    }

    if (action === 'get_catalog_extra') {
      // Ingredientes (insumos), fichas técnicas e histórico de preços
      const [ingredients, recipes, priceHistory, compoundItems] = await Promise.all([
        supabase.from('ingredients').select('*').order('name'),
        supabase.from('recipe_items').select('*'),
        supabase.from('ingredient_price_history').select('*').order('changed_at', { ascending: true }).limit(1000),
        supabase.from('compound_ingredient_items').select('*'),
      ]);
      return NextResponse.json({
        ingredients:   ingredients.data   || [],
        recipes:       recipes.data       || [],
        priceHistory:  priceHistory.data  || [],
        compoundItems: compoundItems.data || [],
      });
    }

    if (action === 'add_product') {
      const { data: inserted, error } = await supabase.from('products').insert(data).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, product: inserted });
    }

    if (action === 'save_ingredient') {
      const {
        id, name, unit, cost_per_unit,
        correction_factor, min_stock, max_stock, current_stock,
        purchase_origin, ingredient_type, weight_volume,
      } = data;
      const extraFields = {
        correction_factor: correction_factor !== undefined ? parseFloat(correction_factor) || 1.0 : undefined,
        min_stock:         min_stock         !== undefined ? parseFloat(min_stock)         || 0   : undefined,
        max_stock:         max_stock         !== undefined ? parseFloat(max_stock)         || 0   : undefined,
        current_stock:     current_stock     !== undefined ? parseFloat(current_stock)     || 0   : undefined,
        purchase_origin:   purchase_origin   !== undefined ? purchase_origin               : undefined,
        ingredient_type:   ingredient_type   !== undefined ? ingredient_type               : undefined,
        weight_volume:     weight_volume     !== undefined ? parseFloat(weight_volume)     || 1   : undefined,
      };
      // Remove undefined fields
      Object.keys(extraFields).forEach(k => extraFields[k] === undefined && delete extraFields[k]);

      if (id) {
        // Check if price changed → record history
        const { data: existing } = await supabase.from('ingredients').select('cost_per_unit').eq('id', id).single();
        const oldPrice = parseFloat(existing?.cost_per_unit);
        const newPrice = parseFloat(cost_per_unit);
        let priceHistoryEntry = null;
        if (!isNaN(oldPrice) && !isNaN(newPrice) && oldPrice !== newPrice) {
          const { data: histEntry } = await supabase.from('ingredient_price_history').insert({
            ingredient_id: id,
            old_price: oldPrice,
            new_price: newPrice,
          }).select().single();
          priceHistoryEntry = histEntry;
        }
        await supabase.from('ingredients').update({ name, unit, cost_per_unit, ...extraFields }).eq('id', id);
        return NextResponse.json({ success: true, priceHistoryEntry });
      } else {
        const { data: inserted, error } = await supabase.from('ingredients').insert({ name, unit, cost_per_unit, ...extraFields }).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true, ingredient: inserted });
      }
    }

    if (action === 'save_compound_recipe') {
      const { compound_id, items, computed_cost } = data;
      if (!compound_id) return NextResponse.json({ error: 'compound_id obrigatório' }, { status: 400 });
      await supabase.from('compound_ingredient_items').delete().eq('compound_id', compound_id);
      if (items && items.length > 0) {
        const rows = items.map(i => ({ compound_id, ingredient_id: i.ingredient_id, quantity: parseFloat(i.quantity) || 0 }));
        const { error } = await supabase.from('compound_ingredient_items').insert(rows);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
      // Auto-update cost_per_unit of the compound ingredient based on recipe
      if (computed_cost !== undefined && computed_cost > 0) {
        const { data: existing } = await supabase.from('ingredients').select('cost_per_unit').eq('id', compound_id).single();
        const oldPrice = parseFloat(existing?.cost_per_unit);
        const newPrice = parseFloat(computed_cost);
        if (!isNaN(oldPrice) && oldPrice !== newPrice) {
          await supabase.from('ingredient_price_history').insert({ ingredient_id: compound_id, old_price: oldPrice, new_price: newPrice });
        }
        await supabase.from('ingredients').update({ cost_per_unit: newPrice }).eq('id', compound_id);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'stock_movement') {
      const { ingredient_id, movement_type, quantity, reason, notes } = data;
      if (!ingredient_id || !movement_type || quantity === undefined) {
        return NextResponse.json({ error: 'ingredient_id, movement_type e quantity são obrigatórios' }, { status: 400 });
      }
      const qty = parseFloat(quantity) || 0;

      // Insert movement record
      const { error: mvErr } = await supabase.from('stock_movements').insert({
        ingredient_id,
        movement_type,
        quantity: qty,
        reason: reason || '',
        notes: notes || '',
      });
      if (mvErr) return NextResponse.json({ error: mvErr.message }, { status: 400 });

      // Update current_stock
      const { data: ing } = await supabase.from('ingredients').select('current_stock').eq('id', ingredient_id).single();
      const currentStock = parseFloat(ing?.current_stock) || 0;
      let newStock;
      if (movement_type === 'in')         newStock = currentStock + qty;
      else if (movement_type === 'out')   newStock = currentStock - qty;
      else                                newStock = qty; // adjustment

      const { error: updErr } = await supabase.from('ingredients').update({ current_stock: newStock }).eq('id', ingredient_id);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

      return NextResponse.json({ success: true, new_stock: newStock });
    }

    if (action === 'get_stock_movements') {
      const { limit: lim = 200, offset: off = 0, ingredient_id } = data || {};
      let query = supabase
        .from('stock_movements')
        .select('id, ingredient_id, movement_type, quantity, reason, notes, created_at, ingredients(name, unit)')
        .order('created_at', { ascending: false })
        .range(off, off + lim - 1);
      if (ingredient_id) query = query.eq('ingredient_id', ingredient_id);
      const { data: movements, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ movements: movements || [] });
    }

    if (action === 'delete_ingredient') {
      const { error } = await supabase.from('ingredients').delete().eq('id', data.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'save_recipe') {
      const { product_id, items } = data;
      // Substitui todos os itens da ficha técnica do produto
      await supabase.from('recipe_items').delete().eq('product_id', product_id);
      if (items && items.length > 0) {
        const rows = items.map(i => ({
          product_id,
          ingredient_id: i.ingredient_id,
          quantity: parseFloat(i.quantity) || 0,
        }));
        const { error } = await supabase.from('recipe_items').insert(rows);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'get_order_items') {
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

    if (action === 'get_customers') {
      // Fetch all orders and aggregate by customer_phone
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, customer_name, customer_phone, total, status, created_at, delivery_neighborhood, delivery_city')
        .order('created_at', { ascending: false })
        .limit(10000);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const map = {};
      for (const o of (orders || [])) {
        const key = o.customer_phone || o.customer_name || 'unknown';
        if (!map[key]) {
          map[key] = {
            phone: o.customer_phone,
            name: o.customer_name,
            neighborhood: o.delivery_neighborhood,
            city: o.delivery_city,
            orders: 0,
            total_spent: 0,
            first_order: o.created_at,
            last_order: o.created_at,
          };
        }
        map[key].orders += 1;
        if (o.status !== 'cancelled') map[key].total_spent += parseFloat(o.total) || 0;
        if (o.created_at < map[key].first_order) map[key].first_order = o.created_at;
        if (o.created_at > map[key].last_order)  map[key].last_order  = o.created_at;
      }

      const customers = Object.values(map)
        .map(c => ({ ...c, avg_ticket: c.orders > 0 ? c.total_spent / c.orders : 0 }))
        .sort((a, b) => b.orders - a.orders);
      return NextResponse.json({ customers });
    }

    if (action === 'get_customer_profile') {
      const { phone } = data || {};
      if (!phone) return NextResponse.json({ error: 'phone obrigatório' }, { status: 400 });

      const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('id, order_number, total, status, created_at, payment_method, delivery_neighborhood')
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false })
        .limit(200);
      if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

      const orderIds = (orders || []).map(o => o.id);
      let topItems = [];
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_name, quantity')
          .in('order_id', orderIds.slice(0, 100));
        if (items) {
          const itemMap = {};
          for (const i of items) {
            itemMap[i.product_name] = (itemMap[i.product_name] || 0) + (i.quantity || 1);
          }
          topItems = Object.entries(itemMap)
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);
        }
      }

      // Peak hour
      const hourMap = {};
      for (const o of (orders || [])) {
        const h = new Date(o.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit' });
        hourMap[h] = (hourMap[h] || 0) + 1;
      }
      const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      return NextResponse.json({ orders: orders || [], topItems, peakHour });
    }

    if (action === 'search_phone_suffix') {
      const { suffix } = data || {};
      if (!suffix || suffix.length < 4) return NextResponse.json({ customers: [] });

      const { data: rows, error: sErr } = await supabase
        .from('orders')
        .select('customer_name, customer_phone, delivery_neighborhood, delivery_city, delivery_street, delivery_number, created_at')
        .like('customer_phone', `%${suffix}`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

      // Group by phone, pick most recent entry per phone
      const map = {};
      for (const r of (rows || [])) {
        const key = r.customer_phone || r.customer_name;
        if (!map[key]) map[key] = r;
      }
      const customers = Object.values(map).slice(0, 8);
      return NextResponse.json({ customers });
    }

    if (action === 'create_manual_order') {
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

      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_name, customer_phone: customer_phone || null,
          delivery_street: delivery_street || null,
          delivery_number: delivery_number || null,
          delivery_complement: delivery_complement || null,
          delivery_neighborhood: delivery_neighborhood || null,
          delivery_city: delivery_city || null,
          delivery_zipcode: delivery_zipcode || null,
          subtotal: parseFloat(subtotal) || 0,
          discount: parseFloat(discount) || 0,
          delivery_fee: parseFloat(delivery_fee) || 0,
          total: parseFloat(total) || 0,
          payment_method: payment_method || 'cash',
          payment_status: payment_status || 'pending',
          status: 'confirmed',
          observations: observations || null,
        })
        .select()
        .single();

      if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

      if (items?.length) {
        const rows = items.map(i => ({
          order_id: order.id,
          product_name: i.product_name,
          quantity: i.quantity || 1,
          unit_price: parseFloat(i.unit_price) || 0,
          total_price: parseFloat(i.total_price) || 0,
          observations: i.observations || null,
        }));
        await supabase.from('order_items').insert(rows);
      }

      return NextResponse.json({ success: true, order });
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (e) {
    logger.error('Admin error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
