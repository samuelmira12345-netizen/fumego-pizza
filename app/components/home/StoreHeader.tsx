'use client';

import { useEffect, useRef } from 'react';
import { ShoppingCart, User, Settings, Package, LogOut, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GOLD, GOLD_LIGHT, BG, BORDER, MUTED } from './tokens';
import type { AppUser } from './types';

interface StoreHeaderProps {
  user: AppUser | null;
  cartCount: number;
  showUserMenu: boolean;
  setShowUserMenu: (v: boolean) => void;
  logoUrl: string | null;
  logoSize: number;
  onGoToCheckout: () => void;
  onLogout: () => void;
  cashbackBalance?: number;
}

export default function StoreHeader({
  user, cartCount, showUserMenu, setShowUserMenu,
  logoUrl, logoSize, onGoToCheckout, onLogout, cashbackBalance = 0,
}: StoreHeaderProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar/tocar fora dele
  useEffect(() => {
    if (!showUserMenu) return;

    function handleOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }

    // Usa mousedown + touchstart para cobrir desktop e mobile (iOS)
    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('touchstart', handleOutside, true);

    return () => {
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('touchstart', handleOutside, true);
    };
  }, [showUserMenu, setShowUserMenu]);

  return (
    <header className="header" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}>
      {/* Esquerda — logo */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {logoUrl && (
          <img src={logoUrl} alt="Logo" style={{ height: logoSize, objectFit: 'contain', display: 'block' }} />
        )}
      </div>

      {/* Centro — nome da marca */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
        <h1 style={{
          fontFamily: 'var(--font-cinzel), Cinzel, Georgia, serif',
          fontSize: 22, fontWeight: 900, color: GOLD,
          letterSpacing: 5, textShadow: `0 0 24px rgba(242,168,0,0.4)`,
        }}>
          FUMÊGO
        </h1>
      </div>

      {/* Direita — ícones */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
        {/* Carrinho */}
        <button
          onClick={onGoToCheckout}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', position: 'relative', padding: 4 }}
        >
          <ShoppingCart size={22} color={cartCount > 0 ? GOLD : '#888'} />
          {cartCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -6,
              background: '#E04040', color: '#fff',
              fontSize: 9, fontWeight: 800, width: 17, height: 17, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1.5px solid ${BG}`,
            }}>
              {cartCount}
            </span>
          )}
        </button>

        {/* Perfil */}
        {user ? (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                color: BG, border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                boxShadow: showUserMenu ? `0 0 0 2px ${GOLD}` : `0 0 12px rgba(242,168,0,0.35)`,
                transition: 'box-shadow 0.15s',
              }}
            >
              {user.name?.charAt(0).toUpperCase()}
            </button>

            {showUserMenu && (
              <>
                <div style={{
                  position: 'absolute', top: 42, right: 0,
                  background: '#1A1400', border: `1px solid ${BORDER}`,
                  borderRadius: 14, padding: '6px 0', minWidth: 210, zIndex: 200,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                  animation: 'fadeIn 0.15s ease-out',
                }}>
                  <div style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{user.name}</p>
                    <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{user.email}</p>
                  </div>

                  {[
                    {
                      icon: <Wallet size={15} />,
                      label: 'Minha Carteira',
                      badge: cashbackBalance > 0 ? `R$ ${cashbackBalance.toFixed(2).replace('.', ',')}` : null,
                      action: () => { setShowUserMenu(false); router.push('/wallet'); },
                    },
                    {
                      icon: <Settings size={15} />,
                      label: 'Configurações da conta',
                      badge: null,
                      action: () => { setShowUserMenu(false); router.push('/account'); },
                    },
                    {
                      icon: <Package size={15} />,
                      label: 'Ver meus pedidos',
                      badge: null,
                      action: () => { setShowUserMenu(false); router.push('/orders'); },
                    },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', textAlign: 'left', padding: '11px 16px',
                        background: 'none', border: 'none', color: '#fff',
                        fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ color: MUTED }}>{item.icon}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: GOLD,
                          background: 'rgba(242,168,0,0.12)', borderRadius: 8,
                          padding: '2px 7px', border: `1px solid ${GOLD}44`,
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}

                  <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />

                  <button
                    onClick={onLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', textAlign: 'left', padding: '11px 16px',
                      background: 'none', border: 'none', color: '#E04040',
                      fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <LogOut size={15} />
                    Sair da conta
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => router.push('/login')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <User size={22} color={MUTED} />
          </button>
        )}
      </div>
    </header>
  );
}
