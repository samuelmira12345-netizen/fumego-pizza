'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [settings, setSettings] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [observations, setObservations] = useState('');
  const [selectedDrinks, setSelectedDrinks] = useState([]);
  const [storeOpen, setStoreOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const token = localStorage.getItem('fumego_token');
      const userData = localStorage.getItem('fumego_user');
      if (token && userData) {
        setUser(JSON.parse(userData));
      }
    } catch (e) {}
  }

  async function loadData() {
    try {
      const [productsRes, drinksRes, settingsRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('display_order'),
        supabase.from('drinks').select('*').eq('is_active', true).order('display_order'),
        supabase.from('settings').select('*'),
      ]);

      if (productsRes.data) setProducts(productsRes.data);
      if (drinksRes.data) setDrinks(drinksRes.data);
      if (settingsRes.data) {
        const s = {};
        settingsRes.data.forEach(item => { s[item.key] = item.value; });
        setSettings(s);
        setStoreOpen(s.store_open === 'true');
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  }

  function getProduct(slug) {
    return products.find(p => p.slug === slug);
  }

  function handleSelectProduct(product) {
    if (!storeOpen) return;
    setSelectedProduct(product);
    setObservations('');
    setSelectedDrinks([]);
    setShowModal(true);
  }

  function toggleDrink(drink) {
    setSelectedDrinks(prev => {
      const exists = prev.find(d => d.id === drink.id);
      if (exists) {
        return prev.filter(d => d.id !== drink.id);
      }
      return [...prev, { ...drink, quantity: 1 }];
    });
  }

  function updateDrinkQty(drinkId, qty) {
    if (qty < 1) return;
    setSelectedDrinks(prev =>
      prev.map(d => d.id === drinkId ? { ...d, quantity: qty } : d)
    );
  }

  function handleProceedToCheckout() {
    const orderData = {
      product: selectedProduct,
      observations,
      drinks: selectedDrinks,
    };
    localStorage.setItem('fumego_order', JSON.stringify(orderData));
    router.push('/checkout');
  }

  function calcTotal() {
    if (!selectedProduct) return 0;
    let total = selectedProduct.price;
    selectedDrinks.forEach(d => { total += d.price * d.quantity; });
    return total;
  }

  const marguerita = getProduct('marguerita');
  const calabresa = getProduct('calabresa');
  const combo = getProduct('combo-classico');
  const especial = getProduct('especial-do-mes');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fumego-black">
        <div className="text-center">
          <div className="text-5xl mb-4">🍕</div>
          <p className="text-fumego-gold text-lg animate-pulse">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fumego-black">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-50 bg-fumego-black/95 backdrop-blur border-b border-fumego-gold/30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔥</span>
            <div>
              <h1 className="font-display text-xl font-bold text-fumego-gold tracking-wide">FUMÊGO</h1>
              <p className="text-[10px] text-fumego-gold/70 uppercase tracking-[3px]">Pizza Clássica</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => { localStorage.removeItem('fumego_token'); localStorage.removeItem('fumego_user'); setUser(null); }}
                className="text-xs text-gray-400 hover:text-fumego-gold transition"
              >
                Olá, {user.name?.split(' ')[0]} | Sair
              </button>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="text-xs text-fumego-gold hover:text-fumego-gold-light transition border border-fumego-gold/30 rounded-full px-3 py-1"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
        {!storeOpen && (
          <div className="bg-red-900/80 text-center py-2 text-sm text-red-200">
            🔴 Estamos fechados no momento
          </div>
        )}
      </header>

      {/* ============ HERO MEIA LUA - 2 SABORES CLÁSSICOS ============ */}
      {marguerita && calabresa && (
        <section className="hero-split">
          {/* MARGUERITA - Lado Esquerdo */}
          <div
            className="hero-half hero-half-left"
            onClick={() => handleSelectProduct(marguerita)}
          >
            <div className="hero-content">
              <div className="hero-pizza-icon">🍕</div>
              <h2 className="hero-flavor-name">Marguerita</h2>
              <p className="hero-flavor-desc">{marguerita.description}</p>
              <p className="hero-price">R$ {marguerita.price.toFixed(2).replace('.', ',')}</p>
              <button className="hero-btn" disabled={!storeOpen}>
                {storeOpen ? 'Pedir' : 'Fechado'}
              </button>
            </div>
          </div>

          {/* DIVISOR CENTRAL */}
          <div className="hero-divider">
            <div className="hero-divider-circle">🔥</div>
          </div>

          {/* CALABRESA - Lado Direito */}
          <div
            className="hero-half hero-half-right"
            onClick={() => handleSelectProduct(calabresa)}
          >
            <div className="hero-content">
              <div className="hero-pizza-icon">🍕</div>
              <h2 className="hero-flavor-name">Calabresa</h2>
              <p className="hero-flavor-desc">{calabresa.description}</p>
              <p className="hero-price">R$ {calabresa.price.toFixed(2).replace('.', ',')}</p>
              <button className="hero-btn" disabled={!storeOpen}>
                {storeOpen ? 'Pedir' : 'Fechado'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ============ COMBO + ESPECIAL ============ */}
      <section className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* COMBO */}
        {combo && (
          <div
            className="product-card"
            onClick={() => handleSelectProduct(combo)}
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">🍕🍕</div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold text-fumego-gold">{combo.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{combo.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="text-xs text-gray-500 line-through">R$ 90,00</span>
                    <span className="text-xl font-bold text-white ml-2">
                      R$ {combo.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <button className="hero-btn text-xs" disabled={!storeOpen}>
                    {storeOpen ? 'Pedir' : 'Fechado'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SABOR ESPECIAL DO MÊS */}
        {especial && (
          <div
            className="product-card special"
            onClick={() => handleSelectProduct(especial)}
          >
            <div className="text-center">
              <div className="inline-block bg-fumego-gold/20 rounded-full px-4 py-1 mb-3">
                <span className="text-fumego-gold text-xs font-bold uppercase tracking-wider">
                  ⭐ Especial do Mês
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-fumego-gold">
                {settings.special_flavor_name || especial.name}
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                {settings.special_flavor_description || especial.description}
              </p>
              <div className="mt-4 flex items-center justify-center gap-4">
                <span className="text-2xl font-bold text-white">
                  R$ {especial.price.toFixed(2).replace('.', ',')}
                </span>
                <button className="hero-btn" disabled={!storeOpen}>
                  {storeOpen ? 'Pedir Agora' : 'Fechado'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INFO ENTREGA */}
        <div className="text-center text-sm text-gray-500 py-4 border-t border-gray-800">
          <p>🛵 Apenas entrega • {settings.delivery_time || '40-60 min'}</p>
          <p className="mt-1">
            {Number(settings.delivery_fee) > 0
              ? `Taxa de entrega: R$ ${Number(settings.delivery_fee).toFixed(2).replace('.', ',')}`
              : '✅ Entrega Grátis'}
          </p>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="text-center py-6 border-t border-gray-800 text-gray-600 text-xs">
        <p>FUMÊGO Pizza Clássica © {new Date().getFullYear()}</p>
      </footer>

      {/* ============ MODAL DE PEDIDO (Observações + Upsell Bebidas) ============ */}
      {showModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-bold text-fumego-gold">
                {selectedProduct.name}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Preço */}
            <p className="text-2xl font-bold text-white mb-4">
              R$ {selectedProduct.price.toFixed(2).replace('.', ',')}
            </p>

            {/* Observações */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-2 block">Observações do pedido:</label>
              <textarea
                className="input-field resize-none"
                rows="3"
                placeholder="Ex: Sem cebola, borda recheada..."
                value={observations}
                onChange={e => setObservations(e.target.value)}
              />
            </div>

            {/* Upsell Bebidas */}
            {drinks.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm text-fumego-gold font-bold mb-3 uppercase tracking-wider">
                  🥤 Adicionar Bebida?
                </h4>
                <div className="space-y-3">
                  {drinks.map(drink => {
                    const selected = selectedDrinks.find(d => d.id === drink.id);
                    return (
                      <div
                        key={drink.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                          selected
                            ? 'border-fumego-gold bg-fumego-gold/10'
                            : 'border-gray-700 hover:border-gray-500'
                        }`}
                        onClick={() => toggleDrink(drink)}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{drink.name}</p>
                          <p className="text-xs text-gray-400">{drink.size}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-fumego-gold">
                            R$ {drink.price.toFixed(2).replace('.', ',')}
                          </span>
                          {selected && (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <button
                                className="w-6 h-6 rounded-full bg-gray-700 text-white text-sm flex items-center justify-center"
                                onClick={() => updateDrinkQty(drink.id, selected.quantity - 1)}
                              >−</button>
                              <span className="text-sm text-white w-4 text-center">{selected.quantity}</span>
                              <button
                                className="w-6 h-6 rounded-full bg-fumego-gold text-black text-sm flex items-center justify-center"
                                onClick={() => updateDrinkQty(drink.id, selected.quantity + 1)}
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

            {/* Total e Botão */}
            <div className="border-t border-gray-700 pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-400">Total:</span>
                <span className="text-2xl font-bold text-fumego-gold">
                  R$ {calcTotal().toFixed(2).replace('.', ',')}
                </span>
              </div>
              <button
                className="btn-primary w-full"
                onClick={handleProceedToCheckout}
                disabled={!storeOpen}
              >
                Continuar para Entrega
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
