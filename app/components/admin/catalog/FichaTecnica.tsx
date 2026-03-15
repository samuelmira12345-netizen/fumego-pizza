'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Check, Loader2, X } from 'lucide-react';
import { costWithFC } from '@/lib/correction-factor';
import { C, fmtBRL, toBaseQty, getUnitOptions } from './catalogUtils';

export default function FichaTecnica({ productId, productPrice, ingredients, recipe, onSave }: { productId: any, productPrice: any, ingredients: any, recipe: any, onSave: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [addIng, setAddIng] = useState('');
  const [addQty, setAddQty] = useState('');
  const [addUnit, setAddUnit] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(recipe || []); }, [recipe]);

  const enriched = items.map((i: any) => {
    const ing = ingredients.find((g: any) => g.id === i.ingredient_id);
    return { ...i, name: ing?.name, unit: ing?.unit, cost_per_unit: costWithFC(parseFloat(ing?.cost_per_unit) || 0, ing?.correction_factor) };
  });

  const calcCost = enriched.reduce((s, i) => {
    const baseQty = toBaseQty(i.quantity, i.recipe_unit, i.unit);
    return s + baseQty * i.cost_per_unit;
  }, 0);
  const price = parseFloat(productPrice) || 0;
  const margin = price > 0 && calcCost > 0 ? ((price - calcCost) / price * 100) : null;

  const availableIngs = ingredients.filter((g: any) => !items.find((i: any) => i.ingredient_id === g.id));

  function addItem() {
    if (!addIng || !addQty) return;
    const ing = ingredients.find((g: any) => g.id === addIng);
    const recipeUnit = addUnit || ing?.unit || '';
    setItems(prev => [...prev, { ingredient_id: addIng, quantity: parseFloat(addQty), recipe_unit: recipeUnit }]);
    setAddIng(''); setAddQty(''); setAddUnit('');
  }

  function removeItem(ingredient_id: any) {
    setItems(prev => prev.filter((i: any) => i.ingredient_id !== ingredient_id));
  }

  function updateQty(ingredient_id: any, qty: any) {
    setItems(prev => prev.map((i: any) => i.ingredient_id === ingredient_id ? { ...i, quantity: qty } : i));
  }

  function updateRecipeUnit(ingredient_id: any, unit: any) {
    setItems(prev => prev.map((i: any) => i.ingredient_id === ingredient_id ? { ...i, recipe_unit: unit } : i));
  }

  async function save() {
    setSaving(true);
    try { await onSave(productId, items); } finally { setSaving(false); }
  }

  const cmv = price > 0 && calcCost > 0 ? (calcCost / price * 100) : null;
  const lucro = price > 0 ? price - calcCost : null;

  function handleAddIngChange(ingId: any) {
    setAddIng(ingId);
    const ing = ingredients.find((g: any) => g.id === ingId);
    setAddUnit(ing?.unit || '');
  }

  return (
    <div style={{ marginTop: 12, padding: '16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E0E7EF' }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: C.light, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Ficha Técnica
      </p>

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

      {availableIngs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={addIng} onChange={e => handleAddIngChange(e.target.value)}
            style={{ flex: 1, minWidth: 160, padding: '5px 8px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none', background: '#fff' }}>
            <option value="">Selecionar insumo...</option>
            {availableIngs.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>)}
          </select>
          <input type="number" value={addQty} min="0" step="0.001" onChange={e => setAddQty(e.target.value)} placeholder="Qtd"
            style={{ width: 70, padding: '5px 6px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none' }} />
          {addIng && (() => {
            const ing = ingredients.find((g: any) => g.id === addIng);
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
