'use client';

import { X, ShoppingCart, Plus, ChevronRight } from 'lucide-react';
import { GOLD, GOLD_LIGHT, BG, CARD, BORDER, MUTED, FAINT, fmt } from './tokens';
import type { CartItem, Product } from './types';

export interface UpsellConfig {
  enabled: boolean;
  product_id: number | string | null;
  offer_label: string;
  show_image: boolean;
  custom_price: number | null;
  custom_image_url: string | null;
}

export interface UpsellItem {
  config: UpsellConfig;
  product: Product;
}

interface CartDrawerProps {
  cart: CartItem[];
  total: number;
  onClose: () => void;
  onGoToCheckout: () => void;
  onRemoveItem: (id: number) => void;
  onAddUpsell: (product: Product) => void;
  upsellItems: UpsellItem[];
}

export default function CartDrawer({
  cart,
  total,
  onClose,
  onGoToCheckout,
  onRemoveItem,
  onAddUpsell,
  upsellItems,
}: CartDrawerProps) {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 50,
          animation: 'fadeIn 0.18s ease-out',
        }}
      />

      {/* Gaveta — wrapper de centralização separado da animação */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480,
          zIndex: 51,
        }}
      >
      <div
        style={{
          background: '#0E0B00',
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${BORDER}`,
          borderBottom: 'none',
          animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px 10px',
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={16} color={GOLD} />
            <span style={{ fontSize: 14, fontWeight: 800, color: GOLD, letterSpacing: 1, textTransform: 'uppercase' }}>
              Seu Carrinho
            </span>
            <span style={{
              background: '#E04040', color: '#fff',
              fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {cart.length}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar carrinho"
            style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Itens — scrollável */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px' }}>

          {/* Lista de itens */}
          <div style={{ paddingTop: 14 }}>
            {cart.map((item, idx) => {
              const itemTotal =
                Number(item.product.price) +
                (item.option?.extra_price || 0) +
                (item.option2?.extra_price || 0) +
                (item.drinks?.reduce((s, d) => s + Number(d.price) * d.quantity, 0) || 0);

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    paddingBottom: 12, marginBottom: 12,
                    borderBottom: idx < cart.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}
                >
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                      {item.product.name}
                    </p>
                    {item.option && (
                      <p style={{ fontSize: 12, color: GOLD, marginTop: 2 }}>
                        {item.option.label}
                        {item.option.extra_price > 0 ? ` (+R$ ${fmt(item.option.extra_price)})` : ''}
                      </p>
                    )}
                    {item.option2 && (
                      <p style={{ fontSize: 12, color: GOLD, marginTop: 1 }}>
                        {item.option2.label}
                        {item.option2.extra_price > 0 ? ` (+R$ ${fmt(item.option2.extra_price)})` : ''}
                      </p>
                    )}
                    {item.drinks?.map(d => (
                      <p key={d.id} style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>
                        + {d.name} {d.size} x{d.quantity}
                      </p>
                    ))}
                    {item.observations && (
                      <p style={{ fontSize: 11, color: MUTED, fontStyle: 'italic', marginTop: 2 }}>
                        Obs: {item.observations}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                      R$ {fmt(itemTotal)}
                    </span>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      aria-label={`Remover ${item.product.name}`}
                      style={{
                        background: 'none', border: 'none', color: '#E04040',
                        cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upsells */}
          {upsellItems.length > 0 && (
            <div style={{ margin: '4px 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upsellItems.map((item, idx) => {
                const price =
                  item.config.custom_price != null && item.config.custom_price > 0
                    ? item.config.custom_price
                    : Number(item.product.price);

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(242,168,0,0.06)',
                      border: `1px solid rgba(242,168,0,0.25)`,
                      borderRadius: 14,
                    }}
                  >
                    <p style={{ fontSize: 10, fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
                      ✦ {item.config.offer_label || 'Aproveite e adicione:'}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {item.config.show_image && (item.config.custom_image_url || item.product.image_url) && (
                        <img
                          src={item.config.custom_image_url || item.product.image_url!}
                          alt={item.product.name}
                          style={{
                            width: 52, height: 52, borderRadius: 10,
                            objectFit: 'cover', flexShrink: 0,
                            border: `1px solid ${BORDER}`,
                          }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                          {item.product.name}
                        </p>
                        {item.product.description && (
                          <p style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>
                            {item.product.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: GOLD }}>
                          R$ {fmt(price)}
                        </span>
                        <button
                          onClick={() => onAddUpsell(item.product)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                            color: BG, border: 'none', borderRadius: 8,
                            padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                          }}
                        >
                          <Plus size={12} /> Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer fixo — total + botão */}
        <div style={{
          padding: '14px 18px 28px',
          borderTop: `1px solid ${BORDER}`,
          background: '#0E0B00',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 14,
          }}>
            <span style={{ fontSize: 13, color: MUTED }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>
              R$ {fmt(total)}
            </span>
          </div>

          <button
            className="btn-primary"
            onClick={onGoToCheckout}
            style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              fontSize: 16, padding: '15px 0',
            }}
          >
            Ir para o Checkout <ChevronRight size={18} />
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
