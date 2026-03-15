'use client';

import React from 'react';
import { UtensilsCrossed, Copy, Trash2, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { costWithFC } from '@/lib/correction-factor';
import { C, fmtBRL, PROD_CATEGORIES } from './catalogUtils';
import ProductCard from './ProductCard';

export default function ProductRow({
  product, idx, isExpanded, onToggleExpand, onDuplicate, onDelete,
  onUpdate, onUploadImage, uploadingId,
  imagePositions, onUpdateImagePos,
  stockLimits, onUpdateStockLimit,
  ingredients, recipe, onSaveRecipe,
  onSave, onToggleFlag, savingProductId,
}: { product: any, idx: any, isExpanded: any, onToggleExpand: any, onDuplicate: any, onDelete: any, onUpdate: any, onUploadImage: any, uploadingId: any, imagePositions: any, onUpdateImagePos: any, stockLimits: any, onUpdateStockLimit: any, ingredients: any, recipe: any, onSaveRecipe: any, onSave: any, onToggleFlag: any, savingProductId: any }) {
  const catLabel = PROD_CATEGORIES.find(c => c.key === (product.category || 'pizza'))?.label || 'Pizza';
  const catColors: Record<string, string> = { pizza: '#F2A800', calzone: '#2563EB', combo: '#7C3AED', outros: '#6B7280' };
  const catColor = catColors[product.category] || catColors.pizza;

  // CMV from ficha técnica
  const cmvValue = (() => {
    if (!recipe?.length) return null;
    return recipe.reduce((s: any, item: any) => {
      const ing = ingredients.find((g: any) => g.id === item.ingredient_id);
      return s + (parseFloat(item.quantity) || 0) * costWithFC((parseFloat(ing?.cost_per_unit) || 0), ing?.correction_factor);
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: savingProductId === product.id ? 'wait' : 'pointer', flexShrink: 0 }}>
          <input type="checkbox" checked={!!product.is_active} disabled={savingProductId === product.id} onChange={e => onToggleFlag(product.id, 'is_active', e.target.checked)} />
          <span style={{ fontSize: 11, fontWeight: 600, color: product.is_active ? C.success : C.light, minWidth: 40 }}>
            {product.is_active ? 'Ativo' : 'Inativo'}
          </span>
        </label>

        {/* Hidden toggle */}
        <label title="Ocultar do cardápio online" style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: savingProductId === product.id ? 'wait' : 'pointer', flexShrink: 0 }}>
          <input type="checkbox" checked={!!product.is_hidden} disabled={savingProductId === product.id} onChange={e => onToggleFlag(product.id, 'is_hidden', e.target.checked)} />
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
          <button onClick={() => onDelete(product.id)} title="Excluir sabor" style={{
            padding: '5px 9px', borderRadius: 4, border: '1px solid #FECACA',
            background: '#FEF2F2', color: '#B91C1C', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Trash2 size={12} /> Excluir
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
