'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [settings, setSettings] = useState({});
  const [storeOpen, setStoreOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [observations, setObservations] = useState('');
  const [selectedDrinks, setSelectedDrinks] = useState([]);

  useEffect(() => {
    loadData();
    try { const u = localStorage.getItem('fumego_user'); if (u) setUser(JSON.parse(u)); } catch (e) {}
    try { const c = localStorage.getItem('fumego_cart'); if (c) setCart(JSON.parse(c)); } catch (e) {}
  }, []);

  function saveCart(newCart) {
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
        const s = {};
        sRes.data.forEach(i => { s[i.key] = i.value; });
        setSettings(s);
        setStoreOpen(s.store_open === 'true');
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function getProduct(slug) { return products.find(p => p.slug === slug); }

  function openProductModal(product) {
    if (!storeOpen) return;
    setSelectedProduct(product);
    setObservations('');
    setSelectedDrinks([]);
    setShowModal(true);
  }

  function toggleDrink(drink) {
    setSelectedDrinks(prev => {
      const exists = prev.find(d => d.id === drink.id);
      if (exists) return prev.filter(d => d.id !== drink.id);
      return [...prev, { ...drink, quantity: 1 }];
    });
  }

  function updateDrinkQty(drinkId, qty) {
    if (qty < 1) return;
    setSelectedDrinks(prev => prev.map(d => d.id === drinkId ? { ...d, quantity: qty } : d));
  }

  function addToCart() {
    const item = { id: Date.now(), product: selectedProduct, observations, drinks: selectedDrinks };
    saveCart([...cart, item]);
    setShowModal(false);
  }

  function getCartTotal() {
    let t = 0;
    cart.forEach(i => { t += Number(i.product.price); i.drinks?.forEach(d => { t += Number(d.price) * d.quantity; }); });
    return t;
  }

  function getCartCount() { return cart.length; }

  function goToCheckout() {
    if (cart.length === 0) return;
    localStorage.setItem('fumego_cart', JSON.stringify(cart));
    router.push('/checkout');
  }

  function getModalTotal() {
    if (!selectedProduct) return 0;
    let t = Number(selectedProduct.price);
    selectedDrinks.forEach(d => { t += Number(d.price) * d.quantity; });
    return t;
  }

  function getImageUrl(product) { return product?.image_url || null; }

  const marguerita = getProduct('marguerita');
  const calabresa = getProduct('calabresa');
  const combo = getProduct('combo-classico');
  const especial = getProduct('especial-do-mes');
  const logoUrl = settings.logo_url || null;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A1A1A' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🍕</div>
          <p style={{ color: '#D4A528', marginTop: 12, animation: 'pulse 1.5s infinite' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A' }}>
      {/* ===== HEADER - LOGO CENTRALIZADA ===== */}
      <header className="header" style={{ justifyContent: 'center', position: 'relative' }}>
        {/* Logo / Nome centralizado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="FUMÊGO" style={{ height: 36, objectFit: 'contain' }} />
          ) : (
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 'bold', color: '#D4A528', letterSpacing: 1 }}>
              FUMÊGO
            </h1>
          )}
        </div>

        {/* Ícones à direita (posição absoluta) */}
        <div style={{ position: 'absolute', right: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={goToCheckout} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', position: 'relative' }}>
            🛒
            {getCartCount() > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -8, background: '#E53E3E', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {getCartCount()}
              </span>
            )}
          </button>
          {user ? (
            <button onClick={() => { localStorage.removeItem('fumego_token'); localStorage.removeItem('fumego_user'); setUser(null); }}
              style={{ width: 32, height: 32, borderRadius: '50%', background: '#D4A528', color: '#000', border: 'none', fontWeight: 'bold', fontSize: 14, cursor: 'pointer' }}>
              {user.name?.charAt(0).toUpperCase()}
            </button>
          ) : (
            <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>👤</button>
          )}
        </div>
      </header>

      {!storeOpen && <div style={{ background: '#E53E3E', color: '#fff', textAlign: 'center', padding: 8, fontSize: 13 }}>🔴 Estamos fechados no momento</div>}

      {/* ===== HERO: PIZZA ESTILO TÁBUA (Imagem 2) ===== */}
      {calabresa && marguerita && (
        <section style={{ padding: '24px 16px 8px', textAlign: 'center' }}>
          <div style={{
            width: 320, height: 320, borderRadius: '50%', margin: '0 auto',
            position: 'relative', overflow: 'hidden',
            border: '4px solid #8B7335',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {/* Pizza inteira - lado esquerdo (Calabresa) */}
            <div
              onClick={() => openProductModal(calabresa)}
              style={{
                position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
                cursor: 'pointer', overflow: 'hidden',
              }}
            >
              {getImageUrl(calabresa) ? (
                <img src={getImageUrl(calabresa)} alt="Calabresa"
                  style={{ width: '200%', height: '100%', objectFit: 'cover', objectPosition: 'left center' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #8B2500, #A0522D)' }} />
              )}

              {/* Texto Calabresa */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '24px 8px 16px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>01</span>
                <p style={{ fontSize: 18, fontWeight: 'bold', color: '#fff', lineHeight: 1.2 }}>Calabresa</p>
                <p style={{ fontSize: 16, fontWeight: 'bold', color: '#D4A528', marginTop: 2 }}>
                  R$ {Number(calabresa.price).toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>

            {/* Pizza inteira - lado direito (Marguerita) */}
            <div
              onClick={() => openProductModal(marguerita)}
              style={{
                position: 'absolute', top: 0, right: 0, width: '50%', height: '100%',
                cursor: 'pointer', overflow: 'hidden',
              }}
            >
              {getImageUrl(marguerita) ? (
                <img src={getImageUrl(marguerita)} alt="Marguerita"
                  style={{ width: '200%', height: '100%', objectFit: 'cover', objectPosition: 'right center' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #228B22, #2E8B57)' }} />
              )}

              {/* Texto Marguerita */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '24px 8px 16px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>02</span>
                <p style={{ fontSize: 18, fontWeight: 'bold', color: '#fff', lineHeight: 1.2 }}>Marguerita</p>
                <p style={{ fontSize: 16, fontWeight: 'bold', color: '#D4A528', marginTop: 2 }}>
                  R$ {Number(marguerita.price).toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>

            {/* Divisor central dourado */}
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 3, height: '100%', background: '#8B7335', zIndex: 5,
              boxShadow: '0 0 6px rgba(139,115,53,0.5)',
            }} />
          </div>

          <p style={{ color: '#777', fontSize: 11, textTransform: 'uppercase', letterSpacing: 4, marginTop: 16, fontWeight: 600 }}>
            Pizza Clássica
          </p>
        </section>
      )}

      {/* ===== COMBO ===== */}
      {combo && (
        <section style={{ margin: '12px 16px 16px', background: 'linear-gradient(135deg, #92702A, #D4A528)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ position: 'relative' }}>
            {getImageUrl(combo) ? (
              <img src={getImageUrl(combo)} alt={combo.name} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: 200, background: '#7A5A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🍕🍕</div>
            )}
            <div style={{ position: 'absolute', top: 12, right: 12, background: '#E53E3E', color: '#fff', fontSize: 11, fontWeight: 'bold', padding: '4px 10px', borderRadius: 20 }}>
              ECONOMIZE R$10
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <span style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 10, fontWeight: 'bold', padding: '3px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 1 }}>🔥 COMBO</span>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 8 }}>Combo Fumêgo</h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 }}>{combo.description}</p>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through', fontSize: 14 }}>R$ 90,00</span>
              <span style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>R$ {Number(combo.price).toFixed(2).replace('.', ',')}</span>
            </div>
            <button onClick={() => openProductModal(combo)} disabled={!storeOpen}
              style={{ marginTop: 12, width: '100%', padding: 12, background: '#1A1A1A', color: '#D4A528', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}>
              Pedir Agora →
            </button>
          </div>
        </section>
      )}

      {/* ===== ESPECIAL DO MÊS ===== */}
      {especial && (
        <section style={{ margin: '0 16px 16px', background: '#2D2D2D', borderRadius: 16, overflow: 'hidden', border: '1px solid #444' }}>
          <div style={{ position: 'relative' }}>
            {getImageUrl(especial) ? (
              <img src={getImageUrl(especial)} alt="Especial" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: 200, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>⭐</div>
            )}
          </div>
          <div style={{ padding: 16 }}>
            <span style={{ background: '#D4A528', color: '#000', fontSize: 10, fontWeight: 'bold', padding: '3px 8px', borderRadius: 10 }}>⭐ Especial do Mês</span>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 8 }}>
              {settings.special_flavor_name || 'Sabor Especial'}
            </h2>
            <p style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>
              {settings.special_flavor_description || especial.description}
            </p>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#D4A528', fontSize: 24, fontWeight: 'bold' }}>R$ {Number(especial.price).toFixed(2).replace('.', ',')}</span>
              <button onClick={() => openProductModal(especial)} disabled={!storeOpen}
                style={{ padding: '10px 24px', background: '#D4A528', color: '#000', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
                Quero! →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ===== INFO ENTREGA ===== */}
      <div style={{ textAlign: 'center', padding: '12px 16px', color: '#666', fontSize: 12 }}>
        <p>🛵 Apenas entrega • {settings.delivery_time || '40-60 min'}</p>
        <p style={{ marginTop: 4 }}>
          {Number(settings.delivery_fee) > 0 ? `Taxa: R$ ${Number(settings.delivery_fee).toFixed(2).replace('.', ',')}` : '✅ Entrega Grátis'}
        </p>
      </div>

      {/* ===== CARRINHO FLUTUANTE ===== */}
      {cart.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, padding: '12px 16px',
          background: '#2D2D2D', borderTop: '2px solid #D4A528', zIndex: 40,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ color: '#D4A528', fontWeight: 'bold' }}>{getCartCount()} {getCartCount() === 1 ? 'item' : 'itens'}</span>
              <span style={{ color: '#999', marginLeft: 8, fontSize: 13 }}>no carrinho</span>
            </div>
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>R$ {getCartTotal().toFixed(2).replace('.', ',')}</span>
          </div>
          <button className="btn-primary" onClick={goToCheckout}>Ir para Checkout →</button>
        </div>
      )}

      <footer style={{ textAlign: 'center', color: '#444', fontSize: 11, padding: '20px 16px', paddingBottom: cart.length > 0 ? 120 : 20 }}>
        FUMÊGO Pizza Clássica © {new Date().getFullYear()}
      </footer>

      {/* ===== MODAL PRODUTO ===== */}
      {showModal && selectedProduct && (
        <div onClick={() => setShowModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1A1A1A', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
            maxHeight: '85vh', overflowY: 'auto', padding: 20, animation: 'slideUp 0.3s ease-out',
          }}>
            <div style={{ width: 40, height: 4, background: '#555', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 'bold', color: '#D4A528' }}>{selectedProduct.name}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#999', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#aaa', marginBottom: 12 }}>{selectedProduct.description}</p>
            <p style={{ fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 16 }}>R$ {Number(selectedProduct.price).toFixed(2).replace('.', ',')}</p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>Observações:</label>
              <textarea className="input-field" rows="2" placeholder="Ex: Sem cebola, borda recheada..."
                value={observations} onChange={e => setObservations(e.target.value)} style={{ resize: 'none' }} />
            </div>

            {drinks.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: '#D4A528', fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 2 }}>🥤 Adicionar Bebida?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {drinks.map(drink => {
                    const sel = selectedDrinks.find(d => d.id === drink.id);
                    return (
                      <div key={drink.id} onClick={() => toggleDrink(drink)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', borderRadius: 10,
                          border: sel ? '2px solid #D4A528' : '1px solid #555',
                          background: sel ? 'rgba(212,165,40,0.1)' : 'transparent',
                          cursor: 'pointer',
                        }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{drink.name}</p>
                          <p style={{ fontSize: 12, color: '#888' }}>{drink.size}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 'bold', color: '#D4A528' }}>R$ {Number(drink.price).toFixed(2).replace('.', ',')}</span>
                          {sel && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => updateDrinkQty(drink.id, sel.quantity - 1)}
                                style={{ width: 26, height: 26, borderRadius: '50%', background: '#555', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}>−</button>
                              <span style={{ color: '#fff', fontSize: 14, width: 16, textAlign: 'center' }}>{sel.quantity}</span>
                              <button onClick={() => updateDrinkQty(drink.id, sel.quantity + 1)}
                                style={{ width: 26, height: 26, borderRadius: '50%', background: '#D4A528', color: '#000', border: 'none', cursor: 'pointer', fontSize: 14 }}>+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #555', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: '#888' }}>Total deste item:</span>
                <span style={{ fontSize: 22, fontWeight: 'bold', color: '#D4A528' }}>R$ {getModalTotal().toFixed(2).replace('.', ',')}</span>
              </div>
              <button className="btn-primary" onClick={addToCart}>Adicionar ao Carrinho 🛒</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
