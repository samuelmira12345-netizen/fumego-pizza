import { NextResponse } from 'next/server';

export async function handleSaveAll(supabase, data) {
  const { products, drinks, settings } = data;
  if (products) for (const p of products) await supabase.from('products').upsert(p);
  if (drinks)   for (const d of drinks)   await supabase.from('drinks').upsert(d);
  if (settings) {
    for (const s of settings) {
      await supabase.from('settings').upsert(s, { onConflict: 'key' });
    }
    // Sincroniza stock_limits → product_stock e drink_stock_limits → drink_stock
    const stockSetting = settings.find(s => s.key === 'stock_limits');
    if (stockSetting?.value) {
      try {
        const stockMap = JSON.parse(stockSetting.value);
        const rows = Object.entries(stockMap).map(([product_id, entry]) => ({
          product_id,
          quantity: entry.qty ?? 0,
          enabled:  entry.enabled ?? false,
          updated_at: new Date().toISOString(),
        }));
        if (rows.length > 0) {
          await supabase.from('product_stock').upsert(rows, { onConflict: 'product_id' });
        }
      } catch {}
    }

    const drinkStockSetting = settings.find(s => s.key === 'drink_stock_limits');
    if (drinkStockSetting?.value) {
      try {
        const drinkMap = JSON.parse(drinkStockSetting.value);
        const rows = Object.entries(drinkMap).map(([drink_id, entry]) => ({
          drink_id: Number(drink_id),
          quantity: entry.qty ?? 0,
          enabled:  entry.enabled ?? false,
          updated_at: new Date().toISOString(),
        }));
        if (rows.length > 0) {
          await supabase.from('drink_stock').upsert(rows, { onConflict: 'drink_id' });
        }
      } catch {}
    }
  }
  return NextResponse.json({ success: true });
}

export async function handleSaveSetting(supabase, data) {
  const { key, value } = data;
  await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
  return NextResponse.json({ success: true });
}

export async function handleAddProduct(supabase, data) {
  const { data: inserted, error } = await supabase.from('products').insert(data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, product: inserted });
}

export async function handleAddDrink(supabase, data) {
  const { error, data: inserted } = await supabase.from('drinks').insert(data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, drink: inserted });
}

export async function handleDeleteDrink(supabase, data) {
  const { error } = await supabase.from('drinks').delete().eq('id', data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function handleDuplicateDrink(supabase, data) {
  const { id } = data;
  const { data: src } = await supabase.from('drinks').select('*').eq('id', id).single();
  if (!src) return NextResponse.json({ error: 'Bebida não encontrada' }, { status: 404 });
  const { id: _id, created_at, ...rest } = src;
  const { data: inserted, error } = await supabase.from('drinks')
    .insert({ ...rest, name: src.name + ' (cópia)', is_active: false }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, drink: inserted });
}

export async function handleRemoveLogo(supabase) {
  await supabase.from('settings').upsert({ key: 'logo_url', value: '' }, { onConflict: 'key' });
  return NextResponse.json({ success: true });
}
