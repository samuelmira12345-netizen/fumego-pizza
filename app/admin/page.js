'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Flame, UtensilsCrossed, GlassWater, Settings, Package,
  Upload, Loader2, Trash2, Plus, Check, Save,
  Palette, Store, Star, Landmark, CreditCard, Banknote, Clock,
  Plug, RefreshCw, X, CheckCircle2, Bike,
} from 'lucide-react';
import { DEFAULT_BUSINESS_HOURS, DAY_LABELS, DAY_ORDER } from '../../lib/store-hours';

const SESSION_KEY = 'admin_token';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState('products');
  const [data, setData] = useState({ products: [], drinks: [], coupons: [], settings: [], orders: [] });
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // ── CardápioWeb ────────────────────────────────────────────
  const [cwOrders, setCwOrders] = useState([]);
  const [cwLoading, setCwLoading] = useState(false);
  const [cwSyncing, setCwSyncing] = useState(false);
  const [cwMsg, setCwMsg] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [newDrink, setNewDrink] = useState({ name: '', size: '', price: '' });
  const [addingDrink, setAddingDrink] = useState(false);
  // Logo visível antes do login
  const [loginLogo, setLoginLogo] = useState('');
  const [loginLogoSize, setLoginLogoSize] = useState(48);

  useEffect(() => {
    supabase.from('settings').select('key,value').in('key', ['logo_url', 'logo_size'])
      .then(({ data: rows }) => {
        if (!rows) return;
        const url  = rows.find(r => r.key === 'logo_url')?.value  || '';
        const size = rows.find(r => r.key === 'logo_size')?.value || '48';
        if (url)  setLoginLogo(url);
        if (size) setLoginLogoSize(parseInt(size) || 48);
      });

    // Restore token from sessionStorage
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) setAdminToken(saved);
  }, []);

  // Helper: POST /api/admin with Authorization header
  const adminFetch = useCallback(async (action, actionData, token) => {
    const tok = token || adminToken;
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tok}`,
      },
      body: JSON.stringify({ action, data: actionData }),
    });
    return res;
  }, [adminToken]);

  // ── Helpers CardápioWeb ───────────────────────────────────────────────────

  async function loadCWOrders() {
    setCwLoading(true);
    try {
      const res = await fetch('/api/cardapioweb/orders', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      const d = await res.json();
      if (d.error) { setCwMsg('❌ ' + d.error); return; }
      setCwOrders(d.orders || []);
    } catch (e) { setCwMsg('❌ Erro ao carregar pedidos CW'); }
    finally { setCwLoading(false); }
  }

  async function syncCWOrders() {
    setCwSyncing(true);
    setCwMsg('');
    try {
      const res = await fetch('/api/cardapioweb/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'sync' }),
      });
      const d = await res.json();
      if (d.error) { setCwMsg('❌ ' + d.error); return; }
      setCwMsg(`✅ Sincronizado! ${d.synced} novos, ${d.updated} atualizados`);
      setTimeout(() => setCwMsg(''), 4000);
      await loadCWOrders();
    } catch (e) { setCwMsg('❌ Erro na sincronização'); }
    finally { setCwSyncing(false); }
  }

  async function cwOrderAction(cwOrderId, action, cancellationReason) {
    try {
      const res = await fetch('/api/cardapioweb/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action, cw_order_id: cwOrderId, cancellation_reason: cancellationReason }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setCwOrders(prev => prev.map(o =>
        o.cw_order_id === cwOrderId ? { ...o, status: d.newStatus } : o
      ));
    } catch (e) { alert('Erro ao atualizar pedido'); }
  }

  async function handleLogin() {
    setLoading(true);
    try {
      // 1) Trocar senha por token de sessão (8h)
      const sessionRes = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const sessionData = await sessionRes.json();
      if (sessionData.error) { alert(sessionData.error); return; }

      const token = sessionData.token;
      sessionStorage.setItem(SESSION_KEY, token);
      setAdminToken(token);

      // 2) Carregar dados com o token recém-obtido
      const res = await adminFetch('get_data', {}, token);
      const d = await res.json();
      if (d.error) { alert(d.error); return; }
      setData(d);
      setHasMoreOrders(d.hasMore || false);
      setAuthenticated(true);
    } catch (e) { alert('Erro de conexão'); }
    finally { setLoading(false); }
  }

  async function saveAll() {
    setSaving(true);
    setMsg('');
    try {
      const res = await adminFetch('save_all', { products: data.products, drinks: data.drinks, settings: data.settings });
      const d = await res.json();
      if (d.error) { setMsg('❌ Erro: ' + d.error); return; }
      setMsg('✅ Salvo com sucesso!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('❌ Erro ao salvar'); }
    finally { setSaving(false); }
  }

  function updateProduct(idx, field, value) {
    setData(prev => {
      const p = [...prev.products];
      p[idx] = { ...p[idx], [field]: value };
      return { ...prev, products: p };
    });
  }

  function updateDrink(idx, field, value) {
    setData(prev => {
      const d = [...prev.drinks];
      d[idx] = { ...d[idx], [field]: value };
      return { ...prev, drinks: d };
    });
  }

  function updateSetting(key, value) {
    setData(prev => {
      const s = [...prev.settings];
      const idx = s.findIndex(i => i.key === key);
      if (idx >= 0) s[idx] = { ...s[idx], value };
      else s.push({ key, value });
      return { ...prev, settings: s };
    });
  }

  function getSetting(key) {
    return data.settings.find(s => s.key === key)?.value || '';
  }

  function getBusinessHours() {
    const raw = getSetting('business_hours');
    if (!raw) return DEFAULT_BUSINESS_HOURS;
    try { return { ...DEFAULT_BUSINESS_HOURS, ...JSON.parse(raw) }; } catch { return DEFAULT_BUSINESS_HOURS; }
  }

  function updateDayHours(day, field, value) {
    const current = getBusinessHours();
    const updated = { ...current, [day]: { ...current[day], [field]: value } };
    updateSetting('business_hours', JSON.stringify(updated));
  }

  // ===== UPLOAD DE FOTO PRODUTO =====
  async function handleImageUpload(productIdx, file) {
    const product = data.products[productIdx];
    if (!file || !product) return;
    setUploadingId(product.id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prefix', `product-${product.id}`);
      formData.append('saveAs', 'product_image');
      formData.append('productId', product.id);

      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) { alert(`Erro no upload: ${result.error}`); return; }

      updateProduct(productIdx, 'image_url', result.url);
      alert('✅ Foto enviada e salva!');
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setUploadingId(null); }
  }

  // ===== UPLOAD DE LOGO =====
  async function handleLogoUpload(file) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prefix', 'logo');
      formData.append('saveAs', 'logo');

      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) { alert(`Erro no upload: ${result.error}`); return; }

      updateSetting('logo_url', result.url);
      alert('✅ Logo enviada com sucesso!');
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setUploadingLogo(false); }
  }

  async function handleAddDrink() {
    if (!newDrink.name || !newDrink.price) { alert('Preencha pelo menos o nome e o preço'); return; }
    setAddingDrink(true);
    try {
      const res = await adminFetch('add_drink', {
        name: newDrink.name, size: newDrink.size,
        price: parseFloat(newDrink.price), is_active: true,
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setData(prev => ({ ...prev, drinks: [...prev.drinks, d.drink] }));
      setNewDrink({ name: '', size: '', price: '' });
      setMsg('✅ Bebida adicionada!');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setAddingDrink(false); }
  }

  async function handleDeleteDrink(drinkId) {
    if (!confirm('Excluir esta bebida?')) return;
    try {
      const res = await adminFetch('delete_drink', { id: drinkId });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setData(prev => ({ ...prev, drinks: prev.drinks.filter(dr => dr.id !== drinkId) }));
      setMsg('✅ Bebida excluída!');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) { alert('Erro: ' + e.message); }
  }

  async function removeLogo() {
    try {
      const res = await adminFetch('remove_logo', {});
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      updateSetting('logo_url', '');
      alert('Logo removida. O nome "FUMÊGO" será exibido.');
    } catch (e) { alert('Erro: ' + e.message); }
  }

  async function updateOrderStatus(orderId, field, value) {
    try {
      await adminFetch('update_order', { id: orderId, [field]: value });
      setData(prev => ({
        ...prev, orders: prev.orders.map(o => o.id === orderId ? { ...o, [field]: value } : o),
      }));
    } catch (e) { alert('Erro ao atualizar'); }
  }

  async function loadMoreOrders() {
    setLoadingMore(true);
    try {
      const lastOrder = data.orders[data.orders.length - 1];
      const cursor = lastOrder?.created_at;
      const res = await adminFetch('get_more_orders', { cursor, pageSize: 50 });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setData(prev => ({ ...prev, orders: [...prev.orders, ...(d.orders || [])] }));
      setHasMoreOrders(d.hasMore || false);
    } catch (e) { alert('Erro ao carregar mais pedidos'); }
    finally { setLoadingMore(false); }
  }

  // LOGIN
  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            {loginLogo
              ? <img src={loginLogo} alt="Logo" style={{ height: loginLogoSize, objectFit: 'contain' }} />
              : <Flame size={48} color="#D4A528" />
            }
          </div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 'bold', color: '#D4A528', margin: '12px 0' }}>Admin FUMÊGO</h1>
          <input className="input-field" type="password" placeholder="Senha do admin" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ marginBottom: 12 }} />
          <button className="btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A' }}>
      <header style={{ background: '#1A1A1A', padding: '12px 16px', borderBottom: '1px solid #333', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 18, fontWeight: 'bold', color: '#D4A528', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flame size={20} color="#D4A528" /> Admin FUMÊGO
        </h1>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #333', overflowX: 'auto' }}>
        {['products', 'drinks', 'settings', 'orders', 'cardapioweb'].map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'cardapioweb' && cwOrders.length === 0) loadCWOrders(); }}
            style={{ padding: '10px 16px', background: tab === t ? '#D4A528' : 'transparent', color: tab === t ? '#000' : '#888',
              border: 'none', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t === 'products'
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><UtensilsCrossed size={14} /> Produtos</span>
              : t === 'drinks'
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><GlassWater size={14} /> Bebidas</span>
              : t === 'settings'
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Settings size={14} /> Config</span>
              : t === 'cardapioweb'
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Plug size={14} /> CardápioWeb</span>
              : <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Package size={14} /> Pedidos</span>
            }
          </button>
        ))}
      </div>

      <div style={{ padding: 16, paddingBottom: 80 }}>
        {/* PRODUTOS */}
        {tab === 'products' && data.products.map((p, idx) => (
          <div key={p.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold', fontSize: 16 }}>{p.name}</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={p.is_active} onChange={e => updateProduct(idx, 'is_active', e.target.checked)} />
                <span style={{ fontSize: 12, color: p.is_active ? '#48BB78' : '#E53E3E' }}>{p.is_active ? 'Ativo' : 'Inativo'}</span>
              </label>
            </div>
            {p.image_url && (
              <div style={{ marginBottom: 10 }}>
                <img src={p.image_url} alt={p.name} style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} />
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <label style={{
                display: 'inline-block', padding: '8px 16px', background: '#444', color: '#fff', borderRadius: 8,
                fontSize: 13, cursor: 'pointer', opacity: uploadingId === p.id ? 0.5 : 1,
              }}>
                {uploadingId === p.id
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</span>
                  : <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Upload size={13} /> Enviar foto</span>
                }
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) handleImageUpload(idx, e.target.files[0]); }}
                  disabled={uploadingId === p.id} />
              </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input className="input-field" placeholder="Descrição" value={p.description || ''}
                onChange={e => updateProduct(idx, 'description', e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="input-field" placeholder="Preço" type="number" step="0.01" value={p.price || ''}
                  onChange={e => updateProduct(idx, 'price', e.target.value)} />
                <input className="input-field" placeholder="Ordem" type="number" value={p.sort_order || ''}
                  onChange={e => updateProduct(idx, 'sort_order', parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>
        ))}

        {/* BEBIDAS */}
        {tab === 'drinks' && (
          <div>
            {data.drinks.map((d, idx) => (
              <div key={d.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={d.is_active} onChange={e => updateDrink(idx, 'is_active', e.target.checked)} />
                    <span style={{ fontSize: 12, color: d.is_active ? '#48BB78' : '#E53E3E' }}>{d.is_active ? 'Ativo' : 'Inativo'}</span>
                  </label>
                  <button onClick={() => handleDeleteDrink(d.id)}
                    style={{ background: 'rgba(229,83,83,0.15)', border: '1px solid rgba(229,83,83,0.3)', color: '#E53E3E', borderRadius: 8, padding: '4px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input className="input-field" placeholder="Marca/Nome" value={d.name || ''}
                    onChange={e => updateDrink(idx, 'name', e.target.value)} />
                  <input className="input-field" placeholder="Tamanho (ex: 600ml)" value={d.size || ''}
                    onChange={e => updateDrink(idx, 'size', e.target.value)} />
                </div>
                <input className="input-field" placeholder="Preço" type="number" step="0.01" value={d.price || ''}
                  onChange={e => updateDrink(idx, 'price', e.target.value)} />
              </div>
            ))}

            {/* Formulário para nova bebida */}
            <div style={{ background: '#222', borderRadius: 12, padding: 16, border: '1px dashed #555', marginTop: 8 }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} color="#D4A528" /> Adicionar Bebida
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="input-field" placeholder="Marca/Nome (ex: Coca-Cola)"
                  value={newDrink.name} onChange={e => setNewDrink(prev => ({ ...prev, name: e.target.value }))} />
                <input className="input-field" placeholder="Tamanho (ex: 600ml)"
                  value={newDrink.size} onChange={e => setNewDrink(prev => ({ ...prev, size: e.target.value }))} />
              </div>
              <input className="input-field" placeholder="Preço" type="number" step="0.01"
                value={newDrink.price} onChange={e => setNewDrink(prev => ({ ...prev, price: e.target.value }))}
                style={{ marginBottom: 12 }} />
              <button onClick={handleAddDrink} disabled={addingDrink}
                style={{ width: '100%', padding: '12px', background: '#D4A528', color: '#000', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 'bold', cursor: 'pointer', opacity: addingDrink ? 0.5 : 1 }}>
                {addingDrink
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Adicionando...</span>
                  : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Check size={14} /> Adicionar Bebida</span>
                }
              </button>
            </div>
          </div>
        )}

        {/* CONFIG */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ===== LOGO DA PIZZARIA ===== */}
            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, border: '1px solid #444' }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Palette size={16} color="#D4A528" /> Logo da Pizzaria
              </h3>
              <p style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
                A logo aparece ao lado esquerdo do nome "FUMÊGO" no cabeçalho.
              </p>

              {getSetting('logo_url') && (
                <div style={{ marginBottom: 14, padding: 12, background: '#1A1A1A', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={getSetting('logo_url')} alt="Logo"
                    style={{ height: parseInt(getSetting('logo_size') || '36'), objectFit: 'contain' }} />
                  <span style={{ color: '#D4A528', fontWeight: 'bold', fontSize: 16, letterSpacing: 3 }}>FUMÊGO</span>
                </div>
              )}

              {/* Controle de tamanho */}
              {getSetting('logo_url') && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 6 }}>
                    Tamanho da logo: <strong style={{ color: '#fff' }}>{getSetting('logo_size') || '36'}px</strong>
                  </label>
                  <input type="range" min="24" max="80" step="2"
                    value={getSetting('logo_size') || '36'}
                    onChange={e => updateSetting('logo_size', e.target.value)}
                    style={{ width: '100%', accentColor: '#D4A528' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666', marginTop: 2 }}>
                    <span>Pequeno (24px)</span><span>Grande (80px)</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{
                  display: 'inline-block', padding: '8px 16px', background: '#D4A528', color: '#000', borderRadius: 8,
                  fontSize: 13, fontWeight: 'bold', cursor: 'pointer', opacity: uploadingLogo ? 0.5 : 1,
                }}>
                  {uploadingLogo
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</span>
                    : <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Upload size={13} /> Enviar Logo</span>
                  }
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) handleLogoUpload(e.target.files[0]); }}
                    disabled={uploadingLogo} />
                </label>

                {getSetting('logo_url') && (
                  <button onClick={removeLogo}
                    style={{ padding: '8px 16px', background: '#555', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Trash2 size={13} /> Remover Logo
                  </button>
                )}
              </div>
            </div>

            {/* Loja */}
            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, border: '1px solid #444' }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Store size={16} color="#D4A528" /> Loja
              </h3>

              {/* Toggle manual */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <input type="checkbox" checked={getSetting('store_open') === 'true'}
                  onChange={e => updateSetting('store_open', e.target.checked ? 'true' : 'false')} />
                <span style={{ color: '#fff', fontSize: 14 }}>Loja aberta</span>
              </label>
              <p style={{ color: '#888', fontSize: 12, marginBottom: 14 }}>
                Desmarque para fechar imediatamente, independente do horário configurado.
              </p>

              <input className="input-field" placeholder="Tempo de entrega (ex: 40–60 min)" value={getSetting('delivery_time')}
                onChange={e => updateSetting('delivery_time', e.target.value)} style={{ marginBottom: 8 }} />
              <input className="input-field" placeholder="Taxa de entrega" type="number" step="0.01" value={getSetting('delivery_fee')}
                onChange={e => updateSetting('delivery_fee', e.target.value)} style={{ marginBottom: 16 }} />

              <div style={{ height: 1, background: '#444', marginBottom: 14 }} />

              {/* Horário de Funcionamento */}
              <h4 style={{ color: '#D4A528', fontWeight: 'bold', marginBottom: 4, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#D4A528" /> Horário de Funcionamento
              </h4>
              <p style={{ color: '#888', fontSize: 12, marginBottom: 14 }}>
                A loja fecha automaticamente fora do horário. Horário de Brasília (UTC-3).
              </p>

              {DAY_ORDER.map(day => {
                const h = getBusinessHours()[day] || { enabled: true, open: '18:00', close: '23:00' };
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90, cursor: 'pointer' }}>
                      <input type="checkbox" checked={h.enabled}
                        onChange={e => updateDayHours(day, 'enabled', e.target.checked)} />
                      <span style={{ fontSize: 13, fontWeight: h.enabled ? 600 : 400, color: h.enabled ? '#fff' : '#555' }}>
                        {DAY_LABELS[day]}
                      </span>
                    </label>
                    <input
                      type="time" value={h.open} disabled={!h.enabled}
                      onChange={e => updateDayHours(day, 'open', e.target.value)}
                      style={{ flex: 1, background: '#1A1A1A', color: h.enabled ? '#fff' : '#555', border: '1px solid #555', borderRadius: 8, padding: '6px 8px', fontSize: 13, cursor: h.enabled ? 'pointer' : 'not-allowed' }} />
                    <span style={{ color: '#888', fontSize: 12 }}>às</span>
                    <input
                      type="time" value={h.close} disabled={!h.enabled}
                      onChange={e => updateDayHours(day, 'close', e.target.value)}
                      style={{ flex: 1, background: '#1A1A1A', color: h.enabled ? '#fff' : '#555', border: '1px solid #555', borderRadius: 8, padding: '6px 8px', fontSize: 13, cursor: h.enabled ? 'pointer' : 'not-allowed' }} />
                  </div>
                );
              })}
            </div>

            {/* Instagram */}
            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, border: '1px solid #444' }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A528" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                Instagram
              </h3>
              <p style={{ color: '#888', fontSize: 12, marginBottom: 10 }}>
                Link exibido abaixo do botão "Voltar ao Cardápio" após o pedido ser confirmado.
              </p>
              <input className="input-field" placeholder="https://instagram.com/suaconta"
                value={getSetting('instagram_url')}
                onChange={e => updateSetting('instagram_url', e.target.value)} />
            </div>

            {/* Especial do Mês */}
            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, border: '1px solid #444' }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={16} color="#D4A528" /> Especial do Mês
              </h3>
              <input className="input-field" placeholder="Nome do sabor especial" value={getSetting('special_flavor_name')}
                onChange={e => updateSetting('special_flavor_name', e.target.value)} style={{ marginBottom: 8 }} />
              <textarea className="input-field" placeholder="Descrição" value={getSetting('special_flavor_description')}
                onChange={e => updateSetting('special_flavor_description', e.target.value)} rows="3" style={{ resize: 'none' }} />
            </div>
          </div>
        )}

        {/* PEDIDOS */}
        {tab === 'orders' && (
          <div>
            {data.orders.map(o => (
              <div key={o.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#D4A528', fontWeight: 'bold' }}>#{o.order_number}</span>
                  <span style={{ color: '#888', fontSize: 12 }}>{new Date(o.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p style={{ color: '#fff', fontSize: 14 }}>{o.customer_name} - {o.customer_phone}</p>
                <p style={{ color: '#aaa', fontSize: 12 }}>{o.delivery_street}, {o.delivery_number} - {o.delivery_neighborhood}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <p style={{ color: '#D4A528', fontWeight: 'bold' }}>R$ {Number(o.total).toFixed(2).replace('.', ',')}</p>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 'bold',
                    background: o.payment_method === 'pix' ? '#0066CC' : o.payment_method === 'card' ? '#9333EA' : '#48BB78',
                    color: '#fff',
                  }}>
                    {o.payment_method === 'pix'
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Landmark size={11} /> PIX</span>
                      : o.payment_method === 'card'
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CreditCard size={11} /> Cartão</span>
                      : <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Banknote size={11} /> Dinheiro</span>
                    }
                  </span>
                </div>
                {o.observations && <p style={{ color: '#777', fontSize: 11, fontStyle: 'italic', marginTop: 4 }}>Obs: {o.observations}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <select value={o.status} onChange={e => updateOrderStatus(o.id, 'status', e.target.value)}
                    style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                    <option value="pending">Pendente</option>
                    <option value="confirmed">Confirmado</option>
                    <option value="preparing">Preparando</option>
                    <option value="delivering">Entregando</option>
                    <option value="delivered">Entregue</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                  <select value={o.payment_status} onChange={e => updateOrderStatus(o.id, 'payment_status', e.target.value)}
                    style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                    <option value="pending">Pag. Pendente</option>
                    <option value="approved">Pag. Aprovado</option>
                    <option value="refunded">Reembolsado</option>
                  </select>
                </div>
              </div>
            ))}

            {/* Paginação */}
            {hasMoreOrders && (
              <button onClick={loadMoreOrders} disabled={loadingMore}
                style={{ width: '100%', padding: '12px', background: '#333', color: '#D4A528', border: '1px solid #D4A528', borderRadius: 10, fontSize: 14, fontWeight: 'bold', cursor: 'pointer', opacity: loadingMore ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {loadingMore
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...</>
                  : 'Carregar mais pedidos'
                }
              </button>
            )}
          </div>
        )}

        {/* ── CARDÁPIOWEB ───────────────────────────────────────────────── */}
        {tab === 'cardapioweb' && (
          <div>
            {/* Cabeçalho com botões de ação */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ color: '#D4A528', fontWeight: 'bold', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plug size={16} color="#D4A528" /> Pedidos CardápioWeb
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={loadCWOrders} disabled={cwLoading}
                  style={{ padding: '8px 12px', background: '#333', color: '#D4A528', border: '1px solid #444', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <RefreshCw size={13} style={cwLoading ? { animation: 'spin 1s linear infinite' } : {}} />
                  {cwLoading ? 'Atualizando...' : 'Atualizar'}
                </button>
                <button onClick={syncCWOrders} disabled={cwSyncing}
                  style={{ padding: '8px 12px', background: '#D4A528', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Plug size={13} style={cwSyncing ? { animation: 'spin 1s linear infinite' } : {}} />
                  {cwSyncing ? 'Sincronizando...' : 'Sincronizar API'}
                </button>
              </div>
            </div>

            {cwMsg && (
              <p style={{ fontSize: 13, textAlign: 'center', marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: cwMsg.includes('✅') ? 'rgba(72,187,120,0.1)' : 'rgba(224,64,64,0.1)', color: cwMsg.includes('✅') ? '#48BB78' : '#E04040' }}>
                {cwMsg}
              </p>
            )}

            {cwLoading && cwOrders.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                <p>Carregando pedidos...</p>
              </div>
            )}

            {!cwLoading && cwOrders.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, background: '#2D2D2D', borderRadius: 12, border: '1px dashed #444' }}>
                <Plug size={32} color="#555" style={{ marginBottom: 12 }} />
                <p style={{ color: '#888', fontSize: 14, marginBottom: 6 }}>Nenhum pedido do CardápioWeb encontrado.</p>
                <p style={{ color: '#666', fontSize: 12 }}>
                  Clique em "Sincronizar API" para buscar pedidos recentes, ou aguarde novos pedidos via webhook.
                </p>
              </div>
            )}

            {cwOrders.map(o => {
              const addr = o.delivery_address || {};
              const items = Array.isArray(o.items) ? o.items : [];
              const payments = Array.isArray(o.payments) ? o.payments : [];
              const statusColors = {
                waiting_confirmation: '#F6AD55',
                confirmed:            '#63B3ED',
                released:             '#68D391',
                waiting_to_catch:     '#F6AD55',
                delivered:            '#48BB78',
                closed:               '#718096',
                canceled:             '#E04040',
                scheduled_confirmed:  '#B794F4',
              };
              const statusLabels = {
                waiting_confirmation: 'Aguardando',
                confirmed:            'Confirmado',
                released:             'Em Entrega',
                waiting_to_catch:     'Aguard. Retirada',
                delivered:            'Entregue',
                closed:               'Finalizado',
                canceled:             'Cancelado',
                scheduled_confirmed:  'Agendado',
              };
              const orderTypeLabel = { delivery: 'Delivery', takeout: 'Retirada', onsite: 'Mesa', closed_table: 'Comanda' };
              const paymentMethodLabel = { money: 'Dinheiro', credit_card: 'Cartão Crédito', debit_card: 'Cartão Débito', pix: 'PIX', online_credit_card: 'Cartão Online' };
              const statusColor = statusColors[o.status] || '#888';
              const isActionable = ['waiting_confirmation', 'confirmed', 'released', 'waiting_to_catch', 'delivered'].includes(o.status);

              return (
                <div key={o.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${statusColor}44` }}>
                  {/* Cabeçalho do pedido */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ color: '#D4A528', fontWeight: 'bold', fontSize: 15 }}>
                          #{o.cw_display_id || o.cw_order_id}
                        </span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 'bold', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55` }}>
                          {statusLabels[o.status] || o.status}
                        </span>
                        {o.order_type && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#333', color: '#aaa' }}>
                            {orderTypeLabel[o.order_type] || o.order_type}
                          </span>
                        )}
                      </div>
                      <span style={{ color: '#666', fontSize: 11 }}>
                        {o.cw_created_at ? new Date(o.cw_created_at).toLocaleString('pt-BR') : '—'}
                      </span>
                    </div>
                    <span style={{ color: '#D4A528', fontWeight: 'bold', fontSize: 16 }}>
                      R$ {Number(o.total || 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  {/* Cliente */}
                  <p style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>
                    {o.customer_name || '—'} {o.customer_phone ? `· ${o.customer_phone}` : ''}
                  </p>

                  {/* Endereço de entrega */}
                  {addr && addr.street && (
                    <p style={{ color: '#aaa', fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Bike size={11} />
                      {addr.street}{addr.number ? `, ${addr.number}` : ''}{addr.neighborhood ? ` — ${addr.neighborhood}` : ''}{addr.complement ? ` (${addr.complement})` : ''}
                    </p>
                  )}

                  {/* Itens */}
                  {items.length > 0 && (
                    <div style={{ background: '#1C1500', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                      {items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#ccc', marginBottom: i < items.length - 1 ? 4 : 0 }}>
                          <span>{item.quantity}x {item.name}</span>
                          <span style={{ color: '#D4A528' }}>R$ {Number(item.total_price || 0).toFixed(2).replace('.', ',')}</span>
                        </div>
                      ))}
                      {o.delivery_fee > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#777', marginTop: 4, paddingTop: 4, borderTop: '1px solid #333' }}>
                          <span>Taxa de entrega</span>
                          <span>R$ {Number(o.delivery_fee).toFixed(2).replace('.', ',')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pagamento */}
                  {payments.length > 0 && (
                    <p style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>
                      {payments.map(p => paymentMethodLabel[p.payment_method] || p.payment_method).join(' + ')}
                    </p>
                  )}

                  {/* Observação */}
                  {o.observation && (
                    <p style={{ color: '#777', fontSize: 11, fontStyle: 'italic', marginBottom: 8 }}>
                      Obs: {o.observation}
                    </p>
                  )}

                  {/* Botões de ação */}
                  {isActionable && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      {o.status === 'waiting_confirmation' && (
                        <button onClick={() => cwOrderAction(o.cw_order_id, 'confirm')}
                          style={{ flex: 1, padding: '8px', background: 'rgba(99,179,237,0.15)', color: '#63B3ED', border: '1px solid rgba(99,179,237,0.4)', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          <Check size={13} /> Confirmar
                        </button>
                      )}
                      {o.status === 'confirmed' && (
                        <button onClick={() => cwOrderAction(o.cw_order_id, 'ready')}
                          style={{ flex: 1, padding: '8px', background: 'rgba(104,211,145,0.15)', color: '#68D391', border: '1px solid rgba(104,211,145,0.4)', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          <Package size={13} /> Pronto / Saiu
                        </button>
                      )}
                      {o.status === 'released' && (
                        <button onClick={() => cwOrderAction(o.cw_order_id, 'delivered')}
                          style={{ flex: 1, padding: '8px', background: 'rgba(72,187,120,0.15)', color: '#48BB78', border: '1px solid rgba(72,187,120,0.4)', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          <CheckCircle2 size={13} /> Entregue
                        </button>
                      )}
                      {(o.status === 'waiting_to_catch' || o.status === 'delivered') && (
                        <button onClick={() => cwOrderAction(o.cw_order_id, 'finalize')}
                          style={{ flex: 1, padding: '8px', background: 'rgba(113,128,150,0.15)', color: '#A0AEC0', border: '1px solid rgba(113,128,150,0.4)', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          <CheckCircle2 size={13} /> Finalizar
                        </button>
                      )}
                      {['waiting_confirmation', 'confirmed'].includes(o.status) && (
                        <button onClick={() => {
                          const reason = prompt('Motivo do cancelamento (opcional):');
                          if (reason !== null) cwOrderAction(o.cw_order_id, 'cancel', reason);
                        }}
                          style={{ padding: '8px 12px', background: 'rgba(224,64,64,0.1)', color: '#E04040', border: '1px solid rgba(224,64,64,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <X size={13} /> Cancelar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTÃO SALVAR FIXO */}
      {tab !== 'orders' && tab !== 'cardapioweb' && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '12px 16px', background: '#2D2D2D', borderTop: '2px solid #D4A528', zIndex: 40 }}>
          {msg && <p style={{ fontSize: 13, textAlign: 'center', marginBottom: 6, color: msg.includes('✅') ? '#48BB78' : '#E53E3E' }}>{msg}</p>}
          <button className="btn-primary" onClick={saveAll} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
              : <><Save size={16} /> Salvar Tudo</>}
          </button>
        </div>
      )}
    </div>
  );
}
