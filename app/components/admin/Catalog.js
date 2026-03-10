'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed, GlassWater, Package, Upload, Loader2, Trash2,
  Plus, Check, ChevronDown, ChevronUp, Save, RefreshCw,
  DollarSign, TrendingDown, BookOpen, X, Eye, EyeOff, Copy,
  BarChart2, TrendingUp, Layers, ArrowDownUp, Warehouse, Star,
} from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────

const PROD_CATEGORIES = [
  { key: 'pizza',   label: 'Pizza' },
  { key: 'calzone', label: 'Calzone' },
  { key: 'combo',   label: 'Combo' },
  { key: 'outros',  label: 'Outros' },
];

const FILTER_TABS = [
  { key: 'all',     label: 'Todos' },
  { key: 'pizza',   label: 'Pizza' },
  { key: 'calzone', label: 'Calzone' },
  { key: 'combo',   label: 'Combo' },
  { key: 'outros',  label: 'Outros' },
  { key: 'bebidas', label: 'Bebidas' },
  { key: 'upsell',  label: 'Upsell' },
];

const UNITS = ['unid', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz', 'ft', 'Bag', 'UN', 'KG'];

const C = {
  bg: '#F4F5F7', card: '#fff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  gold: '#F2A800', success: '#10B981', danger: '#EF4444',
};

function fmtBRL(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Ficha Técnica Panel ───────────────────────────────────────────────────────

// Unit sub-conversion map: base unit → { sub unit, conversion factor to base }
const UNIT_SUB = { kg: { sub: 'g', factor: 0.001 }, L: { sub: 'ml', factor: 0.001 } };

function toBaseQty(qty, recipeUnit, baseUnit) {
  if (!recipeUnit || recipeUnit === baseUnit) return parseFloat(qty) || 0;
  const conv = UNIT_SUB[baseUnit];
  if (conv && conv.sub === recipeUnit) return (parseFloat(qty) || 0) * conv.factor;
  return parseFloat(qty) || 0;
}

function getUnitOptions(baseUnit) {
  const conv = UNIT_SUB[baseUnit];
  if (conv) return [baseUnit, conv.sub];
  return [baseUnit];
}

function FichaTecnica({ productId, productPrice, ingredients, recipe, onSave }) {
  const [items, setItems] = useState([]);
  const [addIng, setAddIng] = useState('');
  const [addQty, setAddQty] = useState('');
  const [addUnit, setAddUnit] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(recipe || []); }, [recipe]);

  const enriched = items.map(i => {
    const ing = ingredients.find(g => g.id === i.ingredient_id);
    return { ...i, name: ing?.name, unit: ing?.unit, cost_per_unit: parseFloat(ing?.cost_per_unit) || 0 };
  });

  const calcCost = enriched.reduce((s, i) => {
    const baseQty = toBaseQty(i.quantity, i.recipe_unit, i.unit);
    return s + baseQty * i.cost_per_unit;
  }, 0);
  const price = parseFloat(productPrice) || 0;
  const margin = price > 0 && calcCost > 0 ? ((price - calcCost) / price * 100) : null;

  const availableIngs = ingredients.filter(g => !items.find(i => i.ingredient_id === g.id));

  function addItem() {
    if (!addIng || !addQty) return;
    const ing = ingredients.find(g => g.id === addIng);
    const recipeUnit = addUnit || ing?.unit || '';
    setItems(prev => [...prev, { ingredient_id: addIng, quantity: parseFloat(addQty), recipe_unit: recipeUnit }]);
    setAddIng(''); setAddQty(''); setAddUnit('');
  }

  function removeItem(ingredient_id) {
    setItems(prev => prev.filter(i => i.ingredient_id !== ingredient_id));
  }

  function updateQty(ingredient_id, qty) {
    setItems(prev => prev.map(i => i.ingredient_id === ingredient_id ? { ...i, quantity: qty } : i));
  }

  function updateRecipeUnit(ingredient_id, unit) {
    setItems(prev => prev.map(i => i.ingredient_id === ingredient_id ? { ...i, recipe_unit: unit } : i));
  }

  async function save() {
    setSaving(true);
    try { await onSave(productId, items); } finally { setSaving(false); }
  }

  const cmv = price > 0 && calcCost > 0 ? (calcCost / price * 100) : null;
  const lucro = price > 0 ? price - calcCost : null;

  // When ingredient selection changes, reset unit to its base unit
  function handleAddIngChange(ingId) {
    setAddIng(ingId);
    const ing = ingredients.find(g => g.id === ingId);
    setAddUnit(ing?.unit || '');
  }

  return (
    <div style={{ marginTop: 12, padding: '16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E0E7EF' }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: C.light, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Ficha Técnica
      </p>

      {/* Tabela de ingredientes */}
      {enriched.length > 0 && (
        <div style={{ marginBottom: 12, border: '1px solid ' + C.border, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 90px 30px', background: '#F3F4F6', borderBottom: '1px solid ' + C.border, padding: '6px 10px' }}>
            {['Insumo', 'Qtd', 'Unid', 'Custo', ''].map((h, idx) => (
              <span key={idx} style={{ fontSize: 10, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>
          {enriched.map(i => {
            const unitOptions = getUnitOptions(i.unit);
            const displayUnit = i.recipe_unit || i.unit;
            const baseCost = toBaseQty(i.quantity, i.recipe_unit, i.unit) * i.cost_per_unit;
            return (
              <div key={i.ingredient_id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 90px 30px', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid ' + C.border + '60' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{i.name || '—'}</span>
                <input
                  type="number" value={i.quantity} min="0" step="0.001"
                  onChange={e => updateQty(i.ingredient_id, e.target.value)}
                  style={{ width: '100%', padding: '3px 5px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
                />
                {unitOptions.length > 1 ? (
                  <select
                    value={displayUnit}
                    onChange={e => updateRecipeUnit(i.ingredient_id, e.target.value)}
                    style={{ padding: '2px 4px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 11, outline: 'none', background: '#fff', color: C.text, textAlign: 'center' }}
                  >
                    {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>{i.unit}</span>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', textAlign: 'right' }}>
                  {fmtBRL(baseCost)}
                </span>
                <button onClick={() => removeItem(i.ingredient_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Resumo CMV / Margem / Lucro */}
      {calcCost > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ background: '#EFF6FF', borderRadius: 6, padding: '7px 12px', flex: 1, minWidth: 90 }}>
            <p style={{ fontSize: 10, color: '#2563EB', fontWeight: 700, marginBottom: 2 }}>CMV</p>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#1E40AF' }}>{fmtBRL(calcCost)}</p>
            {cmv !== null && <p style={{ fontSize: 11, color: '#3B82F6' }}>{cmv.toFixed(0)}% do preço</p>}
          </div>
          {margin !== null && (
            <div style={{
              background: margin >= 60 ? '#ECFDF5' : margin >= 40 ? '#FFFBEB' : '#FEF2F2',
              borderRadius: 6, padding: '7px 12px', flex: 1, minWidth: 90,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, marginBottom: 2, color: margin >= 60 ? '#059669' : margin >= 40 ? '#D97706' : '#EF4444' }}>Margem</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: margin >= 60 ? '#047857' : margin >= 40 ? '#92400E' : '#B91C1C' }}>{margin.toFixed(0)}%</p>
            </div>
          )}
          {lucro !== null && (
            <div style={{ background: '#F5F3FF', borderRadius: 6, padding: '7px 12px', flex: 1, minWidth: 90 }}>
              <p style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, marginBottom: 2 }}>Lucro/unid</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#6D28D9' }}>{fmtBRL(lucro)}</p>
            </div>
          )}
        </div>
      )}

      {enriched.length === 0 && (
        <p style={{ fontSize: 12, color: C.light, marginBottom: 10 }}>Nenhum ingrediente na ficha. Adicione abaixo.</p>
      )}

      {/* Adicionar ingrediente */}
      {availableIngs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={addIng} onChange={e => handleAddIngChange(e.target.value)}
            style={{ flex: 1, minWidth: 160, padding: '5px 8px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none', background: '#fff' }}>
            <option value="">Selecionar insumo...</option>
            {availableIngs.map(g => <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>)}
          </select>
          <input type="number" value={addQty} min="0" step="0.001" onChange={e => setAddQty(e.target.value)} placeholder="Qtd"
            style={{ width: 70, padding: '5px 6px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none' }} />
          {addIng && (() => {
            const ing = ingredients.find(g => g.id === addIng);
            const opts = getUnitOptions(ing?.unit || '');
            return opts.length > 1 ? (
              <select value={addUnit} onChange={e => setAddUnit(e.target.value)}
                style={{ padding: '5px 6px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none', background: '#fff', color: C.text }}>
                {opts.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            ) : null;
          })()}
          <button onClick={addItem} style={{ padding: '5px 10px', borderRadius: 4, border: 'none', background: '#111827', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={12} /> Add
          </button>
        </div>
      )}
      {ingredients.length === 0 && <p style={{ fontSize: 11, color: C.light, marginBottom: 10 }}>Cadastre insumos na aba "Insumos" para usar aqui.</p>}

      <button onClick={save} disabled={saving} style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 4, border: 'none',
        background: saving ? '#9CA3AF' : '#059669', color: '#fff',
        fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
      }}>
        {saving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Check size={12} /> Salvar Ficha</>}
      </button>
    </div>
  );
}

// ── CompoundRecipePanel ───────────────────────────────────────────────────────

const UNITS_COMPOUND = ['unid', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz', 'ft', 'Bag', 'UN', 'KG'];

// ── RecipeItemsEditor: edit ingredients of a single named recipe ──────────────
function RecipeItemsEditor({ recipe, compound, ingredients, adminToken, onSaved, onCancel, onIngredientCreated }) {
  const existing = recipe?.compound_recipe_items || [];
  const [name, setName]     = useState(recipe?.name || '');
  const [yieldQty, setYieldQty] = useState(String(recipe?.yield_quantity ?? 1));
  const [items, setItems]   = useState(existing.map(i => ({ ingredient_id: i.ingredient_id, quantity: String(i.quantity) })));
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

  const available = ingredients.filter(g => g.id !== compound.id && !items.find(i => i.ingredient_id === g.id));
  const enriched  = items.map(i => {
    const sub = ingredients.find(g => g.id === i.ingredient_id);
    return { ...i, name: sub?.name, unit: sub?.unit, cost_per_unit: parseFloat(sub?.cost_per_unit) || 0 };
  });
  const totalCost = enriched.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * i.cost_per_unit, 0);
  const yieldNum  = parseFloat(yieldQty) || 1;
  const costPerUnit = yieldNum > 0 ? totalCost / yieldNum : 0;

  function addItem() {
    if (!addIng || !addQty) return;
    setItems(prev => [...prev, { ingredient_id: addIng, quantity: addQty }]);
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
          ingredient_type: 'simple', correction_factor: 1.0,
          min_stock: 0, max_stock: 0, weight_volume: 1.0,
        }}),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.ingredient) {
        onIngredientCreated(d.ingredient);
        if (newSubQty) setItems(prev => [...prev, { ingredient_id: d.ingredient.id, quantity: newSubQty }]);
        setNewSubName(''); setNewSubUnit('kg'); setNewSubCost(''); setNewSubQty('');
        setShowNewSub(false);
      }
    } catch (e) { alert('Erro: ' + e.message); }
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
          yield_quantity: parseFloat(yieldQty) || 1,
          items: items.map(i => ({ ingredient_id: i.ingredient_id, quantity: parseFloat(i.quantity) || 0 })),
        }}),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      onSaved(d.recipe_id);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, display: 'block', marginBottom: 3 }}>NOME DA RECEITA *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Massa 10kg" style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', boxSizing: 'border-box', color: C.text }} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, display: 'block', marginBottom: 3 }}>RENDIMENTO ({compound.unit})</label>
          <input type="number" min="0.001" step="0.001" value={yieldQty} onChange={e => setYieldQty(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', boxSizing: 'border-box', color: C.text }} />
        </div>
      </div>

      {enriched.length > 0 && (
        <div style={{ marginBottom: 10, border: '1px solid #DDD6FE', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 90px 28px', background: '#EDE9FE', padding: '5px 10px' }}>
            {['Insumo', 'Qtd', 'Unid', 'Custo', ''].map((h, i) => <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>{h}</span>)}
          </div>
          {enriched.map((item, idx) => (
            <div key={item.ingredient_id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 90px 28px', alignItems: 'center', padding: '5px 10px', borderTop: '1px solid #EDE9FE' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{item.name || '—'}</span>
              <input type="number" value={item.quantity} min="0" step="0.001"
                onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))}
                style={{ padding: '3px 5px', borderRadius: 4, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', textAlign: 'right', color: C.text }} />
              <span style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>{item.unit}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', textAlign: 'right' }}>{fmtBRL((parseFloat(item.quantity) || 0) * item.cost_per_unit)}</span>
              <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {totalCost > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ background: '#EDE9FE', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', marginBottom: 2 }}>CUSTO TOTAL</p>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#6D28D9' }}>{fmtBRL(totalCost)}</p>
          </div>
          <div style={{ background: '#ECFDF5', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.success, marginBottom: 2 }}>CUSTO/{compound.unit.toUpperCase()}</p>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#047857' }}>{fmtBRL(costPerUnit)}</p>
          </div>
        </div>
      )}

      {/* Add existing ingredient */}
      {available.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <select value={addIng} onChange={e => setAddIng(e.target.value)} style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid #DDD6FE', fontSize: 12, outline: 'none', background: '#fff', color: C.text }}>
            <option value="">Adicionar insumo...</option>
            {available.map(g => <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>)}
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
function CompoundRecipePanel({ ingredient, ingredients, adminToken, onClose, onIngredientCreated, onRecipeApplied }) {
  const [recipes, setRecipes]         = useState([]);
  const [loadingRec, setLoadingRec]   = useState(true);
  const [editingRecipe, setEditingRecipe] = useState(null); // null | 'new' | recipe_object
  const [applyingId, setApplyingId]   = useState(null);
  const [batches, setBatches]         = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(null); // recipe id to confirm

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

  async function handleApply(recipe) {
    setApplyingId(recipe.id);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'apply_compound_recipe', data: { recipe_id: recipe.id, batches } }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      onRecipeApplied?.(ingredient.id, d.compound_stock);
      alert(`✅ Receita "${recipe.name}" aplicada! Estoque atualizado: ${d.compound_stock} ${ingredient.unit}`);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setApplyingId(null); }
  }

  async function handleDelete(recipeId) {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'delete_compound_recipe', data: { id: recipeId } }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setRecipes(prev => prev.filter(r => r.id !== recipeId));
      setConfirmDelete(null);
    } catch (e) { alert('Erro: ' + e.message); }
  }

  return (
    <div style={{ borderBottom: '1px solid ' + C.border, background: '#F5F3FF', padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Layers size={13} /> Receitas — {ingredient.name}
        </p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      {/* Batch count selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: '#EDE9FE', borderRadius: 6 }}>
        <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700 }}>LOTES P/ PRODUÇÃO:</span>
        <input type="number" min="1" step="1" value={batches} onChange={e => setBatches(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: 60, padding: '4px 6px', borderRadius: 4, border: '1px solid #DDD6FE', fontSize: 12, textAlign: 'center', outline: 'none', color: C.text }} />
        <span style={{ fontSize: 11, color: C.muted }}>lote(s)</span>
      </div>

      {/* Recipe form (new or editing) */}
      {editingRecipe !== null && (
        <RecipeItemsEditor
          recipe={editingRecipe === 'new' ? null : editingRecipe}
          compound={ingredient}
          ingredients={ingredients}
          adminToken={adminToken}
          onIngredientCreated={ing => onIngredientCreated?.(ing)}
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
            return (
              <div key={recipe.id} style={{ background: '#fff', borderRadius: 8, border: '1px solid #DDD6FE', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isConfirming ? 8 : 0 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{recipe.name}</span>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>
                      Rendimento: {recipe.yield_quantity} {ingredient.unit} · {itemCount} insumo(s)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => handleApply(recipe)}
                      disabled={isApplying}
                      style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: isApplying ? '#9CA3AF' : '#059669', color: '#fff', fontSize: 11, fontWeight: 700, cursor: isApplying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {isApplying ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />}
                      Produzir
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

// ── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({
  product, idx,
  onUpdate, onUploadImage, uploadingId,
  imagePositions, onUpdateImagePos,
  stockLimits, onUpdateStockLimit,
  ingredients, recipe, onSaveRecipe,
  onSave, isSaving,
}) {
  const [fichaOpen, setFichaOpen] = useState(false);
  const [cardTab, setCardTab]     = useState('geral'); // 'geral' | 'imagens'
  const [stockOpen, setStockOpen] = useState(false);
  const pos   = imagePositions[String(product.id)] || { x: 50, y: 50 };
  const stock = stockLimits[String(product.id)]    || { enabled: false, qty: 0, low_stock_threshold: 3 };
  const margin = parseFloat(product.price) > 0 && parseFloat(product.cost_price) > 0
    ? Math.round((product.price - product.cost_price) / product.price * 100)
    : null;

  const inputStyle = {
    width: '100%', padding: '6px 9px', borderRadius: 5,
    border: '1px solid ' + C.border, fontSize: 12, outline: 'none',
    background: '#fff', color: C.text, boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle = { fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 };

  const tabs = [
    { key: 'geral',   label: 'Geral' },
    { key: 'imagens', label: 'Imagens' },
  ];

  return (
    <div style={{ background: '#FAFAFA', borderRadius: 8, padding: 14, border: '1px solid ' + C.border }}>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid ' + C.border }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setCardTab(t.key)}
            style={{
              padding: '6px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: cardTab === t.key ? 700 : 500,
              color: cardTab === t.key ? C.gold : C.muted,
              borderBottom: cardTab === t.key ? `2px solid ${C.gold}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── GERAL TAB ── */}
      {cardTab === 'geral' && (
        <>
          {/* Campos principais */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
            {/* Categoria + Ordem */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 7 }}>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select value={product.category || 'pizza'} onChange={e => onUpdate(idx, 'category', e.target.value)}
                  style={{ ...inputStyle }}>
                  {PROD_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Ordem</label>
                <input type="number" value={product.sort_order || ''} placeholder="0"
                  onChange={e => onUpdate(idx, 'sort_order', parseInt(e.target.value) || 0)}
                  style={inputStyle} />
              </div>
            </div>

            {/* Preço + Custo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <div>
                <label style={labelStyle}>Preço (R$)</label>
                <input type="number" step="0.01" placeholder="0,00" value={product.price || ''}
                  onChange={e => onUpdate(idx, 'price', e.target.value)}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Custo (R$)</label>
                <input type="number" step="0.01" placeholder="0,00" value={product.cost_price || ''}
                  onChange={e => onUpdate(idx, 'cost_price', e.target.value)}
                  style={inputStyle} />
              </div>
            </div>

            {/* Margem */}
            {margin !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                background: margin >= 60 ? '#ECFDF5' : margin >= 40 ? '#FFFBEB' : '#FEF2F2',
                color: margin >= 60 ? '#059669' : margin >= 40 ? '#D97706' : '#EF4444',
              }}>
                <TrendingDown size={11} />
                Margem: {margin}% · Lucro: {fmtBRL(product.price - product.cost_price)}
              </div>
            )}

            {/* Descrição */}
            <div>
              <label style={labelStyle}>Descrição</label>
              <input placeholder="Descrição do produto" value={product.description || ''}
                onChange={e => onUpdate(idx, 'description', e.target.value)}
                style={inputStyle} />
            </div>
          </div>

          {/* ── Limitar Estoque (button + sub-panel) ── */}
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setStockOpen(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 6,
                border: '1px solid ' + (stock.enabled ? '#10B981' : C.border),
                background: stock.enabled ? '#ECFDF5' : '#fff',
                cursor: 'pointer', color: stock.enabled ? '#059669' : C.muted,
                fontSize: 12, fontWeight: 600,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Package size={13} />
                Limitar estoque
                {stock.enabled && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                    background: stock.qty <= 0 ? 'rgba(239,68,68,0.12)' : stock.qty <= (stock.low_stock_threshold ?? 3) ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                    color: stock.qty <= 0 ? C.danger : stock.qty <= (stock.low_stock_threshold ?? 3) ? '#D97706' : C.success }}>
                    {stock.qty <= 0 ? 'Esgotado' : stock.qty <= (stock.low_stock_threshold ?? 3) ? `${stock.qty} unid.` : `${stock.qty} unid.`}
                  </span>
                )}
              </span>
              {stockOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {stockOpen && (
              <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid ' + C.border, borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 10 }}>
                  <input type="checkbox" checked={!!stock.enabled} onChange={e => onUpdateStockLimit(product.id, 'enabled', e.target.checked)} />
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>Ativar limite de estoque</span>
                </label>
                {stock.enabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Qtd disponível</label>
                      <input type="number" min="0" placeholder="0" value={stock.qty}
                        onChange={e => onUpdateStockLimit(product.id, 'qty', parseInt(e.target.value) || 0)}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Aviso "poucas unid."</label>
                      <input type="number" min="1" max="50" placeholder="3" value={stock.low_stock_threshold ?? 3}
                        onChange={e => onUpdateStockLimit(product.id, 'low_stock_threshold', parseInt(e.target.value) || 3)}
                        style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Salvar produto ── */}
          <button
            onClick={onSave}
            disabled={isSaving}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 6, border: 'none', background: isSaving ? '#9CA3AF' : '#111827', color: '#fff', fontSize: 13, fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', marginBottom: 8 }}
          >
            {isSaving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Save size={13} /> Salvar Produto</>}
          </button>

          {/* ── Ficha Técnica ── */}
          <button
            onClick={() => setFichaOpen(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 5, border: '1px dashed #C4B5FD', background: fichaOpen ? '#F5F3FF' : '#FAFAFA', cursor: 'pointer', color: '#7C3AED', fontWeight: 600, fontSize: 11 }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <BookOpen size={12} /> Ficha Técnica
            </span>
            {fichaOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {fichaOpen && (
            <FichaTecnica productId={product.id} productPrice={product.price} ingredients={ingredients} recipe={recipe} onSave={onSaveRecipe} />
          )}
        </>
      )}

      {/* ── IMAGENS TAB ── */}
      {cardTab === 'imagens' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Foto atual + upload */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 90, height: 90, borderRadius: 7, overflow: 'hidden', border: '1px solid ' + C.border, background: '#F3F4F6', flexShrink: 0 }}>
              {product.image_url
                ? <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%`, display: 'block' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UtensilsCrossed size={28} color={C.light} /></div>
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#F3F4F6', color: C.muted, borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid ' + C.border, opacity: uploadingId === product.id ? 0.5 : 1, fontWeight: 600 }}>
                {uploadingId === product.id
                  ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
                  : <><Upload size={13} /> Trocar foto</>
                }
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) onUploadImage(idx, e.target.files[0]); }} disabled={uploadingId === product.id} />
              </label>
              <p style={{ fontSize: 11, color: C.light }}>JPG, PNG ou WebP. Recomendado: 800×800px.</p>
            </div>
          </div>

          {/* Encaixe da foto (sliders) */}
          {product.image_url && (
            <div style={{ padding: '12px', background: '#fff', borderRadius: 6, border: '1px solid ' + C.border }}>
              <p style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 }}>
                Encaixe da foto
              </p>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 6, overflow: 'hidden', border: '1px solid ' + C.border, flexShrink: 0 }}>
                  <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%`, display: 'block' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, width: 24 }}>H</span>
                    <input type="range" min="0" max="100" value={pos.x}
                      onChange={e => onUpdateImagePos(product.id, parseInt(e.target.value), pos.y)}
                      style={{ flex: 1, accentColor: C.gold }} />
                    <span style={{ fontSize: 10, color: C.muted, width: 30, textAlign: 'right' }}>{pos.x}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, width: 24 }}>V</span>
                    <input type="range" min="0" max="100" value={pos.y}
                      onChange={e => onUpdateImagePos(product.id, pos.x, parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: C.gold }} />
                    <span style={{ fontSize: 10, color: C.muted, width: 30, textAlign: 'right' }}>{pos.y}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DrinkRow (collapsed + expandable) ─────────────────────────────────────────

function DrinkRow({ drink, idx, isExpanded, onToggleExpand, onDuplicate, onUpdate, onDelete, drinkStockLimits, onUpdateDrinkStockLimit, onSave, isSaving }) {
  const dstock = drinkStockLimits[String(drink.id)] || { enabled: false, qty: 0 };

  return (
    <div style={{ background: C.card, borderRadius: 8, border: isExpanded ? '1.5px solid #6366F1' : '1px solid ' + C.border, overflow: 'hidden', boxShadow: isExpanded ? '0 2px 12px rgba(99,102,241,0.1)' : '0 1px 2px rgba(0,0,0,0.04)' }}>
      {/* Collapsed row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
        {/* Icon placeholder */}
        <div style={{ width: 42, height: 42, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <GlassWater size={18} color="#6366F1" />
        </div>

        {/* Name + size */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{drink.name}</p>
          {drink.size && <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 3, background: '#EFF6FF', color: '#6366F1' }}>{drink.size}</span>}
        </div>

        {/* Price */}
        <span style={{ fontSize: 14, fontWeight: 800, color: C.gold, minWidth: 76, textAlign: 'right', flexShrink: 0 }}>{fmtBRL(drink.price)}</span>

        {/* Active toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
          <input type="checkbox" checked={!!drink.is_active} onChange={e => onUpdate(idx, 'is_active', e.target.checked)} />
          <span style={{ fontSize: 11, fontWeight: 600, color: drink.is_active ? C.success : C.light, minWidth: 40 }}>
            {drink.is_active ? 'Ativo' : 'Inativo'}
          </span>
        </label>

        {/* Hidden toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
          <input type="checkbox" checked={!!drink.is_hidden} onChange={e => onUpdate(idx, 'is_hidden', e.target.checked)} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: drink.is_hidden ? '#7C3AED' : C.light }}>
            {drink.is_hidden ? <EyeOff size={11} /> : <Eye size={11} />}
            {drink.is_hidden ? 'Oculto' : 'Visível'}
          </span>
        </label>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button onClick={() => onDuplicate(idx)} title="Duplicar bebida" style={{
            padding: '5px 9px', borderRadius: 4, border: '1px solid ' + C.border,
            background: '#F9FAFB', color: C.muted, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Copy size={12} /> Duplicar
          </button>
          <button onClick={onToggleExpand} style={{
            padding: '5px 12px', borderRadius: 4, border: 'none',
            background: isExpanded ? '#111827' : '#EFF6FF',
            color: isExpanded ? '#fff' : '#6366F1',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {isExpanded ? <><ChevronUp size={12} /> Fechar</> : <><ChevronDown size={12} /> Editar</>}
          </button>
        </div>
      </div>

      {/* Expanded editing form */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid ' + C.border, padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Nome/Marca *</label>
              <input className="input-field" placeholder="Marca/Nome" value={drink.name || ''}
                onChange={e => onUpdate(idx, 'name', e.target.value)}
                style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Tamanho</label>
              <input className="input-field" placeholder="ex: 600ml" value={drink.size || ''}
                onChange={e => onUpdate(idx, 'size', e.target.value)}
                style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Preço (R$) *</label>
            <input className="input-field" placeholder="Preço" type="number" step="0.01" value={drink.price || ''}
              onChange={e => onUpdate(idx, 'price', e.target.value)}
              style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
          </div>

          <div style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, border: '1px solid ' + C.border }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: dstock.enabled ? 8 : 0 }}>
              <input type="checkbox" checked={!!dstock.enabled} onChange={e => onUpdateDrinkStockLimit(drink.id, 'enabled', e.target.checked)} />
              <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>Limitar estoque</span>
            </label>
            {dstock.enabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="input-field" type="number" min="0" placeholder="Qtd" value={dstock.qty}
                  onChange={e => onUpdateDrinkStockLimit(drink.id, 'qty', parseInt(e.target.value) || 0)}
                  style={{ maxWidth: 120, background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: dstock.qty <= 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: dstock.qty <= 0 ? C.danger : C.success }}>
                  {dstock.qty <= 0 ? 'Esgotado' : 'Disponível'}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={onSave} disabled={isSaving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, border: 'none', background: isSaving ? '#9CA3AF' : '#111827', color: '#fff', fontSize: 12, fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
              {isSaving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Save size={12} /> Salvar Bebida</>}
            </button>
            <button onClick={() => onDelete(drink.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: C.danger, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Trash2 size={12} /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PriceLineChart (para Análise de Preço) ────────────────────────────────────

function PriceLineChart({ points }) {
  const [hovered, setHovered] = useState(null);
  if (!points || points.length < 2) return null;

  const prices = points.map(p => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const W = 400, H = 80, padL = 8, padR = 8, padT = 16, padB = 16;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = points.length;

  function px(i) { return padL + (i / (n - 1)) * chartW; }
  function py(price) { return padT + chartH - ((price - minP) / range) * chartH; }

  const polyPoints = points.map((p, i) => `${px(i)},${py(p.price)}`).join(' ');

  function fmtBRLshort(v) {
    if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
    return `R$${(v || 0).toFixed(2).replace('.', ',')}`;
  }

  return (
    <div style={{ position: 'relative' }}>
      {hovered !== null && (
        <div style={{
          position: 'absolute', top: 0,
          left: `clamp(40px, ${(hovered / (n - 1)) * 100}%, calc(100% - 40px))`,
          transform: 'translateX(-50%)',
          background: '#111827', color: '#fff', padding: '4px 9px', borderRadius: 6,
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none',
        }}>
          {fmtBRLshort(points[hovered].price)}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} onMouseLeave={() => setHovered(null)}>
        {/* Grid lines */}
        {[0, 0.5, 1].map(t => {
          const y = padT + t * chartH;
          return <line key={t} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F3F4F6" strokeWidth="1" />;
        })}
        {/* Line */}
        <polyline points={polyPoints} fill="none" stroke="#F2A800" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Area fill */}
        <polyline points={`${padL},${padT + chartH} ${polyPoints} ${W - padR},${padT + chartH}`} fill="rgba(242,168,0,0.08)" stroke="none" />
        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={px(i)} cy={py(p.price)} r={hovered === i ? 5 : 3.5}
            fill={p.isCurrent ? '#6366F1' : '#F2A800'} stroke="#fff" strokeWidth="1.5"
            opacity={hovered !== null && hovered !== i ? 0.4 : 1}
          />
        ))}
        {/* Hover zones */}
        {points.map((p, i) => (
          <rect key={`h-${i}`} x={px(i) - (chartW / n / 2)} y={padT} width={chartW / n} height={chartH}
            fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setHovered(i)} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.light, marginTop: 2 }}>
        <span>{new Date(points[0].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} (atual)</span>
      </div>
    </div>
  );
}

// ── ProductRow (collapsed + expandable) ──────────────────────────────────────

function ProductRow({
  product, idx, isExpanded, onToggleExpand, onDuplicate,
  onUpdate, onUploadImage, uploadingId,
  imagePositions, onUpdateImagePos,
  stockLimits, onUpdateStockLimit,
  ingredients, recipe, onSaveRecipe,
  onSave, savingProductId,
}) {
  const catLabel = PROD_CATEGORIES.find(c => c.key === (product.category || 'pizza'))?.label || 'Pizza';
  const catColors = { pizza: '#F2A800', calzone: '#2563EB', combo: '#7C3AED', outros: '#6B7280' };
  const catColor = catColors[product.category] || catColors.pizza;

  // CMV from ficha técnica
  const cmvValue = (() => {
    if (!recipe?.length) return null;
    return recipe.reduce((s, item) => {
      const ing = ingredients.find(g => g.id === item.ingredient_id);
      return s + (parseFloat(item.quantity) || 0) * (parseFloat(ing?.cost_per_unit) || 0);
    }, 0);
  })();

  return (
    <div style={{ position: isExpanded ? 'relative' : 'static', zIndex: isExpanded ? 1001 : 'auto', background: C.card, borderRadius: 8, border: isExpanded ? '1.5px solid #F2A800' : '1px solid ' + C.border, overflow: 'hidden', boxShadow: isExpanded ? '0 2px 12px rgba(242,168,0,0.12)' : '0 1px 2px rgba(0,0,0,0.04)' }}>
      {/* Collapsed row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
        {/* Thumbnail */}
        {product.image_url
          ? <img src={product.image_url} alt="" style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 42, height: 42, borderRadius: 6, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UtensilsCrossed size={16} color={C.light} /></div>
        }

        {/* Name + category */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</p>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 3, background: catColor + '18', color: catColor }}>{catLabel}</span>
        </div>

        {/* Price + CMV % */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, minWidth: 76 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>{fmtBRL(product.price)}</span>
          {cmvValue !== null
            ? (() => {
                const price = parseFloat(product.price);
                const pct = price > 0 ? Math.round(cmvValue / price * 100) : null;
                return pct !== null
                  ? <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: pct <= 30 ? '#ECFDF5' : pct <= 45 ? '#FFFBEB' : '#FEF2F2',
                      color: pct <= 30 ? '#059669' : pct <= 45 ? '#D97706' : '#EF4444',
                    }}>CMV {pct}%</span>
                  : null;
              })()
            : <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 500 }}>Falta ficha</span>
          }
        </div>

        {/* Active toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
          <input type="checkbox" checked={!!product.is_active} onChange={e => onUpdate(idx, 'is_active', e.target.checked)} />
          <span style={{ fontSize: 11, fontWeight: 600, color: product.is_active ? C.success : C.light, minWidth: 40 }}>
            {product.is_active ? 'Ativo' : 'Inativo'}
          </span>
        </label>

        {/* Hidden toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0, title: 'Ocultar do cardápio online' }}>
          <input type="checkbox" checked={!!product.is_hidden} onChange={e => onUpdate(idx, 'is_hidden', e.target.checked)} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: product.is_hidden ? '#7C3AED' : C.light }}>
            {product.is_hidden ? <EyeOff size={11} /> : <Eye size={11} />}
            {product.is_hidden ? 'Oculto' : 'Visível'}
          </span>
        </label>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button onClick={() => onDuplicate(idx)} title="Duplicar sabor" style={{
            padding: '5px 9px', borderRadius: 4, border: '1px solid ' + C.border,
            background: '#F9FAFB', color: C.muted, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Copy size={12} /> Duplicar
          </button>
          <button onClick={onToggleExpand} style={{
            padding: '5px 12px', borderRadius: 4, border: 'none',
            background: isExpanded ? '#111827' : '#F2A80020',
            color: isExpanded ? '#fff' : C.gold,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {isExpanded ? <><ChevronUp size={12} /> Fechar</> : <><ChevronDown size={12} /> Editar</>}
          </button>
        </div>
      </div>

      {/* Expanded editing form */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid ' + C.border, padding: 20 }}>
          <ProductCard
            product={product} idx={idx}
            onUpdate={onUpdate}
            onUploadImage={onUploadImage}
            uploadingId={uploadingId}
            imagePositions={imagePositions}
            onUpdateImagePos={onUpdateImagePos}
            stockLimits={stockLimits}
            onUpdateStockLimit={onUpdateStockLimit}
            ingredients={ingredients}
            recipe={recipe}
            onSaveRecipe={onSaveRecipe}
            onSave={() => onSave(product)}
            isSaving={savingProductId === product.id}
          />
        </div>
      )}
    </div>
  );
}

// ── SpecialFlavorSaveButton ───────────────────────────────────────────────────

function SpecialFlavorSaveButton({ name, description, onSave }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave('special_flavor_name', name);
      await onSave('special_flavor_description', description);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', background: saved ? C.success : saving ? '#9CA3AF' : C.gold, color: saved ? '#fff' : '#000', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
    >
      {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
      {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Especial do Mês'}
    </button>
  );
}

// ── Catalog Main ───────────────────────────────────────────────────────────────

export default function Catalog({ adminToken }) {
  const [tab, setTab]           = useState('cardapio'); // 'cardapio' | 'insumos' | 'analise' | 'especial'
  const [catFilter, setCatFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null); // product id currently expanded for editing

  const [products, setProducts]   = useState([]);
  const [drinks, setDrinks]       = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes]     = useState({}); // { [productId]: [{ ingredient_id, quantity }] }
  const [priceHistory, setPriceHistory] = useState([]); // for Análise tab
  const [compoundItems, setCompoundItems] = useState([]); // [{ compound_id, ingredient_id, quantity }]

  // Stock movement UI state
  const [stockPanelIngId, setStockPanelIngId] = useState(null); // ingredient id with open stock panel
  const [stockMovement, setStockMovement] = useState({ type: 'in', quantity: '', reason: '', notes: '' });
  const [savingStockMovement, setSavingStockMovement] = useState(false);

  // Compound recipe panel
  const [compoundPanelIngId, setCompoundPanelIngId] = useState(null); // ingredient id with open compound panel
  const [savingCompoundRecipe, setSavingCompoundRecipe] = useState(false);

  // Per-ingredient stock movement chart
  const [ingMovements, setIngMovements] = useState({}); // { [ingredient_id]: movements[] }

  // Settings needed for stock limits and image positions
  const [settings, setSettings]   = useState([]);

  const [loading, setLoading]     = useState(true);
  const [savingProductId, setSavingProductId] = useState(null);
  const [savingDrinkId, setSavingDrinkId] = useState(null);
  const [msg, setMsg]             = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadingUpsellIdx, setUploadingUpsellIdx] = useState(null);

  // New product form
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', category: 'pizza', price: '', description: '' });
  const [addingProduct, setAddingProduct] = useState(false);

  // New drink form
  const [showNewDrink, setShowNewDrink] = useState(false);
  const [newDrink, setNewDrink]   = useState({ name: '', size: '', price: '' });
  const [addingDrink, setAddingDrink] = useState(false);
  const [expandedDrinkId, setExpandedDrinkId] = useState(null);

  // New ingredient form
  const [newIng, setNewIng]       = useState({ name: '', unit: 'unid', cost_per_unit: '', ingredient_type: 'simple', correction_factor: '1.00', min_stock: '', max_stock: '', purchase_origin: '', weight_volume: '1.000' });
  const [addingIng, setAddingIng] = useState(false);
  const [showNewIngModal, setShowNewIngModal] = useState(false);

  // Edit ingredient inline
  const [editingIng, setEditingIng] = useState(null); // ingredient id

  // Price history panel: selected ingredient id
  const [selectedIngForHistory, setSelectedIngForHistory] = useState(null);

  // Upsell config editing state
  const [savingUpsellSlotIdx, setSavingUpsellSlotIdx] = useState(null); // idx do slot sendo salvo
  const blankUpsell = () => ({ enabled: false, product_id: null, offer_label: 'Aproveite e adicione:', show_image: true, custom_price: null, custom_image_url: null });
  const [upsellSlots, setUpsellSlots] = useState([blankUpsell(), blankUpsell(), blankUpsell()]);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogRes, extraRes] = await Promise.all([
        fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'get_data' }) }),
        fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'get_catalog_extra' }) }),
      ]);

      const catalog = await catalogRes.json();
      const extra   = await extraRes.json();

      setProducts(catalog.products || []);
      setDrinks(catalog.drinks || []);
      const rawSettings = catalog.settings || [];
      setSettings(rawSettings);

      // Initialize upsell slots from saved config
      const savedUpsell = rawSettings.find(s => s.key === 'upsell_config')?.value;
      if (savedUpsell) {
        try {
          const parsed = JSON.parse(savedUpsell);
          const blank = () => ({ enabled: false, product_id: null, offer_label: 'Aproveite e adicione:', show_image: true, custom_price: null, custom_image_url: null });
          const normalize = slot => ({ ...blank(), ...(slot || {}), product_id: slot?.product_id != null ? String(slot.product_id) : null });
          if (Array.isArray(parsed)) {
            setUpsellSlots([0, 1, 2].map(i => normalize(parsed[i])));
          } else {
            setUpsellSlots([normalize(parsed), blank(), blank()]);
          }
        } catch {}
      }

      setIngredients(extra.ingredients || []);
      setPriceHistory(extra.priceHistory || []);
      setCompoundItems(extra.compoundItems || []);

      // Build recipes map: { [productId]: [{ ingredient_id, quantity }] }
      const recipeMap = {};
      for (const item of (extra.recipes || [])) {
        if (!recipeMap[item.product_id]) recipeMap[item.product_id] = [];
        recipeMap[item.product_id].push({ ingredient_id: item.ingredient_id, quantity: item.quantity });
      }
      setRecipes(recipeMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  // Fetch stock movements when a stock panel opens (for chart)
  useEffect(() => {
    if (!stockPanelIngId || ingMovements[stockPanelIngId]) return;
    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'get_stock_movements', data: { ingredient_id: stockPanelIngId, limit: 30 } }),
    }).then(r => r.json()).then(d => {
      if (d.movements) {
        setIngMovements(prev => ({ ...prev, [stockPanelIngId]: d.movements.slice().reverse() }));
      }
    }).catch(() => {});
  }, [stockPanelIngId]);

  // ── Settings helpers ─────────────────────────────────────────────────────────

  function getSetting(key) {
    return settings.find(s => s.key === key)?.value || '';
  }

  function setSetting(key, value) {
    setSettings(prev => {
      const idx = prev.findIndex(s => s.key === key);
      if (idx >= 0) return prev.map((s, i) => i === idx ? { ...s, value } : s);
      return [...prev, { key, value }];
    });
  }

  async function saveSetting(key, value) {
    setSetting(key, value);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_setting', data: { key, value } }),
      });
    } catch (e) { console.error('Erro ao salvar configuração:', e); }
  }

  function getImagePositions() {
    try { return JSON.parse(getSetting('image_positions') || '{}'); } catch { return {}; }
  }

  function updateImagePosition(productId, x, y) {
    const curr = getImagePositions();
    setSetting('image_positions', JSON.stringify({ ...curr, [String(productId)]: { x, y } }));
  }

  function getStockLimits() {
    try { return JSON.parse(getSetting('stock_limits') || '{}'); } catch { return {}; }
  }

  function updateStockLimit(productId, field, value) {
    const curr = getStockLimits();
    const existing = curr[String(productId)] || { enabled: false, qty: 0, low_stock_threshold: 3 };
    const entry = { ...existing, [field]: value };
    setSetting('stock_limits', JSON.stringify({ ...curr, [String(productId)]: entry }));

    // Sincroniza is_active do produto com o estoque (igual ao comportamento das bebidas)
    if (field === 'qty' || field === 'enabled') {
      const isEnabled = field === 'enabled' ? value : existing.enabled;
      const qty = field === 'qty' ? value : existing.qty;
      const outOfStock = isEnabled && qty <= 0;
      setProducts(prev => prev.map(p => String(p.id) === String(productId) ? { ...p, is_active: !outOfStock } : p));
    }
  }

  function getDrinkStockLimits() {
    try { return JSON.parse(getSetting('drink_stock_limits') || '{}'); } catch { return {}; }
  }

  async function saveUpsellConfig(configs, slotIdx = null) {
    setUpsellSlots(configs);
    setSetting('upsell_config', JSON.stringify(configs));
    setSavingUpsellSlotIdx(slotIdx);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_setting', data: { key: 'upsell_config', value: JSON.stringify(configs) } }),
      });
      const d = await res.json();
      if (d.error) { setMsg('❌ ' + d.error); return; }
      setMsg('✅ Upsell salvo!');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('❌ Erro ao salvar upsell'); }
    finally { setSavingUpsellSlotIdx(null); }
  }

  function updateDrinkStockLimit(drinkId, field, value) {
    const curr = getDrinkStockLimits();
    const existing = curr[String(drinkId)] || { enabled: false, qty: 0 };
    const entry = { ...existing, [field]: value };
    setSetting('drink_stock_limits', JSON.stringify({ ...curr, [String(drinkId)]: entry }));

    if (field === 'qty' || field === 'enabled') {
      const outOfStock = (field === 'enabled' ? value : existing.enabled) && (field === 'qty' ? value <= 0 : existing.qty <= 0);
      setDrinks(prev => prev.map(d => String(d.id) === String(drinkId) ? { ...d, is_active: !outOfStock } : d));
    }
  }

  // ── CRUD helpers ─────────────────────────────────────────────────────────────

  function updateProduct(idx, field, value) {
    setProducts(prev => { const p = [...prev]; p[idx] = { ...p[idx], [field]: value }; return p; });
  }

  function updateDrink(idx, field, value) {
    setDrinks(prev => { const d = [...prev]; d[idx] = { ...d[idx], [field]: value }; return d; });
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function saveProduct(product) {
    if (!product) return;
    setSavingProductId(product.id);
    setMsg('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_all', data: { products: [product], settings } }),
      });
      const d = await res.json();
      if (d.error) { setMsg('❌ ' + d.error); return; }
      setMsg('✅ Produto salvo!');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('❌ Erro ao salvar produto'); }
    finally { setSavingProductId(null); }
  }

  async function saveDrink(drink) {
    if (!drink) return;
    setSavingDrinkId(drink.id);
    setMsg('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_all', data: { drinks: [drink], settings } }),
      });
      const d = await res.json();
      if (d.error) { setMsg('❌ ' + d.error); return; }
      setMsg('✅ Bebida salva!');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('❌ Erro ao salvar bebida'); }
    finally { setSavingDrinkId(null); }
  }

  // ── Image upload ─────────────────────────────────────────────────────────────

  async function handleImageUpload(productIdx, file) {
    const product = products[productIdx];
    if (!file || !product) return;
    setUploadingId(product.id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prefix', `product-${product.id}`);
      formData.append('saveAs', 'product_image');
      formData.append('productId', product.id);
      const res = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}` }, body: formData });
      const result = await res.json();
      if (!res.ok) { alert('Erro no upload: ' + result.error); return; }
      updateProduct(productIdx, 'image_url', result.url);
      alert('✅ Foto enviada!');
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setUploadingId(null); }
  }

  async function handleUpsellImageUpload(idx, file) {
    if (!file) return;
    setUploadingUpsellIdx(idx);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prefix', `upsell-${idx}`);
      const res = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}` }, body: formData });
      const result = await res.json();
      if (!res.ok) { setMsg('❌ Erro no upload: ' + result.error); return; }
      const next = upsellSlots.map((u, i) => i === idx ? { ...u, custom_image_url: result.url } : u);
      saveUpsellConfig(next);
    } catch (e) { setMsg('❌ Erro no upload: ' + e.message); }
    finally { setUploadingUpsellIdx(null); }
  }

  // ── Drinks ───────────────────────────────────────────────────────────────────

  async function handleAddDrink() {
    if (!newDrink.name || !newDrink.price) { alert('Nome e preço são obrigatórios'); return; }
    setAddingDrink(true);
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'add_drink', data: { name: newDrink.name, size: newDrink.size, price: parseFloat(newDrink.price), is_active: true } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.drink) {
        setDrinks(prev => [...prev, d.drink]);
        setExpandedDrinkId(d.drink.id);
      }
      setNewDrink({ name: '', size: '', price: '' });
      setShowNewDrink(false);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setAddingDrink(false); }
  }

  async function handleDeleteDrink(drinkId) {
    if (!confirm('Excluir esta bebida?')) return;
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'delete_drink', data: { id: drinkId } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setDrinks(prev => prev.filter(dr => dr.id !== drinkId));
    } catch (e) { alert('Erro: ' + e.message); }
  }

  // ── Ingredients ──────────────────────────────────────────────────────────────

  async function handleAddIngredient() {
    if (!newIng.name) { alert('Nome é obrigatório'); return; }
    setAddingIng(true);
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'save_ingredient', data: {
        name: newIng.name,
        unit: newIng.unit,
        cost_per_unit: parseFloat(newIng.cost_per_unit) || 0,
        ingredient_type: newIng.ingredient_type || 'simple',
        correction_factor: parseFloat(newIng.correction_factor) || 1.0,
        min_stock: parseFloat(newIng.min_stock) || 0,
        max_stock: parseFloat(newIng.max_stock) || 0,
        purchase_origin: newIng.purchase_origin || '',
        weight_volume: parseFloat(newIng.weight_volume) || 1.0,
      } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.ingredient) setIngredients(prev => [...prev, d.ingredient].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setNewIng({ name: '', unit: 'unid', cost_per_unit: '', ingredient_type: 'simple', correction_factor: '1.00', min_stock: '', max_stock: '', purchase_origin: '', weight_volume: '1.000' });
      setShowNewIngModal(false);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setAddingIng(false); }
  }

  async function handleUpdateIngredient(id, field, value) {
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  async function handleSaveIngredient(ingredient) {
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'save_ingredient', data: ingredient }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      // Update ingredient in state
      if (ingredient.id) {
        setIngredients(prev => prev.map(i => i.id === ingredient.id ? { ...i, ...ingredient } : i));
      }
      // Real-time chart update: add new history entry if price changed
      if (d.priceHistoryEntry) {
        setPriceHistory(prev => [...prev, d.priceHistoryEntry]);
      }
      setEditingIng(null);
    } catch (e) { alert('Erro: ' + e.message); }
  }

  async function handleSaveCompoundRecipe(compound_id, items, computedCost) {
    setSavingCompoundRecipe(true);
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'save_compound_recipe', data: { compound_id, items, computed_cost: computedCost } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      // Update local compoundItems state
      setCompoundItems(prev => {
        const filtered = prev.filter(c => c.compound_id !== compound_id);
        const newRows = items.map(i => ({ compound_id, ingredient_id: i.ingredient_id, quantity: i.quantity }));
        return [...filtered, ...newRows];
      });
      // Auto-update compound ingredient cost if computed
      if (computedCost > 0) {
        setIngredients(prev => prev.map(i => i.id === compound_id ? { ...i, cost_per_unit: computedCost } : i));
      }
      setMsg('✅ Receita composta salva!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setSavingCompoundRecipe(false); }
  }

  async function handleStockMovement(ingredient_id, isCompound = false) {
    if (!stockMovement.quantity) { alert('Quantidade é obrigatória'); return; }
    if (isCompound && !stockMovement.reason?.trim()) { alert('Justificativa é obrigatória para compostos'); return; }
    if (isCompound && !stockMovement.admin_password?.trim()) { alert('Senha do admin é obrigatória para compostos'); return; }
    setSavingStockMovement(true);
    try {
      const movType = isCompound ? 'adjustment' : stockMovement.type;
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'stock_movement', data: {
        ingredient_id,
        movement_type: movType,
        quantity: parseFloat(stockMovement.quantity),
        reason: stockMovement.reason,
        notes: stockMovement.notes,
        ...(isCompound ? { admin_password: stockMovement.admin_password } : {}),
      } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      // Update local ingredient stock
      setIngredients(prev => prev.map(i => i.id === ingredient_id ? { ...i, current_stock: d.new_stock } : i));
      setStockMovement({ type: 'in', quantity: '', reason: '', notes: '', admin_password: '' });
      setStockPanelIngId(null);
      setMsg('✅ Estoque atualizado!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setSavingStockMovement(false); }
  }

  async function handleDuplicateDrink(idx) {
    const drink = drinks[idx];
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'duplicate_drink', data: { id: drink.id } }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.drink) {
        setDrinks(prev => [...prev, d.drink]);
        setExpandedDrinkId(d.drink.id);
      }
    } catch (e) { alert('Erro: ' + e.message); }
  }

  async function handleAddProduct() {
    if (!newProduct.name.trim() || !newProduct.price) { alert('Nome e preço são obrigatórios'); return; }
    setAddingProduct(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'add_product', data: {
          name: newProduct.name.trim(),
          category: newProduct.category,
          price: parseFloat(newProduct.price),
          description: newProduct.description || null,
          is_active: true, is_hidden: false,
          sort_order: products.length + 1,
        }}),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.product) {
        setProducts(prev => [...prev, d.product]);
        setExpandedId(d.product.id);
      }
      setNewProduct({ name: '', category: 'pizza', price: '', description: '' });
      setShowNewProduct(false);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setAddingProduct(false); }
  }

  async function handleDuplicateProduct(idx) {
    const p = products[idx];
    setAddingProduct(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'add_product', data: {
          name: p.name + ' (cópia)',
          category: p.category || 'pizza',
          price: parseFloat(p.price) || 0,
          description: p.description || null,
          cost_price: parseFloat(p.cost_price) || null,
          image_url: p.image_url || null,
          is_active: false, is_hidden: false,
          sort_order: (p.sort_order || 0) + 1,
        }}),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.product) {
        setProducts(prev => [...prev, d.product]);
        // Copy recipe if exists
        if (recipes[p.id]?.length > 0) {
          await handleSaveRecipe(d.product.id, recipes[p.id]);
        }
        setExpandedId(d.product.id);
      }
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setAddingProduct(false); }
  }

  async function handleDeleteIngredient(id) {
    if (!confirm('Excluir este insumo? Isso removerá das fichas técnicas.')) return;
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'delete_ingredient', data: { id } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setIngredients(prev => prev.filter(i => i.id !== id));
      setRecipes(prev => {
        const next = { ...prev };
        for (const pid of Object.keys(next)) next[pid] = next[pid].filter(r => r.ingredient_id !== id);
        return next;
      });
    } catch (e) { alert('Erro: ' + e.message); }
  }

  // ── Recipes ───────────────────────────────────────────────────────────────────

  async function handleSaveRecipe(productId, items) {
    const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'save_recipe', data: { product_id: productId, items } }) });
    const d = await res.json();
    if (d.error) { alert('Erro ao salvar ficha: ' + d.error); throw new Error(d.error); }
    setRecipes(prev => ({ ...prev, [productId]: items }));
  }

  // ── Filtered products ─────────────────────────────────────────────────────────

  const filteredProducts = products.filter(p => catFilter === 'all' || catFilter === 'bebidas' ? true : (p.category || 'pizza') === catFilter);
  const showDrinks = catFilter === 'all' || catFilter === 'bebidas';

  const imagePositions   = getImagePositions();
  const stockLimits      = getStockLimits();
  const drinkStockLimits = getDrinkStockLimits();

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: C.muted, fontSize: 14 }}>Carregando catálogo...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Tab bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid ' + C.border, padding: '0 28px', display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
        {[
          { key: 'cardapio', icon: UtensilsCrossed, label: 'Cardápio' },
          { key: 'especial', icon: Star,            label: 'Especial do Mês' },
          { key: 'insumos',  icon: Package,         label: 'Insumos' },
          { key: 'analise',  icon: BarChart2,        label: 'Análise de Preço' },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '14px 18px',
              border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#111827' : C.muted,
              borderBottom: `2px solid ${tab === t.key ? '#F2A800' : 'transparent'}`,
              marginBottom: -1,
            }}>
              <Icon size={15} /> {t.label}
              {t.key === 'insumos' && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#F3F4F6', color: C.light, padding: '1px 6px', borderRadius: 9 }}>
                  {ingredients.length}
                </span>
              )}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        {msg && <span style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith('✅') ? '#059669' : '#EF4444', marginRight: 12 }}>{msg}</span>}
      </div>

      {/* ── ABA CARDÁPIO ─────────────────────────────────────────────────────── */}
      {tab === 'cardapio' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Category filter */}
          <div style={{ background: '#fff', borderBottom: '1px solid ' + C.border, padding: '10px 28px', display: 'flex', gap: 6, flexShrink: 0 }}>
            {FILTER_TABS.map(f => (
              <button key={f.key} onClick={() => setCatFilter(f.key)} style={{
                padding: '5px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: catFilter === f.key ? '#111827' : '#F3F4F6',
                color: catFilter === f.key ? '#fff' : C.muted,
              }}>{f.label}</button>
            ))}
          </div>

          <div style={{ padding: '24px 28px', paddingBottom: 80 }}>
            {/* Produtos */}
            {catFilter !== 'bebidas' && catFilter !== 'upsell' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <UtensilsCrossed size={16} color={C.gold} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Produtos ({filteredProducts.length})</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setShowNewProduct(v => !v)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6,
                    border: 'none', background: showNewProduct ? '#F3F4F6' : '#111827',
                    color: showNewProduct ? C.muted : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    <Plus size={13} /> Novo Produto
                  </button>
                </div>

                {/* Formulário novo produto */}
                {showNewProduct && (
                  <div style={{ background: '#FFFBEB', borderRadius: 8, border: '1px dashed #F2A800', padding: 16, marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 12 }}>Novo Produto</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Nome *</label>
                        <input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Pizza de Frango"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Categoria</label>
                        <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', background: '#fff', color: C.text }}>
                          {PROD_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Preço (R$) *</label>
                        <input type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} placeholder="0,00"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
                      </div>
                    </div>
                    <input value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} placeholder="Descrição (opcional)"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text, marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddProduct} disabled={addingProduct} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: addingProduct ? '#9CA3AF' : C.gold, color: '#000', fontSize: 13, fontWeight: 700, cursor: addingProduct ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {addingProduct ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                        {addingProduct ? 'Criando...' : 'Criar Produto'}
                      </button>
                      <button onClick={() => setShowNewProduct(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid ' + C.border, background: '#fff', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}

                {/* Blur backdrop when a product is being edited */}
                {expandedId !== null && (
                  <div
                    onClick={() => setExpandedId(null)}
                    style={{
                      position: 'fixed', inset: 0, zIndex: 1000,
                      backdropFilter: 'blur(3px)',
                      WebkitBackdropFilter: 'blur(3px)',
                      background: 'rgba(0,0,0,0.2)',
                    }}
                  />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {filteredProducts.map((p, idx) => (
                    <ProductRow
                      key={p.id}
                      product={p} idx={idx}
                      isExpanded={expandedId === p.id}
                      onToggleExpand={() => setExpandedId(prev => prev === p.id ? null : p.id)}
                      onDuplicate={handleDuplicateProduct}
                      onUpdate={updateProduct}
                      onUploadImage={handleImageUpload}
                      uploadingId={uploadingId}
                      imagePositions={imagePositions}
                      onUpdateImagePos={updateImagePosition}
                      stockLimits={stockLimits}
                      onUpdateStockLimit={updateStockLimit}
                      ingredients={ingredients}
                      recipe={recipes[p.id] || []}
                      onSaveRecipe={handleSaveRecipe}
                      onSave={saveProduct}
                      savingProductId={savingProductId}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Bebidas */}
            {showDrinks && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <GlassWater size={16} color={C.gold} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Bebidas ({drinks.length})</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setShowNewDrink(v => !v)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6,
                    border: 'none', background: showNewDrink ? '#F3F4F6' : '#111827',
                    color: showNewDrink ? C.muted : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    <Plus size={13} /> Nova Bebida
                  </button>
                </div>

                {/* Formulário nova bebida */}
                {showNewDrink && (
                  <div style={{ background: '#EFF6FF', borderRadius: 8, border: '1px dashed #6366F1', padding: 16, marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', marginBottom: 12 }}>Nova Bebida</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Nome/Marca *</label>
                        <input value={newDrink.name} onChange={e => setNewDrink(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Coca-Cola"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Tamanho</label>
                        <input value={newDrink.size} onChange={e => setNewDrink(p => ({ ...p, size: e.target.value }))} placeholder="Ex: 600ml"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Preço (R$) *</label>
                        <input type="number" step="0.01" value={newDrink.price} onChange={e => setNewDrink(p => ({ ...p, price: e.target.value }))} placeholder="0,00"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddDrink} disabled={addingDrink} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: addingDrink ? '#9CA3AF' : '#6366F1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: addingDrink ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {addingDrink ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                        {addingDrink ? 'Criando...' : 'Criar Bebida'}
                      </button>
                      <button onClick={() => setShowNewDrink(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid ' + C.border, background: '#fff', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {drinks.map((d, idx) => (
                    <DrinkRow
                      key={d.id}
                      drink={d} idx={idx}
                      isExpanded={expandedDrinkId === d.id}
                      onToggleExpand={() => setExpandedDrinkId(prev => prev === d.id ? null : d.id)}
                      onDuplicate={handleDuplicateDrink}
                      onUpdate={updateDrink}
                      onDelete={handleDeleteDrink}
                      drinkStockLimits={drinkStockLimits}
                      onUpdateDrinkStockLimit={updateDrinkStockLimit}
                      onSave={() => saveDrink(d)}
                      isSaving={savingDrinkId === d.id}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── UPSELL TAB ── */}
            {catFilter === 'upsell' && (() => {
              const allItems = [
                ...products.filter(p => p.is_active).map(p => ({ id: p.id, label: p.name, price: p.price, image_url: p.image_url, type: 'product' })),
                ...drinks.filter(d => d.is_active).map(d => ({ id: d.id, label: `${d.name}${d.size ? ` ${d.size}` : ''}`, price: d.price, image_url: null, type: 'drink' })),
              ];
              return (
                <div>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    <TrendingUp size={16} color={C.gold} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Upsell no Carrinho</span>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>— ofertas exibidas na gaveta do carrinho</span>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => {
                        const next = [...upsellSlots, blankUpsell()];
                        setUpsellSlots(next);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid ' + C.gold, background: 'rgba(242,168,0,0.08)', color: C.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Plus size={13} /> Adicionar Upsell
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {upsellSlots.map((upsell, idx) => {
                      const selectedItem = upsell.product_id != null ? (allItems.find(i => String(i.id) === String(upsell.product_id)) || null) : null;
                      const isSavingSlot = savingUpsellSlotIdx === idx;
                      return (
                        <div key={idx} style={{ background: C.card, borderRadius: 10, border: '1px solid ' + (upsell.enabled ? C.gold : C.border), padding: 16 }}>
                          {/* Slot header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, background: upsell.enabled ? C.gold : C.border, color: upsell.enabled ? '#000' : C.muted, borderRadius: 6, padding: '2px 8px' }}>
                              Upsell {idx + 1}
                            </span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: upsell.enabled ? C.success : C.muted }}>
                              <input
                                type="checkbox"
                                checked={!!upsell.enabled}
                                onChange={e => {
                                  const next = upsellSlots.map((u, i) => i === idx ? { ...u, enabled: e.target.checked } : u);
                                  setUpsellSlots(next);
                                }}
                                style={{ width: 15, height: 15, accentColor: C.gold, cursor: 'pointer' }}
                              />
                              {upsell.enabled ? 'Ativo' : 'Inativo'}
                            </label>
                            <div style={{ flex: 1 }} />
                            <button
                              onClick={() => {
                                const next = upsellSlots.filter((_, i) => i !== idx);
                                saveUpsellConfig(next, null);
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: C.danger }}
                            >
                              <Trash2 size={11} /> Remover
                            </button>
                          </div>

                          {/* Produto */}
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                              Produto a oferecer
                            </label>
                            <select
                              value={upsell.product_id != null ? String(upsell.product_id) : ''}
                              onChange={e => {
                                const next = upsellSlots.map((u, i) => i === idx ? { ...u, product_id: e.target.value || null } : u);
                                setUpsellSlots(next);
                              }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', background: '#fff', color: C.text }}
                            >
                              <option value="">Selecionar produto ou bebida...</option>
                              <optgroup label="Produtos">
                                {products.filter(p => p.is_active).map(p => (
                                  <option key={p.id} value={p.id}>{p.name} — R$ {fmtBRL(p.price)}</option>
                                ))}
                              </optgroup>
                              <optgroup label="Bebidas">
                                {drinks.filter(d => d.is_active).map(d => (
                                  <option key={d.id} value={d.id}>{d.name}{d.size ? ` ${d.size}` : ''} — R$ {fmtBRL(d.price)}</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

                          {/* Texto + Preço */}
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                Texto da oferta
                              </label>
                              <input
                                value={upsell.offer_label}
                                onChange={e => {
                                  const next = upsellSlots.map((u, i) => i === idx ? { ...u, offer_label: e.target.value } : u);
                                  setUpsellSlots(next);
                                }}
                                placeholder="Ex: Aproveite e adicione:"
                                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                Preço especial (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={upsell.custom_price ?? ''}
                                onChange={e => {
                                  const next = upsellSlots.map((u, i) => i === idx ? { ...u, custom_price: e.target.value ? parseFloat(e.target.value) : null } : u);
                                  setUpsellSlots(next);
                                }}
                                placeholder={selectedItem ? fmtBRL(selectedItem.price).replace('R$\u00a0', '') : '0,00'}
                                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }}
                              />
                              <p style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>Vazio = preço original</p>
                            </div>
                          </div>

                          {/* Foto personalizada — upload */}
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                              Foto personalizada
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <label
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 6, border: '1px solid ' + C.border, background: '#fff', fontSize: 12, fontWeight: 600, cursor: uploadingUpsellIdx === idx ? 'not-allowed' : 'pointer', color: C.text, opacity: uploadingUpsellIdx === idx ? 0.6 : 1, pointerEvents: uploadingUpsellIdx === idx ? 'none' : 'auto' }}
                              >
                                {uploadingUpsellIdx === idx
                                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
                                  : <><Upload size={12} /> Fazer upload</>}
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleUpsellImageUpload(idx, e.target.files[0]); e.target.value = ''; }} disabled={uploadingUpsellIdx === idx} />
                              </label>
                              {upsell.custom_image_url ? (
                                <>
                                  <img src={upsell.custom_image_url} alt="" onError={e => { e.target.style.display = 'none'; }} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid ' + C.border, flexShrink: 0 }} />
                                  <button
                                    onClick={() => { const next = upsellSlots.map((u, i) => i === idx ? { ...u, custom_image_url: null } : u); setUpsellSlots(next); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: C.danger }}
                                  >
                                    <Trash2 size={11} /> Remover foto
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: 11, color: C.muted }}>Sem foto — usará a foto do produto</span>
                              )}
                            </div>
                          </div>

                          {/* Mostrar foto */}
                          <div style={{ marginBottom: selectedItem ? 14 : 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text, fontWeight: 500 }}>
                              <input
                                type="checkbox"
                                checked={!!upsell.show_image}
                                onChange={e => {
                                  const next = upsellSlots.map((u, i) => i === idx ? { ...u, show_image: e.target.checked } : u);
                                  setUpsellSlots(next);
                                }}
                                style={{ width: 15, height: 15, accentColor: C.gold, cursor: 'pointer' }}
                              />
                              Mostrar foto no carrinho
                            </label>
                          </div>

                          {/* Preview */}
                          {selectedItem && (
                            <div style={{ background: '#F8F9FA', borderRadius: 8, padding: 12, border: '1px solid ' + C.border, marginBottom: 12 }}>
                              <p style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Prévia</p>
                              <div style={{ background: 'rgba(242,168,0,0.06)', border: '1px solid rgba(242,168,0,0.25)', borderRadius: 10, padding: 10 }}>
                                <p style={{ fontSize: 10, fontWeight: 800, color: C.gold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
                                  ✦ {upsell.offer_label || 'Aproveite e adicione:'}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {upsell.show_image && (upsell.custom_image_url || selectedItem.image_url) && (
                                    <img src={upsell.custom_image_url || selectedItem.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                                  )}
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{selectedItem.label}</p>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>
                                      {fmtBRL(upsell.custom_price && upsell.custom_price > 0 ? upsell.custom_price : selectedItem.price)}
                                    </p>
                                    <div style={{ marginTop: 4, background: C.gold, color: '#000', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 800 }}>
                                      + Adicionar
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Botão Salvar individual */}
                          <button
                            onClick={() => saveUpsellConfig(upsellSlots, idx)}
                            disabled={isSavingSlot}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 6, border: 'none', background: isSavingSlot ? '#9CA3AF' : '#111827', color: '#fff', fontSize: 13, fontWeight: 700, cursor: isSavingSlot ? 'not-allowed' : 'pointer' }}
                          >
                            {isSavingSlot ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Save size={13} /> Salvar Upsell {idx + 1}</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {upsellSlots.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 13 }}>
                      Nenhum upsell configurado. Clique em "Adicionar Upsell" para criar.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── ABA INSUMOS ──────────────────────────────────────────────────────── */}
      {tab === 'insumos' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', position: 'relative' }}>
          {/* Blur backdrop when any ingredient panel is open */}
          {(stockPanelIngId || compoundPanelIngId || editingIng || selectedIngForHistory) && (
            <div
              onClick={() => { setStockPanelIngId(null); setCompoundPanelIngId(null); setEditingIng(null); setSelectedIngForHistory(null); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, cursor: 'pointer' }}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 13, color: C.muted }}>
              Insumos são matérias-primas utilizadas nas fichas técnicas dos produtos para calcular custo e margem automaticamente.
            </p>
            <button
              onClick={() => setShowNewIngModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: C.gold, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <Plus size={14} /> Novo Insumo
            </button>
          </div>

          {/* Lista de ingredientes */}
          <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, overflow: 'hidden', marginBottom: 20 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 100px 180px', gap: 0, background: '#F9FAFB', borderBottom: '1px solid ' + C.border, padding: '10px 16px' }}>
              {['Insumo', 'Unidade', 'Custo/Unid.', 'Variação', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
              ))}
            </div>

            {ingredients.length === 0 ? (
              <p style={{ padding: 20, fontSize: 13, color: C.light, textAlign: 'center' }}>Nenhum insumo cadastrado. Adicione abaixo.</p>
            ) : (
              ingredients.map(ing => {
                const isEditing = editingIng === ing.id;
                const isStockOpen = stockPanelIngId === ing.id;
                const isCompoundOpen = compoundPanelIngId === ing.id;
                // Price variation % from first recorded history to current
                const history = priceHistory
                  .filter(h => h.ingredient_id === ing.id)
                  .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
                const firstPrice = history.length > 0 ? (parseFloat(history[0].old_price) || parseFloat(history[0].new_price)) : null;
                const currentPrice = parseFloat(ing.cost_per_unit);
                const variation = firstPrice && firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice * 100) : null;

                // Stock status
                const curStock = parseFloat(ing.current_stock) || 0;
                const minStock = parseFloat(ing.min_stock) || 0;
                const maxStock = parseFloat(ing.max_stock) || 0;
                const stockConfigured = minStock > 0 || maxStock > 0;
                const stockColor = !stockConfigured ? C.light : curStock <= minStock ? C.danger : C.success;

                // Compound items for this ingredient
                const ingCompoundItems = compoundItems.filter(c => c.compound_id === ing.id);

                // Is compound type
                const isCompound = ing.ingredient_type === 'compound';

                // Correction factor display
                const cf = parseFloat(ing.correction_factor) || 1.0;

                const hasAnyPanelOpen = isStockOpen || isCompoundOpen || selectedIngForHistory === ing.id;

                // Border color per active mode
                const activeBorderColor = isEditing ? '#111827' : isStockOpen ? '#10B981' : isCompoundOpen ? '#7C3AED' : selectedIngForHistory === ing.id ? '#2563EB' : null;

                return (
                  <div key={ing.id} style={activeBorderColor ? {
                    border: `2px solid ${activeBorderColor}`,
                    borderRadius: 8,
                    margin: '4px 8px',
                    boxShadow: `0 0 0 3px ${activeBorderColor}22`,
                    overflow: 'hidden',
                    position: 'relative',
                    zIndex: 51,
                  } : {}}>
                    {/* Main row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 100px 180px', gap: 0, borderBottom: (hasAnyPanelOpen || isEditing) ? '1px solid ' + (activeBorderColor ? activeBorderColor + '40' : C.border) : '1px solid ' + C.border, padding: '10px 16px', alignItems: 'center', background: activeBorderColor ? activeBorderColor + '08' : 'transparent' }}>
                      {isEditing ? (
                        /* ── EDIT MODE ── */
                        <div style={{ gridColumn: '1 / -1' }}>
                          {/* Row 1: Name, Unit, Cost */}
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 90px 130px', gap: 8, marginBottom: 8 }}>
                            <input value={ing.name} onChange={e => handleUpdateIngredient(ing.id, 'name', e.target.value)} placeholder="Nome" style={{ padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 13, outline: 'none' }} />
                            <select value={ing.unit} onChange={e => handleUpdateIngredient(ing.id, 'unit', e.target.value)} style={{ padding: '5px 6px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none' }}>
                              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <input type="number" value={ing.cost_per_unit} min="0" step="0.0001" onChange={e => handleUpdateIngredient(ing.id, 'cost_per_unit', e.target.value)} placeholder="Custo/unid" style={{ padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', textAlign: 'right' }} />
                          </div>
                          {/* Row 2: Type, Correction Factor, Weight/Volume */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 2 }}>Tipo</label>
                              <select value={ing.ingredient_type || 'simple'} onChange={e => handleUpdateIngredient(ing.id, 'ingredient_type', e.target.value)} style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none' }}>
                                <option value="simple">Simples</option>
                                <option value="compound">Composto</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 2 }}>Fator de Correção (%)</label>
                              <input type="number" value={Math.round((parseFloat(ing.correction_factor) || 1) * 100)} min="1" max="200" step="1" onChange={e => handleUpdateIngredient(ing.id, 'correction_factor', (parseFloat(e.target.value) || 100) / 100)} placeholder="100" style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 2 }}>Peso/Volume (rendimento)</label>
                              <input type="number" value={ing.weight_volume || 1} min="0" step="0.001" onChange={e => handleUpdateIngredient(ing.id, 'weight_volume', e.target.value)} placeholder="1.000" style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          {/* Row 3: Stock min/max, purchase origin */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8, marginBottom: 10 }}>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 2 }}>Estoque Mín.</label>
                              <input type="number" value={ing.min_stock || ''} min="0" step="0.001" onChange={e => handleUpdateIngredient(ing.id, 'min_stock', e.target.value)} placeholder="0" style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 2 }}>Estoque Máx.</label>
                              <input type="number" value={ing.max_stock || ''} min="0" step="0.001" onChange={e => handleUpdateIngredient(ing.id, 'max_stock', e.target.value)} placeholder="0" style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 2 }}>Origem de Compra</label>
                              <input value={ing.purchase_origin || ''} onChange={e => handleUpdateIngredient(ing.id, 'purchase_origin', e.target.value)} placeholder="Fornecedor / loja" style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleSaveIngredient(ing)} style={{ padding: '5px 14px', borderRadius: 4, border: 'none', background: '#111827', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Salvar</button>
                            <button onClick={() => setEditingIng(null)} style={{ padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, background: '#fff', color: C.text, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        /* ── VIEW MODE ── */
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ing.name}</span>
                              {isCompound ? (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Layers size={9} /> Composto
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#F3F4F6', color: C.muted }}>Simples</span>
                              )}
                              {cf !== 1.0 && <span style={{ fontSize: 10, color: C.muted }}>FC: {Math.round(cf * 100)}%</span>}
                            </div>
                            {stockConfigured && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Warehouse size={10} color={stockColor} />
                                <span style={{ fontSize: 10, color: stockColor, fontWeight: 600 }}>
                                  {curStock.toFixed(2)} {ing.unit}
                                  {minStock > 0 && <span style={{ color: C.light }}> / mín {minStock}</span>}
                                </span>
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 12, color: C.muted }}>{ing.unit}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#059669', textAlign: 'right' }}>{fmtBRL(ing.cost_per_unit)}</span>
                          <div style={{ textAlign: 'right' }}>
                            {variation !== null ? (
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                                background: variation > 0 ? '#FEF2F2' : variation < 0 ? '#ECFDF5' : '#F3F4F6',
                                color: variation > 0 ? C.danger : variation < 0 ? '#059669' : C.muted,
                              }}>
                                {variation > 0 ? '▲' : variation < 0 ? '▼' : '—'} {Math.abs(variation).toFixed(1)}%
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: C.light }}>—</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => { setStockPanelIngId(isStockOpen ? null : ing.id); setCompoundPanelIngId(null); setSelectedIngForHistory(null); setStockMovement({ type: 'in', quantity: '', reason: '', notes: '' }); }}
                              title="Gerenciar estoque"
                              style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid ' + C.border, background: isStockOpen ? '#ECFDF5' : '#fff', fontSize: 11, cursor: 'pointer', color: isStockOpen ? C.success : C.muted, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
                              <ArrowDownUp size={11} /> Estoque
                            </button>
                            {isCompound && (
                              <button
                                onClick={() => { setCompoundPanelIngId(isCompoundOpen ? null : ing.id); setStockPanelIngId(null); setSelectedIngForHistory(null); }}
                                title="Receita do composto"
                                style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid ' + C.border, background: isCompoundOpen ? '#EDE9FE' : '#fff', fontSize: 11, cursor: 'pointer', color: isCompoundOpen ? '#7C3AED' : C.muted, display: 'flex', alignItems: 'center', gap: 3 }}
                              >
                                <Layers size={11} /> Receita
                              </button>
                            )}
                            <button
                              onClick={() => { setSelectedIngForHistory(selectedIngForHistory === ing.id ? null : ing.id); setStockPanelIngId(null); setCompoundPanelIngId(null); }}
                              title="Histórico de preço"
                              style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid ' + C.border, background: selectedIngForHistory === ing.id ? '#EFF6FF' : '#fff', fontSize: 11, cursor: 'pointer', color: selectedIngForHistory === ing.id ? '#2563EB' : C.muted, display: 'flex', alignItems: 'center' }}
                            >
                              <BarChart2 size={13} />
                            </button>
                            <button onClick={() => { setEditingIng(ing.id); setStockPanelIngId(null); setCompoundPanelIngId(null); setSelectedIngForHistory(null); }} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid ' + C.border, background: '#fff', fontSize: 11, cursor: 'pointer', color: C.muted }}>Editar</button>
                            <button onClick={() => handleDeleteIngredient(ing.id)} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', fontSize: 11, cursor: 'pointer', color: C.danger }}>✕</button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* ── Stock movement panel ── */}
                    {isStockOpen && !isEditing && (
                      <div style={{ borderBottom: '1px solid ' + C.border, background: '#F0FDF4', padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Warehouse size={13} color={C.success} /> Estoque — {ing.name}
                          </p>
                          <button onClick={() => setStockPanelIngId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, lineHeight: 1 }}>×</button>
                        </div>
                        {/* Stock status */}
                        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                          <div style={{ background: stockConfigured ? (curStock <= minStock ? '#FEF2F2' : '#ECFDF5') : '#F3F4F6', borderRadius: 6, padding: '8px 14px', flex: 1, minWidth: 90 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 2 }}>ESTOQUE ATUAL</p>
                            <p style={{ fontSize: 16, fontWeight: 800, color: stockColor }}>{curStock.toFixed(3)} {ing.unit}</p>
                          </div>
                          {stockConfigured && (
                            <>
                              <div style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 14px', flex: 1, minWidth: 90 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 2 }}>MÍNIMO</p>
                                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{minStock.toFixed(3)} {ing.unit}</p>
                              </div>
                              <div style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 14px', flex: 1, minWidth: 90 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 2 }}>MÁXIMO</p>
                                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{maxStock.toFixed(3)} {ing.unit}</p>
                              </div>
                            </>
                          )}
                        </div>
                        {/* Mini stock history chart */}
                        {(() => {
                          const mvs = ingMovements[ing.id];
                          if (!mvs || mvs.length === 0) return null;
                          const maxQty = Math.max(...mvs.map(m => Math.abs(parseFloat(m.quantity) || 0)), 0.001);
                          return (
                            <div style={{ marginBottom: 12 }}>
                              <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Histórico de movimentações (últimas {mvs.length})</p>
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48, background: '#F9FAFB', borderRadius: 6, padding: '6px 8px', overflow: 'hidden' }}>
                                {mvs.map((m, idx) => {
                                  const qty = Math.abs(parseFloat(m.quantity) || 0);
                                  const pct = qty / maxQty;
                                  const color = m.movement_type === 'in' ? '#10B981' : m.movement_type === 'out' ? '#EF4444' : '#F59E0B';
                                  return (
                                    <div key={m.id || idx} title={`${m.movement_type}: ${qty} ${ing.unit}\n${m.reason || ''}`} style={{ flex: 1, minWidth: 4, background: color, borderRadius: 2, height: Math.max(4, pct * 36) + 'px', alignSelf: 'flex-end', opacity: 0.85, cursor: 'default', transition: 'height 0.2s' }} />
                                  );
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                {[['#10B981', 'Entrada'], ['#EF4444', 'Saída'], ['#F59E0B', 'Ajuste']].map(([color, label]) => (
                                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.muted }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />{label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Movement form */}
                        {isCompound && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 10px', background: '#FEF3C7', borderRadius: 6, border: '1px solid #FDE68A' }}>
                            <span style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>
                              Compostos: somente ajuste de estoque. Requer justificativa e senha do admin.
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: isCompound ? '100px 1fr' : '120px 100px 1fr', gap: 8, marginBottom: 8 }}>
                          {!isCompound && (
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Tipo</label>
                              <select value={stockMovement.type} onChange={e => setStockMovement(p => ({ ...p, type: e.target.value }))} style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', background: '#fff' }}>
                                <option value="in">Entrada</option>
                                <option value="out">Saída</option>
                                <option value="adjustment">Ajuste</option>
                              </select>
                            </div>
                          )}
                          <div>
                            <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>
                              {isCompound ? 'Novo Estoque' : 'Quantidade'}
                            </label>
                            <input type="number" min="0" step="0.001" value={stockMovement.quantity} onChange={e => setStockMovement(p => ({ ...p, quantity: e.target.value }))} placeholder="0.000" style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>
                              {isCompound ? 'Justificativa *' : 'Motivo'}
                            </label>
                            <input value={stockMovement.reason} onChange={e => setStockMovement(p => ({ ...p, reason: e.target.value }))} placeholder={isCompound ? 'Motivo do ajuste (obrigatório)...' : 'Compra, perda, inventário...'} style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                        {isCompound ? (
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Senha do Admin *</label>
                            <input type="password" value={stockMovement.admin_password || ''} onChange={e => setStockMovement(p => ({ ...p, admin_password: e.target.value }))} placeholder="Digite a senha do admin..." style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        ) : (
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Observações</label>
                            <input value={stockMovement.notes} onChange={e => setStockMovement(p => ({ ...p, notes: e.target.value }))} placeholder="Observações opcionais..." style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        )}
                        <button
                          onClick={() => handleStockMovement(ing.id, isCompound)}
                          disabled={savingStockMovement}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 5, border: 'none', background: savingStockMovement ? '#9CA3AF' : C.success, color: '#fff', fontSize: 12, fontWeight: 700, cursor: savingStockMovement ? 'not-allowed' : 'pointer' }}
                        >
                          {savingStockMovement ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                          {savingStockMovement ? 'Salvando...' : 'Registrar Movimentação'}
                        </button>
                      </div>
                    )}

                    {/* ── Compound recipe panel ── */}
                    {isCompoundOpen && !isEditing && (
                      <CompoundRecipePanel
                        ingredient={ing}
                        ingredients={ingredients}
                        adminToken={adminToken}
                        onClose={() => setCompoundPanelIngId(null)}
                        onIngredientCreated={newIng => setIngredients(prev => [...prev, newIng].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))}
                        onRecipeApplied={(ingId, newStock) => setIngredients(prev => prev.map(i => i.id === ingId ? { ...i, current_stock: newStock } : i))}
                      />
                    )}

                    {/* ── Inline price history panel ── */}
                    {selectedIngForHistory === ing.id && !isEditing && (() => {
                      const chartPoints = [];
                      if (history.length > 0) {
                        const beforeFirst = new Date(history[0].changed_at);
                        beforeFirst.setDate(beforeFirst.getDate() - 1);
                        chartPoints.push({ date: beforeFirst.toISOString(), price: parseFloat(history[0].old_price) || 0 });
                        for (const h of history) chartPoints.push({ date: h.changed_at, price: parseFloat(h.new_price) });
                      }
                      chartPoints.push({ date: new Date().toISOString(), price: parseFloat(ing.cost_per_unit) || 0, isCurrent: true });
                      return (
                        <div style={{ borderBottom: '1px solid ' + C.border, background: '#F8FAFC', padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Histórico de preço — {ing.name}</p>
                            <button onClick={() => setSelectedIngForHistory(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, lineHeight: 1 }}>×</button>
                          </div>
                          {chartPoints.length < 2 ? (
                            <p style={{ fontSize: 12, color: C.light, padding: '8px 0' }}>Sem histórico. Altere o custo para começar a registrar.</p>
                          ) : (
                            <>
                              <PriceLineChart points={chartPoints} />
                              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 100, overflowY: 'auto' }}>
                                {[...history].reverse().map((h, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}>
                                    <span>{new Date(h.changed_at).toLocaleDateString('pt-BR')}</span>
                                    <span>{fmtBRL(h.old_price)} → <strong style={{ color: parseFloat(h.new_price) > parseFloat(h.old_price) ? C.danger : '#059669' }}>{fmtBRL(h.new_price)}</strong></span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>

          {/* Modal: Novo Insumo */}
          {showNewIngModal && (
            <div
              onClick={e => { if (e.target === e.currentTarget) setShowNewIngModal(false); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            >
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ color: C.gold, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, margin: 0 }}>
                    <Plus size={18} color={C.gold} /> Novo Insumo
                  </h3>
                  <button onClick={() => setShowNewIngModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Nome do insumo *</label>
                    <input className="input-field" placeholder="ex: Farinha de trigo" value={newIng.name} onChange={e => setNewIng(p => ({ ...p, name: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Unidade</label>
                    <select value={newIng.unit} onChange={e => setNewIng(p => ({ ...p, unit: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', background: '#F9FAFB', color: C.text }}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Custo por unid. (R$)</label>
                    <input className="input-field" type="number" min="0" step="0.0001" placeholder="0,00" value={newIng.cost_per_unit} onChange={e => setNewIng(p => ({ ...p, cost_per_unit: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Tipo</label>
                    <select value={newIng.ingredient_type} onChange={e => setNewIng(p => ({ ...p, ingredient_type: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', background: '#F9FAFB', color: C.text }}>
                      <option value="simple">Simples</option>
                      <option value="compound">Composto</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Fator de Correção (%)</label>
                    <input className="input-field" type="number" min="1" max="200" step="1" placeholder="100" value={Math.round((parseFloat(newIng.correction_factor) || 1) * 100)} onChange={e => setNewIng(p => ({ ...p, correction_factor: (parseFloat(e.target.value) || 100) / 100 }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Peso/Volume (rendimento)</label>
                    <input className="input-field" type="number" min="0" step="0.001" placeholder="1.000" value={newIng.weight_volume} onChange={e => setNewIng(p => ({ ...p, weight_volume: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginBottom: 20 }}>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Estoque Mínimo</label>
                    <input className="input-field" type="number" min="0" step="0.001" placeholder="0" value={newIng.min_stock} onChange={e => setNewIng(p => ({ ...p, min_stock: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Estoque Máximo</label>
                    <input className="input-field" type="number" min="0" step="0.001" placeholder="0" value={newIng.max_stock} onChange={e => setNewIng(p => ({ ...p, max_stock: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Origem de Compra</label>
                    <input className="input-field" placeholder="Fornecedor / loja" value={newIng.purchase_origin} onChange={e => setNewIng(p => ({ ...p, purchase_origin: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleAddIngredient} disabled={addingIng} style={{ padding: '10px 20px', background: C.gold, color: '#000', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: addingIng ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {addingIng ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                    {addingIng ? 'Adicionando...' : 'Adicionar Insumo'}
                  </button>
                  <button onClick={() => setShowNewIngModal(false)} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid ' + C.border, background: '#fff', color: C.text, fontSize: 13, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA ESPECIAL DO MÊS ──────────────────────────────────────────────── */}
      {tab === 'especial' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Star size={20} color={C.gold} />
            <p style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Especial do Mês</p>
          </div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
            Configure o sabor especial que aparece como destaque no cardápio. Esse conteúdo é exibido automaticamente no site.
          </p>

          {/* Toggle ativo/inativo */}
          {(() => {
            const enabled = getSetting('special_flavor_enabled') !== 'false';
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.card, borderRadius: 12, border: '1px solid ' + C.border, padding: '14px 20px', maxWidth: 600, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Exibir no cardápio</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
                    {enabled ? 'O especial do mês está visível para os clientes.' : 'O especial do mês está oculto do cardápio.'}
                  </p>
                </div>
                <button
                  onClick={() => saveSetting('special_flavor_enabled', enabled ? 'false' : 'true')}
                  style={{
                    width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                    background: enabled ? C.gold : '#D1D5DB',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: enabled ? 25 : 3,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            );
          })()}

          <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, padding: 24, maxWidth: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: 'rgba(242,168,0,0.08)', borderRadius: 8, border: '1px solid rgba(242,168,0,0.2)' }}>
              <Star size={14} color={C.gold} />
              <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                Este sabor substitui automaticamente a descrição do produto "Especial do Mês" no cardápio.
              </span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Nome do Sabor *
              </label>
              <input
                className="input-field"
                placeholder="ex: Quatro Queijos Trufada"
                value={getSetting('special_flavor_name')}
                onChange={e => setSetting('special_flavor_name', e.target.value)}
                style={{ background: '#F9FAFB', color: C.text, borderColor: C.border, fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Descrição
              </label>
              <textarea
                className="input-field"
                placeholder="Descreva os ingredientes, diferenciais do sabor..."
                value={getSetting('special_flavor_description')}
                onChange={e => setSetting('special_flavor_description', e.target.value)}
                rows={4}
                style={{ resize: 'vertical', background: '#F9FAFB', color: C.text, borderColor: C.border, fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>

            <SpecialFlavorSaveButton
              name={getSetting('special_flavor_name')}
              description={getSetting('special_flavor_description')}
              onSave={saveSetting}
            />

            {/* Preview */}
            {getSetting('special_flavor_name') && (
              <div style={{ marginTop: 20, padding: 16, background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Prévia do Cardápio</p>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg,#F2A800,#EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Star size={18} color="#fff" />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>
                      Especial do Mês — {getSetting('special_flavor_name')}
                    </p>
                    {getSetting('special_flavor_description') && (
                      <p style={{ fontSize: 12, color: C.muted }}>{getSetting('special_flavor_description')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA ANÁLISE DE PREÇO ─────────────────────────────────────────────── */}
      {tab === 'analise' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 6 }}>Análise de Preço</p>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
            Variação histórica de custo dos insumos. Os preços são registrados automaticamente ao salvar um insumo com novo valor.
          </p>

          {ingredients.length === 0 ? (
            <p style={{ fontSize: 13, color: C.light, textAlign: 'center', padding: 40 }}>Nenhum insumo cadastrado.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20 }}>
              {ingredients.map(ing => {
                const history = priceHistory
                  .filter(h => h.ingredient_id === ing.id)
                  .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));

                // Build chart points: initial old_price → each change → current
                const chartPoints = [];
                if (history.length > 0) {
                  // Starting price: old_price of the first recorded change (one day before)
                  const beforeFirst = new Date(history[0].changed_at);
                  beforeFirst.setDate(beforeFirst.getDate() - 1);
                  chartPoints.push({ date: beforeFirst.toISOString(), price: parseFloat(history[0].old_price) || 0 });
                  for (const h of history) {
                    chartPoints.push({ date: h.changed_at, price: parseFloat(h.new_price) });
                  }
                }
                chartPoints.push({ date: new Date().toISOString(), price: parseFloat(ing.cost_per_unit) || 0, isCurrent: true });
                const points = chartPoints;

                return (
                  <div key={ing.id} style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ing.name}</p>
                        <p style={{ fontSize: 11, color: C.muted }}>{ing.unit} · Atual: {fmtBRL(ing.cost_per_unit)}</p>
                      </div>
                      {history.length > 0 && (() => {
                        const first = parseFloat(history[0].old_price) || parseFloat(history[0].new_price);
                        const current = parseFloat(ing.cost_per_unit);
                        const pct = first > 0 ? ((current - first) / first * 100) : 0;
                        return (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: pct > 0 ? '#FEF2F2' : '#ECFDF5', color: pct > 0 ? C.danger : C.success }}>
                            {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
                          </span>
                        );
                      })()}
                    </div>

                    {points.length < 2 ? (
                      <p style={{ fontSize: 12, color: C.light, textAlign: 'center', padding: '16px 0' }}>
                        Sem histórico de variação. Altere o custo do insumo para começar a registrar.
                      </p>
                    ) : (
                      <PriceLineChart points={points} />
                    )}

                    {history.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ fontSize: 10, color: C.light, fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>Histórico</p>
                        <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {[...history].reverse().map((h, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}>
                              <span>{new Date(h.changed_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              <span>{fmtBRL(h.old_price)} → <strong style={{ color: C.text }}>{fmtBRL(h.new_price)}</strong></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
