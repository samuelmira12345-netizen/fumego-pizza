'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed, GlassWater, Package, Upload, Loader2, Trash2,
  Plus, Check, ChevronDown, ChevronUp, Save, RefreshCw,
  DollarSign, TrendingDown, BookOpen, X, Eye, EyeOff, Copy,
  BarChart2, TrendingUp,
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
];

const UNITS = ['unid', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz', 'ft'];

const C = {
  bg: '#F4F5F7', card: '#fff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  gold: '#F2A800', success: '#10B981', danger: '#EF4444',
};

function fmtBRL(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Ficha Técnica Panel ───────────────────────────────────────────────────────

function FichaTecnica({ productId, productPrice, ingredients, recipe, onSave }) {
  const [items, setItems] = useState([]);
  const [addIng, setAddIng] = useState('');
  const [addQty, setAddQty] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(recipe || []); }, [recipe]);

  const enriched = items.map(i => {
    const ing = ingredients.find(g => g.id === i.ingredient_id);
    return { ...i, name: ing?.name, unit: ing?.unit, cost_per_unit: parseFloat(ing?.cost_per_unit) || 0 };
  });

  const calcCost = enriched.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * i.cost_per_unit, 0);
  const price = parseFloat(productPrice) || 0;
  const margin = price > 0 && calcCost > 0 ? ((price - calcCost) / price * 100) : null;

  const availableIngs = ingredients.filter(g => !items.find(i => i.ingredient_id === g.id));

  function addItem() {
    if (!addIng || !addQty) return;
    setItems(prev => [...prev, { ingredient_id: addIng, quantity: parseFloat(addQty) }]);
    setAddIng(''); setAddQty('');
  }

  function removeItem(ingredient_id) {
    setItems(prev => prev.filter(i => i.ingredient_id !== ingredient_id));
  }

  function updateQty(ingredient_id, qty) {
    setItems(prev => prev.map(i => i.ingredient_id === ingredient_id ? { ...i, quantity: qty } : i));
  }

  async function save() {
    setSaving(true);
    try { await onSave(productId, items); } finally { setSaving(false); }
  }

  const cmv = price > 0 && calcCost > 0 ? (calcCost / price * 100) : null;
  const lucro = price > 0 ? price - calcCost : null;

  return (
    <div style={{ marginTop: 12, padding: '16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E0E7EF' }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: C.light, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Ficha Técnica
      </p>

      {/* Tabela de ingredientes */}
      {enriched.length > 0 && (
        <div style={{ marginBottom: 12, border: '1px solid ' + C.border, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 90px 30px', background: '#F3F4F6', borderBottom: '1px solid ' + C.border, padding: '6px 10px' }}>
            {['Insumo', 'Qtd', 'Unid', 'Custo', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>
          {enriched.map(i => (
            <div key={i.ingredient_id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 90px 30px', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid ' + C.border + '60' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{i.name || '—'}</span>
              <input
                type="number" value={i.quantity} min="0" step="0.001"
                onChange={e => updateQty(i.ingredient_id, e.target.value)}
                style={{ width: '100%', padding: '3px 5px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>{i.unit}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', textAlign: 'right' }}>
                {fmtBRL((parseFloat(i.quantity) || 0) * i.cost_per_unit)}
              </span>
              <button onClick={() => removeItem(i.ingredient_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={12} />
              </button>
            </div>
          ))}
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
          <select value={addIng} onChange={e => setAddIng(e.target.value)}
            style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none', background: '#fff' }}>
            <option value="">Selecionar insumo...</option>
            {availableIngs.map(g => <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>)}
          </select>
          <input type="number" value={addQty} min="0" step="0.001" onChange={e => setAddQty(e.target.value)} placeholder="Qtd"
            style={{ width: 70, padding: '5px 6px', borderRadius: 4, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none' }} />
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

// ── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({
  product, idx,
  onUpdate, onUploadImage, uploadingId,
  imagePositions, onUpdateImagePos,
  stockLimits, onUpdateStockLimit,
  ingredients, recipe, onSaveRecipe,
}) {
  const [fichaOpen, setFichaOpen] = useState(false);
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

  return (
    <div style={{ background: '#FAFAFA', borderRadius: 8, padding: 14, border: '1px solid ' + C.border }}>

      {/* ── Row 1: foto + campos básicos ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>

        {/* Foto */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ width: 80, height: 80, borderRadius: 7, overflow: 'hidden', border: '1px solid ' + C.border, background: '#F3F4F6', position: 'relative', marginBottom: 5 }}>
            {product.image_url
              ? <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%`, display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UtensilsCrossed size={24} color={C.light} /></div>
            }
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: '#F3F4F6', color: C.muted, borderRadius: 5, fontSize: 11, cursor: 'pointer', border: '1px solid ' + C.border, opacity: uploadingId === product.id ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            {uploadingId === product.id
              ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
              : <><Upload size={11} /> Trocar foto</>
            }
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) onUploadImage(idx, e.target.files[0]); }} disabled={uploadingId === product.id} />
          </label>
        </div>

        {/* Campos principais */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {/* Categoria + Ordem na mesma linha */}
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
        </div>
      </div>

      {/* ── Descrição ── */}
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Descrição</label>
        <input placeholder="Descrição do produto" value={product.description || ''}
          onChange={e => onUpdate(idx, 'description', e.target.value)}
          style={inputStyle} />
      </div>

      {/* ── Posição da foto (sliders) ── */}
      {product.image_url && (
        <div style={{ marginBottom: 8, padding: '10px 12px', background: '#fff', borderRadius: 6, border: '1px solid ' + C.border }}>
          <p style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
            Encaixe da foto
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Preview */}
            <div style={{ width: 64, height: 64, borderRadius: 6, overflow: 'hidden', border: '1px solid ' + C.border, flexShrink: 0 }}>
              <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%`, display: 'block' }} />
            </div>
            {/* Sliders */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
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

      {/* ── Estoque ── */}
      <div style={{ marginBottom: 8, padding: '10px 12px', background: '#fff', borderRadius: 6, border: '1px solid ' + C.border }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!stock.enabled} onChange={e => onUpdateStockLimit(product.id, 'enabled', e.target.checked)} />
            <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>Limitar estoque</span>
          </label>
          {stock.enabled && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              background: stock.qty <= 0 ? 'rgba(239,68,68,0.1)' : stock.qty <= (stock.low_stock_threshold ?? 3) ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
              color: stock.qty <= 0 ? C.danger : stock.qty <= (stock.low_stock_threshold ?? 3) ? '#D97706' : C.success }}>
              {stock.qty <= 0 ? 'Esgotado' : stock.qty <= (stock.low_stock_threshold ?? 3) ? 'Poucas unid.' : 'Disponível'}
            </span>
          )}
        </div>
        {stock.enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
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
    </div>
  );
}

// ── DrinkRow (collapsed + expandable) ─────────────────────────────────────────

function DrinkRow({ drink, idx, isExpanded, onToggleExpand, onDuplicate, onUpdate, onDelete, drinkStockLimits, onUpdateDrinkStockLimit }) {
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

          <button onClick={() => onDelete(drink.id)} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: C.danger, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Trash2 size={12} /> Excluir Bebida
          </button>
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
}) {
  const catLabel = PROD_CATEGORIES.find(c => c.key === (product.category || 'pizza'))?.label || 'Pizza';
  const catColors = { pizza: '#F2A800', calzone: '#2563EB', combo: '#7C3AED', outros: '#6B7280' };
  const catColor = catColors[product.category] || catColors.pizza;

  return (
    <div style={{ background: C.card, borderRadius: 8, border: isExpanded ? '1.5px solid #F2A800' : '1px solid ' + C.border, overflow: 'hidden', boxShadow: isExpanded ? '0 2px 12px rgba(242,168,0,0.12)' : '0 1px 2px rgba(0,0,0,0.04)' }}>
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

        {/* Price */}
        <span style={{ fontSize: 14, fontWeight: 800, color: C.gold, minWidth: 76, textAlign: 'right', flexShrink: 0 }}>{fmtBRL(product.price)}</span>

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
          />
        </div>
      )}
    </div>
  );
}

// ── Catalog Main ───────────────────────────────────────────────────────────────

export default function Catalog({ adminToken }) {
  const [tab, setTab]           = useState('cardapio'); // 'cardapio' | 'insumos' | 'analise'
  const [catFilter, setCatFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null); // product id currently expanded for editing

  const [products, setProducts]   = useState([]);
  const [drinks, setDrinks]       = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes]     = useState({}); // { [productId]: [{ ingredient_id, quantity }] }
  const [priceHistory, setPriceHistory] = useState([]); // for Análise tab

  // Settings needed for stock limits and image positions
  const [settings, setSettings]   = useState([]);

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');
  const [uploadingId, setUploadingId] = useState(null);

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
  const [newIng, setNewIng]       = useState({ name: '', unit: 'unid', cost_per_unit: '' });
  const [addingIng, setAddingIng] = useState(false);

  // Edit ingredient inline
  const [editingIng, setEditingIng] = useState(null); // ingredient id

  // Price history panel: selected ingredient id
  const [selectedIngForHistory, setSelectedIngForHistory] = useState(null);

  // Upsell config editing state
  const [savingUpsell, setSavingUpsell] = useState(false);
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

  async function saveUpsellConfig(configs) {
    setUpsellSlots(configs);
    setSetting('upsell_config', JSON.stringify(configs));
    setSavingUpsell(true);
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
    finally { setSavingUpsell(false); }
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

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_all', data: { products, drinks, settings } }),
      });
      const d = await res.json();
      if (d.error) { setMsg('❌ ' + d.error); return; }
      setMsg('✅ Salvo com sucesso!');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('❌ Erro ao salvar'); }
    finally { setSaving(false); }
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
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'save_ingredient', data: { name: newIng.name, unit: newIng.unit, cost_per_unit: parseFloat(newIng.cost_per_unit) || 0 } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.ingredient) setIngredients(prev => [...prev, d.ingredient].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setNewIng({ name: '', unit: 'unid', cost_per_unit: '' });
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
      // Update ingredient cost in state
      if (ingredient.id) {
        setIngredients(prev => prev.map(i => i.id === ingredient.id ? { ...i, name: ingredient.name, unit: ingredient.unit, cost_per_unit: ingredient.cost_per_unit } : i));
      }
      // Real-time chart update: add new history entry if price changed
      if (d.priceHistoryEntry) {
        setPriceHistory(prev => [...prev, d.priceHistoryEntry]);
      }
      setEditingIng(null);
    } catch (e) { alert('Erro: ' + e.message); }
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
        {tab === 'cardapio' && (
          <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 6, border: 'none', background: saving ? '#9CA3AF' : '#111827', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Save size={13} /> Salvar</>}
          </button>
        )}
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
            {catFilter !== 'bebidas' && (
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
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── UPSELL ── */}
            {(() => {
              const allItems = [
                ...products.filter(p => p.is_active).map(p => ({ id: p.id, label: p.name, price: p.price, image_url: p.image_url, type: 'product' })),
                ...drinks.filter(d => d.is_active).map(d => ({ id: d.id, label: `${d.name}${d.size ? ` ${d.size}` : ''}`, price: d.price, image_url: null, type: 'drink' })),
              ];

              return (
                <div style={{ marginTop: 32, borderTop: '2px dashed ' + C.border, paddingTop: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    <TrendingUp size={16} color={C.gold} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Upsell no Carrinho</span>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>— até 3 ofertas exibidas na gaveta do carrinho</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {upsellSlots.map((upsell, idx) => {
                      const selectedItem = upsell.product_id != null ? (allItems.find(i => String(i.id) === String(upsell.product_id)) || null) : null;
                      return (
                        <div key={idx} style={{ background: C.card, borderRadius: 10, border: '1px solid ' + (upsell.enabled ? C.gold : C.border), padding: 16 }}>
                          {/* Slot header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, background: upsell.enabled ? C.gold : C.border, color: upsell.enabled ? '#000' : C.muted, borderRadius: 6, padding: '2px 8px' }}>
                              Upsell {idx + 1}
                            </span>
                            <div style={{ flex: 1 }} />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: upsell.enabled ? C.success : C.muted }}>
                              <input
                                type="checkbox"
                                checked={!!upsell.enabled}
                                onChange={e => {
                                  const next = upsellSlots.map((u, i) => i === idx ? { ...u, enabled: e.target.checked } : u);
                                  saveUpsellConfig(next);
                                }}
                                style={{ width: 15, height: 15, accentColor: C.gold, cursor: 'pointer' }}
                              />
                              {upsell.enabled ? 'Ativo' : 'Inativo'}
                            </label>
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
                                saveUpsellConfig(next);
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
                                onBlur={() => saveUpsellConfig(upsellSlots)}
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
                                onBlur={() => saveUpsellConfig(upsellSlots)}
                                placeholder={selectedItem ? fmtBRL(selectedItem.price).replace('R$\u00a0', '') : '0,00'}
                                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }}
                              />
                              <p style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>Vazio = preço original</p>
                            </div>
                          </div>

                          {/* Foto personalizada */}
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                              URL da foto personalizada
                            </label>
                            <input
                              value={upsell.custom_image_url || ''}
                              onChange={e => {
                                const next = upsellSlots.map((u, i) => i === idx ? { ...u, custom_image_url: e.target.value || null } : u);
                                setUpsellSlots(next);
                              }}
                              onBlur={() => saveUpsellConfig(upsellSlots)}
                              placeholder="https://... (deixe vazio para usar a foto do produto)"
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }}
                            />
                            {upsell.custom_image_url && (
                              <img src={upsell.custom_image_url} alt="" onError={e => e.target.style.display='none'} style={{ marginTop: 6, width: 52, height: 52, borderRadius: 8, objectFit: 'cover', border: '1px solid ' + C.border }} />
                            )}
                          </div>

                          {/* Mostrar foto */}
                          <div style={{ marginBottom: selectedItem ? 14 : 0 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text, fontWeight: 500 }}>
                              <input
                                type="checkbox"
                                checked={!!upsell.show_image}
                                onChange={e => {
                                  const next = upsellSlots.map((u, i) => i === idx ? { ...u, show_image: e.target.checked } : u);
                                  saveUpsellConfig(next);
                                }}
                                style={{ width: 15, height: 15, accentColor: C.gold, cursor: 'pointer' }}
                              />
                              Mostrar foto no carrinho
                            </label>
                          </div>

                          {/* Preview */}
                          {selectedItem && (
                            <div style={{ background: '#F8F9FA', borderRadius: 8, padding: 12, border: '1px solid ' + C.border }}>
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
                        </div>
                      );
                    })}
                  </div>

                  {savingUpsell && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: C.muted }}>
                      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
            Insumos são matérias-primas utilizadas nas fichas técnicas dos produtos para calcular custo e margem automaticamente.
          </p>

          {/* Lista de ingredientes */}
          <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, overflow: 'hidden', marginBottom: 20 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 100px 140px', gap: 0, background: '#F9FAFB', borderBottom: '1px solid ' + C.border, padding: '10px 16px' }}>
              {['Insumo', 'Unidade', 'Custo/Unid.', 'Variação', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
              ))}
            </div>

            {ingredients.length === 0 ? (
              <p style={{ padding: 20, fontSize: 13, color: C.light, textAlign: 'center' }}>Nenhum insumo cadastrado. Adicione abaixo.</p>
            ) : (
              ingredients.map(ing => {
                const isEditing = editingIng === ing.id;
                // Price variation % from first recorded history to current
                const history = priceHistory
                  .filter(h => h.ingredient_id === ing.id)
                  .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
                const firstPrice = history.length > 0 ? (parseFloat(history[0].old_price) || parseFloat(history[0].new_price)) : null;
                const currentPrice = parseFloat(ing.cost_per_unit);
                const variation = firstPrice && firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice * 100) : null;

                return (
                  <div key={ing.id}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 100px 140px', gap: 0, borderBottom: selectedIngForHistory === ing.id ? 'none' : '1px solid ' + C.border, padding: '10px 16px', alignItems: 'center' }}>
                      {isEditing ? (
                        <>
                          <input value={ing.name} onChange={e => handleUpdateIngredient(ing.id, 'name', e.target.value)} style={{ padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', marginRight: 8 }} />
                          <select value={ing.unit} onChange={e => handleUpdateIngredient(ing.id, 'unit', e.target.value)} style={{ padding: '5px 6px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', marginRight: 8 }}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <input type="number" value={ing.cost_per_unit} min="0" step="0.0001" onChange={e => handleUpdateIngredient(ing.id, 'cost_per_unit', e.target.value)} style={{ padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', textAlign: 'right' }} />
                          <div />
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                            <button onClick={() => handleSaveIngredient(ing)} style={{ padding: '5px 10px', borderRadius: 4, border: 'none', background: '#111827', color: '#fff', fontSize: 12, cursor: 'pointer' }}>OK</button>
                            <button onClick={() => setEditingIng(null)} style={{ padding: '5px 8px', borderRadius: 4, border: '1px solid ' + C.border, background: '#fff', fontSize: 12, cursor: 'pointer' }}>✕</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ing.name}</span>
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
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              onClick={() => setSelectedIngForHistory(selectedIngForHistory === ing.id ? null : ing.id)}
                              title="Histórico de preço"
                              style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid ' + C.border, background: selectedIngForHistory === ing.id ? '#EFF6FF' : '#fff', fontSize: 11, cursor: 'pointer', color: selectedIngForHistory === ing.id ? '#2563EB' : C.muted, display: 'flex', alignItems: 'center' }}
                            >
                              <BarChart2 size={13} />
                            </button>
                            <button onClick={() => setEditingIng(ing.id)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid ' + C.border, background: '#fff', fontSize: 11, cursor: 'pointer', color: C.muted }}>Editar</button>
                            <button onClick={() => handleDeleteIngredient(ing.id)} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', fontSize: 11, cursor: 'pointer', color: C.danger }}>✕</button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Inline price history panel */}
                    {selectedIngForHistory === ing.id && (() => {
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

          {/* Adicionar insumo */}
          <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '2px dashed ' + C.border }}>
            <h3 style={{ color: C.gold, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <Plus size={16} color={C.gold} /> Novo Insumo
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
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
            <button onClick={handleAddIngredient} disabled={addingIng} style={{ padding: '10px 20px', background: C.gold, color: '#000', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: addingIng ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {addingIng ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
              {addingIng ? 'Adicionando...' : 'Adicionar Insumo'}
            </button>
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
