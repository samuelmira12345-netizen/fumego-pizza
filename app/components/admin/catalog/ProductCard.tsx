'use client';

import React, { useState } from 'react';
import { UtensilsCrossed, Upload, Loader2, Save, TrendingDown, BookOpen, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { C, fmtBRL, PROD_CATEGORIES } from './catalogUtils';
import FichaTecnica from './FichaTecnica';

export default function ProductCard({
  product, idx,
  onUpdate, onUploadImage, uploadingId,
  imagePositions, onUpdateImagePos,
  stockLimits, onUpdateStockLimit,
  ingredients, recipe, onSaveRecipe,
  onSave, isSaving,
}: { product: any, idx: any, onUpdate: any, onUploadImage: any, uploadingId: any, imagePositions: any, onUpdateImagePos: any, stockLimits: any, onUpdateStockLimit: any, ingredients: any, recipe: any, onSaveRecipe: any, onSave: any, isSaving: any }) {
  const [fichaOpen, setFichaOpen] = useState(false);
  const [cardTab, setCardTab]     = useState('geral'); // 'geral' | 'imagens'
  const [stockOpen, setStockOpen] = useState(false);
  const pos   = imagePositions[String(product.id)] || { x: 50, y: 50 };
  const stock = stockLimits[String(product.id)]    || { enabled: false, qty: 0, low_stock_threshold: 3 };
  const margin = parseFloat(product.price) > 0 && parseFloat(product.cost_price) > 0
    ? Math.round((product.price - product.cost_price) / product.price * 100)
    : null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 9px', borderRadius: 5,
    border: '1px solid ' + C.border, fontSize: 12, outline: 'none',
    background: '#fff', color: C.text, boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 };

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

            {/* Promoção */}
            <div style={{ background: product.promotion_active ? '#FFF7ED' : '#F9FAFB', border: `1px solid ${product.promotion_active ? '#FED7AA' : C.border}`, borderRadius: 6, padding: '10px 12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: product.promotion_active ? 10 : 0 }}>
                <input type="checkbox" checked={!!product.promotion_active} onChange={e => onUpdate(idx, 'promotion_active', e.target.checked)} />
                <span style={{ fontSize: 12, fontWeight: 700, color: product.promotion_active ? '#EA580C' : C.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                  🏷️ Colocar em promoção
                  {product.promotion_active && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#EA580C', color: '#fff' }}>ATIVO</span>}
                </span>
              </label>
              {product.promotion_active && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                    <div>
                      <label style={labelStyle}>Preço Promocional (R$)</label>
                      <input type="number" step="0.01" placeholder="0,00" value={product.promotional_price || ''}
                        onChange={e => onUpdate(idx, 'promotional_price', e.target.value)}
                        style={{ ...inputStyle, border: '1px solid #FB923C', background: '#FFF7ED' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Válido até (opcional)</label>
                      <input type="datetime-local" value={product.promotion_ends_at ? product.promotion_ends_at.slice(0, 16) : ''}
                        onChange={e => onUpdate(idx, 'promotion_ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                        style={{ ...inputStyle }} />
                    </div>
                  </div>
                  {product.promotional_price && parseFloat(product.promotional_price) > 0 && parseFloat(product.price) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#FEF3C7', borderRadius: 5 }}>
                      <span style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>
                        Desconto de <strong>{Math.round((1 - parseFloat(product.promotional_price) / parseFloat(product.price)) * 100)}%</strong> · De <s>{fmtBRL(product.price)}</s> por <strong style={{ color: '#EA580C' }}>{fmtBRL(product.promotional_price)}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

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
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files && e.target.files[0]) onUploadImage(idx, e.target.files[0]); }} disabled={uploadingId === product.id} />
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
