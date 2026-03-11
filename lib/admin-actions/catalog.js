import { NextResponse } from 'next/server';

function slugifyProductName(value) {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return base || `produto-${Date.now()}`;
}

async function getAvailableProductSlug(supabase, preferredSlug) {
  const { data: rows, error } = await supabase
    .from('products')
    .select('slug')
    .ilike('slug', `${preferredSlug}%`);

  if (error || !rows?.length) return preferredSlug;

  const used = new Set(rows.map((r) => r.slug).filter(Boolean));
  if (!used.has(preferredSlug)) return preferredSlug;

  let i = 2;
  while (used.has(`${preferredSlug}-${i}`)) i += 1;
  return `${preferredSlug}-${i}`;
}

export async function handleSaveAll(supabase, data) {
  const { products, drinks, settings } = data;
  if (products) {
    for (const p of products) {
      const { error } = await supabase.from('products').upsert(p);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }
  if (drinks) {
    for (const d of drinks) {
      const { error } = await supabase.from('drinks').upsert(d);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }
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
          drink_id,
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
  const baseSlug = slugifyProductName(data?.slug || data?.name);
  const slug = await getAvailableProductSlug(supabase, baseSlug);

  const { data: inserted, error } = await supabase
    .from('products')
    .insert({ ...data, slug })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, product: inserted });
}

export async function handleAddDrink(supabase, data) {
  const { error, data: inserted } = await supabase.from('drinks').insert(data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, drink: inserted });
}

export async function handleDeleteProduct(supabase, data) {
  const { id } = data || {};
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  await supabase.from('recipe_items').delete().eq('product_id', id);
  await supabase.from('product_stock').delete().eq('product_id', id);

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: settingsRows } = await supabase
    .from('settings')
    .select('key, value')
    .eq('key', 'catalog_visibility_overrides');

  let visibility = { products: {}, drinks: {} };
  try {
    if (settingsRows?.[0]?.value) visibility = JSON.parse(settingsRows[0].value);
  } catch {}

  if (visibility?.products && visibility.products[String(id)] !== undefined) {
    delete visibility.products[String(id)];
    await supabase
      .from('settings')
      .upsert({ key: 'catalog_visibility_overrides', value: JSON.stringify(visibility) }, { onConflict: 'key' });
  }

  return NextResponse.json({ success: true });
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

export async function handleUpdateProductFlags(supabase, data) {
  const { id, is_active, is_hidden } = data || {};
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const updates = {};
  if (is_active !== undefined) updates.is_active = !!is_active;
  if (is_hidden !== undefined) updates.is_hidden = !!is_hidden;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  const { data: current, error: currentErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (currentErr || !current) {
    return NextResponse.json({ error: currentErr?.message || 'Produto não encontrado' }, { status: 404 });
  }

  const { data: settingsRows } = await supabase
    .from('settings')
    .select('key, value')
    .eq('key', 'catalog_visibility_overrides');

  let visibility = { products: {}, drinks: {} };
  try {
    if (settingsRows?.[0]?.value) visibility = JSON.parse(settingsRows[0].value);
  } catch {}

  visibility.products = visibility.products || {};
  visibility.drinks = visibility.drinks || {};
  const prev = visibility.products[String(id)] || {};
  visibility.products[String(id)] = { ...prev, ...updates };

  await supabase
    .from('settings')
    .upsert({ key: 'catalog_visibility_overrides', value: JSON.stringify(visibility) }, { onConflict: 'key' });

  let updated = { ...current, ...updates };

  const { data: dbUpdated, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (!error && dbUpdated) {
    updated = dbUpdated;
  }

  return NextResponse.json({ success: true, product: updated, persistedInSettings: true });
}

export async function handleUpdateDrinkFlags(supabase, data) {
  const { id, is_active, is_hidden } = data || {};
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const updates = {};
  if (is_active !== undefined) updates.is_active = !!is_active;
  if (is_hidden !== undefined) updates.is_hidden = !!is_hidden;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  const { data: current, error: currentErr } = await supabase
    .from('drinks')
    .select('*')
    .eq('id', id)
    .single();

  if (currentErr || !current) {
    return NextResponse.json({ error: currentErr?.message || 'Bebida não encontrada' }, { status: 404 });
  }

  const { data: settingsRows } = await supabase
    .from('settings')
    .select('key, value')
    .eq('key', 'catalog_visibility_overrides');

  let visibility = { products: {}, drinks: {} };
  try {
    if (settingsRows?.[0]?.value) visibility = JSON.parse(settingsRows[0].value);
  } catch {}

  visibility.products = visibility.products || {};
  visibility.drinks = visibility.drinks || {};
  const prev = visibility.drinks[String(id)] || {};
  visibility.drinks[String(id)] = { ...prev, ...updates };

  await supabase
    .from('settings')
    .upsert({ key: 'catalog_visibility_overrides', value: JSON.stringify(visibility) }, { onConflict: 'key' });

  let updated = { ...current, ...updates };

  const { data: dbUpdated, error } = await supabase
    .from('drinks')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (!error && dbUpdated) {
    updated = dbUpdated;
  }

  return NextResponse.json({ success: true, drink: updated, persistedInSettings: true });
}
