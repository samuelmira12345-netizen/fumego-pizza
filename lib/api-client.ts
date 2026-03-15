/**
 * Cliente centralizado para o dispatcher POST /api/admin.
 *
 * Uso:
 *   const api = createAdminClient(adminToken);
 *   const data = await api.orders.getOrdersOnly();
 *   const data = await api.delivery.assignDelivery(orderId, personId);
 *
 * Todos os métodos retornam o JSON parseado. Em caso de erro HTTP ou
 * campo `error` na resposta, um Error é lançado com a mensagem do servidor.
 */

async function adminPost(
  action: string,
  data: Record<string, unknown>,
  token: string,
): Promise<any> {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, data }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Erro HTTP ${res.status}`);
  return json;
}

export function createAdminClient(token: string) {
  const post = (action: string, data: Record<string, unknown> = {}) =>
    adminPost(action, data, token);

  return {
    // ── Orders ──────────────────────────────────────────────────────────────
    orders: {
      /** Carrega dados iniciais (produtos, pedidos, configurações). */
      getData: () =>
        post('get_data'),

      /** Pedidos do dia, com filtro opcional de data. */
      getOrdersOnly: (params: { since?: string } = {}) =>
        post('get_orders_only', params),

      /** Paginação de pedidos anteriores. */
      getMoreOrders: (cursor: string, pageSize = 50) =>
        post('get_more_orders', { cursor, pageSize }),

      /** Itens de um pedido específico. */
      getOrderItems: (orderId: string) =>
        post('get_order_items', { order_id: orderId }),

      /** Histórico de alterações de um pedido. */
      getChangeHistory: (orderId: string) =>
        post('get_order_change_history', { order_id: orderId }),

      /** Atualiza campos de um pedido (status, payment_status, etc.). */
      updateOrder: (id: string, updates: Record<string, unknown>) =>
        post('update_order', { id, ...updates }),

      /** Substitui os itens de um pedido. */
      updateItems: (orderId: string, items: unknown[]) =>
        post('update_order_items', { order_id: orderId, items }),

      /** Cancela/exclui um pedido. */
      deleteOrder: (id: string) =>
        post('delete_order', { id }),

      /** Restaura um pedido cancelado. */
      restoreOrder: (id: string) =>
        post('restore_order', { id }),

      /** Lista pedidos arquivados/inativos. */
      getInactive: () =>
        post('get_inactive_orders'),

      /** Cria pedido manual no painel. */
      createManual: (data: Record<string, unknown>) =>
        post('create_manual_order', data),
    },

    // ── Catalog & Settings ──────────────────────────────────────────────────
    catalog: {
      /** Salva todo o catálogo de uma vez. */
      saveAll: (products: unknown[], drinks: unknown[], settings: unknown) =>
        post('save_all', { products, drinks, settings }),

      /** Atualiza uma configuração individual. */
      saveSetting: (key: string, value: unknown) =>
        post('save_setting', { key, value }),

      addProduct: (data: Record<string, unknown>) =>
        post('add_product', data),

      addDrink: (data: Record<string, unknown>) =>
        post('add_drink', data),

      deleteProduct: (id: string) =>
        post('delete_product', { id }),

      deleteDrink: (id: string) =>
        post('delete_drink', { id }),

      duplicateDrink: (id: string) =>
        post('duplicate_drink', { id }),

      removeLogo: () =>
        post('remove_logo'),

      updateProductFlags: (id: string, flags: Record<string, boolean>) =>
        post('update_product_flags', { id, ...flags }),

      updateDrinkFlags: (id: string, flags: Record<string, boolean>) =>
        post('update_drink_flags', { id, ...flags }),
    },

    // ── Inventory ───────────────────────────────────────────────────────────
    inventory: {
      /** Retorna estoque, ingredientes e receitas além do catálogo básico. */
      getCatalogExtra: () =>
        post('get_catalog_extra'),

      saveIngredient: (data: Record<string, unknown>) =>
        post('save_ingredient', data),

      deleteIngredient: (id: string) =>
        post('delete_ingredient', { id }),

      saveRecipe: (data: Record<string, unknown>) =>
        post('save_recipe', data),

      saveCompoundRecipe: (data: Record<string, unknown>) =>
        post('save_compound_recipe', data),

      saveCompoundRecipeV2: (data: Record<string, unknown>) =>
        post('save_compound_recipe_v2', data),

      getCompoundRecipes: (params: Record<string, unknown> = {}) =>
        post('get_compound_recipes', params),

      deleteCompoundRecipe: (id: string) =>
        post('delete_compound_recipe', { id }),

      applyCompoundRecipe: (id: string) =>
        post('apply_compound_recipe', { id }),

      stockMovement: (data: Record<string, unknown>) =>
        post('stock_movement', data),

      getStockMovements: (params: Record<string, unknown> = {}) =>
        post('get_stock_movements', params),
    },

    // ── Delivery ─────────────────────────────────────────────────────────────
    delivery: {
      getPersons: () =>
        post('get_delivery_persons'),

      savePerson: (data: Record<string, unknown>) =>
        post('save_delivery_person', data),

      deletePerson: (id: string) =>
        post('delete_delivery_person', { id }),

      getHistory: (params: Record<string, unknown> = {}) =>
        post('get_delivery_history', params),

      getZones: () =>
        post('get_delivery_zones'),

      saveZone: (data: Record<string, unknown>) =>
        post('save_delivery_zone', data),

      deleteZone: (id: string) =>
        post('delete_delivery_zone', { id }),

      /** Atribui um entregador a um pedido. */
      assignDelivery: (orderId: string, deliveryPersonId: string) =>
        post('assign_delivery', { order_id: orderId, delivery_person_id: deliveryPersonId }),

      getQueue: (params: Record<string, unknown> = {}) =>
        post('get_delivery_queue', params),

      setPriority: (data: Record<string, unknown>) =>
        post('set_delivery_priority', data),

      getDriverLocations: () =>
        post('get_driver_locations'),

      getMetrics: (params: Record<string, unknown> = {}) =>
        post('get_delivery_metrics', params),

      getAnalysis: (params: Record<string, unknown> = {}) =>
        post('get_delivery_analysis', params),
    },

    // ── Coupons ──────────────────────────────────────────────────────────────
    coupons: {
      add: (data: Record<string, unknown>) =>
        post('add_coupon', data),

      update: (data: Record<string, unknown>) =>
        post('update_coupon', data),

      delete: (id: string) =>
        post('delete_coupon', { id }),

      getAnalytics: () =>
        post('get_coupon_analytics'),
    },

    // ── Customers ────────────────────────────────────────────────────────────
    customers: {
      getAll: (params: Record<string, unknown> = {}) =>
        post('get_customers', params),

      getProfile: (params: Record<string, unknown>) =>
        post('get_customer_profile', params),

      searchPhoneSuffix: (suffix: string) =>
        post('search_phone_suffix', { suffix }),
    },

    // ── Sub-Admin Management (master only) ───────────────────────────────────
    subAdmins: {
      list: () =>
        post('list_sub_admins'),

      create: (username: string, password: string, allowedTabs: string[]) =>
        post('create_sub_admin', { username, password, allowedTabs }),

      update: (id: string, params: { allowedTabs?: string[]; password?: string }) =>
        post('update_sub_admin', { id, ...params }),

      deactivate: (id: string) =>
        post('deactivate_sub_admin', { id }),

      reactivate: (id: string) =>
        post('reactivate_sub_admin', { id }),
    },
  };
}

/** Tipo inferido do cliente — útil para props e contextos. */
export type AdminClient = ReturnType<typeof createAdminClient>;
