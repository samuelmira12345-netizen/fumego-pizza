'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Flame, UtensilsCrossed, GlassWater, Settings, Package,
  Upload, Loader2, Trash2, Plus, Check, Save,
  Palette, Store, Star, Landmark, CreditCard, Banknote, Clock,
  Plug, RefreshCw, X, Link2, Copy,
} from 'lucide-react';
import { DEFAULT_BUSINESS_HOURS, DAY_LABELS, DAY_ORDER } from '../../lib/store-hours';
import OrdersTab from '../components/admin/OrdersTab';
import CardapioWebTab from '../components/admin/CardapioWebTab';

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

  // ── Open Delivery ───────────────────────────────────────────
  const [odSetup, setOdSetup] = useState(null);
  const [odLoading, setOdLoading] = useState(false);
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

  // ── Auto-dispatch de pedidos agendados (substitui o Vercel Cron) ──────────
  // Executa a cada 5 minutos enquanto o admin está aberto e autenticado.
  useEffect(() => {
    if (!authenticated) return;
    async function dispatch() {
      try { await fetch('/api/cron/dispatch-scheduled'); } catch {}
    }
    dispatch(); // Dispara imediatamente ao autenticar
    const iv = setInterval(dispatch, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [authenticated]);

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

  // ── Helpers Open Delivery ─────────────────────────────────────────────────

  async function loadODSetup() {
    setOdLoading(true);
    try {
      const res = await fetch('/api/open-delivery/setup', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      const d = await res.json();
      setOdSetup(d);
    } catch { setOdSetup(null); }
    finally { setOdLoading(false); }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

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

  // ── Stock limits ─────────────────────────────────────────────────────
  function getStockLimits() {
    const raw = getSetting('stock_limits');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }

  function updateStockLimit(productId, field, value) {
    const current = getStockLimits();
    const updated = {
      ...current,
      [String(productId)]: { ...(current[String(productId)] || { enabled: false, qty: 0, low_stock_threshold: 3 }), [field]: value },
    };
    updateSetting('stock_limits', JSON.stringify(updated));
  }

  // ── Posição de imagem dos produtos ───────────────────────────────────
  function getImagePositions() {
    const raw = getSetting('image_positions');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }

  function updateImagePosition(productId, x, y) {
    const current = getImagePositions();
    const updated = { ...current, [String(productId)]: { x, y } };
    updateSetting('image_positions', JSON.stringify(updated));
  }

  // ── Estoque de bebidas ────────────────────────────────────────────────
  function getDrinkStockLimits() {
    const raw = getSetting('drink_stock_limits');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }

  function updateDrinkStockLimit(drinkId, field, value) {
    const current = getDrinkStockLimits();
    const updated = {
      ...current,
      [String(drinkId)]: { ...(current[String(drinkId)] || { enabled: false, qty: 0 }), [field]: value },
    };
    updateSetting('drink_stock_limits', JSON.stringify(updated));
  }

  // ── Scheduling ───────────────────────────────────────────────────────
  function getSchedulingSlots() {
    const raw = getSetting('scheduling_slots');
    if (!raw) return [{ time: '12:00', max_orders: 3 }, { time: '18:00', max_orders: 3 }];
    try { return JSON.parse(raw); } catch { return []; }
  }

  function updateSchedulingSlots(slots) {
    updateSetting('scheduling_slots', JSON.stringify(slots));
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
            {p.image_url && (() => {
              const pos = getImagePositions()[String(p.id)] || { x: 50, y: 50 };
              return (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: '#999', marginBottom: 5, fontWeight: 600 }}>
                    Posição da foto — Clique para ajustar ({pos.x}% H, {pos.y}% V)
                  </p>
                  <div
                    style={{ position: 'relative', width: '100%', height: 130, cursor: 'crosshair', borderRadius: 8, overflow: 'hidden', border: '2px solid #555', userSelect: 'none' }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
                      const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
                      updateImagePosition(p.id, x, y);
                    }}
                  >
                    <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%`, pointerEvents: 'none', display: 'block' }} />
                    <div style={{
                      position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'rgba(242,168,0,0.9)', border: '2px solid #fff',
                      boxShadow: '0 0 6px rgba(0,0,0,0.8)', pointerEvents: 'none',
                    }} />
                    <div style={{ position: 'absolute', left: `${pos.x}%`, top: 0, bottom: 0, width: 1, background: 'rgba(242,168,0,0.35)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: `${pos.y}%`, left: 0, right: 0, height: 1, background: 'rgba(242,168,0,0.35)', pointerEvents: 'none' }} />
                  </div>
                  <p style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Clique na imagem para definir o ponto de foco do recorte</p>
                </div>
              );
            })()}
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

              {/* Controle de Estoque */}
              {(() => {
                const stock = getStockLimits()[String(p.id)] || { enabled: false, qty: 0 };
                return (
                  <div style={{ marginTop: 4, padding: '10px 12px', background: '#1A1A1A', borderRadius: 8, border: '1px solid #333' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: stock.enabled ? 8 : 0 }}>
                      <input type="checkbox" checked={stock.enabled} onChange={e => updateStockLimit(p.id, 'enabled', e.target.checked)} />
                      <span style={{ fontSize: 12, color: '#bbb', fontWeight: 600 }}>Limitar estoque</span>
                    </label>
                    {stock.enabled && (() => {
                      const thr = stock.low_stock_threshold ?? 3;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input className="input-field" type="number" min="0" placeholder="Qtd disponível"
                              value={stock.qty}
                              onChange={e => updateStockLimit(p.id, 'qty', parseInt(e.target.value) || 0)}
                              style={{ maxWidth: 150 }} />
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                              background: stock.qty <= 0 ? 'rgba(229,83,83,0.2)' : stock.qty <= thr ? 'rgba(246,173,85,0.2)' : 'rgba(72,187,120,0.2)',
                              color: stock.qty <= 0 ? '#E53E3E' : stock.qty <= thr ? '#F6AD55' : '#48BB78',
                            }}>
                              {stock.qty <= 0 ? 'Esgotado' : stock.qty <= thr ? 'Poucas unidades' : 'Disponível'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input className="input-field" type="number" min="1" max="50"
                              placeholder="Aviso poucas unid. (ex: 3)"
                              value={thr}
                              onChange={e => updateStockLimit(p.id, 'low_stock_threshold', parseInt(e.target.value) || 3)}
                              style={{ maxWidth: 150 }} />
                            <span style={{ fontSize: 10, color: '#666' }}>= qtd para "Poucas unidades"</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
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

                {/* Controle de Estoque da Bebida */}
                {(() => {
                  const dstock = getDrinkStockLimits()[String(d.id)] || { enabled: false, qty: 0 };
                  return (
                    <div style={{ marginTop: 8, padding: '10px 12px', background: '#1A1A1A', borderRadius: 8, border: '1px solid #333' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: dstock.enabled ? 8 : 0 }}>
                        <input type="checkbox" checked={dstock.enabled} onChange={e => updateDrinkStockLimit(d.id, 'enabled', e.target.checked)} />
                        <span style={{ fontSize: 12, color: '#bbb', fontWeight: 600 }}>Limitar estoque</span>
                      </label>
                      {dstock.enabled && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input className="input-field" type="number" min="0" placeholder="Qtd disponível"
                            value={dstock.qty}
                            onChange={e => updateDrinkStockLimit(d.id, 'qty', parseInt(e.target.value) || 0)}
                            style={{ maxWidth: 150 }} />
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                            background: dstock.qty <= 0 ? 'rgba(229,83,83,0.2)' : 'rgba(72,187,120,0.2)',
                            color: dstock.qty <= 0 ? '#E53E3E' : '#48BB78',
                          }}>
                            {dstock.qty <= 0 ? 'Esgotado' : 'Disponível'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
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

            {/* Agendamento */}
            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, border: '1px solid #444' }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={16} color="#D4A528" /> Agendamento de Pedidos
              </h3>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <input type="checkbox" checked={getSetting('scheduling_enabled') === 'true'}
                  onChange={e => updateSetting('scheduling_enabled', e.target.checked ? 'true' : 'false')} />
                <span style={{ color: '#fff', fontSize: 14 }}>Ativar agendamento</span>
              </label>
              <p style={{ color: '#888', fontSize: 12, marginBottom: 14 }}>
                Permite que o cliente escolha data e hora na finalização do pedido.
              </p>

              {getSetting('scheduling_enabled') === 'true' && (
                <>
                  <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Máximo de dias antecipados para agendamento
                  </label>
                  <input className="input-field" type="number" min="1" max="30" placeholder="Ex: 3"
                    value={getSetting('scheduling_max_days') || '3'}
                    onChange={e => updateSetting('scheduling_max_days', e.target.value)}
                    style={{ marginBottom: 16, maxWidth: 120 }} />

                  <div style={{ height: 1, background: '#444', marginBottom: 14 }} />

                  <h4 style={{ color: '#D4A528', fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>
                    Horários disponíveis e capacidade máxima
                  </h4>
                  <p style={{ color: '#888', fontSize: 11, marginBottom: 12 }}>
                    Cada horário pode receber no máximo N pedidos simultâneos.
                  </p>

                  {getSchedulingSlots().map((slot, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input type="time" value={slot.time}
                        onChange={e => {
                          const slots = [...getSchedulingSlots()];
                          slots[i] = { ...slots[i], time: e.target.value };
                          updateSchedulingSlots(slots);
                        }}
                        style={{ flex: 1, background: '#1A1A1A', color: '#fff', border: '1px solid #555', borderRadius: 8, padding: '6px 8px', fontSize: 13 }} />
                      <input type="number" min="1" max="99" value={slot.max_orders}
                        onChange={e => {
                          const slots = [...getSchedulingSlots()];
                          slots[i] = { ...slots[i], max_orders: parseInt(e.target.value) || 1 };
                          updateSchedulingSlots(slots);
                        }}
                        style={{ width: 60, background: '#1A1A1A', color: '#fff', border: '1px solid #555', borderRadius: 8, padding: '6px 8px', fontSize: 13, textAlign: 'center' }} />
                      <span style={{ color: '#666', fontSize: 11 }}>pedidos</span>
                      <button onClick={() => {
                        const slots = getSchedulingSlots().filter((_, j) => j !== i);
                        updateSchedulingSlots(slots);
                      }}
                        style={{ background: 'none', border: 'none', color: '#E53E3E', cursor: 'pointer', padding: 4 }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  <button onClick={() => {
                    const slots = [...getSchedulingSlots(), { time: '12:00', max_orders: 3 }];
                    updateSchedulingSlots(slots);
                  }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(212,165,40,0.15)', color: '#D4A528', border: '1px solid rgba(212,165,40,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
                    <Plus size={12} /> Adicionar horário
                  </button>
                </>
              )}
            </div>

            {/* Open Delivery */}
            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, border: '1px solid #444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ color: '#D4A528', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link2 size={16} color="#D4A528" /> Open Delivery (CardápioWeb)
                </h3>
                <button onClick={loadODSetup} disabled={odLoading}
                  style={{ padding: '6px 10px', background: '#333', color: '#D4A528', border: '1px solid #444', borderRadius: 8, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <RefreshCw size={11} style={odLoading ? { animation: 'spin 1s linear infinite' } : {}} />
                  {odLoading ? '...' : 'Carregar'}
                </button>
              </div>
              <p style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
                Pedidos feitos no app chegam automaticamente no dashboard do CardápioWeb via Open Delivery.
                Configure as variáveis de ambiente abaixo e forneça as credenciais ao CardápioWeb.
              </p>

              {!odSetup && (
                <p style={{ color: '#666', fontSize: 12, fontStyle: 'italic' }}>
                  Clique em "Carregar" para ver as credenciais e endpoints.
                </p>
              )}

              {odSetup && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 'bold',
                      background: odSetup.enabled ? 'rgba(72,187,120,0.15)' : 'rgba(224,64,64,0.1)',
                      color: odSetup.enabled ? '#48BB78' : '#E04040',
                      border: `1px solid ${odSetup.enabled ? 'rgba(72,187,120,0.4)' : 'rgba(224,64,64,0.3)'}` }}>
                      {odSetup.enabled ? '● Integração ativa' : '● Integração inativa'}
                    </span>
                  </div>

                  {!odSetup.enabled && (
                    <div style={{ background: '#1A1A1A', borderRadius: 8, padding: 12, marginBottom: 12, border: '1px solid #555' }}>
                      <p style={{ color: '#F6AD55', fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>Configure as variáveis de ambiente:</p>
                      {['OD_CLIENT_ID', 'OD_CLIENT_SECRET', 'OD_APP_ID', 'OD_MERCHANT_ID', 'OD_MERCHANT_NAME'].map(v => (
                        <p key={v} style={{ color: '#888', fontSize: 11, fontFamily: 'monospace' }}>{v}</p>
                      ))}
                    </div>
                  )}

                  <p style={{ color: '#aaa', fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>
                    Forneça ao CardápioWeb:
                  </p>
                  {[
                    ['Base URL', odSetup.endpoints?.baseUrl],
                    ['Token URL', odSetup.endpoints?.token],
                    ['Client ID', odSetup.clientId],
                    ['App ID', odSetup.appId],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: '#888', fontSize: 11, minWidth: 80 }}>{label}:</span>
                      <span style={{ color: '#D4A528', fontSize: 11, fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>{value}</span>
                      <button onClick={() => copyToClipboard(value)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 2 }}>
                        <Copy size={12} />
                      </button>
                    </div>
                  ))}
                  <p style={{ color: '#666', fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                    Client Secret: use o valor definido em OD_CLIENT_SECRET (não exibido por segurança).
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PEDIDOS (componente extraído em components/admin/OrdersTab.js) */}
        {tab === 'orders' && (
          <OrdersTab
            orders={data.orders}
            hasMoreOrders={hasMoreOrders}
            loadingMore={loadingMore}
            onUpdateStatus={updateOrderStatus}
            onLoadMore={loadMoreOrders}
          />
        )}

        {/* ── CARDÁPIOWEB (componente extraído em components/admin/CardapioWebTab.js) */}
        {tab === 'cardapioweb' && (
          <CardapioWebTab
            orders={cwOrders}
            loading={cwLoading}
            syncing={cwSyncing}
            msg={cwMsg}
            onRefresh={loadCWOrders}
            onSync={syncCWOrders}
            onOrderAction={cwOrderAction}
          />
        )}
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
    </div>
  );
}
