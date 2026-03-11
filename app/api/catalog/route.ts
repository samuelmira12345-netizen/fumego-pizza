import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { parseCatalogVisibilityOverrides, applyCatalogVisibilityOverrides } from '../../../lib/catalog-visibility';

/**
 * GET /api/catalog
 *
 * Retorna catálogo para cliente após aplicar overrides de visibilidade/atividade.
 * - Produtos ocultos são filtrados após merge com settings (fallback para bancos legados)
 * - Produtos inativos chegam ao frontend para exibir "ESGOTADO"
 * - Bebidas ocultas/inativas são filtradas após merge
 * - Cache-Control: no-store → mudanças no admin refletem imediatamente
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [products, drinks, settings, productStock, drinkStock] = await Promise.all([
      // Busca completo e aplica regras de visibilidade/atividade após merge com overrides
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('drinks').select('*').order('name'),
      supabase.from('settings').select('*'),
      supabase.from('product_stock').select('product_id, quantity, enabled').eq('enabled', true),
      supabase.from('drink_stock').select('drink_id, quantity, enabled').eq('enabled', true),
    ]);

    const settingsData = settings.data || [];
    const overrides = parseCatalogVisibilityOverrides(settingsData);
    const merged = applyCatalogVisibilityOverrides(products.data || [], drinks.data || [], overrides);

    const visibleProducts = (merged.products || []).filter((p) => !p.is_hidden);
    const visibleDrinks = (merged.drinks || []).filter((d) => !d.is_hidden && d.is_active);

    const response = NextResponse.json({
      products:     visibleProducts,
      drinks:       visibleDrinks,
      settings:     settingsData,
      productStock: productStock.data || [],
      drinkStock:   drinkStock.data   || [],
    });

    // Sem cache: mudanças de is_active/is_hidden no admin refletem imediatamente
    response.headers.set('Cache-Control', 'no-store');

    return response;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
