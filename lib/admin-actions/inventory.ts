import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleGetCatalogExtra(supabase: SupabaseClient): Promise<NextResponse> {
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

export async function handleSaveIngredient(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const {
    id, name, unit, cost_per_unit,
    correction_factor, min_stock, max_stock, current_stock,
    purchase_origin, ingredient_type, weight_volume, density,
  } = data || {};

  const extraFields: Record<string, unknown> = {};
  if (correction_factor !== undefined) extraFields.correction_factor = Number.isFinite(parseFloat(String(correction_factor))) ? parseFloat(String(correction_factor)) : 0;
  if (min_stock         !== undefined) extraFields.min_stock         = parseFloat(String(min_stock))     || 0;
  if (max_stock         !== undefined) extraFields.max_stock         = parseFloat(String(max_stock))     || 0;
  if (current_stock     !== undefined) extraFields.current_stock     = parseFloat(String(current_stock)) || 0;
  if (purchase_origin   !== undefined) extraFields.purchase_origin   = purchase_origin;
  if (ingredient_type   !== undefined) extraFields.ingredient_type   = ingredient_type;
  if (weight_volume     !== undefined) extraFields.weight_volume     = parseFloat(String(weight_volume)) || 1;
  // density (g/ml): only stored for liquid units (L, ml); null clears the value
  if (density !== undefined) extraFields.density = density === null ? null : (parseFloat(String(density)) || null);

  if (id) {
    const { data: existing } = await supabase.from('ingredients').select('cost_per_unit').eq('id', id).single();
    const oldPrice = parseFloat(String((existing as unknown as Record<string, unknown>)?.cost_per_unit));
    const newPrice = parseFloat(String(cost_per_unit));
    let priceHistoryEntry = null;
    if (!isNaN(oldPrice) && !isNaN(newPrice) && oldPrice !== newPrice) {
      const { data: histEntry } = await supabase.from('ingredient_price_history')
        .insert({ ingredient_id: id, old_price: oldPrice, new_price: newPrice }).select().single();
      priceHistoryEntry = histEntry;
    }
    await supabase.from('ingredients').update({ name, unit, cost_per_unit, ...extraFields }).eq('id', id);
    return NextResponse.json({ success: true, priceHistoryEntry });
  }

  const { data: inserted, error } = await supabase.from('ingredients')
    .insert({ name, unit, cost_per_unit, ...extraFields }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, ingredient: inserted });
}

export async function handleSaveCompoundRecipe(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { compound_id, items, computed_cost } = data || {};
  if (!compound_id) return NextResponse.json({ error: 'compound_id obrigatório' }, { status: 400 });

  await supabase.from('compound_ingredient_items').delete().eq('compound_id', compound_id);
  if (Array.isArray(items) && items.length > 0) {
    const rows = (items as Record<string, unknown>[]).map(i => ({
      compound_id,
      ingredient_id: i.ingredient_id,
      quantity: parseFloat(String(i.quantity)) || 0,
    }));
    const { error } = await supabase.from('compound_ingredient_items').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (computed_cost !== undefined && Number(computed_cost) > 0) {
    const { data: existing } = await supabase.from('ingredients').select('cost_per_unit').eq('id', compound_id).single();
    const oldPrice = parseFloat(String((existing as unknown as Record<string, unknown>)?.cost_per_unit));
    const newPrice = parseFloat(String(computed_cost));
    if (!isNaN(oldPrice) && oldPrice !== newPrice) {
      await supabase.from('ingredient_price_history').insert({ ingredient_id: compound_id, old_price: oldPrice, new_price: newPrice });
    }
    await supabase.from('ingredients').update({ cost_per_unit: newPrice }).eq('id', compound_id);
  }
  return NextResponse.json({ success: true });
}

export async function handleGetCompoundRecipes(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { compound_id } = data || {};
  if (!compound_id) return NextResponse.json({ error: 'compound_id obrigatório' }, { status: 400 });
  const { data: recipes, error } = await supabase
    .from('compound_recipes')
    .select('*, compound_recipe_items(*)')
    .eq('compound_id', compound_id)
    .order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ recipes: recipes || [] });
}

export async function handleSaveCompoundRecipeV2(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { id, compound_id, name, yield_quantity, yield_unit, items } = data || {};
  if (!compound_id || !name) {
    return NextResponse.json({ error: 'compound_id e name são obrigatórios' }, { status: 400 });
  }
  const recipeFields: Record<string, unknown> = {
    name,
    yield_quantity: parseFloat(String(yield_quantity)) || 1,
  };
  if (yield_unit) recipeFields.yield_unit = yield_unit;

  let recipe_id = id;
  if (id) {
    await supabase.from('compound_recipes').update(recipeFields).eq('id', id);
  } else {
    const { data: inserted, error } = await supabase
      .from('compound_recipes')
      .insert({ compound_id, ...recipeFields })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    recipe_id = (inserted as Record<string, unknown>).id;
  }

  await supabase.from('compound_recipe_items').delete().eq('recipe_id', recipe_id);
  if (Array.isArray(items) && items.length > 0) {
    const rows = (items as Record<string, unknown>[]).map(i => ({
      recipe_id,
      ingredient_id: i.ingredient_id,
      quantity: parseFloat(String(i.quantity)) || 0,
    }));
    const { error } = await supabase.from('compound_recipe_items').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, recipe_id });
}

export async function handleDeleteCompoundRecipe(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { id } = data || {};
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  const { error } = await supabase.from('compound_recipes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function handleApplyCompoundRecipe(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { recipe_id } = data || {};
  if (!recipe_id) return NextResponse.json({ error: 'recipe_id obrigatório' }, { status: 400 });
  const batchCount = 1;

  const { data: recipe, error: recipeErr } = await supabase
    .from('compound_recipes')
    .select('*, compound_recipe_items(*, ingredients(name, unit, current_stock))')
    .eq('id', recipe_id)
    .single();
  if (recipeErr || !recipe) return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 });

  const rec = recipe as Record<string, unknown>;

  // Deduct raw ingredients
  for (const item of ((rec.compound_recipe_items as Record<string, unknown>[]) || [])) {
    const deduct = (parseFloat(String(item.quantity)) || 0) * batchCount;
    const ing = item.ingredients as Record<string, unknown> | null;
    const curStock = parseFloat(String(ing?.current_stock)) || 0;
    const newStock = Math.max(0, curStock - deduct);
    await supabase.from('ingredients').update({ current_stock: newStock }).eq('id', item.ingredient_id);
    await supabase.from('stock_movements').insert({
      ingredient_id: item.ingredient_id,
      movement_type: 'out',
      quantity: deduct,
      reason: `Produção: ${rec.name}`,
      notes: '1 lote',
    });
  }

  // Credit compound ingredient (apply FC loss if configured)
  const { data: compound } = await supabase
    .from('ingredients').select('current_stock, correction_factor').eq('id', rec.compound_id).single();
  const comp = compound as Record<string, unknown> | null;
  const grossYield = (parseFloat(String(rec.yield_quantity)) || 1) * batchCount;
  const fc = parseFloat(String(comp?.correction_factor)) || 0;
  const netYield = fc > 0 ? +(grossYield * (1 - fc / 100)).toFixed(6) : grossYield;
  const newCompoundStock = (parseFloat(String(comp?.current_stock)) || 0) + netYield;
  await supabase.from('ingredients').update({ current_stock: newCompoundStock }).eq('id', rec.compound_id);
  await supabase.from('stock_movements').insert({
    ingredient_id: rec.compound_id,
    movement_type: 'in',
    quantity: netYield,
    reason: `Produção: ${rec.name}`,
    notes: fc > 0
      ? `1 lote aplicado — bruto: ${grossYield.toFixed(3)}, FC ${fc}%, líquido: ${netYield.toFixed(3)}`
      : '1 lote aplicado',
  });

  return NextResponse.json({ success: true, compound_stock: newCompoundStock });
}

export async function handleStockMovement(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { ingredient_id, movement_type, quantity, reason, notes, admin_password } = data || {};
  if (!ingredient_id || !movement_type || quantity === undefined) {
    return NextResponse.json({ error: 'ingredient_id, movement_type e quantity são obrigatórios' }, { status: 400 });
  }

  if (admin_password) {
    const bcrypt = await import('bcryptjs');
    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (hash) {
      const valid = await bcrypt.compare(String(admin_password), hash);
      if (!valid) return NextResponse.json({ error: 'Senha do admin incorreta' }, { status: 403 });
    }
  }

  const qty = parseFloat(String(quantity)) || 0;

  const { error: mvErr } = await supabase.from('stock_movements').insert({
    ingredient_id,
    movement_type,
    quantity: qty,
    reason: reason || '',
    notes:  notes  || '',
  });
  if (mvErr) return NextResponse.json({ error: mvErr.message }, { status: 400 });

  const { data: ing } = await supabase.from('ingredients').select('current_stock').eq('id', ingredient_id).single();
  const currentStock = parseFloat(String((ing as Record<string, unknown>)?.current_stock)) || 0;
  let newStock: number;
  if (movement_type === 'in')       newStock = currentStock + qty;
  else if (movement_type === 'out') newStock = currentStock - qty;
  else                              newStock = qty; // adjustment

  const { error: updErr } = await supabase.from('ingredients').update({ current_stock: newStock }).eq('id', ingredient_id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
  return NextResponse.json({ success: true, new_stock: newStock });
}

export async function handleGetStockMovements(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const lim = Number(data?.limit) || 200;
  const off = Number(data?.offset) || 0;
  const { ingredient_id } = data || {};

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

export async function handleDeleteIngredient(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { id } = data || {};
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function handleSaveRecipe(supabase: SupabaseClient, data?: Record<string, unknown>): Promise<NextResponse> {
  const { product_id, items } = data || {};
  await supabase.from('recipe_items').delete().eq('product_id', product_id);
  if (Array.isArray(items) && items.length > 0) {
    const rows = (items as Record<string, unknown>[]).map(i => ({
      product_id,
      ingredient_id: i.ingredient_id,
      quantity: parseFloat(String(i.quantity)) || 0,
      recipe_unit: i.recipe_unit || null,
    }));
    const { error } = await supabase.from('recipe_items').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
