'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  async function handleAuth(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'auth' }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthenticated(true);
        localStorage.setItem('fumego_admin', 'true');
        loadAllData();
      } else {
        setAuthError('Senha incorreta');
      }
    } catch (e) {
      setAuthError('Erro de conexão');
    }
  }

  useEffect(() => {
    const isAdmin = localStorage.getItem('fumego_admin');
    if (isAdmin) {
      setAuthenticated(true);
      loadAllData();
    }
  }, []);

  async function loadAllData() {
    const [productsRes, drinksRes, ordersRes, settingsRes] = await Promise.all([
      supabase.from('products').select('*').order('display_order'),
      supabase.from('drinks').select('*').order('display_order'),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('settings').select('*'),
    ]);
    if (productsRes.data) setProducts(productsRes.data);
    if (drinksRes.data) setDrinks(drinksRes.data);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (settingsRes.data) {
      const s = {};
      settingsRes.data.forEach(item => { s[item.key] = item.value; });
      setSettings(s);
    }
  }

  function toggleProduct(id) {
    setProducts(prev =>
      prev.map(p => p.id === id ? { ...p, is_active: !p.is_active } : p)
    );
    setHasChanges(true);
  }

  function toggleDrink(id) {
    setDrinks(prev =>
      prev.map(d => d.id === id ? { ...d, is_active: !d.is_active } : d)
    );
    setHasChanges(true);
  }

  function updateProductPrice(id, price) {
    setProducts(prev =>
      prev.map(p => p.id === id ? { ...p, price: parseFloat(price) || 0 } : p)
    );
    setHasChanges(true);
  }

  function updateProductDescription(id, description) {
    setProducts(prev =>
      prev.map(p => p.id === id ? { ...p, description } : p)
    );
    setHasChanges(true);
  }

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }

  async function handleSaveAll() {
    setSaving(true);
    setSaveMessage('');
    try {
      // Salvar produtos
      for (const product of products) {
        await supabase.from('products').update({
          is_active: product.is_active,
          price: product.price,
          description: product.description,
        }).eq('id', product.id);
      }

      // Salvar bebidas
      for (const drink of drinks) {
        await supabase.from('drinks').update({
          is_active: drink.is_active,
          price: drink.price,
        }).eq('id', drink.id);
      }

      // Salvar configurações
      for (const [key, value] of Object.entries(settings)) {
        await supabase.from('settings').upsert({
          key,
          value: String(value),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      }

      setSaveMessage('✅ Tudo salvo com sucesso!');
      setHasChanges(false);
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (e) {
      setSaveMessage('❌ Erro ao salvar. Tente novamente.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function updateOrderStatus(orderId, status) {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, status } : o)
    );
  }

  function logout() {
    localStorage.removeItem('fumego_admin');
    setAuthenticated(false);
  }

  // ============ TELA DE LOGIN DO ADMIN ============
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-fumego-black flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <span className="text-5xl">🔐</span>
            <h1 className="font-display text-2xl font-bold text-fumego-gold mt-3">Admin FUMÊGO</h1>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              className="input-field"
              type="password"
              placeholder="Senha do administrador"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button className="btn-primary w-full">Entrar</button>
          </form>
          <button onClick={() => router.push('/')} className="text-gray-500 text-sm hover:text-gray-300 mt-4 block mx-auto">
            ← Voltar ao cardápio
          </button>
        </div>
      </div>
    );
  }

  // ============ PAINEL ADMIN ============
  return (
    <div className="min-h-screen bg-fumego-black pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-fumego-black/95 backdrop-blur border-b border-fumego-gold/30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-display text-lg font-bold text-fumego-gold">🔐 Admin FUMÊGO</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-xs text-gray-400 hover:text-white">
              Ver Cardápio
            </button>
            <button onClick={logout} className="text-xs text-red-400 hover:text-red-300">
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-4">
          {[
            { key: 'products', label: '🍕 Produtos' },
            { key: 'drinks', label: '🥤 Bebidas' },
            { key: 'orders', label: '📦 Pedidos' },
            { key: 'settings', label: '⚙️ Config' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                activeTab === tab.key
                  ? 'bg-fumego-gold text-fumego-black'
                  : 'bg-fumego-dark text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ============ TAB: PRODUTOS ============ */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-fumego-gold">Gerenciar Produtos</h2>
            {products.map(product => (
              <div key={product.id} className="bg-fumego-dark rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-white">{product.name}</h3>
                    {product.is_special && (
                      <span className="text-xs bg-fumego-gold/20 text-fumego-gold px-2 py-0.5 rounded">Especial</span>
                    )}
                  </div>
                  {/* TOGGLE - Agora não bloqueia mais o save */}
                  <button
                    onClick={() => toggleProduct(product.id)}
                    className={`admin-toggle ${product.is_active ? 'active' : ''}`}
                    title={product.is_active ? 'Ativo - clique para desativar' : 'Inativo - clique para ativar'}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Preço (R$)</label>
                    <input
                      className="input-field"
                      type="number"
                      step="0.01"
                      value={product.price}
                      onChange={e => updateProductPrice(product.id, e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
                    <input
                      className="input-field"
                      value={product.description || ''}
                      onChange={e => updateProductDescription(product.id, e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Status: {product.is_active ? '🟢 Ativo no cardápio' : '🔴 Oculto do cardápio'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============ TAB: BEBIDAS ============ */}
        {activeTab === 'drinks' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-fumego-gold">Gerenciar Bebidas</h2>
            {drinks.map(drink => (
              <div key={drink.id} className="bg-fumego-dark rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white">{drink.name} ({drink.size})</h3>
                  <button
                    onClick={() => toggleDrink(drink.id)}
                    className={`admin-toggle ${drink.is_active ? 'active' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Preço (R$)</label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.01"
                    value={drink.price}
                    onChange={e => {
                      setDrinks(prev => prev.map(d =>
                        d.id === drink.id ? { ...d, price: parseFloat(e.target.value) || 0 } : d
                      ));
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Status: {drink.is_active ? '🟢 Ativo' : '🔴 Oculto'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============ TAB: PEDIDOS ============ */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-fumego-gold">Pedidos Recentes</h2>
              <button onClick={loadAllData} className="text-xs text-fumego-gold hover:underline">
                🔄 Atualizar
              </button>
            </div>
            {orders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum pedido ainda</p>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-fumego-dark rounded-xl p-4 border border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white">Pedido #{order.order_number}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      order.status === 'pending' ? 'bg-yellow-900/50 text-yellow-400' :
                      order.status === 'confirmed' ? 'bg-blue-900/50 text-blue-400' :
                      order.status === 'preparing' ? 'bg-orange-900/50 text-orange-400' :
                      order.status === 'delivering' ? 'bg-purple-900/50 text-purple-400' :
                      order.status === 'delivered' ? 'bg-green-900/50 text-green-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>
                      {order.status === 'pending' ? '⏳ Pendente' :
                       order.status === 'confirmed' ? '✅ Confirmado' :
                       order.status === 'preparing' ? '👨‍🍳 Preparando' :
                       order.status === 'delivering' ? '🛵 Saiu p/ entrega' :
                       order.status === 'delivered' ? '📦 Entregue' :
                       '❌ Cancelado'}
                    </span>
                  </div>
                  <div className="text-sm space-y-1 text-gray-300">
                    <p>👤 {order.customer_name} • 📱 {order.customer_phone}</p>
                    <p>📍 {order.delivery_street}, {order.delivery_number} - {order.delivery_neighborhood}</p>
                    <p>💰 Total: R$ {Number(order.total).toFixed(2).replace('.', ',')} • PIX: {
                      order.payment_status === 'approved' ? '✅ Pago' : '⏳ Aguardando'
                    }</p>
                    {order.observations && <p className="italic text-gray-500">Obs: {order.observations}</p>}
                    <p className="text-xs text-gray-600">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {['confirmed', 'preparing', 'delivering', 'delivered', 'cancelled'].map(status => (
                      <button
                        key={status}
                        onClick={() => updateOrderStatus(order.id, status)}
                        className={`text-xs px-3 py-1 rounded-full border transition ${
                          order.status === status
                            ? 'bg-fumego-gold text-fumego-black border-fumego-gold'
                            : 'border-gray-600 text-gray-400 hover:border-gray-400'
                        }`}
                      >
                        {status === 'confirmed' ? 'Confirmar' :
                         status === 'preparing' ? 'Preparando' :
                         status === 'delivering' ? 'Saiu entrega' :
                         status === 'delivered' ? 'Entregue' :
                         'Cancelar'}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ============ TAB: CONFIGURAÇÕES ============ */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-fumego-gold">Configurações</h2>

            <div className="bg-fumego-dark rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white">Loja Aberta</h3>
                  <p className="text-xs text-gray-500">Quando fechada, clientes não conseguem pedir</p>
                </div>
                <button
                  onClick={() => updateSetting('store_open', settings.store_open === 'true' ? 'false' : 'true')}
                  className={`admin-toggle ${settings.store_open === 'true' ? 'active' : ''}`}
                />
              </div>
            </div>

            <div className="bg-fumego-dark rounded-xl p-4 border border-gray-800 space-y-3">
              <h3 className="font-bold text-white">Entrega</h3>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Taxa de entrega (R$)</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={settings.delivery_fee || '0'}
                  onChange={e => updateSetting('delivery_fee', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tempo de entrega</label>
                <input
                  className="input-field"
                  value={settings.delivery_time || '40-60 min'}
                  onChange={e => updateSetting('delivery_time', e.target.value)}
                />
              </div>
            </div>

            <div className="bg-fumego-dark rounded-xl p-4 border border-gray-800 space-y-3">
              <h3 className="font-bold text-white">⭐ Sabor Especial do Mês</h3>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nome do sabor</label>
                <input
                  className="input-field"
                  value={settings.special_flavor_name || ''}
                  onChange={e => updateSetting('special_flavor_name', e.target.value)}
                  placeholder="Ex: Quatro Queijos"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Descrição do sabor</label>
                <textarea
                  className="input-field resize-none"
                  rows="2"
                  value={settings.special_flavor_description || ''}
                  onChange={e => updateSetting('special_flavor_description', e.target.value)}
                  placeholder="Ex: Mussarela, parmesão, gorgonzola e catupiry"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          BOTÃO SALVAR FIXO NO RODAPÉ - SEMPRE VISÍVEL E ACESSÍVEL
          ============================================================ */}
      <div className="fixed bottom-0 left-0 right-0 bg-fumego-black/95 backdrop-blur border-t border-fumego-gold/30 p-4 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex-1">
            {saveMessage && (
              <p className={`text-sm ${saveMessage.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {saveMessage}
              </p>
            )}
            {hasChanges && !saveMessage && (
              <p className="text-sm text-yellow-400 animate-pulse">⚠️ Alterações não salvas</p>
            )}
          </div>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className={`btn-primary px-8 py-3 text-base ${
              hasChanges ? 'animate-pulse' : ''
            }`}
          >
            {saving ? '⏳ Salvando...' : '💾 Salvar Tudo'}
          </button>
        </div>
      </div>
    </div>
  );
}
