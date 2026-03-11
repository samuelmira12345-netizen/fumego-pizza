'use client';

import { useRef } from 'react';
import { X, GlassWater, Minus, Plus } from 'lucide-react';
import type { Product, Drink, DrinkSelection, CartItemOption } from './types';
import {
  GOLD, GOLD_LIGHT, BG, BORDER, MUTED,
  fmt, isPromoActive, effectivePrice,
  COMBO_CALABRESA_OPTS, COMBO_MARGUERITA_OPTS, PRODUCT_OPTIONS,
} from './tokens';
import { useScrollToStep } from '../../../hooks/useScrollToStep';

interface ProductModalProps {
  product: Product;
  drinks: Drink[];
  observations: string;
  setObservations: (v: string) => void;
  selectedDrinks: DrinkSelection[];
  toggleDrink: (drink: Drink) => void;
  updateDrinkQty: (drinkId: number, qty: number) => void;
  selectedOption: CartItemOption | null;
  setSelectedOption: (opt: CartItemOption) => void;
  selectedOption2: CartItemOption | null;
  setSelectedOption2: (opt: CartItemOption) => void;
  modalTotal: number;
  onClose: () => void;
  onAddToCart: () => void;
}

function OptionRow({
  opt,
  isSelected,
  onClick,
}: {
  opt: CartItemOption;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderRadius: 13, cursor: 'pointer',
        border: isSelected ? `1.5px solid ${GOLD}` : `1px solid ${BORDER}`,
        background: isSelected ? 'rgba(242,168,0,0.07)' : '#1A1400',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          border: isSelected ? `6px solid ${GOLD}` : `2px solid ${BORDER}`,
          background: isSelected ? BG : 'transparent',
        }} />
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{opt.label}</span>
      </div>
      <span style={{ color: opt.extra_price > 0 ? GOLD : MUTED, fontSize: 13, fontWeight: 700 }}>
        {opt.extra_price > 0 ? `+R$ ${fmt(opt.extra_price)}` : 'Incluso'}
      </span>
    </div>
  );
}

export default function ProductModal({
  product,
  drinks,
  observations,
  setObservations,
  selectedDrinks,
  toggleDrink,
  updateDrinkQty,
  selectedOption,
  setSelectedOption,
  selectedOption2,
  setSelectedOption2,
  modalTotal,
  onClose,
  onAddToCart,
}: ProductModalProps) {
  const isCombo = product.slug === 'combo-classico';
  const singleOpts = PRODUCT_OPTIONS[product.slug];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollToStep = useScrollToStep(300);

  // ── Handlers com scroll guiado ──────────────────────────────────────────────

  /** Opção principal → rola para próximo passo lógico */
  function handleSelectOption(opt: CartItemOption) {
    setSelectedOption(opt);
    if (isCombo) {
      scrollToStep('modal-opts-marguerita', scrollContainerRef.current);
    } else if (drinks.length > 0) {
      scrollToStep('modal-drinks', scrollContainerRef.current);
    } else {
      scrollToStep('modal-add-to-cart', scrollContainerRef.current);
    }
  }

  /** Segunda opção do combo (marguerita) → rola para bebidas ou botão */
  function handleSelectOption2(opt: CartItemOption) {
    setSelectedOption2(opt);
    if (drinks.length > 0) {
      scrollToStep('modal-drinks', scrollContainerRef.current);
    } else {
      scrollToStep('modal-add-to-cart', scrollContainerRef.current);
    }
  }

  /** Bebida adicionada (não removida) → rola para o botão de adicionar */
  function handleToggleDrink(drink: Drink) {
    const isAlreadySelected = selectedDrinks.some(d => d.id === drink.id);
    toggleDrink(drink);
    if (!isAlreadySelected) {
      scrollToStep('modal-add-to-cart', scrollContainerRef.current);
    }
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(6px)', zIndex: 50,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      {/* Container com scroll — ref necessária para scroll interno */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        ref={scrollContainerRef}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#141000', borderRadius: '24px 24px 0 0',
          border: `1px solid ${BORDER}`, borderBottom: 'none',
          width: '100%', maxWidth: 480,
          maxHeight: '88vh', overflowY: 'auto', padding: '0 20px 36px',
          animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: `0 -4px 50px rgba(242,168,0,0.07)`,
        }}
      >
        {/* Handle */}
        <div style={{ padding: '14px 0 22px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, background: BORDER, borderRadius: 2 }} />
        </div>

        {/* Título */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <h3 id="product-modal-title" style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontSize: 22, fontWeight: 700, color: '#fff', flex: 1, paddingRight: 12, lineHeight: 1.2,
          }}>
            {product.name}
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: BORDER, border: 'none', color: MUTED,
              width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: MUTED, marginBottom: 14, lineHeight: 1.55 }}>
          {product.description}
        </p>
        <div style={{ marginBottom: 22, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          {product.is_active && isPromoActive(product) && (
            <span style={{ fontSize: 16, color: MUTED, textDecoration: 'line-through' }}>R$ {fmt(product.price)}</span>
          )}
          {product.is_active && isPromoActive(product) && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: '#EA580C', color: '#fff' }}>PROMO</span>
          )}
          <p style={{ fontSize: 24, fontWeight: 800, color: product.is_active ? (isPromoActive(product) ? '#FB923C' : GOLD) : '#E04040', margin: 0 }}>
            {product.is_active ? `R$ ${fmt(effectivePrice(product))}` : 'ESGOTADO'}
          </p>
        </div>

        {/* ── Opções — Combo (duas pizzas) ─────────────────────────────── */}
        {product.is_active && isCombo && (
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 11, color: MUTED, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>
              Pizza Calabresa
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {COMBO_CALABRESA_OPTS.map(opt => (
                <OptionRow
                  key={opt.label}
                  opt={opt}
                  isSelected={selectedOption?.label === opt.label}
                  onClick={() => handleSelectOption(opt)}
                />
              ))}
            </div>

            {/* Alvo do scroll após selecionar calabresa */}
            <div id="modal-opts-marguerita">
              <label style={{ fontSize: 11, color: MUTED, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>
                Pizza Marguerita
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {COMBO_MARGUERITA_OPTS.map(opt => (
                  <OptionRow
                    key={opt.label}
                    opt={opt}
                    isSelected={selectedOption2?.label === opt.label}
                    onClick={() => handleSelectOption2(opt)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Opções — sabor único ──────────────────────────────────────── */}
        {product.is_active && !isCombo && singleOpts && (
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 11, color: MUTED, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>
              Opções
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {singleOpts.map(opt => (
                <OptionRow
                  key={opt.label}
                  opt={opt}
                  isSelected={selectedOption?.label === opt.label}
                  onClick={() => handleSelectOption(opt)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Observações */}
        {product.is_active && (
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 11, color: MUTED, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>
            Observações
          </label>
          <textarea
            className="input-field"
            rows={2}
            placeholder="Ex: Borda recheada…"
            value={observations}
            onChange={e => setObservations(e.target.value)}
            style={{ resize: 'none' }}
          />
        </div>
        )}

        {/* ── Bebidas — alvo do scroll após opção selecionada ─────────── */}
        {product.is_active && drinks.length > 0 && (
          <div id="modal-drinks" style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <GlassWater size={14} color={MUTED} />
              <p style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                Adicionar bebida?
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drinks.map(drink => {
                const sel = selectedDrinks.find(d => d.id === drink.id);
                return (
                  <div
                    key={drink.id}
                    onClick={() => handleToggleDrink(drink)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', borderRadius: 13,
                      border: sel ? `1.5px solid ${GOLD}` : `1px solid ${BORDER}`,
                      background: sel ? 'rgba(242,168,0,0.07)' : '#1A1400',
                      cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{drink.name}</p>
                      <p style={{ fontSize: 12, color: MUTED }}>{drink.size}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isPromoActive(drink) ? (
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <span style={{ fontSize: 11, color: MUTED, textDecoration: 'line-through' }}>R$ {fmt(drink.price)}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#FB923C' }}>R$ {fmt(effectivePrice(drink))}</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>R$ {fmt(drink.price)}</span>
                      )}
                      {sel && (
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => updateDrinkQty(drink.id, sel.quantity - 1)}
                            style={{
                              width: 28, height: 28, borderRadius: '50%', background: BORDER,
                              color: MUTED, border: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Minus size={14} />
                          </button>
                          <span style={{ color: '#fff', fontSize: 14, width: 18, textAlign: 'center' }}>
                            {sel.quantity}
                          </span>
                          <button
                            onClick={() => updateDrinkQty(drink.id, sel.quantity + 1)}
                            style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                              color: BG, border: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Rodapé — alvo do scroll após bebida selecionada ─────────── */}
        <div id="modal-add-to-cart" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}>
          {product.is_active && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ color: MUTED, fontSize: 13 }}>Total deste item:</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>
                R$ {modalTotal.toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
          {product.is_active ? (
            <button className="btn-primary" onClick={onAddToCart}>
              Adicionar ao Carrinho
            </button>
          ) : (
            <div style={{
              padding: '14px 20px', textAlign: 'center',
              background: 'rgba(224,64,64,0.1)', border: '1px solid rgba(224,64,64,0.3)',
              borderRadius: 14, color: '#E04040', fontWeight: 700, letterSpacing: 0.5, fontSize: 14,
            }}>
              Produto esgotado — indisponível no momento
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
