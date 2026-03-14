import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';
import { logger } from '../../../lib/logger';

// ── Handlers por domínio ──────────────────────────────────────────────────────
import {
  handleGetData, handleGetOrdersOnly, handleGetMoreOrders,
  handleGetOrderItems, handleGetOrderChangeHistory, handleUpdateOrder, handleUpdateOrderItems,
  handleDeleteOrder, handleRestoreOrder, handleGetInactiveOrders, handleCreateManualOrder,
} from '../../../lib/admin-actions/orders';
import {
  handleSaveAll, handleSaveSetting, handleAddProduct,
  handleAddDrink, handleDeleteProduct, handleDeleteDrink, handleDuplicateDrink, handleRemoveLogo,
  handleUpdateProductFlags, handleUpdateDrinkFlags,
} from '../../../lib/admin-actions/catalog';
import {
  handleAddCoupon, handleUpdateCoupon, handleDeleteCoupon, handleGetCouponAnalytics,
} from '../../../lib/admin-actions/coupons';
import {
  handleGetCustomers, handleGetCustomerProfile, handleSearchPhoneSuffix,
} from '../../../lib/admin-actions/customers';
import {
  handleGetCatalogExtra, handleSaveIngredient, handleSaveCompoundRecipe,
  handleStockMovement, handleGetStockMovements, handleDeleteIngredient, handleSaveRecipe,
  handleGetCompoundRecipes, handleSaveCompoundRecipeV2, handleDeleteCompoundRecipe, handleApplyCompoundRecipe,
} from '../../../lib/admin-actions/inventory';
import {
  handleGetDeliveryPersons, handleSaveDeliveryPerson, handleDeleteDeliveryPerson,
  handleGetDeliveryHistory, handleGetDeliveryZones, handleSaveDeliveryZone,
  handleDeleteDeliveryZone, handleAssignDelivery, handleGetDriverLocations, handleGetDeliveryMetrics,
  handleGetDeliveryQueue, handleSetDeliveryPriority,
} from '../../../lib/admin-actions/delivery';

// ── Auth ──────────────────────────────────────────────────────────────────────

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

// ── Dispatcher ────────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const { allowed, retryAfterMs } = await checkRateLimit(`admin:${ip}`, 500, 15 * 60_000);
    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${retryAfterSec} segundos.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;
    const supabase = getSupabaseAdmin();

    // ── Orders ──────────────────────────────────────────────────────────────
    if (action === 'get_data')          return handleGetData(supabase);
    if (action === 'get_orders_only')   return handleGetOrdersOnly(supabase, data);
    if (action === 'get_more_orders')   return handleGetMoreOrders(supabase, data);
    if (action === 'get_order_items')   return handleGetOrderItems(supabase, data);
    if (action === 'get_order_change_history') return handleGetOrderChangeHistory(supabase, data);
    if (action === 'update_order')      return handleUpdateOrder(supabase, data);
    if (action === 'update_order_items') return handleUpdateOrderItems(supabase, data);
    if (action === 'delete_order')      return handleDeleteOrder(supabase, data);
    if (action === 'restore_order')     return handleRestoreOrder(supabase, data);
    if (action === 'get_inactive_orders') return handleGetInactiveOrders(supabase, data);
    if (action === 'create_manual_order') return handleCreateManualOrder(supabase, data);

    // ── Catalog & Settings ──────────────────────────────────────────────────
    if (action === 'save_all')          return handleSaveAll(supabase, data);
    if (action === 'save_setting')      return handleSaveSetting(supabase, data);
    if (action === 'add_product')       return handleAddProduct(supabase, data);
    if (action === 'add_drink')         return handleAddDrink(supabase, data);
    if (action === 'delete_product')    return handleDeleteProduct(supabase, data);
    if (action === 'delete_drink')      return handleDeleteDrink(supabase, data);
    if (action === 'duplicate_drink')   return handleDuplicateDrink(supabase, data);
    if (action === 'remove_logo')       return handleRemoveLogo(supabase);
    if (action === 'update_product_flags') return handleUpdateProductFlags(supabase, data);
    if (action === 'update_drink_flags')   return handleUpdateDrinkFlags(supabase, data);

    // ── Coupons ─────────────────────────────────────────────────────────────
    if (action === 'add_coupon')        return handleAddCoupon(supabase, data);
    if (action === 'update_coupon')     return handleUpdateCoupon(supabase, data);
    if (action === 'delete_coupon')     return handleDeleteCoupon(supabase, data);
    if (action === 'get_coupon_analytics') return handleGetCouponAnalytics(supabase);

    // ── Customers ───────────────────────────────────────────────────────────
    if (action === 'get_customers')        return handleGetCustomers(supabase);
    if (action === 'get_customer_profile') return handleGetCustomerProfile(supabase, data);
    if (action === 'search_phone_suffix')  return handleSearchPhoneSuffix(supabase, data);

    // ── Inventory ───────────────────────────────────────────────────────────
    if (action === 'get_catalog_extra')    return handleGetCatalogExtra(supabase);
    if (action === 'save_ingredient')      return handleSaveIngredient(supabase, data);
    if (action === 'save_compound_recipe')    return handleSaveCompoundRecipe(supabase, data);
    if (action === 'get_compound_recipes')    return handleGetCompoundRecipes(supabase, data);
    if (action === 'save_compound_recipe_v2') return handleSaveCompoundRecipeV2(supabase, data);
    if (action === 'delete_compound_recipe')  return handleDeleteCompoundRecipe(supabase, data);
    if (action === 'apply_compound_recipe')   return handleApplyCompoundRecipe(supabase, data);
    if (action === 'stock_movement')          return handleStockMovement(supabase, data);
    if (action === 'get_stock_movements')     return handleGetStockMovements(supabase, data);
    if (action === 'delete_ingredient')       return handleDeleteIngredient(supabase, data);
    if (action === 'save_recipe')             return handleSaveRecipe(supabase, data);

    // ── Delivery ─────────────────────────────────────────────────────────────
    if (action === 'get_delivery_persons')   return handleGetDeliveryPersons(supabase);
    if (action === 'save_delivery_person')   return handleSaveDeliveryPerson(supabase, data);
    if (action === 'delete_delivery_person') return handleDeleteDeliveryPerson(supabase, data);
    if (action === 'get_delivery_history')   return handleGetDeliveryHistory(supabase, data);
    if (action === 'get_delivery_zones')     return handleGetDeliveryZones(supabase);
    if (action === 'save_delivery_zone')     return handleSaveDeliveryZone(supabase, data);
    if (action === 'delete_delivery_zone')   return handleDeleteDeliveryZone(supabase, data);
    if (action === 'assign_delivery')        return handleAssignDelivery(supabase, data);
    if (action === 'get_driver_locations')   return handleGetDriverLocations(supabase);
    if (action === 'get_delivery_metrics')   return handleGetDeliveryMetrics(supabase, data);
    if (action === 'get_delivery_queue')     return handleGetDeliveryQueue(supabase, data);
    if (action === 'set_delivery_priority')  return handleSetDeliveryPriority(supabase, data);

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (e) {
    logger.error('Admin error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
