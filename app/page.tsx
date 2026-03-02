'use client';

import { useState, useEffect } from 'react';
import {
  ShoppingCart, User, LogOut, Settings, Package,
  X, Clock, Truck, ChevronRight, Flame, Star,
  Minus, Plus, GlassWater, UtensilsCrossed,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Product {
  id: number;
  slug: string;
  name: string;
  price: number | string;
  description: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Drink {
  id: number;
  name: string;
  price: number | string;
  size: string;
  is_active: boolean;
}

interface DrinkSelection extends Drink {
  quantity: number;
}

interface CartItemOption {
  label: string;
  extra_price: number;
}

interface CartItem {
  id: number;
  product: Product;
  observations: string;
  drinks: DrinkSelection[];
  option?: CartItemOption | null;
}

interface Settings {
  [key: string]: string;
}

interface User {
  name: string;
  email: string;
}

// ── Tokens ────────────────────────────────────────────────────────────────────
const GOLD       = '#F2A800';
const GOLD_LIGHT = '#FFD060';
const BG         = '#080600';
const CARD       = '#1C1500';
const BORDER     = '#2C1E00';
const MUTED      = '#7A6040';
const FAINT      = '#3A2810';

// ── Opções por produto ──────────────────────────────────────────────────────
const CAPRICHO_OPTS: CartItemOption[] = [
  { label: 'Sem alho', extra_price: 0 },
  { label: 'Com alho', extra_price: 2 },
];
const PRODUCT_OPTIONS: Record<string, CartItemOption[]> = {
  'calabresa':       [{ label: 'Sem cebola', extra_price: 0 }, { label: 'Com cebola', extra_price: 2 }],
  'marguerita':      [{ label: 'Sem alho',   extra_price: 0 }, { label: 'Com alho',   extra_price: 0 }],
  'especial-do-mes': CAPRICHO_OPTS,
  'capricho':        CAPRICHO_OPTS,
};

function fmt(price: number | string): string {
  return Number(price).toFixed(2).replace('.', ',');
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();

  const [products, setProducts]               = useState<Product[]>([]);
  const [drinks, setDrinks]                   = useState<Drink[]>([]);
  const [settings, setSettings]               = useState<Settings>({});
  const [storeOpen, setStoreOpen]             = useState(true);
  const [todayLabel, setTodayLabel]           = useState<string | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [user, setUser]                       = useState<User | null>(null);
  const [cart, setCart]                       = useState<CartItem[]>([]);
  const [showModal, setShowModal]             = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [observations, setObservations]       = useState('');
  const [selectedDrinks, setSelectedDrinks]   = useState<DrinkSelection[]>([]);
  const [selectedOption, setSelectedOption]   = useState<CartItemOption | null>(null);
  const [showUserMenu, setShowUserMenu]       = useState(false);
  const [showEmptyCartToast, setShowEmptyCartToast] = useState(false);
  const [stockLimits, setStockLimits]         = useState<Record<string, { enabled: boolean; qty: number }>>({});

  useEffect(() => {
    loadData();
    try { const u = localStorage.getItem('fumego_user'); if (u) setUser(JSON.parse(u)); } catch {}
    try { const c = localStorage.getItem('fumego_cart'); if (c) setCart(JSON.parse(c)); } catch {}
  }, []);

  function saveCart(newCart: CartItem[]) {
    setCart(newCart);
    localStorage.setItem('fumego_cart', JSON.stringify(newCart));
  }

  async function loadData() {
    try {
      const [pRes, dRes, sRes] = await Promise.all([
        supabase.from('products').select('*').order('sort_order'),
        supabase.from('drinks').select('*').eq('is_active', true).order('name'),
        supabase.from('settings').select('*'),
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (dRes.data) setDrinks(dRes.data);
      if (sRes.data) {
        const s: Settings = {};
        sRes.data.forEach((i: { key: string; value: string }) => { s[i.key] = i.value; });
        setSettings(s);

        // Stock limits
        if (s.stock_limits) {
          try { setStockLimits(JSON.parse(s.stock_limits)); } catch {}
        }

        // Compute effective store open status using business hours (Brasília timezone)
        let effectiveOpen = s.store_open === 'true';
        let label: string | null = null;
        if (effectiveOpen && s.business_hours) {
          try {
            const bh = JSON.parse(s.business_hours);
            const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            const dayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][now.getDay()];
            const today = bh[dayKey];
            if (!today || !today.enabled) {
              effectiveOpen = false;
            } else {
              const [openH = 0, openM = 0]   = (today.open  || '00:00').split(':').map(Number);
              const [closeH = 0, closeM = 0] = (today.close || '00:00').split(':').map(Number);
              const nowMin   = now.getHours() * 60 + now.getMinutes();
              effectiveOpen  = nowMin >= (openH * 60 + openM) && nowMin < (closeH * 60 + closeM);
              label = `${today.open} – ${today.close}`;
            }
          } catch { /* keep effectiveOpen as-is */ }
        }
        setStoreOpen(effectiveOpen);
        setTodayLabel(label);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function getProduct(slug: string): Product | undefined {
    return products.find(p => p.slug === slug);
  }

  function openProductModal(product: Product) {
    if (!storeOpen) return;
    setSelectedProduct(product);
    setObservations('');
    setSelectedDrinks([]);
    const opts = PRODUCT_OPTIONS[product.slug];
    setSelectedOption(opts ? opts[0] : null);
    setShowModal(true);
  }

  function toggleDrink(drink: Drink) {
    setSelectedDrinks(prev => {
      const exists = prev.find(d => d.id === drink.id);
      if (exists) return prev.filter(d => d.id !== drink.id);
      return [...prev, { ...drink, quantity: 1 }];
    });
  }

  // FIX: quando qty < 1, remove a bebida ao invés de bloquear
  function updateDrinkQty(drinkId: number, qty: number) {
    if (qty < 1) {
      setSelectedDrinks(prev => prev.filter(d => d.id !== drinkId));
      return;
    }
    setSelectedDrinks(prev => prev.map(d => d.id === drinkId ? { ...d, quantity: qty } : d));
  }

  function addToCart() {
    if (!selectedProduct || !selectedProduct.is_active) return;
    const item: CartItem = {
      id: Date.now(),
      product: selectedProduct,
      observations,
      drinks: selectedDrinks,
      option: selectedOption || null,
    };
    saveCart([...cart, item]);
    setShowModal(false);
  }

  function getCartTotal(): number {
    let t = 0;
    cart.forEach(i => {
      t += Number(i.product.price);
      if (i.option) t += i.option.extra_price;
      i.drinks?.forEach(d => { t += Number(d.price) * d.quantity; });
    });
    return t;
  }

  function goToCheckout() {
    if (cart.length === 0) {
      setShowEmptyCartToast(true);
      setTimeout(() => setShowEmptyCartToast(false), 2500);
      return;
    }
    localStorage.setItem('fumego_cart', JSON.stringify(cart));
    router.push('/checkout');
  }

  function getModalTotal(): number {
    if (!selectedProduct) return 0;
    let t = Number(selectedProduct.price);
    if (selectedOption) t += selectedOption.extra_price;
    selectedDrinks.forEach(d => { t += Number(d.price) * d.quantity; });
    return t;
  }

  function imgUrl(product: Product | undefined): string | null {
    return product?.image_url ?? null;
  }

  function logout() {
    localStorage.removeItem('fumego_token');
    localStorage.removeItem('fumego_user');
    setUser(null);
    setShowUserMenu(false);
  }

  const marguerita  = getProduct('marguerita');
  const calabresa   = getProduct('calabresa');
  const combo       = getProduct('combo-classico');
  const especial    = getProduct('especial-do-mes') ?? getProduct('capricho');
  const logoUrl     = settings.logo_url || null;
  const logoSize    = parseInt(settings.logo_size || '36');
  const deliveryTime = settings.delivery_time || '40–60 min';
  const cartCount   = cart.length;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
        <div style={{ textAlign: 'center' }}>
          <Flame size={48} color={GOLD} style={{ filter: 'drop-shadow(0 0 16px rgba(242,168,0,0.5))' }} />
          <p style={{ color: GOLD, marginTop: 16, animation: 'pulse 1.5s infinite', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>
            Carregando…
          </p>
        </div>
      </div>
    );
  }

  // ── Helpers de estoque ───────────────────────────────────────────────────────
  function getStock(product: Product): { enabled: boolean; qty: number } | null {
    const s = stockLimits[String(product.id)];
    return s?.enabled ? s : null;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG }}>

      {/* ── TOAST CARRINHO VAZIO ── */}
      {showEmptyCartToast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#1C1500', border: `1px solid ${GOLD}`, borderRadius: 12,
          padding: '10px 22px', fontSize: 13, color: GOLD, fontWeight: 600,
          zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          animation: 'fadeIn 0.2s ease-out', whiteSpace: 'nowrap',
        }}>
          Seu carrinho está vazio
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="header" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}>
        {/* left — logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {logoUrl && (
            <img src={logoUrl} alt="Logo" style={{ height: logoSize, objectFit: 'contain', display: 'block' }} />
          )}
        </div>

        {/* center — nome */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
          <h1 style={{
            fontFamily: 'var(--font-cinzel), Cinzel, Georgia, serif',
            fontSize: 22, fontWeight: 900, color: GOLD,
            letterSpacing: 5, textShadow: `0 0 24px rgba(242,168,0,0.4)`,
          }}>
            FUMÊGO
          </h1>
        </div>

        {/* right — ícones */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
          {/* Carrinho */}
          <button onClick={goToCheckout} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', position: 'relative', padding: 4 }}>
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
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserMenu(prev => !prev)}
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
                  <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setShowUserMenu(false)} />
                  <div style={{
                    position: 'absolute', top: 42, right: 0,
                    background: '#1A1400', border: `1px solid ${BORDER}`,
                    borderRadius: 14, padding: '6px 0', minWidth: 210, zIndex: 200,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                    animation: 'fadeIn 0.15s ease-out',
                  }}>
                    <div style={{ padding: '10px 16px 10px', borderBottom: `1px solid ${BORDER}` }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{user.name}</p>
                      <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{user.email}</p>
                    </div>

                    {[
                      { icon: <Settings size={15} />, label: 'Configurações da conta', action: () => { setShowUserMenu(false); router.push('/account'); } },
                      { icon: <Package size={15} />, label: 'Ver meus pedidos', action: () => { setShowUserMenu(false); router.push('/orders'); } },
                    ].map(item => (
                      <button key={item.label}
                        onClick={item.action}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 16px', background: 'none', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <span style={{ color: MUTED }}>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}

                    <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />

                    <button
                      onClick={logout}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 16px', background: 'none', border: 'none', color: '#E04040', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      <LogOut size={15} />
                      Sair da conta
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <User size={22} color={MUTED} />
            </button>
          )}
        </div>
      </header>

      {/* ── LOJA FECHADA ── */}
      {!storeOpen && (
        <div style={{
          background: 'rgba(224,64,64,0.12)', borderBottom: '1px solid rgba(224,64,64,0.25)',
          color: '#FF8080', textAlign: 'center', padding: '10px 16px', fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: 0.5,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E04040', display: 'inline-block', boxShadow: '0 0 8px #E04040' }} />
          Estamos fechados no momento
        </div>
      )}

      {/* ── PIZZA HERO ── */}
      {calabresa && marguerita && (
        <section style={{ padding: '32px 16px 16px', textAlign: 'center', background: 'radial-gradient(ellipse at 50% 30%, rgba(242,168,0,0.07) 0%, transparent 65%)' }}>
          <p style={{ color: FAINT, fontSize: 10, textTransform: 'uppercase', letterSpacing: 5, fontWeight: 700, marginBottom: 24 }}>
            ✦ &nbsp;Pizzas Clássicas&nbsp; ✦
          </p>

          <div style={{ position: 'relative', width: 300, margin: '0 auto' }}>
            {/* Brilho */}
            <div style={{
              position: 'absolute', inset: -20, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(242,168,0,0.1) 0%, transparent 70%)',
              pointerEvents: 'none', animation: 'glow 3s ease-in-out infinite',
            }} />

            {/* Círculo */}
            <div style={{
              width: 300, height: 300, borderRadius: '50%',
              position: 'relative', overflow: 'hidden',
              border: `3px solid ${GOLD}`,
              boxShadow: `0 0 0 1px rgba(242,168,0,0.1), 0 16px 48px rgba(0,0,0,0.8), 0 0 40px rgba(242,168,0,0.08)`,
            }}>
              {/* Metade esquerda — Calabresa */}
              <div onClick={() => openProductModal(calabresa)} style={{
                position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
                cursor: storeOpen ? 'pointer' : 'default', overflow: 'hidden',
              }}>
                {imgUrl(calabresa) ? (
                  <img src={imgUrl(calabresa)!} alt="Calabresa"
                    style={{ width: '200%', height: '100%', objectFit: 'cover', objectPosition: 'left center', filter: calabresa.is_active ? 'none' : 'grayscale(70%) brightness(0.5)' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: calabresa.is_active ? 'linear-gradient(160deg, #5A1800, #8B3200)' : '#2A1A1A' }} />
                )}
                {!calabresa.is_active && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ color: '#E04040', fontWeight: 900, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', transform: 'rotate(-30deg)', textShadow: '0 0 8px rgba(0,0,0,0.8)', border: '2px solid #E04040', padding: '3px 7px', borderRadius: 4, background: 'rgba(0,0,0,0.6)' }}>
                      ESGOTADO
                    </span>
                  </div>
                )}
              </div>

              {/* Metade direita — Marguerita */}
              <div onClick={() => openProductModal(marguerita)} style={{
                position: 'absolute', top: 0, right: 0, width: '50%', height: '100%',
                cursor: storeOpen ? 'pointer' : 'default', overflow: 'hidden',
              }}>
                {imgUrl(marguerita) ? (
                  <img src={imgUrl(marguerita)!} alt="Marguerita"
                    style={{ width: '200%', height: '100%', objectFit: 'cover', objectPosition: 'right center', filter: marguerita.is_active ? 'none' : 'grayscale(70%) brightness(0.5)' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: marguerita.is_active ? 'linear-gradient(160deg, #1A5A1A, #2E7D32)' : '#1A2A1A' }} />
                )}
                {!marguerita.is_active && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ color: '#E04040', fontWeight: 900, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', transform: 'rotate(30deg)', textShadow: '0 0 8px rgba(0,0,0,0.8)', border: '2px solid #E04040', padding: '3px 7px', borderRadius: 4, background: 'rgba(0,0,0,0.6)' }}>
                      ESGOTADO
                    </span>
                  </div>
                )}
              </div>

              {/* Divisor */}
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 2, height: '100%',
                background: `linear-gradient(to bottom, transparent 0%, ${GOLD} 30%, ${GOLD} 70%, transparent 100%)`,
                zIndex: 5,
              }} />
            </div>

            {/* Labels de preço fora do overflow:hidden */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', pointerEvents: 'none', zIndex: 10 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '32px 8px 18px', background: 'linear-gradient(to top, rgba(8,6,0,0.95) 0%, rgba(8,6,0,0.55) 60%, transparent 100%)', borderRadius: '0 0 0 150px' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Calabresa</p>
                {calabresa.is_active
                  ? <p style={{ fontSize: 15, fontWeight: 800, color: GOLD, marginTop: 4 }}>R$ {fmt(calabresa.price)}</p>
                  : <p style={{ fontSize: 11, fontWeight: 800, color: '#E04040', marginTop: 4, letterSpacing: 1.5 }}>ESGOTADO</p>
                }
                {(() => { const s = getStock(calabresa); return s && s.qty > 0 && s.qty <= 3 ? <p style={{ fontSize: 10, color: '#F6AD55', marginTop: 3, fontWeight: 700 }}>Poucas unidades!</p> : null; })()}
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '32px 8px 18px', background: 'linear-gradient(to top, rgba(8,6,0,0.95) 0%, rgba(8,6,0,0.55) 60%, transparent 100%)', borderRadius: '0 0 150px 0' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Marguerita</p>
                {marguerita.is_active
                  ? <p style={{ fontSize: 15, fontWeight: 800, color: GOLD, marginTop: 4 }}>R$ {fmt(marguerita.price)}</p>
                  : <p style={{ fontSize: 11, fontWeight: 800, color: '#E04040', marginTop: 4, letterSpacing: 1.5 }}>ESGOTADO</p>
                }
                {(() => { const s = getStock(marguerita); return s && s.qty > 0 && s.qty <= 3 ? <p style={{ fontSize: 10, color: '#F6AD55', marginTop: 3, fontWeight: 700 }}>Poucas unidades!</p> : null; })()}
              </div>
            </div>
          </div>

          {/* Info abaixo do círculo */}
          <p style={{ color: '#2E1E08', fontSize: 11, marginTop: 20, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            toque para pedir
          </p>

          {/* Status da loja: Aberto / Fechado */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
              background: storeOpen ? '#48BB78' : '#E04040',
              boxShadow: `0 0 7px ${storeOpen ? '#48BB78' : '#E04040'}`,
            }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: storeOpen ? '#48BB78' : '#E04040', letterSpacing: 0.3 }}>
              {storeOpen
                ? (todayLabel ? `Aberto: ${todayLabel}` : 'Aberto')
                : 'Fechado'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: FAINT, fontSize: 12 }}>
              <Truck size={13} color={FAINT} /> Apenas entrega
            </span>
            <span style={{ width: 1, height: 12, background: BORDER, display: 'inline-block' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: FAINT, fontSize: 12 }}>
              <Clock size={13} color={FAINT} /> {deliveryTime}
            </span>
          </div>
        </section>
      )}

      {/* ── COMBO ── */}
      {combo && (
        <section style={{ margin: '4px 16px 14px' }}>
          <div style={{
            borderRadius: 20, overflow: 'hidden', background: CARD,
            border: combo.is_active ? '1px solid rgba(242,168,0,0.2)' : `1px solid ${BORDER}`,
            boxShadow: '0 6px 32px rgba(0,0,0,0.55)',
            cursor: storeOpen ? 'pointer' : 'default',
            opacity: combo.is_active ? 1 : 0.75,
          }}
            onClick={() => openProductModal(combo)}
          >
            <div style={{ position: 'relative' }}>
              {imgUrl(combo) ? (
                <img src={imgUrl(combo)!} alt={combo.name} style={{ width: '100%', height: 195, objectFit: 'cover', display: 'block', filter: combo.is_active ? 'none' : 'grayscale(60%) brightness(0.6)' }} />
              ) : (
                <div style={{ width: '100%', height: 195, background: '#251800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UtensilsCrossed size={48} color="#5A3800" />
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,21,0,1) 0%, rgba(28,21,0,0.3) 50%, transparent 100%)' }} />
              {combo.is_active ? (
                <div style={{ position: 'absolute', top: 14, left: 14, background: '#E04040', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 11px', borderRadius: 20, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Economize R$10
                </div>
              ) : (
                <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,0.7)', color: '#E04040', fontSize: 10, fontWeight: 800, padding: '4px 11px', borderRadius: 20, letterSpacing: 1, textTransform: 'uppercase', border: '1px solid #E04040' }}>
                  Esgotado
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 18px 16px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 6, background: 'rgba(10,8,0,0.72)', border: '1px solid rgba(242,168,0,0.35)', color: GOLD, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                  <Flame size={12} /> Combo Fumêgo
                </div>
                <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 22, fontWeight: 700, color: '#fff' }}>{combo.name}</h2>
              </div>
            </div>
            <div style={{ padding: '14px 18px 18px' }}>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>{combo.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  {combo.is_active && <p style={{ color: FAINT, textDecoration: 'line-through', fontSize: 13 }}>R$ 90,00</p>}
                  <p style={{ color: combo.is_active ? GOLD : '#E04040', fontSize: combo.is_active ? 26 : 16, fontWeight: 800, lineHeight: 1.1 }}>
                    {combo.is_active ? <>R$&nbsp;{fmt(combo.price)}</> : 'Indisponível no momento'}
                  </p>
                </div>
                {combo.is_active && (
                  <button
                    onClick={e => { e.stopPropagation(); openProductModal(combo); }}
                    disabled={!storeOpen}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: BG, border: 'none', borderRadius: 13, padding: '13px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 18px rgba(242,168,0,0.35)` }}
                  >
                    Pedir <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── ESPECIAL DO MÊS / CAPRICHO ── */}
      {especial && (
        <section style={{ margin: '0 16px 20px' }}>
          <div style={{
            borderRadius: 20, overflow: 'hidden', background: CARD,
            border: `1px solid ${BORDER}`, boxShadow: '0 6px 32px rgba(0,0,0,0.45)',
            cursor: storeOpen ? 'pointer' : 'default',
            opacity: especial.is_active ? 1 : 0.75,
          }}
            onClick={() => openProductModal(especial)}
          >
            <div style={{ position: 'relative' }}>
              {imgUrl(especial) ? (
                <img src={imgUrl(especial)!} alt="Especial" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block', filter: especial.is_active ? 'none' : 'grayscale(60%) brightness(0.6)' }} />
              ) : (
                <div style={{ width: '100%', height: 180, background: '#201600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Star size={48} color="#5A3800" />
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,21,0,0.9) 0%, transparent 55%)' }} />
              <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(10,8,0,0.72)', border: `1px solid ${especial.is_active ? 'rgba(242,168,0,0.4)' : '#E04040'}`, color: especial.is_active ? GOLD : '#E04040', fontSize: 10, fontWeight: 700, padding: '4px 11px', borderRadius: 20, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                <Star size={11} fill={especial.is_active ? GOLD : '#E04040'} /> {especial.is_active ? 'Especial do Mês' : 'Esgotado'}
              </div>
            </div>
            <div style={{ padding: '16px 18px 18px' }}>
              <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                {settings.special_flavor_name || 'Sabor Especial'}
              </h2>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.55, marginTop: 7 }}>
                {settings.special_flavor_description || especial.description}
              </p>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: especial.is_active ? GOLD : '#E04040', fontSize: especial.is_active ? 26 : 15, fontWeight: 800 }}>
                  {especial.is_active ? `R$ ${fmt(especial.price)}` : 'Indisponível no momento'}
                </span>
                {especial.is_active && (
                  <button
                    onClick={e => { e.stopPropagation(); openProductModal(especial); }}
                    disabled={!storeOpen}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px', background: 'transparent', color: GOLD, border: `1.5px solid ${GOLD}`, borderRadius: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Quero <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── CARRINHO FLUTUANTE ── */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, padding: '14px 18px',
          background: 'rgba(18, 13, 0, 0.97)', backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(242,168,0,0.2)', zIndex: 40,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={16} color={GOLD} />
              <span style={{ color: GOLD, fontWeight: 800 }}>{cartCount}</span>
              <span style={{ color: MUTED, fontSize: 13 }}>{cartCount === 1 ? 'item' : 'itens'}</span>
            </div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>R$ {getCartTotal().toFixed(2).replace('.', ',')}</span>
          </div>
          <button className="btn-primary" onClick={goToCheckout}>
            Ir para o Checkout
          </button>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer style={{ textAlign: 'center', color: FAINT, fontSize: 11, padding: '12px 16px', paddingBottom: cartCount > 0 ? 132 : 24, letterSpacing: 2, textTransform: 'uppercase' }}>
        Fumêgo © {new Date().getFullYear()}
      </footer>

      {/* ── MODAL PRODUTO ── */}
      {showModal && selectedProduct && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#141000', borderRadius: '24px 24px 0 0', border: `1px solid ${BORDER}`,
            borderBottom: 'none', width: '100%', maxWidth: 480,
            maxHeight: '88vh', overflowY: 'auto', padding: '0 20px 36px',
            animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: `0 -4px 50px rgba(242,168,0,0.07)`,
          }}>
            <div style={{ padding: '14px 0 22px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 4, background: BORDER, borderRadius: 2 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <h3 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 22, fontWeight: 700, color: '#fff', flex: 1, paddingRight: 12, lineHeight: 1.2 }}>
                {selectedProduct.name}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: BORDER, border: 'none', color: MUTED, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: MUTED, marginBottom: 14, lineHeight: 1.55 }}>{selectedProduct.description}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: selectedProduct.is_active ? GOLD : '#E04040', marginBottom: 22 }}>
              {selectedProduct.is_active ? `R$ ${fmt(selectedProduct.price)}` : 'ESGOTADO'}
            </p>

            {/* Opções do produto */}
            {selectedProduct.is_active && PRODUCT_OPTIONS[selectedProduct.slug] && (
              <div style={{ marginBottom: 22 }}>
                <label style={{ fontSize: 11, color: MUTED, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Opções</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PRODUCT_OPTIONS[selectedProduct.slug].map(opt => {
                    const isSelected = selectedOption?.label === opt.label;
                    return (
                      <div key={opt.label} onClick={() => setSelectedOption(opt)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: 13, cursor: 'pointer',
                        border: isSelected ? `1.5px solid ${GOLD}` : `1px solid ${BORDER}`,
                        background: isSelected ? 'rgba(242,168,0,0.07)' : '#1A1400',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}>
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
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 11, color: MUTED, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Observações</label>
              <textarea className="input-field" rows={2} placeholder="Ex: Borda recheada…" value={observations} onChange={e => setObservations(e.target.value)} style={{ resize: 'none' }} />
            </div>

            {drinks.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <GlassWater size={14} color={MUTED} />
                  <p style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>Adicionar bebida?</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {drinks.map(drink => {
                    const sel = selectedDrinks.find(d => d.id === drink.id);
                    return (
                      <div key={drink.id} onClick={() => toggleDrink(drink)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: 13,
                        border: sel ? `1.5px solid ${GOLD}` : `1px solid ${BORDER}`,
                        background: sel ? 'rgba(242,168,0,0.07)' : '#1A1400',
                        cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                      }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{drink.name}</p>
                          <p style={{ fontSize: 12, color: MUTED }}>{drink.size}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>R$ {fmt(drink.price)}</span>
                          {sel && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => updateDrinkQty(drink.id, sel.quantity - 1)}
                                style={{ width: 28, height: 28, borderRadius: '50%', background: BORDER, color: MUTED, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Minus size={14} />
                              </button>
                              <span style={{ color: '#fff', fontSize: 14, width: 18, textAlign: 'center' }}>{sel.quantity}</span>
                              <button
                                onClick={() => updateDrinkQty(drink.id, sel.quantity + 1)}
                                style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: BG, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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

            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}>
              {selectedProduct.is_active && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ color: MUTED, fontSize: 13 }}>Total deste item:</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>R$ {getModalTotal().toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              {selectedProduct.is_active ? (
                <button className="btn-primary" onClick={addToCart}>Adicionar ao Carrinho</button>
              ) : (
                <div style={{ padding: '14px 20px', textAlign: 'center', background: 'rgba(224,64,64,0.1)', border: '1px solid rgba(224,64,64,0.3)', borderRadius: 14, color: '#E04040', fontWeight: 700, letterSpacing: 0.5, fontSize: 14 }}>
                  Produto esgotado — indisponível no momento
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
