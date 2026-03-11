import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase';

/**
 * GET /api/catalog
 *
 * Retorna produtos, bebidas e settings em uma única chamada com cache HTTP.
 * - s-maxage=60: CDN da Vercel mantém por 60 s sem bater no banco
 * - stale-while-revalidate=300: serve cache stale por até 5 min enquanto revalida em background
 *
 * O catálogo raramente muda; com esse cache uma pizzaria com 10 k visitas/dia
 * passa de ~10.000 queries/dia para ~1.440 (1 por minuto).
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [products, drinks, settings, productStock, drinkStock] = await Promise.all([
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('drinks').select('*').order('name'),
      supabase.from('settings').select('*'),
      supabase.from('product_stock').select('product_id, quantity, enabled').eq('enabled', true),
      supabase.from('drink_stock').select('drink_id, quantity, enabled').eq('enabled', true),
    ]);

    const response = NextResponse.json({
      products:     products.data     || [],
      drinks:       drinks.data       || [],
      settings:     settings.data     || [],
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
