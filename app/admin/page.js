'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Flame, UtensilsCrossed, GlassWater, Settings, Package,
  Upload, Loader2, Trash2, Plus, Check, Save,
  Palette, Store, Star, Landmark, CreditCard, Banknote, Clock,
  Plug, RefreshCw, X, Copy,
  LayoutDashboard, ShoppingBag, Users, ChefHat, Truck,
  Megaphone, Wallet, Archive, BarChart2, LogOut, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { DEFAULT_BUSINESS_HOURS, DAY_LABELS, DAY_ORDER } from '../../lib/store-hours';
import CardapioWebTab from '../components/admin/CardapioWebTab';
import Dashboard from '../components/admin/Dashboard';
import Reports from '../components/admin/Reports';
import KDSBoard from '../components/admin/KDSBoard';
import Customers from '../components/admin/Customers';
import Catalog from '../components/admin/Catalog';
import Analytics from '../components/admin/Analytics';

const SESSION_KEY = 'admin_token';

// ── Cores do CRM ──────────────────────────────────────────────────────────────
const C = {
  sidebar:       '#111827',
  sidebarHover:  '#1F2937',
  sidebarActive: '#1F2937',
  gold:          '#F2A800',
  goldDim:       'rgba(242,168,0,0.15)',
  bg:            '#F4F5F7',
  card:          '#ffffff',
  border:        '#E5E7EB',
  text:          '#111827',
  textMuted:     '#6B7280',
  textLight:     '#9CA3AF',
  danger:        '#EF4444',
  success:       '#10B981',
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'GERAL',
    items: [
      { key: 'dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
      { key: 'orders',      icon: ShoppingBag,     label: 'Pedidos' },
      { key: 'clients',     icon: Users,           label: 'Clientes' },
    ],
  },
  {
    label: 'OPERAÇÃO',
    items: [
      { key: 'catalog',     icon: UtensilsCrossed, label: 'Catálogo' },
      { key: 'cardapioweb', icon: Plug,            label: 'CardápioWeb' },
      { key: 'deliveries',  icon: Truck,           label: 'Entregas',   soon: true },
    ],
  },
  {
    label: 'CRESCIMENTO',
    items: [
      { key: 'analytics',   icon: BarChart2,       label: 'Analytics' },
      { key: 'marketing',   icon: Megaphone,       label: 'Marketing',  soon: true },
      { key: 'financial',   icon: Wallet,          label: 'Financeiro', soon: true },
      { key: 'stock',       icon: Archive,         label: 'Estoque',    soon: true },
      { key: 'reports',     icon: BarChart2,       label: 'Relatórios' },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { key: 'settings',    icon: Settings,        label: 'Configurações' },
    ],
  },
];

function Sidebar({ section, onNavigate, onLogout, logoUrl, logoSize, isOpen, onToggle }) {
  const w = isOpen ? 240 : 64;
  return (
    <aside style={{
      width: w, minWidth: w,
      background: C.sidebar,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      overflowY: 'auto', overflowX: 'hidden',
      flexShrink: 0,
      transition: 'width 0.2s ease, min-width 0.2s ease',
    }}>
      {/* Brand + toggle */}
      <div style={{ padding: isOpen ? '20px 16px 16px' : '20px 0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'space-between' : 'center' }}>
        {isOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ height: Math.min(logoSize, 30), objectFit: 'contain', flexShrink: 0 }} />
              : <Flame size={24} color={C.gold} style={{ flexShrink: 0 }} />
            }
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 2, fontFamily: 'Georgia,serif', whiteSpace: 'nowrap' }}>FUMÊGO</p>
              <p style={{ fontSize: 9, color: C.gold, fontWeight: 600, letterSpacing: 1.5, marginTop: 1 }}>CRM</p>
            </div>
          </div>
        )}
        {!isOpen && <Flame size={22} color={C.gold} />}
        <button
          onClick={onToggle}
          title={isOpen ? 'Recolher sidebar' : 'Expandir sidebar'}
          style={{
            background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 6,
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, marginLeft: isOpen ? 4 : 0,
          }}
        >
          {isOpen ? <PanelLeftClose size={15} color="rgba(255,255,255,0.6)" /> : <PanelLeftOpen size={15} color="rgba(255,255,255,0.6)" />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: isOpen ? '14px 10px' : '14px 8px', overflowY: 'auto' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: isOpen ? 22 : 6 }}>
            {isOpen && (
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, paddingLeft: 8, marginBottom: 5 }}>
                {group.label}
              </p>
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = section === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => !item.soon && onNavigate(item.key)}
                  title={!isOpen ? item.label : undefined}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    gap: isOpen ? 10 : 0, justifyContent: isOpen ? 'flex-start' : 'center',
                    padding: isOpen ? '8px 10px' : '10px 0',
                    borderRadius: 6, border: 'none',
                    background: isActive ? C.goldDim : 'transparent',
                    color: isActive ? C.gold : item.soon ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.65)',
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    cursor: item.soon ? 'default' : 'pointer',
                    marginBottom: 2, textAlign: 'left',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseEnter={e => { if (!isActive && !item.soon) e.currentTarget.style.background = C.sidebarHover; }}
                  onMouseLeave={e => { if (!isActive && !item.soon) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {isOpen && (
                    <>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>{item.label}</span>
                      {item.soon && (
                        <span style={{ fontSize: 8, fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', padding: '2px 5px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                          EM BREVE
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: isOpen ? '10px 10px 18px' : '10px 8px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={onLogout}
          title={!isOpen ? 'Sair' : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: isOpen ? 10 : 0, justifyContent: isOpen ? 'flex-start' : 'center',
            padding: isOpen ? '8px 10px' : '10px 0',
            borderRadius: 6, border: 'none',
            background: 'transparent', color: 'rgba(255,255,255,0.4)',
            fontSize: 13, cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {isOpen && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}

// ── Coming Soon placeholder ───────────────────────────────────────────────────

function ComingSoon({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: C.goldDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Clock size={26} color={C.gold} />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{label}</h3>
      <p style={{ fontSize: 14, color: C.textMuted }}>Esta seção está em desenvolvimento e estará disponível em breve.</p>
    </div>
  );
}

// ── Page Header ───────────────────────────────────────────────────────────────

function PageHeader({ section }) {
  const labels = {
    dashboard:   'Dashboard',
    orders:      'Pedidos',
    catalog:     'Catálogo',
    cardapioweb: 'CardápioWeb',
    settings:    'Configurações',
  };
  return (
    <div style={{ padding: '20px 32px 0', borderBottom: '1px solid ' + C.border, background: C.card, marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12, color: C.textLight }}>
        <span>Admin</span>
        <ChevronRight size={12} />
        <span style={{ color: C.text, fontWeight: 600 }}>{labels[section] || section}</span>
      </div>
    </div>
  );
}

// ── Admin Page (Main) ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const [password, setPassword]               = useState('');
  const [adminToken, setAdminToken]           = useState('');
  const [authenticated, setAuthenticated]     = useState(false);
  const [section, setSection]                 = useState('dashboard');
  const [sidebarOpen, setSidebarOpen]         = useState(true);
  const [data, setData]                       = useState({ products: [], drinks: [], coupons: [], settings: [], orders: [] });
  const [hasMoreOrders, setHasMoreOrders]     = useState(false);
  const [loadingMore, setLoadingMore]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [msg, setMsg]                         = useState('');

  // ── CardápioWeb ─────────────────────────────────────────────────────────────
  const [cwOrders, setCwOrders]       = useState([]);
  const [cwLoading, setCwLoading]     = useState(false);
  const [cwSyncing, setCwSyncing]     = useState(false);
  const [cwMsg, setCwMsg]             = useState('');

  // ── CardápioWeb Partner API ─────────────────────────────────────────────────
  const [cwPartnerStatus, setCwPartnerStatus]   = useState(null);
  const [cwPartnerLoading, setCwPartnerLoading] = useState(false);

  const [uploadingId, setUploadingId]   = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [newDrink, setNewDrink]         = useState({ name: '', size: '', price: '' });
  const [addingDrink, setAddingDrink]   = useState(false);

  // Logo visível antes do login
  const [loginLogo, setLoginLogo]       = useState('');
  const [loginLogoSize, setLoginLogoSize] = useState(48);

  // ── Aplicar/remover override de body para desktop ───────────────────────────
  useEffect(() => {
    document.body.classList.add('admin-desktop');
    return () => document.body.classList.remove('admin-desktop');
  }, []);

  useEffect(() => {
    supabase.from('settings').select('key,value').in('key', ['logo_url', 'logo_size'])
      .then(({ data: rows }) => {
        if (!rows) return;
        const url  = rows.find(r => r.key === 'logo_url')?.value  || '';
        const size = rows.find(r => r.key === 'logo_size')?.value || '48';
        if (url)  setLoginLogo(url);
        if (size) setLoginLogoSize(parseInt(size) || 48);
      });

    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) setAdminToken(saved);
  }, []);

  // ── Auto-dispatch de pedidos agendados ──────────────────────────────────────
  useEffect(() => {
    if (!authenticated) return;
    async function dispatch() {
      try { await fetch('/api/cron/dispatch-scheduled'); } catch {}
    }
    dispatch();
    const iv = setInterval(dispatch, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [authenticated]);

  // ── adminFetch helper ───────────────────────────────────────────────────────
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

  // ── CardápioWeb helpers ─────────────────────────────────────────────────────

  async function testCWPartner() {
    setCwPartnerLoading(true);
    try {
      const res = await fetch('/api/cardapioweb-partner/test', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      const d = await res.json();
      setCwPartnerStatus(d);
    } catch (e) {
      setCwPartnerStatus({ enabled: false, error: 'Erro ao conectar: ' + e.message });
    } finally {
      setCwPartnerLoading(false);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

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

  // ── Auth ────────────────────────────────────────────────────────────────────

  async function handleLogin() {
    setLoading(true);
    try {
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

      const res = await adminFetch('get_data', {}, token);
      const d = await res.json();
      if (d.error) { alert(d.error); return; }
      setData(d);
      setHasMoreOrders(d.hasMore || false);
      setAuthenticated(true);
    } catch (e) { alert('Erro de conexão'); }
    finally { setLoading(false); }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminToken('');
    setAuthenticated(false);
    setData({ products: [], drinks: [], coupons: [], settings: [], orders: [] });
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await adminFetch('get_data', {});
      const d = await res.json();
      if (d.error) { alert(d.error); return; }
      setData(d);
      setHasMoreOrders(d.hasMore || false);
    } catch (e) { alert('Erro ao atualizar dados'); }
    finally { setLoading(false); }
  }

  // Refresh: busca os últimos 8 dias de orders e mescla com dados já carregados.
  // Ordens mais antigas (carregadas via "Carregar mais") são preservadas.
  const loadOrders = useCallback(async () => {
    try {
      const res = await adminFetch('get_orders_only', {});
      const d = await res.json();
      if (d.orders) {
        setData(prev => {
          const freshIds = new Set(d.orders.map(o => o.id));
          // Preserva pedidos mais antigos que não estão no batch novo
          const olderOrders = prev.orders.filter(o => !freshIds.has(o.id));
          return { ...prev, orders: [...d.orders, ...olderOrders] };
        });
      }
    } catch {}
  }, [adminFetch]);

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

  // ── CRUD helpers ────────────────────────────────────────────────────────────

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

  function getDrinkStockLimits() {
    const raw = getSetting('drink_stock_limits');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }

  function updateDrinkStockLimit(drinkId, field, value) {
    setData(prev => {
      const raw = prev.settings.find(s => s.key === 'drink_stock_limits')?.value;
      let current = {};
      try { current = JSON.parse(raw || '{}'); } catch {}
      const existing = current[String(drinkId)] || { enabled: false, qty: 0 };
      const entry = { ...existing, [field]: value };
      const newMap = { ...current, [String(drinkId)]: entry };

      const settingsIdx = prev.settings.findIndex(s => s.key === 'drink_stock_limits');
      const newSettings = settingsIdx >= 0
        ? prev.settings.map((s, i) => i === settingsIdx ? { ...s, value: JSON.stringify(newMap) } : s)
        : [...prev.settings, { key: 'drink_stock_limits', value: JSON.stringify(newMap) }];

      const outOfStock = entry.enabled && entry.qty <= 0;
      const newDrinks = prev.drinks.map(d =>
        String(d.id) === String(drinkId) ? { ...d, is_active: !outOfStock } : d
      );

      return { ...prev, settings: newSettings, drinks: newDrinks };
    });
  }

  function getSchedulingSlots() {
    const raw = getSetting('scheduling_slots');
    if (!raw) return [{ time: '12:00', max_orders: 3 }, { time: '18:00', max_orders: 3 }];
    try { return JSON.parse(raw); } catch { return []; }
  }

  function updateSchedulingSlots(slots) {
    updateSetting('scheduling_slots', JSON.stringify(slots));
  }

  // ── Uploads ─────────────────────────────────────────────────────────────────

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

  // ── Handle section change ───────────────────────────────────────────────────
  function handleNavigate(key) {
    setSection(key);
    if (key === 'cardapioweb' && cwOrders.length === 0) loadCWOrders();
    setMsg('');
  }

  // ── Login screen ────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F172A',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            {loginLogo
              ? <img src={loginLogo} alt="Logo" style={{ height: loginLogoSize, objectFit: 'contain' }} />
              : <Flame size={48} color="#F2A800" />
            }
          </div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 800, color: '#F2A800', letterSpacing: 3, marginBottom: 4 }}>
            FUMÊGO
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, marginBottom: 32 }}>CRM · PAINEL ADMINISTRATIVO</p>

          <div style={{ background: '#1E293B', borderRadius: 16, padding: 28, border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              className="input-field"
              type="password"
              placeholder="Senha do administrador"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ marginBottom: 14, background: '#0F172A', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            />
            <button
              className="btn-primary"
              onClick={handleLogin}
              disabled={loading}
              style={{ borderRadius: 10 }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Conteúdo de cada seção ──────────────────────────────────────────────────

  const showSaveBar = ['settings'].includes(section);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <Sidebar
        section={section}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        logoUrl={getSetting('logo_url')}
        logoSize={parseInt(getSetting('logo_size') || '36')}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      {/* ── Conteúdo principal ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: section === 'orders' ? 'hidden' : 'auto' }}>

        {/* Page Header */}
        {section !== 'dashboard' && <PageHeader section={section} />}

        {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
        {section === 'dashboard' && (
          <Dashboard
            orders={data.orders}
            onRefresh={loadData}
            loading={loading}
            adminToken={adminToken}
          />
        )}

        {/* ── PEDIDOS / KDS ─────────────────────────────────────────────── */}
        {section === 'orders' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <KDSBoard
              orders={data.orders}
              onUpdateStatus={updateOrderStatus}
              onRefresh={loadData}
              onRefreshOrders={loadOrders}
              adminToken={adminToken}
              loading={loading}
              products={data.products}
              drinks={data.drinks}
              hasMoreOrders={hasMoreOrders}
              loadingMore={loadingMore}
              onLoadMore={loadMoreOrders}
            />
          </div>
        )}

        {/* ── CATÁLOGO (Produtos + Bebidas + Insumos) ───────────────────── */}
        {section === 'catalog' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <Catalog adminToken={adminToken} />
          </div>
        )}

        {/* ── PRODUTOS (legado — não aparece mais no nav) ────────────────── */}
        {section === 'products' && (
          <div style={{ padding: '24px 32px', paddingBottom: 100 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
              {data.products.map((p, idx) => (
                <div key={p.id} style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{p.name}</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={p.is_active} onChange={e => updateProduct(idx, 'is_active', e.target.checked)} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: p.is_active ? C.success : C.danger }}>{p.is_active ? 'Ativo' : 'Inativo'}</span>
                    </label>
                  </div>

                  {p.image_url && (() => {
                    const pos = getImagePositions()[String(p.id)] || { x: 50, y: 50 };
                    return (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: 11, color: C.textLight, marginBottom: 5, fontWeight: 600 }}>
                          Posição da foto — Clique para ajustar ({pos.x}% H, {pos.y}% V)
                        </p>
                        <div
                          style={{ position: 'relative', width: '100%', height: 130, cursor: 'crosshair', borderRadius: 8, overflow: 'hidden', border: '2px solid ' + C.border, userSelect: 'none' }}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
                            const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
                            updateImagePosition(p.id, x, y);
                          }}
                        >
                          <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%`, pointerEvents: 'none', display: 'block' }} />
                          <div style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: '50%', background: 'rgba(242,168,0,0.9)', border: '2px solid #fff', boxShadow: '0 0 6px rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
                          <div style={{ position: 'absolute', left: `${pos.x}%`, top: 0, bottom: 0, width: 1, background: 'rgba(242,168,0,0.35)', pointerEvents: 'none' }} />
                          <div style={{ position: 'absolute', top: `${pos.y}%`, left: 0, right: 0, height: 1, background: 'rgba(242,168,0,0.35)', pointerEvents: 'none' }} />
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#F3F4F6', color: C.text, borderRadius: 8, fontSize: 13, cursor: 'pointer', border: '1px solid ' + C.border, opacity: uploadingId === p.id ? 0.5 : 1 }}>
                      {uploadingId === p.id
                        ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
                        : <><Upload size={13} /> Enviar foto</>
                      }
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleImageUpload(idx, e.target.files[0]); }} disabled={uploadingId === p.id} />
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="input-field" placeholder="Descrição" value={p.description || ''} onChange={e => updateProduct(idx, 'description', e.target.value)} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input className="input-field" placeholder="Preço" type="number" step="0.01" value={p.price || ''} onChange={e => updateProduct(idx, 'price', e.target.value)} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                      <input className="input-field" placeholder="Ordem" type="number" value={p.sort_order || ''} onChange={e => updateProduct(idx, 'sort_order', parseInt(e.target.value) || 0)} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                    </div>

                    {(() => {
                      const stock = getStockLimits()[String(p.id)] || { enabled: false, qty: 0 };
                      return (
                        <div style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, border: '1px solid ' + C.border }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: stock.enabled ? 8 : 0 }}>
                            <input type="checkbox" checked={stock.enabled} onChange={e => updateStockLimit(p.id, 'enabled', e.target.checked)} />
                            <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>Limitar estoque</span>
                          </label>
                          {stock.enabled && (() => {
                            const thr = stock.low_stock_threshold ?? 3;
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input className="input-field" type="number" min="0" placeholder="Qtd disponível" value={stock.qty} onChange={e => updateStockLimit(p.id, 'qty', parseInt(e.target.value) || 0)} style={{ maxWidth: 140, background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap', background: stock.qty <= 0 ? 'rgba(239,68,68,0.1)' : stock.qty <= thr ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: stock.qty <= 0 ? C.danger : stock.qty <= thr ? '#D97706' : C.success }}>
                                    {stock.qty <= 0 ? 'Esgotado' : stock.qty <= thr ? 'Poucas unidades' : 'Disponível'}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input className="input-field" type="number" min="1" max="50" placeholder="Aviso poucas unid. (ex: 3)" value={thr} onChange={e => updateStockLimit(p.id, 'low_stock_threshold', parseInt(e.target.value) || 3)} style={{ maxWidth: 140, background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                                  <span style={{ fontSize: 10, color: C.textLight }}>= qtd para "Poucas unidades"</span>
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
            </div>
          </div>
        )}

        {/* ── BEBIDAS ───────────────────────────────────────────────────── */}
        {section === 'drinks' && (
          <div style={{ padding: '24px 32px', paddingBottom: 100 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {data.drinks.map((d, idx) => (
                <div key={d.id} style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={d.is_active} onChange={e => updateDrink(idx, 'is_active', e.target.checked)} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: d.is_active ? C.success : C.danger }}>{d.is_active ? 'Ativo' : 'Inativo'}</span>
                    </label>
                    <button onClick={() => handleDeleteDrink(d.id)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: C.danger, borderRadius: 8, padding: '4px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Trash2 size={13} /> Excluir
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <input className="input-field" placeholder="Marca/Nome" value={d.name || ''} onChange={e => updateDrink(idx, 'name', e.target.value)} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                    <input className="input-field" placeholder="Tamanho (ex: 600ml)" value={d.size || ''} onChange={e => updateDrink(idx, 'size', e.target.value)} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                  <input className="input-field" placeholder="Preço" type="number" step="0.01" value={d.price || ''} onChange={e => updateDrink(idx, 'price', e.target.value)} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />

                  {(() => {
                    const dstock = getDrinkStockLimits()[String(d.id)] || { enabled: false, qty: 0 };
                    return (
                      <div style={{ marginTop: 8, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, border: '1px solid ' + C.border }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: dstock.enabled ? 8 : 0 }}>
                          <input type="checkbox" checked={dstock.enabled} onChange={e => updateDrinkStockLimit(d.id, 'enabled', e.target.checked)} />
                          <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>Limitar estoque</span>
                        </label>
                        {dstock.enabled && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input className="input-field" type="number" min="0" placeholder="Qtd disponível" value={dstock.qty} onChange={e => updateDrinkStockLimit(d.id, 'qty', parseInt(e.target.value) || 0)} style={{ maxWidth: 140, background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap', background: dstock.qty <= 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: dstock.qty <= 0 ? C.danger : C.success }}>
                              {dstock.qty <= 0 ? 'Esgotado' : 'Disponível'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}

              {/* Adicionar bebida */}
              <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '2px dashed ' + C.border }}>
                <h3 style={{ color: C.gold, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <Plus size={16} color={C.gold} /> Adicionar Bebida
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input className="input-field" placeholder="Marca/Nome (ex: Coca-Cola)" value={newDrink.name} onChange={e => setNewDrink(prev => ({ ...prev, name: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  <input className="input-field" placeholder="Tamanho (ex: 600ml)" value={newDrink.size} onChange={e => setNewDrink(prev => ({ ...prev, size: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                </div>
                <input className="input-field" placeholder="Preço" type="number" step="0.01" value={newDrink.price} onChange={e => setNewDrink(prev => ({ ...prev, price: e.target.value }))} style={{ marginBottom: 12, background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                <button onClick={handleAddDrink} disabled={addingDrink} style={{ width: '100%', padding: '11px', background: C.gold, color: '#000', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: addingDrink ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {addingDrink ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Adicionando...</> : <><Check size={14} /> Adicionar Bebida</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CARDÁPIOWEB ───────────────────────────────────────────────── */}
        {section === 'cardapioweb' && (
          <div style={{ padding: '24px 32px', paddingBottom: 60 }}>
            <CardapioWebTab
              orders={cwOrders}
              loading={cwLoading}
              syncing={cwSyncing}
              msg={cwMsg}
              onRefresh={loadCWOrders}
              onSync={syncCWOrders}
              onOrderAction={cwOrderAction}
            />
          </div>
        )}

        {/* ── CONFIGURAÇÕES ─────────────────────────────────────────────── */}
        {section === 'settings' && (
          <div style={{ padding: '24px 32px', paddingBottom: 100, maxWidth: 720 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Logo */}
              <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ color: C.text, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <Palette size={16} color={C.gold} /> Logo da Pizzaria
                </h3>
                <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 12 }}>A logo aparece ao lado esquerdo do nome "FUMÊGO" no cabeçalho.</p>

                {getSetting('logo_url') && (
                  <div style={{ marginBottom: 14, padding: 12, background: '#111827', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={getSetting('logo_url')} alt="Logo" style={{ height: parseInt(getSetting('logo_size') || '36'), objectFit: 'contain' }} />
                    <span style={{ color: C.gold, fontWeight: 800, fontSize: 16, letterSpacing: 3 }}>FUMÊGO</span>
                  </div>
                )}

                {getSetting('logo_url') && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ color: C.textMuted, fontSize: 13, display: 'block', marginBottom: 6 }}>
                      Tamanho: <strong style={{ color: C.text }}>{getSetting('logo_size') || '36'}px</strong>
                    </label>
                    <input type="range" min="24" max="80" step="2" value={getSetting('logo_size') || '36'} onChange={e => updateSetting('logo_size', e.target.value)} style={{ width: '100%', accentColor: C.gold }} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.gold, color: '#000', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: uploadingLogo ? 0.5 : 1 }}>
                    {uploadingLogo ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</> : <><Upload size={13} /> Enviar Logo</>}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleLogoUpload(e.target.files[0]); }} disabled={uploadingLogo} />
                  </label>
                  {getSetting('logo_url') && (
                    <button onClick={removeLogo} style={{ padding: '8px 16px', background: '#F3F4F6', color: C.textMuted, border: '1px solid ' + C.border, borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Trash2 size={13} /> Remover Logo
                    </button>
                  )}
                </div>
              </div>

              {/* Loja */}
              <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ color: C.text, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <Store size={16} color={C.gold} /> Loja
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <input type="checkbox" checked={getSetting('store_open') === 'true'} onChange={e => updateSetting('store_open', e.target.checked ? 'true' : 'false')} />
                  <span style={{ color: C.text, fontSize: 14 }}>Loja aberta</span>
                </label>
                <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 14 }}>Desmarque para fechar imediatamente, independente do horário configurado.</p>
                <input className="input-field" placeholder="Tempo de entrega (ex: 40–60 min)" value={getSetting('delivery_time')} onChange={e => updateSetting('delivery_time', e.target.value)} style={{ marginBottom: 8, background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                <input className="input-field" placeholder="Taxa de entrega" type="number" step="0.01" value={getSetting('delivery_fee')} onChange={e => updateSetting('delivery_fee', e.target.value)} style={{ marginBottom: 16, background: '#F9FAFB', color: C.text, borderColor: C.border }} />

                <div style={{ height: 1, background: C.border, marginBottom: 14 }} />

                <h4 style={{ color: C.text, fontWeight: 700, marginBottom: 4, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} color={C.gold} /> Horário de Funcionamento
                </h4>
                <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 14 }}>A loja fecha automaticamente fora do horário. Horário de Brasília (UTC-3).</p>

                {DAY_ORDER.map(day => {
                  const h = getBusinessHours()[day] || { enabled: true, open: '18:00', close: '23:00' };
                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90, cursor: 'pointer' }}>
                        <input type="checkbox" checked={h.enabled} onChange={e => updateDayHours(day, 'enabled', e.target.checked)} />
                        <span style={{ fontSize: 13, fontWeight: h.enabled ? 600 : 400, color: h.enabled ? C.text : C.textLight }}>{DAY_LABELS[day]}</span>
                      </label>
                      <input type="time" value={h.open} disabled={!h.enabled} onChange={e => updateDayHours(day, 'open', e.target.value)} style={{ flex: 1, background: '#F9FAFB', color: h.enabled ? C.text : C.textLight, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 8px', fontSize: 13, cursor: h.enabled ? 'pointer' : 'not-allowed' }} />
                      <span style={{ color: C.textMuted, fontSize: 12 }}>às</span>
                      <input type="time" value={h.close} disabled={!h.enabled} onChange={e => updateDayHours(day, 'close', e.target.value)} style={{ flex: 1, background: '#F9FAFB', color: h.enabled ? C.text : C.textLight, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 8px', fontSize: 13, cursor: h.enabled ? 'pointer' : 'not-allowed' }} />
                    </div>
                  );
                })}
              </div>

              {/* Instagram */}
              <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ color: C.text, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  Instagram
                </h3>
                <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 10 }}>Link exibido após o pedido ser confirmado.</p>
                <input className="input-field" placeholder="https://instagram.com/suaconta" value={getSetting('instagram_url')} onChange={e => updateSetting('instagram_url', e.target.value)} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
              </div>

              {/* Especial do Mês */}
              <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ color: C.text, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <Star size={16} color={C.gold} /> Especial do Mês
                </h3>
                <input className="input-field" placeholder="Nome do sabor especial" value={getSetting('special_flavor_name')} onChange={e => updateSetting('special_flavor_name', e.target.value)} style={{ marginBottom: 8, background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                <textarea className="input-field" placeholder="Descrição" value={getSetting('special_flavor_description')} onChange={e => updateSetting('special_flavor_description', e.target.value)} rows="3" style={{ resize: 'none', background: '#F9FAFB', color: C.text, borderColor: C.border }} />
              </div>

              {/* Agendamento */}
              <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ color: C.text, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <Clock size={16} color={C.gold} /> Agendamento de Pedidos
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <input type="checkbox" checked={getSetting('scheduling_enabled') === 'true'} onChange={e => updateSetting('scheduling_enabled', e.target.checked ? 'true' : 'false')} />
                  <span style={{ color: C.text, fontSize: 14 }}>Ativar agendamento</span>
                </label>
                <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 14 }}>Permite que o cliente escolha data e hora na finalização do pedido.</p>

                {getSetting('scheduling_enabled') === 'true' && (
                  <>
                    <label style={{ color: C.textMuted, fontSize: 12, display: 'block', marginBottom: 4 }}>Máximo de dias antecipados</label>
                    <input className="input-field" type="number" min="1" max="30" placeholder="Ex: 3" value={getSetting('scheduling_max_days') || '3'} onChange={e => updateSetting('scheduling_max_days', e.target.value)} style={{ marginBottom: 16, maxWidth: 120, background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                    <div style={{ height: 1, background: C.border, marginBottom: 14 }} />
                    <h4 style={{ color: C.text, fontWeight: 700, marginBottom: 4, fontSize: 13 }}>Horários e capacidade</h4>
                    <p style={{ color: C.textMuted, fontSize: 11, marginBottom: 12 }}>Cada horário pode receber no máximo N pedidos simultâneos.</p>
                    {getSchedulingSlots().map((slot, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <input type="time" value={slot.time} onChange={e => { const slots = [...getSchedulingSlots()]; slots[i] = { ...slots[i], time: e.target.value }; updateSchedulingSlots(slots); }} style={{ flex: 1, background: '#F9FAFB', color: C.text, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 8px', fontSize: 13 }} />
                        <input type="number" min="1" max="99" value={slot.max_orders} onChange={e => { const slots = [...getSchedulingSlots()]; slots[i] = { ...slots[i], max_orders: parseInt(e.target.value) || 1 }; updateSchedulingSlots(slots); }} style={{ width: 60, background: '#F9FAFB', color: C.text, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 8px', fontSize: 13, textAlign: 'center' }} />
                        <span style={{ color: C.textMuted, fontSize: 11 }}>pedidos</span>
                        <button onClick={() => { const slots = getSchedulingSlots().filter((_, j) => j !== i); updateSchedulingSlots(slots); }} style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', padding: 4 }}><X size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => { const slots = [...getSchedulingSlots(), { time: '12:00', max_orders: 3 }]; updateSchedulingSlots(slots); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(242,168,0,0.1)', color: C.gold, border: '1px solid rgba(242,168,0,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
                      <Plus size={12} /> Adicionar horário
                    </button>
                  </>
                )}
              </div>

              {/* CardápioWeb Partner API */}
              <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ color: C.text, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <Plug size={16} color={C.gold} /> Integração CardápioWeb (Partner API)
                  </h3>
                  <button onClick={testCWPartner} disabled={cwPartnerLoading} style={{ padding: '6px 10px', background: '#F3F4F6', color: C.text, border: '1px solid ' + C.border, borderRadius: 8, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={11} style={cwPartnerLoading ? { animation: 'spin 1s linear infinite' } : {}} />
                    {cwPartnerLoading ? '...' : 'Testar Conexão'}
                  </button>
                </div>
                <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 12 }}>Pedidos feitos no app são enviados automaticamente ao painel do CardápioWeb via Partner API.</p>

                <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 12, border: '1px solid ' + C.border }}>
                  <p style={{ color: '#D97706', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Variáveis de ambiente necessárias no Vercel:</p>
                  {[
                    ['CW_BASE_URL',    'URL base da API'],
                    ['CW_API_KEY',     'Token do estabelecimento — X-API-KEY'],
                    ['CW_PARTNER_KEY', 'Token do integrador — X-PARTNER-KEY'],
                    ['CW_DEFAULT_LAT', 'Latitude do estabelecimento'],
                    ['CW_DEFAULT_LNG', 'Longitude do estabelecimento'],
                  ].map(([k, desc]) => (
                    <div key={k} style={{ marginBottom: 8 }}>
                      <p style={{ color: C.gold, fontSize: 11, fontFamily: 'monospace', marginBottom: 2 }}>{k}</p>
                      <p style={{ color: C.textMuted, fontSize: 10 }}>{desc}</p>
                    </div>
                  ))}
                </div>

                {!cwPartnerStatus && <p style={{ color: C.textLight, fontSize: 12, fontStyle: 'italic' }}>Clique em "Testar Conexão" para verificar o status.</p>}

                {cwPartnerStatus && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700, background: cwPartnerStatus.enabled && !cwPartnerStatus.error ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: cwPartnerStatus.enabled && !cwPartnerStatus.error ? C.success : C.danger, border: `1px solid ${cwPartnerStatus.enabled && !cwPartnerStatus.error ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                        {cwPartnerStatus.enabled && !cwPartnerStatus.error ? '● Integração ativa' : '● Integração inativa'}
                      </span>
                    </div>
                    {cwPartnerStatus.error && <p style={{ color: C.danger, fontSize: 12, marginBottom: 8, background: 'rgba(239,68,68,0.06)', padding: '8px 10px', borderRadius: 6 }}>{cwPartnerStatus.error}</p>}
                    {cwPartnerStatus.payment_methods?.length > 0 && (
                      <div>
                        <p style={{ color: C.textMuted, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Métodos de pagamento disponíveis:</p>
                        {cwPartnerStatus.payment_methods.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, padding: '5px 8px', background: '#F9FAFB', borderRadius: 6, border: '1px solid ' + C.border }}>
                            <span style={{ color: C.gold, fontSize: 10, fontFamily: 'monospace', minWidth: 28 }}>#{m.id}</span>
                            <span style={{ color: C.text, fontSize: 12 }}>{m.name}</span>
                            <span style={{ color: C.textLight, fontSize: 10, marginLeft: 'auto', fontFamily: 'monospace' }}>{m.kind}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── ANALYTICS ─────────────────────────────────────────────────── */}
        {section === 'analytics' && (
          <Analytics adminToken={adminToken} />
        )}

        {/* ── RELATÓRIOS ────────────────────────────────────────────────── */}
        {section === 'reports' && (
          <Reports adminToken={adminToken} />
        )}

        {/* ── CLIENTES ──────────────────────────────────────────────────── */}
        {section === 'clients' && (
          <Customers
            adminToken={adminToken}
            products={data.products}
            drinks={data.drinks}
            onRefresh={loadData}
          />
        )}

        {/* ── Coming Soon sections ─────────────────────────────────────── */}
        {['deliveries', 'marketing', 'financial', 'stock'].includes(section) && (
          <ComingSoon label={NAV_GROUPS.flatMap(g => g.items).find(i => i.key === section)?.label || section} />
        )}

        {/* ── Barra de Salvar (Produtos / Bebidas / Config) ────────────── */}
        {showSaveBar && (
          <div style={{
            position: 'fixed', bottom: 0, left: 240, right: 0,
            padding: '12px 32px',
            background: C.card,
            borderTop: '1px solid ' + C.border,
            zIndex: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16,
            boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          }}>
            {msg && (
              <span style={{ fontSize: 13, color: msg.includes('✅') ? C.success : C.danger, fontWeight: 600 }}>
                {msg}
              </span>
            )}
            <button onClick={saveAll} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: C.gold, color: '#000', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Save size={16} /> Salvar Alterações</>}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
