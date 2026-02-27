'use client';

import { useState, useEffect } from 'react';
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

interface CartItem {
  id: number;
  product: Product;
  observations: string;
  drinks: DrinkSelection[];
}

interface Settings {
  [key: string]: string;
}

interface User {
  name: string;
  email: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const GOLD       = '#F2A800';
const GOLD_LIGHT = '#FFD060';
const BG         = '#080600';
const CARD       = '#1C1500';
const BORDER     = '#2C1E00';
const MUTED      = '#7A6040';
const FAINT      = '#3A2810';

function fmt(price: number | string): string {
  return Number(price).toFixed(2).replace('.', ',');
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();

  const [products, setProducts]               = useState<Product[]>([]);
  const [drinks, setDrinks]                   = useState<Drink[]>([]);
  const [settings, setSettings]               = useState<Settings>({});
  const [storeOpen, setStoreOpen]             = useState(true);
  const [loading, setLoading]                 = useState(true);
  const [user, setUser]                       = useState<User | null>(null);
  const [cart, setCart]                       = useState<CartItem[]>([]);
  const [showModal, setShowModal]             = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [observations, setObservations]       = useState('');
  const [selectedDrinks, setSelectedDrinks]   = useState<DrinkSelection[]>([]);

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
        supabase.from('products').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('drinks').select('*').eq('is_active', true).order('name'),
        supabase.from('settings').select('*'),
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (dRes.data) setDrinks(dRes.data);
      if (sRes.data) {
        const s: Settings = {};
        sRes.data.forEach((i: { key: string; value: string }) => { s[i.key] = i.value; });
        setSettings(s);
        setStoreOpen(s.store_open === 'true');
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
    setShowModal(true);
  }

  function toggleDrink(drink: Drink) {
    setSelectedDrinks(prev => {
      const exists = prev.find(d => d.id === drink.id);
      if (exists) return prev.filter(d => d.id !== drink.id);
      return [...prev, { ...drink, quantity: 1 }];
    });
  }

  function updateDrinkQty(drinkId: number, qty: number) {
    if (qty < 1) return;
    setSelectedDrinks(prev => prev.map(d => d.id === drinkId ? { ...d, quantity: qty } : d));
  }

  function addToCart() {
    if (!selectedProduct) return;
    const item: CartItem = {
      id: Date.now(),
      product: selectedProduct,
      observations,
      drinks: selectedDrinks,
    };
    saveCart([...cart, item]);
    setShowModal(false);
  }

  function getCartTotal(): number {
    let t = 0;
    cart.forEach(i => {
      t += Number(i.product.price);
      i.drinks?.forEach(d => { t += Number(d.price) * d.quantity; });
    });
    return t;
  }

  function goToCheckout() {
    if (cart.length === 0) return;
    localStorage.setItem('fumego_cart', JSON.stringify(cart));
    router.push('/checkout');
  }

  function getModalTotal(): number {
    if (!selectedProduct) return 0;
    let t = Number(selectedProduct.price);
    selectedDrinks.forEach(d => { t += Number(d.price) * d.quantity; });
    return t;
  }

  function imgUrl(product: Product | undefined): string | null {
    return product?.image_url ?? null;
  }

  const marguerita = getProduct('marguerita');
  const calabresa  = getProduct('calabresa');
  const combo      = getProduct('combo-classico');
  const especial   = getProduct('especial-do-mes');
  const logoUrl    = settings.logo_url ?? null;
  const cartCount  = cart.length;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: BG,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, filter: 'drop-shadow(0 0 16px rgba(242,168,0,0.5))' }}>🍕</div>
          <p style={{
            color: GOLD, marginTop: 16, animation: 'pulse 1.5s infinite',
            fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700,
          }}>
            Carregando…
          </p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG }}>

      {/* ── HEADER ── */}
      <header className="header" style={{ justifyContent: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {logoUrl ? (
            <img src={logoUrl} alt="FUMÊGO" style={{ height: 38, objectFit: 'contain' }} />
          ) : (
            <h1 style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontSize: 24, fontWeight: 700, color: GOLD,
              letterSpacing: 4, textShadow: `0 0 24px rgba(242,168,0,0.45)`,
            }}>
              FUMÊGO
            </h1>
          )}
        </div>

        <div style={{ position: 'absolute', right: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Cart icon */}
          <button
            onClick={goToCheckout}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', position: 'relative', padding: 4 }}
          >
            🛒
            {cartCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -6,
                background: '#E04040', color: '#fff',
                fontSize: 9, fontWeight: 800,
                width: 17, height: 17, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${BG}`,
              }}>
                {cartCount}
              </span>
            )}
          </button>

          {/* User icon */}
          {user ? (
            <button
              onClick={() => {
                localStorage.removeItem('fumego_token');
                localStorage.removeItem('fumego_user');
                setUser(null);
              }}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                color: BG, border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                boxShadow: `0 0 12px rgba(242,168,0,0.4)`,
              }}
            >
              {user.name?.charAt(0).toUpperCase()}
            </button>
          ) : (
            <button
              onClick={() => router.push('/login')}
              style={{ background: 'none', border: 'none', color: MUTED, fontSize: 20, cursor: 'pointer' }}
            >
              👤
            </button>
          )}
        </div>
      </header>

      {/* ── STORE CLOSED BANNER ── */}
      {!storeOpen && (
        <div style={{
          background: 'rgba(224,64,64,0.12)',
          borderBottom: '1px solid rgba(224,64,64,0.25)',
          color: '#FF8080', textAlign: 'center',
          padding: '10px 16px', fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          letterSpacing: 0.5,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#E04040', display: 'inline-block',
            boxShadow: '0 0 8px #E04040',
          }} />
          Estamos fechados no momento
        </div>
      )}

      {/* ── PIZZA HERO ── */}
      {calabresa && marguerita && (
        <section style={{ padding: '32px 16px 16px', textAlign: 'center' }}>

          {/* Eyebrow */}
          <p style={{
            color: FAINT, fontSize: 10, textTransform: 'uppercase',
            letterSpacing: 5, fontWeight: 700, marginBottom: 24,
          }}>
            ✦ &nbsp;Pizzas Clássicas&nbsp; ✦
          </p>

          <div style={{ position: 'relative', width: 300, margin: '0 auto' }}>

            {/* Ambient glow behind circle */}
            <div style={{
              position: 'absolute', inset: -20, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(242,168,0,0.1) 0%, transparent 70%)',
              pointerEvents: 'none',
              animation: 'glow 3s ease-in-out infinite',
            }} />

            {/* Pizza circle */}
            <div style={{
              width: 300, height: 300, borderRadius: '50%',
              position: 'relative', overflow: 'hidden',
              border: `3px solid ${GOLD}`,
              boxShadow: `0 0 0 1px rgba(242,168,0,0.1), 0 16px 48px rgba(0,0,0,0.8), 0 0 40px rgba(242,168,0,0.08)`,
            }}>
              {/* Left half – Calabresa */}
              <div
                onClick={() => openProductModal(calabresa)}
                style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', cursor: 'pointer', overflow: 'hidden' }}
              >
                {imgUrl(calabresa) ? (
                  <img
                    src={imgUrl(calabresa)!} alt="Calabresa"
                    style={{ width: '200%', height: '100%', objectFit: 'cover', objectPosition: 'left center' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #5A1800, #8B3200)' }} />
                )}
              </div>

              {/* Right half – Marguerita */}
              <div
                onClick={() => openProductModal(marguerita)}
                style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', cursor: 'pointer', overflow: 'hidden' }}
              >
                {imgUrl(marguerita) ? (
                  <img
                    src={imgUrl(marguerita)!} alt="Marguerita"
                    style={{ width: '200%', height: '100%', objectFit: 'cover', objectPosition: 'right center' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #1A5A1A, #2E7D32)' }} />
                )}
              </div>

              {/* Center divider – gold gradient line */}
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 2, height: '100%',
                background: `linear-gradient(to bottom, transparent 0%, ${GOLD} 30%, ${GOLD} 70%, transparent 100%)`,
                zIndex: 5,
              }} />
            </div>

            {/* Price labels – outside overflow:hidden, overlaid on bottom of circle */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              display: 'flex', pointerEvents: 'none', zIndex: 10,
            }}>
              {/* Calabresa */}
              <div style={{
                flex: 1, textAlign: 'center', padding: '32px 8px 18px',
                background: 'linear-gradient(to top, rgba(8,6,0,0.95) 0%, rgba(8,6,0,0.55) 60%, transparent 100%)',
                borderRadius: '0 0 0 150px',
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>01</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 3 }}>Calabresa</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: GOLD, marginTop: 4 }}>R$ {fmt(calabresa.price)}</p>
              </div>

              {/* Marguerita */}
              <div style={{
                flex: 1, textAlign: 'center', padding: '32px 8px 18px',
                background: 'linear-gradient(to top, rgba(8,6,0,0.95) 0%, rgba(8,6,0,0.55) 60%, transparent 100%)',
                borderRadius: '0 0 150px 0',
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>02</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 3 }}>Marguerita</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: GOLD, marginTop: 4 }}>R$ {fmt(marguerita.price)}</p>
              </div>
            </div>
          </div>

          <p style={{ color: '#2E1E08', fontSize: 11, marginTop: 20, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            toque para pedir
          </p>
        </section>
      )}

      {/* ── COMBO ── */}
      {combo && (
        <section style={{ margin: '4px 16px 14px' }}>
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            background: CARD,
            border: '1px solid rgba(242,168,0,0.2)',
            boxShadow: '0 6px 32px rgba(0,0,0,0.55)',
          }}>
            {/* Image */}
            <div style={{ position: 'relative' }}>
              {imgUrl(combo) ? (
                <img src={imgUrl(combo)!} alt={combo.name} style={{ width: '100%', height: 195, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: 195, background: '#251800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>🍕🍕</div>
              )}

              {/* Image gradient overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(28,21,0,1) 0%, rgba(28,21,0,0.3) 50%, transparent 100%)',
              }} />

              {/* Save badge */}
              <div style={{
                position: 'absolute', top: 14, left: 14,
                background: '#E04040', color: '#fff',
                fontSize: 10, fontWeight: 800, padding: '4px 11px',
                borderRadius: 20, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>
                Economize R$10
              </div>

              {/* Title over image */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 18px 16px' }}>
                <div style={{
                  display: 'inline-block', marginBottom: 6,
                  background: 'rgba(242,168,0,0.15)', border: '1px solid rgba(242,168,0,0.35)',
                  color: GOLD, fontSize: 10, fontWeight: 700,
                  padding: '3px 10px', borderRadius: 10,
                  textTransform: 'uppercase', letterSpacing: 1,
                }}>
                  🔥 Combo Fumêgo
                </div>
                <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 22, fontWeight: 700, color: '#fff' }}>
                  {combo.name}
                </h2>
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding: '14px 18px 18px' }}>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>
                {combo.description}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: FAINT, textDecoration: 'line-through', fontSize: 13 }}>R$ 90,00</p>
                  <p style={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
                    R$&nbsp;<span style={{ color: GOLD }}>{fmt(combo.price)}</span>
                  </p>
                </div>
                <button
                  onClick={() => openProductModal(combo)}
                  disabled={!storeOpen}
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                    color: BG, border: 'none',
                    borderRadius: 13, padding: '13px 22px',
                    fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    boxShadow: `0 4px 18px rgba(242,168,0,0.35)`,
                  }}
                >
                  Pedir →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── ESPECIAL DO MÊS ── */}
      {especial && (
        <section style={{ margin: '0 16px 20px' }}>
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            background: CARD,
            border: `1px solid ${BORDER}`,
            boxShadow: '0 6px 32px rgba(0,0,0,0.45)',
          }}>
            {/* Image */}
            <div style={{ position: 'relative' }}>
              {imgUrl(especial) ? (
                <img src={imgUrl(especial)!} alt="Especial" style={{ width: '100%', height: 180, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: 180, background: '#201600', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>⭐</div>
              )}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(28,21,0,0.9) 0%, transparent 55%)',
              }} />
              <div style={{
                position: 'absolute', top: 14, left: 14,
                background: 'rgba(242,168,0,0.15)', border: '1px solid rgba(242,168,0,0.4)',
                color: GOLD, fontSize: 10, fontWeight: 700,
                padding: '4px 11px', borderRadius: 20, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>
                ⭐ Especial do Mês
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding: '16px 18px 18px' }}>
              <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                {settings.special_flavor_name || 'Sabor Especial'}
              </h2>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.55, marginTop: 7 }}>
                {settings.special_flavor_description || especial.description}
              </p>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: GOLD, fontSize: 26, fontWeight: 800 }}>R$ {fmt(especial.price)}</span>
                <button
                  onClick={() => openProductModal(especial)}
                  disabled={!storeOpen}
                  style={{
                    padding: '12px 22px',
                    background: 'transparent', color: GOLD,
                    border: `1.5px solid ${GOLD}`,
                    borderRadius: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  Quero! →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── DELIVERY INFO ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 14, padding: '8px 16px 24px',
      }}>
        {[
          `🛵 Apenas entrega`,
          `⏱ ${settings.delivery_time || '40–60 min'}`,
          Number(settings.delivery_fee) > 0
            ? `Taxa R$ ${fmt(settings.delivery_fee)}`
            : `✅ Frete grátis`,
        ].map((item, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {i > 0 && <span style={{ width: 1, height: 12, background: BORDER, display: 'inline-block' }} />}
            <span style={{ color: FAINT, fontSize: 11, letterSpacing: 0.3 }}>{item}</span>
          </span>
        ))}
      </div>

      {/* ── FLOATING CART ── */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, padding: '14px 18px',
          background: 'rgba(18, 13, 0, 0.97)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(242,168,0,0.2)',
          zIndex: 40,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <span style={{ color: GOLD, fontWeight: 800 }}>{cartCount}</span>
              <span style={{ color: MUTED, marginLeft: 6, fontSize: 13 }}>
                {cartCount === 1 ? 'item' : 'itens'} no carrinho
              </span>
            </div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>
              R$ {getCartTotal().toFixed(2).replace('.', ',')}
            </span>
          </div>
          <button className="btn-primary" onClick={goToCheckout}>Ir para o Checkout →</button>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer style={{
        textAlign: 'center', color: FAINT, fontSize: 11,
        padding: '12px 16px',
        paddingBottom: cartCount > 0 ? 132 : 24,
        letterSpacing: 2, textTransform: 'uppercase',
      }}>
        Fumêgo © {new Date().getFullYear()}
      </footer>

      {/* ── PRODUCT MODAL ── */}
      {showModal && selectedProduct && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(6px)',
            zIndex: 50,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#141000',
              borderRadius: '24px 24px 0 0',
              border: `1px solid ${BORDER}`,
              borderBottom: 'none',
              width: '100%', maxWidth: 480,
              maxHeight: '88vh', overflowY: 'auto',
              padding: '0 20px 36px',
              animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: `0 -4px 50px rgba(242,168,0,0.07)`,
            }}
          >
            {/* Handle */}
            <div style={{ padding: '14px 0 22px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 4, background: BORDER, borderRadius: 2 }} />
            </div>

            {/* Title row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <h3 style={{
                fontFamily: 'var(--font-playfair), Georgia, serif',
                fontSize: 22, fontWeight: 700, color: '#fff',
                flex: 1, paddingRight: 12, lineHeight: 1.2,
              }}>
                {selectedProduct.name}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: BORDER, border: 'none', color: MUTED,
                  width: 32, height: 32, borderRadius: '50%',
                  fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: MUTED, marginBottom: 14, lineHeight: 1.55 }}>
              {selectedProduct.description}
            </p>
            <p style={{ fontSize: 24, fontWeight: 800, color: GOLD, marginBottom: 22 }}>
              R$ {fmt(selectedProduct.price)}
            </p>

            {/* Observations */}
            <div style={{ marginBottom: 22 }}>
              <label style={{
                fontSize: 11, color: MUTED, display: 'block', marginBottom: 8,
                textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600,
              }}>
                Observações
              </label>
              <textarea
                className="input-field" rows={2}
                placeholder="Ex: Sem cebola, borda recheada…"
                value={observations}
                onChange={e => setObservations(e.target.value)}
                style={{ resize: 'none' }}
              />
            </div>

            {/* Drinks */}
            {drinks.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                <p style={{
                  fontSize: 11, color: MUTED, fontWeight: 700,
                  marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.5,
                }}>
                  🥤 Adicionar bebida?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {drinks.map(drink => {
                    const sel = selectedDrinks.find(d => d.id === drink.id);
                    return (
                      <div
                        key={drink.id}
                        onClick={() => toggleDrink(drink)}
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
                          <span style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>R$ {fmt(drink.price)}</span>
                          {sel && (
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={() => updateDrinkQty(drink.id, sel.quantity - 1)}
                                style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: BORDER, color: MUTED,
                                  border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >−</button>
                              <span style={{ color: '#fff', fontSize: 14, width: 18, textAlign: 'center' }}>
                                {sel.quantity}
                              </span>
                              <button
                                onClick={() => updateDrinkQty(drink.id, sel.quantity + 1)}
                                style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                                  color: BG, border: 'none', cursor: 'pointer',
                                  fontSize: 16, fontWeight: 700,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Total + Add button */}
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ color: MUTED, fontSize: 13 }}>Total deste item:</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>
                  R$ {getModalTotal().toFixed(2).replace('.', ',')}
                </span>
              </div>
              <button className="btn-primary" onClick={addToCart}>
                Adicionar ao Carrinho 🛒
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
