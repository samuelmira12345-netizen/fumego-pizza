import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { parseCatalogVisibilityOverrides, applyCatalogVisibilityOverrides } from '../../../lib/catalog-visibility';

/**
 * GET /api/catalog
 *
 * Retorna produtos visíveis, bebidas ativas e settings.
 * - Produtos com is_hidden=true são filtrados no banco (nunca chegam ao browser)
 * - Produtos com is_active=false chegam ao frontend para exibir "ESGOTADO"
 * - Bebidas com is_hidden=true ou is_active=false são filtradas no banco
 * - Cache-Control: no-store → mudanças no admin refletem imediatamente
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [products, drinks, settings, productStock, drinkStock] = await Promise.all([
      // Filtra produtos ocultos diretamente no banco
      supabase.from('products').select('*')
        .or('is_hidden.is.null,is_hidden.eq.false')
        .order('sort_order'),
      // Filtra bebidas ocultas e inativas diretamente no banco
      supabase.from('drinks').select('*')
        .or('is_hidden.is.null,is_hidden.eq.false')
        .eq('is_active', true)
        .order('name'),
      supabase.from('settings').select('*'),
      supabase.from('product_stock').select('product_id, quantity, enabled').eq('enabled', true),
      supabase.from('drink_stock').select('drink_id, quantity, enabled').eq('enabled', true),
    ]);

    const settingsData = settings.data || [];
    const overrides = parseCatalogVisibilityOverrides(settingsData);
    const merged = applyCatalogVisibilityOverrides(products.data || [], drinks.data || [], overrides);

    const response = NextResponse.json({
      products:     merged.products,
      drinks:       merged.drinks,
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
