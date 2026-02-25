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

  // Carrinho
  const [cart, setCart] = useState([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [observations, setObservations] = useState('');
  const [selectedDrinks, setSelectedDrinks] = useState([]);

  useEffect(() => {
    loadData();
    checkUser();
    loadCart();
  }, []);

  function checkUser() {
    try {
      const userData = localStorage.getItem('fumego_user');
      if (userData) setUser(JSON.parse(userData));
    } catch (e) {}
  }

  function loadCart() {
    try {
      const c = localStorage.getItem('fumego_cart');
      if (c) setCart(JSON.parse(c));
    } catch (e) {}
  }

  function saveCart(newCart) {
    setCart(newCart);
    localStorage.setItem('fumego_cart', JSON.stringify(newCart));
  }

  async function loadData() {
    try {
      const [pRes, dRes, sRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('display_order'),
        supabase.from('drinks').select('*').eq('is_active', true).order('display_order'),
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
    const item = {
      id: Date.now(),
      product: selectedProduct,
      observations,
      drinks: selectedDrinks,
    };
    const newCart = [...cart, item];
    saveCart(newCart);
    setShowModal(false);
  }

  function removeFromCart(itemId) {
    const newCart = cart.filter(c => c.id !== itemId);
    saveCart(newCart);
  }

  function getCartTotal() {
    let total = 0;
    cart.forEach(item => {
      total += Number(item.product.price);
      item.drinks?.forEach(d => { total += Number(d.price) * d.quantity; });
    });
    return total;
  }

  function getCartCount() {
    return cart.length;
  }

  function goToCheckout() {
    if (cart.length === 0) return;
    localStorage.setItem('fumego_cart', JSON.stringify(cart));
    router.push('/checkout');
  }

  function getModalTotal() {
    if (!selectedProduct) return 0;
    let total = Number(selectedProduct.price);
    selectedDrinks.forEach(d => { total += Number(d.price) * d.quantity; });
    return total;
  }

  function getImageUrl(product) {
    if (product?.image_url) return product.image_url;
    return null;
  }

  const marguerita = getProduct('marguerita');
  const calabresa = getProduct('calabresa');
  const combo = getProduct('combo-classico');
  const especial = getProduct('especial-do-mes');

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
      {/* ===== HEADER ===== */}
      <header className="header">
        <div className="header-logo">
          <span className="fire">🔥</span>
          <h1>FUMÊGO</h1>
        </div>
        <div className="header-actions">
          <button className="cart-btn" onClick={goToCheckout} aria-label="Carrinho">
            🛒
            {getCartCount() > 0 && <span className="cart-badge">{getCartCount()}</span>}
          </button>
          {user ? (
            <button className="user-btn" onClick={() => { localStorage.removeItem('fumego_token'); localStorage.removeItem('fumego_user'); setUser(null); }}>
              {user.name?.charAt(0).toUpperCase()}
            </button>
          ) : (
            <button className="user-btn" onClick={() => router.push('/login')}>
              👤
            </button>
          )}
        </div>
      </header>

      {!storeOpen && <div className="store-closed-banner">🔴 Estamos fechados no momento</div>}

      {/* ===== HERO: PIZZA CIRCULAR CORTADA AO MEIO ===== */}
      {calabresa && marguerita && (
        <section className="hero-section">
          <div className="pizza-circle">
            <div className="pizza-circle-inner">
              {/* Lado esquerdo - Calabresa */}
              <div
                className="pizza-half pizza-half-left"
                style={getImageUrl(calabresa) ? { backgroundImage: `url(${getImageUrl(calabresa)})` } : {}}
                onClick={() => openProductModal(calabresa)}
              >
                <div className="pizza-half-content">
                  <div className="pizza-half-name">Calabresa</div>
                  <div className="pizza-half-price">R$ {Number(calabresa.price).toFixed(2).replace('.', ',')}</div>
                </div>
              </div>

              {/* Divisor */}
              <div className="pizza-divider" />

              {/* Lado direito - Marguerita */}
              <div
                className="pizza-half pizza-half-right"
                style={getImageUrl(marguerita) ? { backgroundImage: `url(${getImageUrl(marguerita)})` } : {}}
                onClick={() => openProductModal(marguerita)}
              >
                <div className="pizza-half-content">
                  <div className="pizza-half-name">Marguerita</div>
                  <div className="pizza-half-price">R$ {Number(marguerita.price).toFixed(2).replace('.', ',')}</div>
                </div>
              </div>
            </div>
          </div>

          <p className="hero-subtitle">Pizza Clássica</p>
        </section>
      )}

      {/* ===== COMBO ===== */}
      {combo && (
        <section className="combo-section">
          <div className="combo-fire-icon">🔥</div>

          <div style={{ position: 'relative' }}>
            {getImageUrl(combo) ? (
              <img src={getImageUrl(combo)} alt={combo.name} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
            ) : (
              <div className="combo-image-placeholder">🍕🍕</div>
            )}
            <div className="combo-save-badge">ECONOMIZE R$10</div>
          </div>

          <div className="combo-content">
            <div className="combo-tag">🔥 COMBO</div>
            <h2 className="combo-title">Combo Fumêgo</h2>
            <p className="combo-desc">{combo.description}</p>
            <div className="combo-prices">
              <span className="combo-old-price">R$ 90,00</span>
              <span className="combo-price">R$ {Number(combo.price).toFixed(2).replace('.', ',')}</span>
            </div>
            <button
              className="combo-btn"
              onClick={() => openProductModal(combo)}
              disabled={!storeOpen}
            >
              Pedir Agora →
            </button>
          </div>
        </section>
      )}

      {/* ===== ESPECIAL DO MÊS ===== */}
      {especial && (
        <section className="special-section">
          <div style={{ position: 'relative' }}>
            {getImageUrl(especial) ? (
              <img src={getImageUrl(especial)} alt="Especial" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
            ) : (
              <div className="special-image-placeholder">⭐</div>
            )}
          </div>

          <div className="special-content">
            <span className="special-badge">⭐ Especial do Mês</span>
            <h2 className="special-title">
              {settings.special_flavor_name || 'Sabor Especial'}
            </h2>
            <p className="special-desc">
              {settings.special_flavor_description || especial.description}
            </p>
            <div className="special-bottom">
              <span className="special-price">R$ {Number(especial.price).toFixed(2).replace('.', ',')}</span>
              <button
                className="special-btn"
                onClick={() => openProductModal(especial)}
                disabled={!storeOpen}
              >
                Quero! →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ===== INFO ENTREGA ===== */}
      <div className="delivery-info">
        <p>🛵 Apenas entrega • {settings.delivery_time || '40-60 min'}</p>
        <p style={{ marginTop: 4 }}>
          {Number(settings.delivery_fee) > 0
            ? `Taxa: R$ ${Number(settings.delivery_fee).toFixed(2).replace('.', ',')}`
            : '✅ Entrega Grátis'}
        </p>
      </div>

      {/* ===== CARRINHO FLUTUANTE ===== */}
      {cart.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, padding: '12px 16px',
          background: '#2D2D2D', borderTop: '2px solid #D4A528',
          zIndex: 40,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ color: '#D4A528', fontWeight: 'bold' }}>{getCartCount()} {getCartCount() === 1 ? 'item' : 'itens'}</span>
              <span style={{ color: '#999', marginLeft: 8, fontSize: 13 }}>no carrinho</span>
            </div>
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>
              R$ {getCartTotal().toFixed(2).replace('.', ',')}
            </span>
          </div>
          <button className="btn-primary" onClick={goToCheckout}>
            Ir para Checkout →
          </button>
        </div>
      )}

      <footer className="footer" style={{ paddingBottom: cart.length > 0 ? 120 : 20 }}>
        FUMÊGO Pizza Clássica © {new Date().getFullYear()}
      </footer>

      {/* ===== MODAL PRODUTO ===== */}
      {showModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 'bold', color: '#D4A528' }}>
                {selectedProduct.name}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#999', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: '#aaa', marginBottom: 12 }}>{selectedProduct.description}</p>
            <p style={{ fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 16 }}>
              R$ {Number(selectedProduct.price).toFixed(2).replace('.', ',')}
            </p>

            {/* Observações */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>Observações:</label>
              <textarea
                className="input-field"
                rows="2"
                placeholder="Ex: Sem cebola, borda recheada..."
                value={observations}
                onChange={e => setObservations(e.target.value)}
                style={{ resize: 'none' }}
              />
            </div>

            {/* Bebidas */}
            {drinks.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: '#D4A528', fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 2 }}>
                  🥤 Adicionar Bebida?
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
                          padding: '10px 12px', borderRadius: 10,
                          border: sel ? '2px solid #D4A528' : '1px solid #555',
                          background: sel ? 'rgba(212,165,40,0.1)' : 'transparent',
                          cursor: 'pointer', transition: 'all 0.2s',
                        }}
                      >
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{drink.name}</p>
                          <p style={{ fontSize: 12, color: '#888' }}>{drink.size}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 'bold', color: '#D4A528' }}>
                            R$ {Number(drink.price).toFixed(2).replace('.', ',')}
                          </span>
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

            {/* Total e botão */}
            <div style={{ borderTop: '1px solid #555', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: '#888' }}>Total deste item:</span>
                <span style={{ fontSize: 22, fontWeight: 'bold', color: '#D4A528' }}>
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
