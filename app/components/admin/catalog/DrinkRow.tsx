'use client';

import React from 'react';
import { GlassWater, Loader2, Save, Trash2, Copy, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { C, fmtBRL } from './catalogUtils';

export default function DrinkRow({ drink, idx, isExpanded, onToggleExpand, onDuplicate, onUpdate, onDelete, drinkStockLimits, onUpdateDrinkStockLimit, onToggleFlag, onSave, isSaving }: { drink: any, idx: any, isExpanded: any, onToggleExpand: any, onDuplicate: any, onUpdate: any, onDelete: any, drinkStockLimits: any, onUpdateDrinkStockLimit: any, onToggleFlag: any, onSave: any, isSaving: any }) {
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: isSaving ? 'wait' : 'pointer', flexShrink: 0 }}>
          <input type="checkbox" checked={!!drink.is_active} disabled={isSaving} onChange={e => onToggleFlag(drink.id, 'is_active', e.target.checked)} />
          <span style={{ fontSize: 11, fontWeight: 600, color: drink.is_active ? C.success : C.light, minWidth: 40 }}>
            {drink.is_active ? 'Ativo' : 'Inativo'}
          </span>
        </label>

        {/* Hidden toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: isSaving ? 'wait' : 'pointer', flexShrink: 0 }}>
          <input type="checkbox" checked={!!drink.is_hidden} disabled={isSaving} onChange={e => onToggleFlag(drink.id, 'is_hidden', e.target.checked)} />
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
          <button onClick={() => onDelete(drink.id)} title="Excluir bebida" style={{
            padding: '5px 9px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.06)', color: C.danger, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Trash2 size={12} /> Excluir
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

          {/* Promoção */}
          <div style={{ marginBottom: 8, background: drink.promotion_active ? '#FFF7ED' : '#F9FAFB', border: `1px solid ${drink.promotion_active ? '#FED7AA' : C.border}`, borderRadius: 8, padding: '10px 12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: drink.promotion_active ? 10 : 0 }}>
              <input type="checkbox" checked={!!drink.promotion_active} onChange={e => onUpdate(idx, 'promotion_active', e.target.checked)} />
              <span style={{ fontSize: 12, fontWeight: 700, color: drink.promotion_active ? '#EA580C' : C.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                🏷️ Colocar em promoção
                {drink.promotion_active && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#EA580C', color: '#fff' }}>ATIVO</span>}
              </span>
            </label>
            {drink.promotion_active && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Preço Promocional (R$)</label>
                    <input className="input-field" type="number" step="0.01" placeholder="0,00" value={drink.promotional_price || ''}
                      onChange={e => onUpdate(idx, 'promotional_price', e.target.value)}
                      style={{ background: '#FFF7ED', color: C.text, borderColor: '#FB923C' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Válido até (opcional)</label>
                    <input className="input-field" type="datetime-local" value={drink.promotion_ends_at ? drink.promotion_ends_at.slice(0, 16) : ''}
                      onChange={e => onUpdate(idx, 'promotion_ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                      style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                </div>
                {drink.promotional_price && parseFloat(drink.promotional_price) > 0 && parseFloat(drink.price) > 0 && (
                  <div style={{ padding: '6px 10px', background: '#FEF3C7', borderRadius: 5, fontSize: 11, color: '#92400E', fontWeight: 600 }}>
                    Desconto de <strong>{Math.round((1 - parseFloat(drink.promotional_price) / parseFloat(drink.price)) * 100)}%</strong> · De <s>{fmtBRL(drink.price)}</s> por <strong style={{ color: '#EA580C' }}>{fmtBRL(drink.promotional_price)}</strong>
                  </div>
                )}
              </div>
            )}
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
            <button onClick={() => onSave(drink)} disabled={isSaving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, border: 'none', background: isSaving ? '#9CA3AF' : '#111827', color: '#fff', fontSize: 12, fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
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
