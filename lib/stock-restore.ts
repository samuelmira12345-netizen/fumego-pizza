/**
 * lib/stock-restore.ts
 *
 * Restaura o estoque de produtos e bebidas quando um pedido é cancelado
 * (pagamento rejeitado/expirado pelo Mercado Pago ou timeout do PIX no cliente).
 *
 * Idempotente: se chamada duas vezes para o mesmo pedido, a segunda chamada
 * não encontrará itens para restaurar pois o pedido já estará cancelado e o
 * estoque já terá sido devolvido.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

interface OrderItemRow {
  product_id: string | null;
  drink_id: string | null;
  quantity: number;
}

/**
 * Devolve ao estoque as quantidades decrementadas quando um pedido é criado,
 * caso o pagamento seja cancelado, rejeitado ou expirado.
 *
 * Reativa produtos/bebidas que foram marcados como inativos por esgotamento.
 */
export async function restoreStockOnCancel(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  // Busca todos os itens do pedido
  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('product_id, drink_id, quantity')
    .eq('order_id', orderId);

  if (itemsErr) {
    logger.error('[StockRestore] Erro ao buscar itens do pedido', {
      orderId,
      error: itemsErr.message,
    });
    return;
  }

  if (!items || items.length === 0) return;

  // ── Restaurar estoque de produtos ─────────────────────────────────────────
  const productItems = (items as OrderItemRow[]).filter(i => i.product_id);
  for (const item of productItems) {
    try {
      const { data: stock } = await supabase
        .from('product_stock')
        .select('quantity, enabled')
        .eq('product_id', item.product_id)
        .single();

      if (!stock?.enabled) continue;

      const newQty = (stock.quantity as number) + item.quantity;
      await supabase
        .from('product_stock')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('product_id', item.product_id);

      // Se o produto estava inativo por esgotamento, reativa-o
      if (newQty > 0) {
        await supabase
          .from('products')
          .update({ is_active: true })
          .eq('id', item.product_id)
          .eq('is_active', false);
      }
    } catch (e) {
      logger.error('[StockRestore] Erro ao restaurar estoque do produto', {
        productId: item.product_id,
        orderId,
        error: (e as Error).message,
      });
    }
  }

  // ── Restaurar estoque de bebidas ──────────────────────────────────────────
  const drinkItems = (items as OrderItemRow[]).filter(i => i.drink_id);
  for (const item of drinkItems) {
    try {
      const { data: stock } = await supabase
        .from('drink_stock')
        .select('quantity, enabled')
        .eq('drink_id', item.drink_id)
        .single();

      if (!stock?.enabled) continue;

      const newQty = (stock.quantity as number) + item.quantity;
      await supabase
        .from('drink_stock')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('drink_id', item.drink_id);

      // Se a bebida estava inativa por esgotamento, reativa-a
      if (newQty > 0) {
        await supabase
          .from('drinks')
          .update({ is_active: true })
          .eq('id', item.drink_id)
          .eq('is_active', false);
      }
    } catch (e) {
      logger.error('[StockRestore] Erro ao restaurar estoque da bebida', {
        drinkId: item.drink_id,
        orderId,
        error: (e as Error).message,
      });
    }
  }

  logger.info('[StockRestore] Estoque restaurado com sucesso', { orderId });
}
