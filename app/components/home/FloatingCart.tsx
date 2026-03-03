'use client';

import { ShoppingCart } from 'lucide-react';
import { GOLD, MUTED } from './tokens';

interface FloatingCartProps {
  itemCount: number;
  total: number;
  onCheckout: () => void;
}

export default function FloatingCart({ itemCount, total, onCheckout }: FloatingCartProps) {
  if (itemCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '14px 18px',
        background: 'rgba(18, 13, 0, 0.97)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(242,168,0,0.2)', zIndex: 40,
        boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingCart size={16} color={GOLD} />
          <span style={{ color: GOLD, fontWeight: 800 }}>{itemCount}</span>
          <span style={{ color: MUTED, fontSize: 13 }}>{itemCount === 1 ? 'item' : 'itens'}</span>
        </div>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>
          R$ {total.toFixed(2).replace('.', ',')}
        </span>
      </div>
      <button className="btn-primary" onClick={onCheckout}>
        Ir para o Checkout
      </button>
    </div>
  );
}
