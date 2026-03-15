import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';
import { logger } from '../../../lib/logger';

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
  handleGetDeliveryQueue, handleSetDeliveryPriority, handleGetDeliveryAnalysis,
} from '../../../lib/admin-actions/delivery';
import {
  handleListSubAdmins, handleCreateSubAdmin, handleUpdateSubAdmin,
  handleDeactivateSubAdmin, handleReactivateSubAdmin,
} from '../../../lib/admin-actions/sub-admins';

export type AdminTokenPayload = {
  role: 'admin' | 'master' | 'sub';
  username?: string;
  allowedTabs: string[] | null;
};

/** Extrai e verifica o JWT. Retorna o payload ou null se inválido. */
function getTokenPayload(request: NextRequest): AdminTokenPayload | null {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload & AdminTokenPayload;
    if (!['admin', 'master', 'sub'].includes(decoded.role)) return null;
    return {
      role: decoded.role,
      username: decoded.username,
      allowedTabs: decoded.allowedTabs ?? null,
    };
  } catch {
    return null;
  }
}

/** Verifica se o token tem role master (ou legado 'admin'). */
function isMaster(payload: AdminTokenPayload): boolean {
  return payload.role === 'master' || payload.role === 'admin';
}

// ── Tipos do dispatch map ─────────────────────────────────────────────────────

type Supabase = ReturnType<typeof getSupabaseAdmin>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: Supabase; data: any };
type Handler = (ctx: Ctx) => Promise<NextResponse>;

// ── Alertas operacionais (inline, sem módulo próprio) ─────────────────────────

async function handleGetCwAlerts({ supabase }: Ctx): Promise<NextResponse> {
  const [{ data: cwFailed }, { data: stockConflicts }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, cw_push_last_error, created_at')
      .eq('cw_push_status', 'failed')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('orders')
      .select('id, order_number, created_at')
      .eq('stock_conflict', true)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  return NextResponse.json({
    cwFailed:       cwFailed       || [],
    stockConflicts: stockConflicts || [],
  });
}

// ── Dispatch maps ─────────────────────────────────────────────────────────────

/** Ações restritas a master/admin. */
const MASTER_ONLY: Record<string, Handler> = {
  list_sub_admins:      ({ supabase })       => handleListSubAdmins(supabase),
  create_sub_admin:     ({ supabase, data }) => handleCreateSubAdmin(supabase, data),
  update_sub_admin:     ({ supabase, data }) => handleUpdateSubAdmin(supabase, data),
  deactivate_sub_admin: ({ supabase, data }) => handleDeactivateSubAdmin(supabase, data),
  reactivate_sub_admin: ({ supabase, data }) => handleReactivateSubAdmin(supabase, data),
};

/** Ações disponíveis para qualquer role válida. */
const HANDLERS: Record<string, Handler> = {
  // Alertas
  get_cw_alerts: handleGetCwAlerts,

  // Orders
  get_data:               ({ supabase })       => handleGetData(supabase),
  get_orders_only:        ({ supabase, data }) => handleGetOrdersOnly(supabase, data),
  get_more_orders:        ({ supabase, data }) => handleGetMoreOrders(supabase, data),
  get_order_items:        ({ supabase, data }) => handleGetOrderItems(supabase, data),
  get_order_change_history: ({ supabase, data }) => handleGetOrderChangeHistory(supabase, data),
  update_order:           ({ supabase, data }) => handleUpdateOrder(supabase, data),
  update_order_items:     ({ supabase, data }) => handleUpdateOrderItems(supabase, data),
  delete_order:           ({ supabase, data }) => handleDeleteOrder(supabase, data),
  restore_order:          ({ supabase, data }) => handleRestoreOrder(supabase, data),
  get_inactive_orders:    ({ supabase, data }) => handleGetInactiveOrders(supabase, data),
  create_manual_order:    ({ supabase, data }) => handleCreateManualOrder(supabase, data),

  // Catalog & Settings
  save_all:               ({ supabase, data }) => handleSaveAll(supabase, data),
  save_setting:           ({ supabase, data }) => handleSaveSetting(supabase, data),
  add_product:            ({ supabase, data }) => handleAddProduct(supabase, data),
  add_drink:              ({ supabase, data }) => handleAddDrink(supabase, data),
  delete_product:         ({ supabase, data }) => handleDeleteProduct(supabase, data),
  delete_drink:           ({ supabase, data }) => handleDeleteDrink(supabase, data),
  duplicate_drink:        ({ supabase, data }) => handleDuplicateDrink(supabase, data),
  remove_logo:            ({ supabase })       => handleRemoveLogo(supabase),
  update_product_flags:   ({ supabase, data }) => handleUpdateProductFlags(supabase, data),
  update_drink_flags:     ({ supabase, data }) => handleUpdateDrinkFlags(supabase, data),

  // Coupons
  add_coupon:             ({ supabase, data }) => handleAddCoupon(supabase, data),
  update_coupon:          ({ supabase, data }) => handleUpdateCoupon(supabase, data),
  delete_coupon:          ({ supabase, data }) => handleDeleteCoupon(supabase, data),
  get_coupon_analytics:   ({ supabase })       => handleGetCouponAnalytics(supabase),

  // Customers
  get_customers:          ({ supabase })       => handleGetCustomers(supabase),
  get_customer_profile:   ({ supabase, data }) => handleGetCustomerProfile(supabase, data),
  search_phone_suffix:    ({ supabase, data }) => handleSearchPhoneSuffix(supabase, data),

  // Inventory
  get_catalog_extra:      ({ supabase })       => handleGetCatalogExtra(supabase),
  save_ingredient:        ({ supabase, data }) => handleSaveIngredient(supabase, data),
  save_compound_recipe:   ({ supabase, data }) => handleSaveCompoundRecipe(supabase, data),
  get_compound_recipes:   ({ supabase, data }) => handleGetCompoundRecipes(supabase, data),
  save_compound_recipe_v2:({ supabase, data }) => handleSaveCompoundRecipeV2(supabase, data),
  delete_compound_recipe: ({ supabase, data }) => handleDeleteCompoundRecipe(supabase, data),
  apply_compound_recipe:  ({ supabase, data }) => handleApplyCompoundRecipe(supabase, data),
  stock_movement:         ({ supabase, data }) => handleStockMovement(supabase, data),
  get_stock_movements:    ({ supabase, data }) => handleGetStockMovements(supabase, data),
  delete_ingredient:      ({ supabase, data }) => handleDeleteIngredient(supabase, data),
  save_recipe:            ({ supabase, data }) => handleSaveRecipe(supabase, data),

  // Delivery
  get_delivery_persons:   ({ supabase })       => handleGetDeliveryPersons(supabase),
  save_delivery_person:   ({ supabase, data }) => handleSaveDeliveryPerson(supabase, data),
  delete_delivery_person: ({ supabase, data }) => handleDeleteDeliveryPerson(supabase, data),
  get_delivery_history:   ({ supabase, data }) => handleGetDeliveryHistory(supabase, data),
  get_delivery_zones:     ({ supabase })       => handleGetDeliveryZones(supabase),
  save_delivery_zone:     ({ supabase, data }) => handleSaveDeliveryZone(supabase, data),
  delete_delivery_zone:   ({ supabase, data }) => handleDeleteDeliveryZone(supabase, data),
  assign_delivery:        ({ supabase, data }) => handleAssignDelivery(supabase, data),
  get_driver_locations:   ({ supabase })       => handleGetDriverLocations(supabase),
  get_delivery_metrics:   ({ supabase, data }) => handleGetDeliveryMetrics(supabase, data),
  get_delivery_queue:     ({ supabase, data }) => handleGetDeliveryQueue(supabase, data),
  set_delivery_priority:  ({ supabase, data }) => handleSetDeliveryPriority(supabase, data),
  get_delivery_analysis:  ({ supabase, data }) => handleGetDeliveryAnalysis(supabase, data),
};

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    const payload = getTokenPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;
    const supabase = getSupabaseAdmin();
    const ctx: Ctx = { supabase, data };

    if (MASTER_ONLY[action]) {
      if (!isMaster(payload)) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
      return MASTER_ONLY[action](ctx);
    }

    if (HANDLERS[action]) {
      return HANDLERS[action](ctx);
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (e) {
    logger.error('Admin error', e as Error);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
