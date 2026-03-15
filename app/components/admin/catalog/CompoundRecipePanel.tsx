'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Check, Loader2, X, Trash2, Layers } from 'lucide-react';
import { costWithFC } from '@/lib/correction-factor';
import { C, fmtBRL } from './catalogUtils';

// ── Constants ─────────────────────────────────────────────────────────────────

const UNITS_COMPOUND = ['unid', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz', 'ft', 'Bag', 'UN', 'KG'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Calcula automaticamente o rendimento de uma receita somando as quantidades
 * dos insumos. Quando o insumo é líquido (L ou ml) e tem densidade cadastrada
 * (g/ml) e a unidade de saída é peso (kg ou g), converte volume → peso.
 */
function autoCalcYield(enrichedItems: any, unit: any) {
  const toGrams = { kg: 1000, g: 1 };
  const toMl    = { L: 1000, ml: 1 };
  const yieldIsWeight = unit === 'kg' || unit === 'g';
  let totalG = 0, totalMl = 0, totalCount = 0;
  enrichedItems.forEach((item: any) => {
    const q = parseFloat(item.quantity) || 0;
    if ((toGrams as any)[item.unit] !== undefined) {
      totalG += q * (toGrams as any)[item.unit];
    } else if ((toMl as any)[item.unit] !== undefined) {
      const mlAmt  = q * (toMl as any)[item.unit];
      const density = parseFloat(item.density) || 0; // g/ml
      if (yieldIsWeight && density > 0) {
        // Converte volume → peso: quantidade_ml × densidade_g_ml = gramas
        totalG += mlAmt * density;
      } else {
        totalMl += mlAmt;
      }
    } else {
      totalCount += q;
    }
  });
  if (unit === 'kg')  return totalG   > 0 ? +(totalG   / 1000).toFixed(3) : null;
  if (unit === 'g')   return totalG   > 0 ? +totalG.toFixed(0)            : null;
  if (unit === 'L')   return totalMl  > 0 ? +(totalMl  / 1000).toFixed(3) : null;
  if (unit === 'ml')  return totalMl  > 0 ? +totalMl.toFixed(0)           : null;
  return totalCount > 0 ? +totalCount.toFixed(3) : null;
}

// ── RecipeItemsEditor: edit ingredients of a single named recipe ──────────────
function RecipeItemsEditor({ recipe, compound, ingredients, adminToken, onSaved, onCancel, onIngredientCreated }: { recipe: any, compound: any, ingredients: any, adminToken: any, onSaved: any, onCancel: any, onIngredientCreated: any }) {
  const existing = recipe?.compound_recipe_items || [];
  const [name, setName]         = useState(recipe?.name || '');
  const [yieldUnit, setYieldUnit] = useState(recipe?.yield_unit || compound.unit);
  const [items, setItems]   = useState<any[]>(existing.map((i: any) => ({ ingredient_id: i.ingredient_id, quantity: String(i.quantity) })));
  const [addIng, setAddIng] = useState('');
  const [addQty, setAddQty] = useState('');
  const [saving, setSaving] = useState(false);

  // New sub-ingredient inline
  const [showNewSub, setShowNewSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubUnit, setNewSubUnit] = useState('kg');
  const [newSubCost, setNewSubCost] = useState('');
  const [newSubQty, setNewSubQty]   = useState('');
  const [creatingNew, setCreatingNew] = useState(false);

  const available = ingredients.filter((g: any) => g.id !== compound.id && !items.find((i: any) => i.ingredient_id === g.id));
  const enriched  = items.map((i: any) => {
    const sub = ingredients.find((g: any) => g.id === i.ingredient_id);
    const rawCost = parseFloat(sub?.cost_per_unit) || 0;
    const cf = sub?.correction_factor;
    return { ...i, name: sub?.name, unit: sub?.unit, density: sub?.density ?? null, cost_per_unit: costWithFC(rawCost, cf), raw_cost: rawCost, correction_factor: cf };
  });
  const totalCost   = enriched.reduce((s: any, i: any) => s + (parseFloat(i.quantity) || 0) * i.cost_per_unit, 0);
  const yieldNum    = autoCalcYield(enriched, yieldUnit);
  const compoundFC  = parseFloat(compound.correction_factor) || 0;
  const netYield    = (yieldNum !== null && compoundFC > 0) ? +(yieldNum * (1 - compoundFC / 100)).toFixed(3) : yieldNum;
  const costPerUnit = netYield ? totalCost / netYield : 0;

  function addItem() {
    if (!addIng || !addQty) return;
    setItems((prev: any[]) => [...prev, { ingredient_id: addIng, quantity: addQty }]);
    setAddIng(''); setAddQty('');
  }

  async function handleCreateNewSub() {
    if (!newSubName.trim()) { alert('Nome é obrigatório'); return; }
    setCreatingNew(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_ingredient', data: {
          name: newSubName.trim(), unit: newSubUnit,
          cost_per_unit: parseFloat(newSubCost) || 0,
          ingredient_type: 'simple', correction_factor: 0,
          min_stock: 0, max_stock: 0, weight_volume: 1.0,
        }}),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.ingredient) {
        onIngredientCreated(d.ingredient);
        if (newSubQty) setItems((prev: any[]) => [...prev, { ingredient_id: d.ingredient.id, quantity: newSubQty }]);
        setNewSubName(''); setNewSubUnit('kg'); setNewSubCost(''); setNewSubQty('');
        setShowNewSub(false);
      }
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setCreatingNew(false); }
  }

  async function handleSave() {
    if (!name.trim()) { alert('Nome da receita é obrigatório'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_compound_recipe_v2', data: {
          id: recipe?.id || null,
          compound_id: compound.id,
          name: name.trim(),
          yield_quantity: yieldNum || 0,
          yield_unit: yieldUnit,
          items: items.map((i: any) => ({ ingredient_id: i.ingredient_id, quantity: parseFloat(i.quantity) || 0 })),
        }}),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      onSaved(d.recipe_id);
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, display: 'block', marginBottom: 3 }}>NOME DA RECEITA *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Massa 10kg" style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', boxSizing: 'border-box', color: C.text }} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, display: 'block', marginBottom: 3 }}>UNIDADE SAÍDA</label>
          <select value={yieldUnit} onChange={e => setYieldUnit(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', background: '#fff', color: C.text }}>
            {['kg', 'g', 'L', 'ml', 'unid', 'cx', 'pct', 'dz'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          {yieldNum !== null ? (
            compoundFC > 0 ? (
              <p style={{ fontSize: 9, color: '#7C3AED', marginTop: 3, fontWeight: 700 }}>
                {yieldNum} {yieldUnit} bruto → <span style={{ color: '#059669' }}>{netYield} {yieldUnit} líquido</span> (FC {compoundFC}%)
              </p>
            ) : (
              <p style={{ fontSize: 9, color: '#7C3AED', marginTop: 3, fontWeight: 700 }}>≈ {yieldNum} {yieldUnit} (auto-calculado)</p>
            )
          ) : (
            <p style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>Adicione insumos para calcular</p>
          )}
        </div>
      </div>

      {enriched.length > 0 && (
        <div style={{ marginBottom: 10, border: '1px solid #DDD6FE', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 90px 28px', background: '#EDE9FE', padding: '5px 10px' }}>
            {['Insumo', 'Qtd', 'Unid', 'Custo', ''].map((h, i) => <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>{h}</span>)}
          </div>
          {enriched.map((item: any, idx: any) => (
            <div key={item.ingredient_id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 90px 28px', alignItems: 'center', padding: '5px 10px', borderTop: '1px solid #EDE9FE' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{item.name || '—'}</span>
              <input type="number" value={item.quantity} min="0" step="0.001"
                onChange={e => setItems((prev: any[]) => prev.map((it: any, i: any) => i === idx ? { ...it, quantity: e.target.value } : it))}
                style={{ padding: '3px 5px', borderRadius: 4, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', textAlign: 'right', color: C.text }} />
              <span style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>{item.unit}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', textAlign: 'right' }}>{fmtBRL((parseFloat(item.quantity) || 0) * item.cost_per_unit)}</span>
              <button onClick={() => setItems((prev: any[]) => prev.filter((_: any, i: any) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {totalCost > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ background: '#EDE9FE', borderRadius: 6, padding: '8px 12px', flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>Custo Total</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#6D28D9' }}>{fmtBRL(totalCost)}</p>
            <p style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>FC dos insumos já incluído</p>
          </div>
          {yieldNum !== null && (() => {
            const costComFC  = netYield ? totalCost / netYield  : 0; // com FC do composto
            const costSemFC  = yieldNum ? totalCost / yieldNum  : 0; // sem FC do composto
            const diferenca  = costComFC - costSemFC;
            return (
              <>
                <div style={{ background: '#ECFDF5', borderRadius: 6, padding: '8px 12px', flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#059669', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>Custo/{yieldUnit} com FC</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#047857' }}>{fmtBRL(costComFC)}</p>
                  <p style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>rendimento líquido: {netYield} {yieldUnit}</p>
                </div>
                <div style={{ background: '#FFF7ED', borderRadius: 6, padding: '8px 12px', flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#C2410C', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>Custo/{yieldUnit} sem FC</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#9A3412' }}>{fmtBRL(costSemFC)}</p>
                  <p style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>rendimento bruto: {yieldNum} {yieldUnit}</p>
                </div>
                {compoundFC > 0 && (
                  <div style={{ background: '#FEF2F2', borderRadius: 6, padding: '8px 12px', flex: 1 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>Impacto FC {compoundFC}%</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#B91C1C' }}>+{fmtBRL(diferenca)}</p>
                    <p style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>por {yieldUnit} devido à perda</p>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Add existing ingredient */}
      {available.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <select value={addIng} onChange={e => setAddIng(e.target.value)} style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', background: '#fff', color: C.text }}>
            <option value="">Adicionar insumo...</option>
            {available.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>)}
          </select>
          <input type="number" value={addQty} min="0" step="0.001" onChange={e => setAddQty(e.target.value)} placeholder="Qtd" style={{ width: 70, padding: '5px 6px', borderRadius: 4, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', color: C.text }} />
          <button onClick={addItem} style={{ padding: '5px 10px', borderRadius: 4, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}><Plus size={12} /> Add</button>
        </div>
      )}

      {/* Create new sub-ingredient */}
      <button onClick={() => setShowNewSub(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 4, border: '1px dashed #DDD6FE', background: showNewSub ? '#EDE9FE' : 'transparent', color: '#7C3AED', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>
        <Plus size={11} /> {showNewSub ? 'Cancelar' : 'Criar novo insumo'}
      </button>
      {showNewSub && (
        <div style={{ background: '#fff', borderRadius: 6, border: '1px solid #DDD6FE', padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 70px', gap: 6, marginBottom: 6 }}>
            <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Nome *" style={{ padding: '5px 7px', borderRadius: 4, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', color: C.text }} />
            <select value={newSubUnit} onChange={e => setNewSubUnit(e.target.value)} style={{ padding: '5px 6px', borderRadius: 4, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', color: C.text }}>
              {UNITS_COMPOUND.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" value={newSubCost} onChange={e => setNewSubCost(e.target.value)} placeholder="Custo/unid" min="0" step="0.0001" style={{ padding: '5px 7px', borderRadius: 4, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', color: C.text }} />
            <input type="number" value={newSubQty} onChange={e => setNewSubQty(e.target.value)} placeholder="Qtd" min="0" step="0.001" style={{ padding: '5px 6px', borderRadius: 4, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', color: C.text }} />
          </div>
          <button onClick={handleCreateNewSub} disabled={creatingNew} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 4, border: 'none', background: creatingNew ? '#9CA3AF' : '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: creatingNew ? 'not-allowed' : 'pointer' }}>
            {creatingNew ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />}
            {creatingNew ? 'Criando...' : 'Criar e adicionar'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 5, border: 'none', background: saving ? '#9CA3AF' : '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
          {saving ? 'Salvando...' : 'Salvar Receita'}
        </button>
        <button onClick={onCancel} style={{ padding: '6px 12px', borderRadius: 5, border: '1px solid #DDD6FE', background: '#fff', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── CompoundRecipePanel: multiple named recipes per compound ──────────────────
export default function CompoundRecipePanel({ ingredient, ingredients, adminToken, onClose, onIngredientCreated, onRecipeApplied }: { ingredient: any, ingredients: any, adminToken: any, onClose: any, onIngredientCreated: any, onRecipeApplied: any }) {
  const [recipes, setRecipes]         = useState<any[]>([]);
  const [loadingRec, setLoadingRec]   = useState(true);
  const [editingRecipe, setEditingRecipe] = useState<any>(null); // null | 'new' | recipe_object
  const [applyingId, setApplyingId]   = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null); // recipe id to confirm

  useEffect(() => { loadRecipes(); }, [ingredient.id]);

  async function loadRecipes() {
    setLoadingRec(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'get_compound_recipes', data: { compound_id: ingredient.id } }),
      });
      const d = await res.json();
      setRecipes(d.recipes || []);
    } catch { /* silent */ }
    finally { setLoadingRec(false); }
  }

  async function handleApply(recipe: any) {
    setApplyingId(recipe.id);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'apply_compound_recipe', data: { recipe_id: recipe.id, batches: 1 } }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      onRecipeApplied?.(ingredient.id, d.compound_stock);
      alert(`✅ Receita "${recipe.name}" aplicada! Estoque atualizado: ${d.compound_stock} ${ingredient.unit}`);
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setApplyingId(null); }
  }

  async function handleDelete(recipeId: any) {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'delete_compound_recipe', data: { id: recipeId } }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setRecipes((prev: any[]) => prev.filter((r: any) => r.id !== recipeId));
      setConfirmDelete(null);
    } catch (e) { alert('Erro: ' + (e as Error).message); }
  }

  return (
    <div style={{ borderBottom: '1px solid ' + C.border, background: '#F5F3FF', padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Layers size={13} /> Receitas — {ingredient.name}
        </p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      {/* Recipe form (new or editing) */}
      {editingRecipe !== null && (
        <RecipeItemsEditor
          recipe={editingRecipe === 'new' ? null : editingRecipe}
          compound={ingredient}
          ingredients={ingredients}
          adminToken={adminToken}
          onIngredientCreated={(ing: any) => onIngredientCreated?.(ing)}
          onSaved={() => { setEditingRecipe(null); loadRecipes(); }}
          onCancel={() => setEditingRecipe(null)}
        />
      )}

      {/* Recipe list */}
      {loadingRec ? (
        <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '16px 0' }}>Carregando receitas...</p>
      ) : recipes.length === 0 && editingRecipe === null ? (
        <p style={{ fontSize: 12, color: C.light, marginBottom: 10 }}>Nenhuma receita cadastrada. Crie a primeira abaixo.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {recipes.map(recipe => {
            const itemCount = recipe.compound_recipe_items?.length || 0;
            const isApplying = applyingId === recipe.id;
            const isConfirming = confirmDelete === recipe.id;
            const recipeFC  = parseFloat(ingredient.correction_factor) || 0;
            const grossQty  = parseFloat(recipe.yield_quantity) || 0;
            const netQty    = recipeFC > 0 ? +(grossQty * (1 - recipeFC / 100)).toFixed(3) : grossQty;
            const yieldUnit = recipe.yield_unit || ingredient.unit;

            // Custo total calculado a partir dos itens enriquecidos (mesmo cálculo do editor)
            const enrichedItems = (recipe.compound_recipe_items || []).map((i: any) => {
              const sub = ingredients.find((g: any) => g.id === i.ingredient_id);
              const rawCost = parseFloat(sub?.cost_per_unit) || 0;
              return { ...i, cost_per_unit: costWithFC(rawCost, sub?.correction_factor), unit: sub?.unit, density: sub?.density ?? null };
            });
            const totalCost   = enrichedItems.reduce((s: number, i: any) => s + (parseFloat(i.quantity) || 0) * i.cost_per_unit, 0);
            const costComFC   = netQty  ? totalCost / netQty  : 0;
            const costSemFC   = grossQty ? totalCost / grossQty : 0;
            const diferenca   = costComFC - costSemFC;
            const hasCost     = totalCost > 0;

            return (
              <div key={recipe.id} style={{ background: '#fff', borderRadius: 8, border: '1px solid #DDD6FE', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (isConfirming || hasCost) ? 8 : 0 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{recipe.name}</span>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>
                      Rendimento: {netQty} {yieldUnit}
                      {recipeFC > 0 && <span style={{ color: '#DC2626', marginLeft: 4 }}>({grossQty} bruto, FC {recipeFC}%)</span>}
                      {' '}· {itemCount} insumo(s)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => handleApply(recipe)}
                      disabled={isApplying}
                      style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: isApplying ? '#9CA3AF' : '#059669', color: '#fff', fontSize: 11, fontWeight: 700, cursor: isApplying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {isApplying ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />}
                      Produzir 1 lote
                    </button>
                    <button onClick={() => { setEditingRecipe(recipe); setConfirmDelete(null); }} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #DDD6FE', background: '#fff', color: C.muted, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                    {isConfirming ? (
                      <span style={{ fontSize: 11, color: C.danger }}>
                        Confirmar?{' '}
                        <button onClick={() => handleDelete(recipe.id)} style={{ color: C.danger, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>Sim</button>
                        {' / '}
                        <button onClick={() => setConfirmDelete(null)} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>Não</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete(recipe.id)} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #DDD6FE', background: '#fff', color: C.danger, fontSize: 11, cursor: 'pointer' }}><Trash2 size={11} /></button>
                    )}
                  </div>
                </div>

                {/* Breakdown de custo com/sem FC — visível na lista */}
                {hasCost && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <div style={{ background: '#EDE9FE', borderRadius: 5, padding: '5px 10px', flex: 1, minWidth: 100 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', marginBottom: 1 }}>Custo total</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#6D28D9' }}>{fmtBRL(totalCost)}</p>
                    </div>
                    <div style={{ background: '#ECFDF5', borderRadius: 5, padding: '5px 10px', flex: 1, minWidth: 100 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: 1 }}>Com FC / {yieldUnit}</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#047857' }}>{fmtBRL(costComFC)}</p>
                      <p style={{ fontSize: 8, color: C.muted }}>rendimento líquido: {netQty} {yieldUnit}</p>
                    </div>
                    <div style={{ background: '#FFF7ED', borderRadius: 5, padding: '5px 10px', flex: 1, minWidth: 100 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', marginBottom: 1 }}>Sem FC / {yieldUnit}</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#9A3412' }}>{fmtBRL(costSemFC)}</p>
                      <p style={{ fontSize: 8, color: C.muted }}>rendimento bruto: {grossQty} {yieldUnit}</p>
                    </div>
                    {recipeFC > 0 && (
                      <div style={{ background: '#FEF2F2', borderRadius: 5, padding: '5px 10px', flex: 1, minWidth: 100 }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', marginBottom: 1 }}>Impacto FC {recipeFC}%</p>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C' }}>+{fmtBRL(diferenca)}</p>
                        <p style={{ fontSize: 8, color: C.muted }}>por {yieldUnit}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingRecipe === null && (
        <button
          onClick={() => setEditingRecipe('new')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 5, border: '1px dashed #7C3AED', background: 'transparent', color: '#7C3AED', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={12} /> Nova Receita
        </button>
      )}
    </div>
  );
}
