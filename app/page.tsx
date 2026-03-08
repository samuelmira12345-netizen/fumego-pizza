'use client';

import { useState, useEffect } from 'react';
import {
  Clock, Truck, ChevronRight, Flame, Star, UtensilsCrossed,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

// ── Componentes extraídos ─────────────────────────────────────────────────────
import StoreHeader from './components/home/StoreHeader';
import ProductModal from './components/home/ProductModal';
import FloatingCart from './components/home/FloatingCart';
import type { Product, Drink, DrinkSelection, CartItem, CartItemOption, AppSettings, AppUser, StockLimit, ImagePosition } from './components/home/types';
import {
  GOLD, GOLD_LIGHT, BG, CARD, BORDER, MUTED, FAINT,
  PRODUCT_OPTIONS, COMBO_CALABRESA_OPTS, COMBO_MARGUERITA_OPTS, fmt,
} from './components/home/tokens';

// ── Tipos locais ──────────────────────────────────────────────────────────────
// (Types migrados para app/components/home/types.ts)
// Mantidos aqui como aliases para retrocompatibilidade interna do arquivo:
type Settings = AppSettings;
type User = AppUser;

// ── Componente ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();

  const [products, setProducts]               = useState<Product[]>([]);
  const [drinks, setDrinks]                   = useState<Drink[]>([]);
  const [settings, setSettings]               = useState<Settings>({});
  const [storeOpen, setStoreOpen]             = useState(true);
  const [todayLabel, setTodayLabel]           = useState<string | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [loadingLogoUrl, setLoadingLogoUrl]   = useState<string | null>(() => {
    try { return localStorage.getItem('fumego_logo_url'); } catch { return null; }
  });
  const [user, setUser]                       = useState<User | null>(null);
  const [cart, setCart]                       = useState<CartItem[]>([]);
  const [showModal, setShowModal]             = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [observations, setObservations]       = useState('');
  const [selectedDrinks, setSelectedDrinks]   = useState<DrinkSelection[]>([]);
  const [selectedOption, setSelectedOption]   = useState<CartItemOption | null>(null);
  const [selectedOption2, setSelectedOption2] = useState<CartItemOption | null>(null);
  const [showUserMenu, setShowUserMenu]       = useState(false);
  const [showEmptyCartToast, setShowEmptyCartToast] = useState(false);
  const [stockLimits, setStockLimits]         = useState<Record<string, StockLimit>>({});
  const [imagePositions, setImagePositions]   = useState<Record<string, ImagePosition>>({});
  const [cashbackBalance, setCashbackBalance] = useState(0);

  useEffect(() => {
    router.prefetch('/checkout');
    loadData();
    try {
      const u = localStorage.getItem('fumego_user');
      if (u) {
        const parsed = JSON.parse(u);
        setUser(parsed);
        if (parsed?.id) {
          fetch(`/api/cashback/balance?user_id=${parsed.id}`)
            .then(r => r.json())
            .then(d => setCashbackBalance(d.balance || 0))
            .catch(() => {});
        }
      }
    } catch {}
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
      if (pRes.data) {
        // Filtra produtos ocultos do cardápio, exceto calabresa e marguerita (capa da loja)
        const visibleProducts = pRes.data.filter((p: Product) =>
          !p.is_hidden || p.slug === 'calabresa' || p.slug === 'marguerita'
        );
        setProducts(visibleProducts);
      }
      if (sRes.data) {
        const s: Settings = {};
        sRes.data.forEach((i: { key: string; value: string }) => { s[i.key] = i.value; });
        setSettings(s);

        // Cacheia a logo no localStorage para ser usada na próxima tela de loading
        if (s.logo_url) {
          try { localStorage.setItem('fumego_logo_url', s.logo_url); } catch {}
          setLoadingLogoUrl(s.logo_url);
        }

        // Stock limits
        if (s.stock_limits) {
          try { setStockLimits(JSON.parse(s.stock_limits)); } catch {}
        }

        // Filtra bebidas: remove as que têm controle de estoque ativo com qty = 0
        if (dRes.data) {
          let drinkStockMap: Record<string, { enabled: boolean; qty: number }> = {};
          if (s.drink_stock_limits) {
            try { drinkStockMap = JSON.parse(s.drink_stock_limits); } catch {}
          }
          const visibleDrinks = dRes.data.filter((d: Drink) => {
            const sl = drinkStockMap[String(d.id)];
            return !sl || !sl.enabled || sl.qty > 0;
          });
          setDrinks(visibleDrinks);
        }

        // Image positions
        if (s.image_positions) {
          try { setImagePositions(JSON.parse(s.image_positions)); } catch {}
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
      } else if (dRes.data) {
        // Fallback: sem settings, mostra todas as bebidas ativas
        setDrinks(dRes.data);
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
    if (product.slug === 'combo-classico') {
      setSelectedOption(COMBO_CALABRESA_OPTS[0]);
      setSelectedOption2(COMBO_MARGUERITA_OPTS[0]);
    } else {
      const opts = PRODUCT_OPTIONS[product.slug];
      setSelectedOption(opts ? opts[0] : null);
      setSelectedOption2(null);
    }
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
      option2: selectedOption2 || null,
    };
    saveCart([...cart, item]);
    setShowModal(false);
  }

  function getCartTotal(): number {
    let t = 0;
    cart.forEach(i => {
      t += Number(i.product.price);
      if (i.option) t += i.option.extra_price;
      if (i.option2) t += i.option2.extra_price;
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
    if (selectedOption2) t += selectedOption2.extra_price;
    selectedDrinks.forEach(d => { t += Number(d.price) * d.quantity; });
    return t;
  }

  function imgUrl(product: Product | undefined): string | null {
    return product?.image_url ?? null;
  }

  async function logout() {
    // Invalida o cookie httpOnly no servidor antes de limpar o estado local
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
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
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: BG }}>
        {loadingLogoUrl ? (
          <img
            src={loadingLogoUrl}
            alt="FUMÊGO"
            style={{ width: 96, height: 96, objectFit: 'contain', filter: 'drop-shadow(0 0 28px rgba(242,168,0,0.5))' }}
          />
        ) : (
          <Flame size={64} color={GOLD} style={{ filter: 'drop-shadow(0 0 20px rgba(242,168,0,0.5))' }} />
        )}
        <p style={{ fontFamily: 'var(--font-cinzel), Cinzel, Georgia, serif', fontSize: 34, fontWeight: 900, color: GOLD, letterSpacing: 8, marginTop: 22, textShadow: '0 0 28px rgba(242,168,0,0.45)' }}>
          FUMÊGO
        </p>
        <p style={{ color: GOLD, marginTop: 18, animation: 'pulse 1.5s infinite', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>
          Carregando…
        </p>
      </div>
    );
  }

  // ── Helpers de estoque ───────────────────────────────────────────────────────
  function getStock(product: Product): { enabled: boolean; qty: number; low_stock_threshold?: number } | null {
    const s = stockLimits[String(product.id)];
    return s?.enabled ? s : null;
  }

  function getImgPosition(product: Product, fallback = '50% 50%'): string {
    const pos = imagePositions[String(product.id)];
    return pos ? `${pos.x}% ${pos.y}%` : fallback;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG }}>

      {/* ── TOAST CARRINHO VAZIO ── */}
      {showEmptyCartToast && (
        <div style={{
          position: 'fixed', top: 80, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          zIndex: 300, pointerEvents: 'none',
        }}>
          <div style={{
            background: '#1C1500', border: `1px solid ${GOLD}`, borderRadius: 12,
            padding: '10px 22px', fontSize: 13, color: GOLD, fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            animation: 'fadeIn 0.2s ease-out', whiteSpace: 'nowrap',
          }}>
            Seu carrinho está vazio
          </div>
        </div>
      )}

      {/* ── HEADER (componente extraído) ── */}
      <StoreHeader
        user={user}
        cartCount={cartCount}
        showUserMenu={showUserMenu}
        setShowUserMenu={setShowUserMenu}
        logoUrl={logoUrl}
        logoSize={logoSize}
        onGoToCheckout={goToCheckout}
        onLogout={logout}
        cashbackBalance={cashbackBalance}
      />

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
        <section style={{ padding: '32px 16px 16px', textAlign: 'center', background: 'radial-gradient(ellipse at 50% 30%, rgba(242,168,0,0.20) 0%, transparent 65%)' }}>
          <p style={{ color: MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: 5, fontWeight: 700, marginBottom: 24 }}>
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
                    style={{ width: '200%', height: '100%', objectFit: 'cover', objectPosition: getImgPosition(calabresa, '0% 50%'), filter: calabresa.is_active ? 'none' : 'grayscale(70%) brightness(0.5)' }} />
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
                    style={{ width: '200%', height: '100%', objectFit: 'cover', objectPosition: getImgPosition(marguerita, '100% 50%'), filter: marguerita.is_active ? 'none' : 'grayscale(70%) brightness(0.5)' }} />
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
                {(() => { const s = getStock(calabresa); const thr = s?.low_stock_threshold ?? 3; return calabresa.is_active && s && s.qty > 0 && s.qty <= thr ? <p style={{ fontSize: 10, color: '#F6AD55', marginTop: 3, fontWeight: 700 }}>Poucas unidades!</p> : null; })()}
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '32px 8px 18px', background: 'linear-gradient(to top, rgba(8,6,0,0.95) 0%, rgba(8,6,0,0.55) 60%, transparent 100%)', borderRadius: '0 0 150px 0' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Marguerita</p>
                {marguerita.is_active
                  ? <p style={{ fontSize: 15, fontWeight: 800, color: GOLD, marginTop: 4 }}>R$ {fmt(marguerita.price)}</p>
                  : <p style={{ fontSize: 11, fontWeight: 800, color: '#E04040', marginTop: 4, letterSpacing: 1.5 }}>ESGOTADO</p>
                }
                {(() => { const s = getStock(marguerita); const thr = s?.low_stock_threshold ?? 3; return marguerita.is_active && s && s.qty > 0 && s.qty <= thr ? <p style={{ fontSize: 10, color: '#F6AD55', marginTop: 3, fontWeight: 700 }}>Poucas unidades!</p> : null; })()}
              </div>
            </div>
          </div>

          {/* Info abaixo do círculo */}
          <p style={{ color: MUTED, fontSize: 11, marginTop: 20, letterSpacing: 1.5, textTransform: 'uppercase' }}>
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
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: MUTED, fontSize: 12 }}>
              <Truck size={13} color={MUTED} /> Apenas entrega
            </span>
            <span style={{ width: 1, height: 12, background: BORDER, display: 'inline-block' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: MUTED, fontSize: 12 }}>
              <Clock size={13} color={MUTED} /> {deliveryTime}
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
                <img src={imgUrl(combo)!} alt={combo.name} style={{ width: '100%', height: 195, objectFit: 'cover', objectPosition: getImgPosition(combo), display: 'block', filter: combo.is_active ? 'none' : 'grayscale(60%) brightness(0.6)' }} />
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
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.55, marginBottom: 8 }}>{combo.description}</p>
              {(() => { const s = getStock(combo); const thr = s?.low_stock_threshold ?? 3; return combo.is_active && s && s.qty > 0 && s.qty <= thr ? <p style={{ fontSize: 11, color: '#F6AD55', marginBottom: 8, fontWeight: 700 }}>Poucas unidades!</p> : null; })()}
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
                <img src={imgUrl(especial)!} alt="Especial" style={{ width: '100%', height: 180, objectFit: 'cover', objectPosition: getImgPosition(especial), display: 'block', filter: especial.is_active ? 'none' : 'grayscale(60%) brightness(0.6)' }} />
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
              {(() => { const s = getStock(especial); const thr = s?.low_stock_threshold ?? 3; return especial.is_active && s && s.qty > 0 && s.qty <= thr ? <p style={{ fontSize: 11, color: '#F6AD55', marginTop: 6, fontWeight: 700 }}>Poucas unidades!</p> : null; })()}
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

      {/* ── CARRINHO FLUTUANTE (componente extraído) ── */}
      <FloatingCart
        itemCount={cartCount}
        total={getCartTotal()}
        onCheckout={goToCheckout}
      />

      {/* ── FOOTER ── */}
      <footer style={{ textAlign: 'center', color: FAINT, fontSize: 11, padding: '12px 16px', paddingBottom: cartCount > 0 ? 132 : 24, letterSpacing: 2, textTransform: 'uppercase' }}>
        Fumêgo © {new Date().getFullYear()}
      </footer>

      {/* ── MODAL PRODUTO (componente extraído) ── */}
      {showModal && selectedProduct && (
        <ProductModal
          product={selectedProduct}
          drinks={drinks}
          observations={observations}
          setObservations={setObservations}
          selectedDrinks={selectedDrinks}
          toggleDrink={toggleDrink}
          updateDrinkQty={updateDrinkQty}
          selectedOption={selectedOption}
          setSelectedOption={setSelectedOption}
          selectedOption2={selectedOption2}
          setSelectedOption2={setSelectedOption2}
          modalTotal={getModalTotal()}
          onClose={() => setShowModal(false)}
          onAddToCart={addToCart}
        />
      )}
    </div>
  );
}