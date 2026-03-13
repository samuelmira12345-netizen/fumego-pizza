'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Phone, Package, CheckCircle, Truck, LogOut,
  RefreshCw, Navigation, Clock, DollarSign, User,
  ChevronDown, ChevronUp, AlertCircle, Loader2,
} from 'lucide-react';

const TOKEN_KEY = 'delivery_token';
const PERSON_KEY = 'delivery_person';

function fmtBRL(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPhone(p) {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p;
}

function fmtTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  });
}

const PM_LABELS = {
  pix: 'PIX',
  cash: 'Dinheiro',
  card_delivery: 'Cartão na entrega',
  card: 'Crédito',
  debit: 'Débito',
};

// ── Login Screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password) { setError('Preencha email e senha'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/delivery/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); return; }
      sessionStorage.setItem(TOKEN_KEY, d.token);
      sessionStorage.setItem(PERSON_KEY, JSON.stringify(d.person));
      onLogin(d.token, d.person);
    } catch (e) { setError('Erro de conexão'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#111827', padding: '24px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#1F2937', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Truck size={32} color="#F59E0B" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>FUMÊGO ENTREGAS</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Área do Entregador</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email" placeholder="E-mail" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid #374151', background: '#1F2937', color: '#fff', fontSize: 16, outline: 'none' }}
            autoComplete="email"
          />
          <input
            type="password" placeholder="Senha" value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid #374151', background: '#1F2937', color: '#fff', fontSize: 16, outline: 'none' }}
            autoComplete="current-password"
          />
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: '#450A0A', border: '1px solid #EF4444', borderRadius: 8, color: '#FCA5A5', fontSize: 13 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <button
            type="submit" disabled={loading}
            style={{ padding: '15px', borderRadius: 10, border: 'none', background: '#F59E0B', color: '#000', fontSize: 16, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}
          >
            {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Entrando...</> : 'Entrar'}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({ order, token, onStatusUpdate, isBlocked, queuePosition }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(null); // 'collected' | 'delivered'

  const isCollected  = !!order.driver_collected_at;
  const isDelivered  = !!order.driver_delivered_at || order.status === 'delivered';
  const pmLabel = PM_LABELS[order.payment_method] || order.payment_method || '—';
  const needsPayment = ['cash', 'card_delivery'].includes(order.payment_method);

  async function doAction(action) {
    setShowConfirm(null);
    setUpdating(true);
    try {
      const res = await fetch('/api/delivery/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ order_id: order.id, action }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      onStatusUpdate(order.id, action);
    } catch (e) { alert('Erro de conexão'); }
    finally { setUpdating(false); }
  }

  const addr = [
    order.delivery_street, order.delivery_number,
    order.delivery_complement, order.delivery_neighborhood,
    order.delivery_city,
  ].filter(Boolean).join(', ');

  function openMapAddress() {
    const url = `https://maps.google.com/maps?q=${encodeURIComponent(addr)}`;
    window.open(url, '_blank');
  }

  function openWazeAddress() {
    const url = `https://waze.com/ul?q=${encodeURIComponent(addr)}`;
    window.open(url, '_blank');
  }

  return (
    <div style={{
      background: '#1F2937', borderRadius: 16,
      border: isDelivered ? '1px solid #065F46' : isCollected ? '2px solid #7C3AED' : '1px solid #374151',
      overflow: 'hidden', marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: isDelivered ? '#064E3B' : isCollected ? '#4C1D95' : '#374151',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            {isDelivered ? <CheckCircle size={22} color="#34D399" /> : isCollected ? <Truck size={22} color="#A78BFA" /> : <Package size={22} color="#9CA3AF" />}
            {isBlocked && (
              <div style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>🔒</div>
            )}
            {!isDelivered && !isBlocked && queuePosition && (
              <div style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>{queuePosition}</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>
              #{order.order_number || String(order.id).slice(-4).toUpperCase()}
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>
              {isDelivered ? '✅ Entregue' : isBlocked ? '🔒 Aguardando anterior' : isCollected ? '🏍️ Em rota' : '📦 Aguardando retirada'}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#F59E0B' }}>{fmtBRL(order.total)}</div>
          <div style={{ fontSize: 11, color: needsPayment ? '#FBBF24' : '#6B7280', fontWeight: needsPayment ? 700 : 400 }}>
            {pmLabel}
          </div>
        </div>
      </div>

      {/* Quick info */}
      <div style={{ padding: '0 16px 12px', borderTop: '1px solid #374151' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '10px 0', textAlign: 'left', width: '100%' }}>
          <MapPin size={16} color="#F59E0B" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F3F4F6', lineHeight: 1.4 }}>
              {order.delivery_street}, {order.delivery_number}
              {order.delivery_complement ? ` — ${order.delivery_complement}` : ''}
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              {order.delivery_neighborhood}{order.delivery_city ? `, ${order.delivery_city}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 3, fontWeight: 600 }}>📍 Abrir rota no mapa</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                onClick={openMapAddress}
                style={{ border: '1px solid #60A5FA55', background: '#111827', color: '#60A5FA', borderRadius: 6, fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}
              >
                Google Maps
              </button>
              <button
                onClick={openWazeAddress}
                style={{ border: '1px solid #A78BFA55', background: '#111827', color: '#C4B5FD', borderRadius: 6, fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}
              >
                Waze
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable details */}
      {isBlocked ? (
        <div style={{ padding: '10px 16px', background: '#111827', borderTop: '1px solid #374151', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <span style={{ fontSize: 13, color: '#6B7280' }}>
            Complete o {queuePosition === 2 ? '1°' : `pedido anterior`} primeiro para desbloquear este pedido
          </span>
        </div>
      ) : (
        <>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#111827', border: 'none', borderTop: '1px solid #374151', cursor: 'pointer', color: '#9CA3AF', fontSize: 13 }}
      >
        <span>Ver detalhes do pedido</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div style={{ padding: '14px 16px', background: '#111827', borderTop: '1px solid #1F2937' }}>
          {/* Cliente */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>CLIENTE</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{order.customer_name}</p>
            {order.customer_phone && (
              <a
                href={`https://wa.me/55${order.customer_phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, color: '#4ADE80', fontSize: 13, textDecoration: 'none' }}
              >
                <Phone size={13} /> {fmtPhone(order.customer_phone)} · WhatsApp
              </a>
            )}
          </div>

          {/* Itens */}
          {order.order_items && order.order_items.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>ITENS DO PEDIDO</p>
              {order.order_items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#F59E0B', minWidth: 24 }}>{item.quantity}×</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>{item.product_name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Observações */}
          {order.observations && (
            <div style={{ background: '#3B2B00', border: '1px solid #7C5A00', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: '#FDE68A' }}>⚠️ {order.observations}</p>
            </div>
          )}

          {/* Pagamento */}
          <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <p style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>PAGAMENTO</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: needsPayment ? '#FBBF24' : '#9CA3AF', fontWeight: 600 }}>{pmLabel}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#F59E0B' }}>{fmtBRL(order.total)}</span>
            </div>
            {needsPayment && (
              <p style={{ fontSize: 12, color: '#F97316', marginTop: 5, fontWeight: 700 }}>⚠️ Cobrar do cliente na entrega</p>
            )}
          </div>

          {/* Timeline */}
          <div style={{ fontSize: 11, color: '#6B7280' }}>
            <div>Pedido: {fmtTime(order.created_at)}</div>
            {order.driver_collected_at && <div>Saiu: {fmtTime(order.driver_collected_at)}</div>}
            {order.driver_delivered_at && <div>Entregue: {fmtTime(order.driver_delivered_at)}</div>}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!isDelivered && (
        <div style={{ padding: '12px 16px', background: '#111827', borderTop: '1px solid #374151' }}>
          {showConfirm ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                {showConfirm === 'collected' ? '🏍️ Confirmar que saiu para entrega?' : '✅ Confirmar que entregou?'}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => doAction(showConfirm)}
                  disabled={updating}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: showConfirm === 'delivered' ? '#16A34A' : '#7C3AED', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
                >
                  {updating ? 'Registrando...' : 'Confirmar'}
                </button>
                <button
                  onClick={() => setShowConfirm(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #374151', background: '#1F2937', color: '#9CA3AF', fontSize: 14, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              {!isCollected && (
                <button
                  onClick={() => setShowConfirm('collected')}
                  disabled={updating}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Truck size={16} /> Saiu p/ Entrega
                </button>
              )}
              {(isCollected || order.status === 'delivering') && (
                <button
                  onClick={() => setShowConfirm('delivered')}
                  disabled={updating}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: '#16A34A', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <CheckCircle size={16} /> Entregue!
                </button>
              )}
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}

// ── Main Delivery Page ────────────────────────────────────────────────────────

export default function EntregasPage() {
  const [token, setToken]       = useState(() => {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  });
  const [person, setPerson]     = useState(() => {
    try { const s = sessionStorage.getItem(PERSON_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const locationRef             = useRef(null);

  const isLoggedIn = !!token && !!person;

  function handleLogin(tok, p) {
    setToken(tok);
    setPerson(p);
  }

  function handleLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PERSON_KEY);
    setToken('');
    setPerson(null);
    setOrders([]);
  }

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/orders', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { handleLogout(); return; }
      const d = await res.json();
      if (!d.error) {
        setOrders(d.orders || []);
        setLastRefresh(new Date());
      }
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isLoggedIn) return;
    fetchOrders();
    const iv = setInterval(fetchOrders, 30000);
    return () => clearInterval(iv);
  }, [isLoggedIn, fetchOrders]);

  // Geolocation tracking
  useEffect(() => {
    if (!isLoggedIn || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        locationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isLoggedIn]);

  // Send location heartbeat every 60s while logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    const iv = setInterval(async () => {
      const loc = locationRef.current;
      if (!loc) return;
      const firstActive = orders.find(o => ['ready', 'delivering'].includes(o.status) && !o.driver_delivered_at);
      try {
        await fetch('/api/delivery/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ order_id: firstActive?.id || null, action: 'update_location', lat: loc.lat, lng: loc.lng }),
        });
      } catch {}
    }, 60000);
    return () => clearInterval(iv);
  }, [isLoggedIn, orders, token]);

  function handleStatusUpdate(orderId, action) {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const now = new Date().toISOString();
      if (action === 'collected') return { ...o, status: 'delivering', driver_collected_at: now };
      if (action === 'delivered') return { ...o, status: 'delivered', driver_delivered_at: now };
      return o;
    }));
    // Refresh after a moment
    setTimeout(() => fetchOrders(), 2000);
  }

  if (!isLoggedIn) return <LoginScreen onLogin={handleLogin} />;

  const activeOrders    = orders.filter(o => !o.driver_delivered_at && o.status !== 'delivered');
  const completedOrders = orders.filter(o => !!o.driver_delivered_at || o.status === 'delivered');
  const deliveredCount = completedOrders.length;
  const deliveredFees = completedOrders.reduce((sum, o) => sum + (parseFloat(o.delivery_fee) || 0), 0);

  // Compute blocking: only the first undelivered active order is unlocked
  // (orders are already sorted by delivery_sort_order from the server)
  let foundFirstActive = false;
  const activeWithBlocking = activeOrders.map((order, idx) => {
    const isBlocked = foundFirstActive; // blocked if a previous active exists
    foundFirstActive = true;
    return { order, isBlocked, queuePosition: idx + 1 };
  });

  return (
    <div style={{ minHeight: '100dvh', background: '#111827', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ background: '#1F2937', borderBottom: '1px solid #374151', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Truck size={18} color="#F59E0B" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{person?.name}</p>
            <p style={{ fontSize: 10, color: '#6B7280' }}>Entregador</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastRefresh && (
            <span style={{ fontSize: 10, color: '#4B5563' }}>{lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <button onClick={fetchOrders} disabled={loading} style={{ padding: '7px', borderRadius: 7, border: 'none', background: '#374151', cursor: 'pointer' }}>
            <RefreshCw size={14} color="#9CA3AF" style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
          <button onClick={handleLogout} style={{ padding: '7px', borderRadius: 7, border: 'none', background: '#374151', cursor: 'pointer' }}>
            <LogOut size={14} color="#EF4444" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Entregues (período)</p>
            <p style={{ fontSize: 18, color: '#34D399', fontWeight: 800, marginTop: 4 }}>{deliveredCount}</p>
          </div>
          <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Ganhos em taxa</p>
            <p style={{ fontSize: 18, color: '#F59E0B', fontWeight: 800, marginTop: 4 }}>{fmtBRL(deliveredFees)}</p>
          </div>
        </div>
        {loading && orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#6B7280' }}>
            <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14 }}>Carregando pedidos...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#6B7280' }}>
            <Package size={48} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: '#9CA3AF' }}>Nenhum pedido atribuído</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Aguardando pedidos do restaurante...</p>
          </div>
        ) : (
          <>
            {/* Active orders */}
            {activeWithBlocking.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Truck size={14} color="#F59E0B" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Para Entregar ({activeWithBlocking.length})
                  </span>
                </div>
                {activeWithBlocking.map(({ order, isBlocked, queuePosition }) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    token={token}
                    onStatusUpdate={handleStatusUpdate}
                    isBlocked={isBlocked}
                    queuePosition={queuePosition}
                  />
                ))}
              </>
            )}

            {/* Completed orders */}
            {completedOrders.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: activeOrders.length > 0 ? 20 : 0, marginBottom: 12 }}>
                  <CheckCircle size={14} color="#10B981" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Entregues Hoje ({completedOrders.length})
                  </span>
                </div>
                {completedOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    token={token}
                    onStatusUpdate={handleStatusUpdate}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
