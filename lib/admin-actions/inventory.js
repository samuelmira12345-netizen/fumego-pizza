import { NextResponse } from 'next/server';

export async function handleGetCatalogExtra(supabase) {
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

export async function handleSaveIngredient(supabase, data) {
  const {
    id, name, unit, cost_per_unit,
    correction_factor, min_stock, max_stock, current_stock,
    purchase_origin, ingredient_type, weight_volume,
  } = data;

  const parsedCorrectionFactor = correction_factor !== undefined ? parseFloat(correction_factor) : undefined;

  const extraFields = {
    correction_factor: correction_factor !== undefined ? (isNaN(parsedCorrectionFactor) ? 0 : parsedCorrectionFactor) : undefined,
    min_stock:         min_stock         !== undefined ? parseFloat(min_stock)         || 0   : undefined,
    max_stock:         max_stock         !== undefined ? parseFloat(max_stock)         || 0   : undefined,
    current_stock:     current_stock     !== undefined ? parseFloat(current_stock)     || 0   : undefined,
    purchase_origin:   purchase_origin   !== undefined ? purchase_origin               : undefined,
    ingredient_type:   ingredient_type   !== undefined ? ingredient_type               : undefined,
    weight_volume:     weight_volume     !== undefined ? parseFloat(weight_volume)     || 1   : undefined,
  };
  Object.keys(extraFields).forEach(k => extraFields[k] === undefined && delete extraFields[k]);

  if (id) {
    const { data: existing } = await supabase.from('ingredients').select('cost_per_unit').eq('id', id).single();
    const oldPrice = parseFloat(existing?.cost_per_unit);
    const newPrice = parseFloat(cost_per_unit);
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

export async function handleSaveCompoundRecipe(supabase, data) {
  const { compound_id, items, computed_cost } = data;
  if (!compound_id) return NextResponse.json({ error: 'compound_id obrigatório' }, { status: 400 });

  await supabase.from('compound_ingredient_items').delete().eq('compound_id', compound_id);
  if (items && items.length > 0) {
    const rows = items.map(i => ({
      compound_id, ingredient_id: i.ingredient_id, quantity: parseFloat(i.quantity) || 0,
    }));
    const { error } = await supabase.from('compound_ingredient_items').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (computed_cost !== undefined && computed_cost > 0) {
    const { data: existing } = await supabase.from('ingredients').select('cost_per_unit').eq('id', compound_id).single();
    const oldPrice = parseFloat(existing?.cost_per_unit);
    const newPrice = parseFloat(computed_cost);
    if (!isNaN(oldPrice) && oldPrice !== newPrice) {
      await supabase.from('ingredient_price_history').insert({ ingredient_id: compound_id, old_price: oldPrice, new_price: newPrice });
    }
    await supabase.from('ingredients').update({ cost_per_unit: newPrice }).eq('id', compound_id);
  }
  return NextResponse.json({ success: true });
}

export async function handleGetCompoundRecipes(supabase, data) {
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

export async function handleSaveCompoundRecipeV2(supabase, data) {
  const { id, compound_id, name, yield_quantity, yield_unit, items } = data;
  if (!compound_id || !name) {
    return NextResponse.json({ error: 'compound_id e name são obrigatórios' }, { status: 400 });
  }
  const recipeFields = { name, yield_quantity: parseFloat(yield_quantity) || 1 };
  if (yield_unit) recipeFields.yield_unit = yield_unit;
  let recipe_id = id;
  if (id) {
    await supabase.from('compound_recipes')
      .update(recipeFields)
      .eq('id', id);
  } else {
    const { data: inserted, error } = await supabase
      .from('compound_recipes')
      .insert({ compound_id, ...recipeFields })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    recipe_id = inserted.id;
  }
  await supabase.from('compound_recipe_items').delete().eq('recipe_id', recipe_id);
  if (items && items.length > 0) {
    const rows = items.map(i => ({
      recipe_id, ingredient_id: i.ingredient_id, quantity: parseFloat(i.quantity) || 0,
    }));
    const { error } = await supabase.from('compound_recipe_items').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, recipe_id });
}

export async function handleDeleteCompoundRecipe(supabase, data) {
  const { id } = data || {};
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  const { error } = await supabase.from('compound_recipes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function handleApplyCompoundRecipe(supabase, data) {
  const { recipe_id } = data || {};
  if (!recipe_id) return NextResponse.json({ error: 'recipe_id obrigatório' }, { status: 400 });
  const batchCount = 1;

  const { data: recipe, error: recipeErr } = await supabase
    .from('compound_recipes')
    .select('*, compound_recipe_items(*, ingredients(name, unit, current_stock))')
    .eq('id', recipe_id)
    .single();
  if (recipeErr || !recipe) return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 });

  // Deduct raw ingredients
  for (const item of (recipe.compound_recipe_items || [])) {
    const deduct = (parseFloat(item.quantity) || 0) * batchCount;
    const curStock = parseFloat(item.ingredients?.current_stock) || 0;
    const newStock = Math.max(0, curStock - deduct);
    await supabase.from('ingredients').update({ current_stock: newStock }).eq('id', item.ingredient_id);
    await supabase.from('stock_movements').insert({
      ingredient_id: item.ingredient_id,
      movement_type: 'out',
      quantity: deduct,
      reason: `Produção: ${recipe.name}`,
      notes: '1 lote',
    });
  }

  // Credit compound ingredient
  const { data: compound } = await supabase
    .from('ingredients').select('current_stock').eq('id', recipe.compound_id).single();
  const yieldTotal = (parseFloat(recipe.yield_quantity) || 1) * batchCount;
  const newCompoundStock = (parseFloat(compound?.current_stock) || 0) + yieldTotal;
  await supabase.from('ingredients').update({ current_stock: newCompoundStock }).eq('id', recipe.compound_id);
  await supabase.from('stock_movements').insert({
    ingredient_id: recipe.compound_id,
    movement_type: 'in',
    quantity: yieldTotal,
    reason: `Produção: ${recipe.name}`,
    notes: '1 lote aplicado',
  });

  return NextResponse.json({ success: true, compound_stock: newCompoundStock });
}

export async function handleStockMovement(supabase, data) {
  const { ingredient_id, movement_type, quantity, reason, notes, admin_password } = data;
  if (!ingredient_id || !movement_type || quantity === undefined) {
    return NextResponse.json({ error: 'ingredient_id, movement_type e quantity são obrigatórios' }, { status: 400 });
  }

  // Verify admin password when provided (required for compound ingredient adjustments)
  if (admin_password) {
    const bcrypt = await import('bcryptjs');
    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (hash) {
      const valid = await bcrypt.compare(admin_password, hash);
      if (!valid) return NextResponse.json({ error: 'Senha do admin incorreta' }, { status: 403 });
    }
  }

  const qty = parseFloat(quantity) || 0;

  const { error: mvErr } = await supabase.from('stock_movements').insert({
    ingredient_id, movement_type, quantity: qty, reason: reason || '', notes: notes || '',
  });
  if (mvErr) return NextResponse.json({ error: mvErr.message }, { status: 400 });

  const { data: ing } = await supabase.from('ingredients').select('current_stock').eq('id', ingredient_id).single();
  const currentStock = parseFloat(ing?.current_stock) || 0;
  let newStock;
  if (movement_type === 'in')       newStock = currentStock + qty;
  else if (movement_type === 'out') newStock = currentStock - qty;
  else                              newStock = qty; // adjustment

  const { error: updErr } = await supabase.from('ingredients').update({ current_stock: newStock }).eq('id', ingredient_id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
  return NextResponse.json({ success: true, new_stock: newStock });
}

export async function handleGetStockMovements(supabase, data) {
  const { limit: lim = 200, offset: off = 0, ingredient_id } = data || {};
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

export async function handleDeleteIngredient(supabase, data) {
  const { error } = await supabase.from('ingredients').delete().eq('id', data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function handleSaveRecipe(supabase, data) {
  const { product_id, items } = data;
  await supabase.from('recipe_items').delete().eq('product_id', product_id);
  if (items && items.length > 0) {
    const rows = items.map(i => ({
      product_id, ingredient_id: i.ingredient_id,
      quantity: parseFloat(i.quantity) || 0, recipe_unit: i.recipe_unit || null,
    }));
    const { error } = await supabase.from('recipe_items').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
