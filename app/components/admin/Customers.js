'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, User, Phone, MapPin, ShoppingBag, TrendingUp, Clock,
  Star, Award, UserCheck, UserX, ChevronRight, X, Plus, Minus,
  Printer, ArrowLeft, Package, CreditCard, Zap, Banknote,
  ChefHat, AlertCircle, Check,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPhone(p) {
  if (!p) return '—';
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p;
}

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysSince(isoStr) {
  if (!isoStr) return 9999;
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 86400000);
}

function classify(c) {
  const days = daysSince(c.last_order);
  if (days > 45) return { label: 'Inativo', color: '#6B7280', bg: '#F3F4F6', icon: UserX };
  if (c.orders === 1) return { label: 'Novo', color: '#2563EB', bg: '#EFF6FF', icon: User };
  if (c.orders >= 6 || c.total_spent >= 300)
    return { label: 'VIP', color: '#D97706', bg: '#FFFBEB', icon: Award };
  return { label: 'Recorrente', color: '#059669', bg: '#ECFDF5', icon: UserCheck };
}

const PM_LABELS = {
  pix:          { label: 'PIX',      icon: Zap,        color: '#2563EB' },
  cash:         { label: 'Dinheiro', icon: Banknote,   color: '#059669' },
  card_delivery:{ label: 'Cartão',   icon: CreditCard, color: '#7C3AED' },
};

const C = {
  bg: '#F1F3F5', card: '#fff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  gold: '#D97706', success: '#059669', danger: '#EF4444',
};

// ── Classificação visual ───────────────────────────────────────────────────────

function ClassBadge({ customer }) {
  const cl = classify(customer);
  const Icon = cl.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
      background: cl.bg, color: cl.color, border: `1px solid ${cl.color}30`,
    }}>
      <Icon size={11} />
      {cl.label}
    </span>
  );
}

// ── Formulário de Pedido Manual ───────────────────────────────────────────────

function CreateOrderForm({ prefillCustomer, products, drinks, adminToken, onSuccess, onCancel }) {
  const [customer, setCustomer] = useState({
    name: prefillCustomer?.name || '',
    phone: prefillCustomer?.phone || '',
    street: '', number: '', complement: '',
    neighborhood: prefillCustomer?.neighborhood || '',
    city: prefillCustomer?.city || '',
  });
  const [cartItems, setCartItems] = useState([]);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const allItems = [
    ...products.map(p => ({ id: p.id, name: p.name, price: parseFloat(p.price) || 0, type: 'product' })),
    ...drinks.map(d => ({ id: d.id, name: d.name + (d.size ? ` (${d.size})` : ''), price: parseFloat(d.price) || 0, type: 'drink' })),
  ].filter(i => i.price > 0);

  const filtered = productSearch
    ? allItems.filter(i => i.name.toLowerCase().includes(productSearch.toLowerCase()))
    : allItems;

  function addItem(item) {
    setCartItems(prev => {
      const existing = prev.find(c => c.id === item.id && c.type === item.type);
      if (existing) return prev.map(c => c.id === item.id && c.type === item.type ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1, obs: '' }];
    });
  }

  function changeQty(idx, delta) {
    setCartItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], qty: updated[idx].qty + delta };
      return updated.filter(c => c.qty > 0);
    });
  }

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const fee = parseFloat(deliveryFee) || 0;
  const total = subtotal + fee;

  async function submit() {
    if (!customer.name.trim()) { setError('Nome do cliente é obrigatório'); return; }
    if (cartItems.length === 0) { setError('Adicione pelo menos um item'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
          action: 'create_manual_order',
          data: {
            customer_name: customer.name,
            customer_phone: customer.phone || null,
            delivery_street: customer.street || null,
            delivery_number: customer.number || null,
            delivery_complement: customer.complement || null,
            delivery_neighborhood: customer.neighborhood || null,
            delivery_city: customer.city || null,
            subtotal, discount: 0, delivery_fee: fee, total,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            observations: obs || null,
            items: cartItems.map(i => ({
              product_name: i.name,
              quantity: i.qty,
              unit_price: i.price,
              total_price: i.price * i.qty,
              observations: i.obs || null,
            })),
          },
        }),
      });
      const d = await res.json();
      if (!d.success) { setError(d.error || 'Erro ao criar pedido'); return; }
      onSuccess(d.order);
    } catch (e) {
      setError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '20px 28px 60px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 4, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Novo Pedido Manual</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Coluna esquerda: cliente + pagamento */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Cliente */}
          <div style={{ background: C.card, borderRadius: 6, padding: 18, border: '1px solid ' + C.border }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Cliente</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FormField label="Nome *" value={customer.name} onChange={v => setCustomer(p => ({...p, name: v}))} placeholder="Nome completo" />
              <FormField label="Telefone" value={customer.phone} onChange={v => setCustomer(p => ({...p, phone: v}))} placeholder="(11) 99999-9999" />
            </div>
          </div>

          {/* Endereço */}
          <div style={{ background: C.card, borderRadius: 6, padding: 18, border: '1px solid ' + C.border }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Endereço de Entrega</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <FormField label="Rua" value={customer.street} onChange={v => setCustomer(p => ({...p, street: v}))} placeholder="Rua/Av" />
                <FormField label="Número" value={customer.number} onChange={v => setCustomer(p => ({...p, number: v}))} placeholder="Nº" />
              </div>
              <FormField label="Complemento" value={customer.complement} onChange={v => setCustomer(p => ({...p, complement: v}))} placeholder="Apto, casa..." />
              <FormField label="Bairro" value={customer.neighborhood} onChange={v => setCustomer(p => ({...p, neighborhood: v}))} placeholder="Bairro" />
              <FormField label="Cidade" value={customer.city} onChange={v => setCustomer(p => ({...p, city: v}))} placeholder="Cidade" />
            </div>
          </div>

          {/* Pagamento */}
          <div style={{ background: C.card, borderRadius: 6, padding: 18, border: '1px solid ' + C.border }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Pagamento</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5 }}>Forma</label>
                <div style={{ display: 'flex', gap: 7 }}>
                  {Object.entries(PM_LABELS).map(([k, pm]) => {
                    const PMIcon = pm.icon;
                    return (
                      <button key={k} onClick={() => setPaymentMethod(k)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 4, border: `1px solid ${paymentMethod === k ? pm.color : C.border}`,
                        background: paymentMethod === k ? pm.color + '12' : C.card, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      }}>
                        <PMIcon size={15} color={paymentMethod === k ? pm.color : C.light} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: paymentMethod === k ? pm.color : C.light }}>{pm.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5 }}>Status</label>
                <div style={{ display: 'flex', gap: 7 }}>
                  {[{ k: 'pending', l: 'Aguardando' }, { k: 'paid', l: 'Pago' }].map(({ k, l }) => (
                    <button key={k} onClick={() => setPaymentStatus(k)} style={{
                      flex: 1, padding: '7px', borderRadius: 4, border: `1px solid ${paymentStatus === k ? '#111827' : C.border}`,
                      background: paymentStatus === k ? '#111827' : C.card, cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, color: paymentStatus === k ? '#fff' : C.muted,
                    }}>{l}</button>
                  ))}
                </div>
              </div>
              <FormField label="Taxa de entrega (R$)" value={deliveryFee} onChange={setDeliveryFee} placeholder="0,00" type="number" />
              <FormField label="Observações" value={obs} onChange={setObs} placeholder="Sem cebola, campainha..." multiline />
            </div>
          </div>
        </div>

        {/* Coluna direita: produtos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Buscar produtos */}
          <div style={{ background: C.card, borderRadius: 6, padding: 18, border: '1px solid ' + C.border }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Produtos</h3>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.light }} />
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Buscar produto..."
                style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#F9FAFB' }}
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(item => {
                const inCart = cartItems.find(c => c.id === item.id && c.type === item.type);
                return (
                  <div key={item.type + item.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 10px', borderRadius: 4, border: '1px solid ' + (inCart ? '#BFDBFE' : C.border),
                    background: inCart ? '#EFF6FF' : '#F9FAFB', cursor: 'pointer',
                    transition: 'background 0.1s',
                  }} onClick={() => addItem(item)}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{item.name}</p>
                      <p style={{ fontSize: 11, color: C.muted }}>{fmtBRL(item.price)}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {inCart && <span style={{ fontSize: 11, fontWeight: 800, color: '#2563EB' }}>{inCart.qty}×</span>}
                      <Plus size={14} color={inCart ? '#2563EB' : C.light} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Carrinho */}
          <div style={{ background: C.card, borderRadius: 6, padding: 18, border: '1px solid ' + C.border, flex: 1 }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Pedido</h3>
            {cartItems.length === 0 ? (
              <p style={{ fontSize: 13, color: C.light, textAlign: 'center', padding: '20px 0' }}>Nenhum item adicionado</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cartItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: '#F9FAFB', borderRadius: 4, border: '1px solid ' + C.border }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{item.name}</p>
                      <p style={{ fontSize: 11, color: C.muted }}>{fmtBRL(item.price)} × {item.qty} = <strong>{fmtBRL(item.price * item.qty)}</strong></p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => changeQty(idx, -1)} style={{ width: 24, height: 24, borderRadius: 3, border: '1px solid ' + C.border, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Minus size={11} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => changeQty(idx, 1)} style={{ width: 24, height: 24, borderRadius: 3, border: '1px solid ' + C.border, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Totais */}
                <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px dashed ' + C.border }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>Subtotal</span>
                    <span style={{ fontSize: 12, color: C.text }}>{fmtBRL(subtotal)}</span>
                  </div>
                  {fee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: C.muted }}>Taxa entrega</span>
                      <span style={{ fontSize: 12, color: C.text }}>{fmtBRL(fee)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid ' + C.border }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Total</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{fmtBRL(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px', background: '#FEF2F2', borderRadius: 4, border: '1px solid #FECACA' }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: '#B91C1C' }}>{error}</span>
          </div>
        )}
        <button onClick={submit} disabled={saving} style={{
          padding: '14px', borderRadius: 5, border: 'none',
          background: saving ? '#9CA3AF' : '#111827', color: '#fff',
          fontSize: 15, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <ChefHat size={16} />
          {saving ? 'Criando pedido...' : `Criar Pedido · ${fmtBRL(total)}`}
        </button>
        <p style={{ fontSize: 11, color: C.light, textAlign: 'center' }}>O pedido será criado direto em <strong>Em Preparo</strong> no KDS</p>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type, multiline }) {
  const style = {
    width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #E5E7EB',
    fontSize: 12, outline: 'none', background: '#F9FAFB', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };
  return (
    <div>
      <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...style, resize: 'vertical', minHeight: 60 }} />
        : <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={style} />
      }
    </div>
  );
}

// ── Perfil do Cliente ─────────────────────────────────────────────────────────

function CustomerProfile({ customer, adminToken, products, drinks, onBack, onCreateOrder }) {
  const [orders, setOrders]     = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [peakHour, setPeakHour] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!customer?.phone) { setLoading(false); return; }
    setLoading(true);
    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'get_customer_profile', data: { phone: customer.phone } }),
    })
      .then(r => r.json())
      .then(d => {
        setOrders(d.orders || []);
        setTopItems(d.topItems || []);
        setPeakHour(d.peakHour || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customer?.phone, adminToken]);

  const cl = classify(customer);
  const ClIcon = cl.icon;

  return (
    <div style={{ padding: '20px 28px 60px', maxWidth: 800, margin: '0 auto' }}>
      {/* Back */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 4, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 600, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Todos os clientes
      </button>

      {/* Header do perfil */}
      <div style={{ background: C.card, borderRadius: 6, padding: 22, border: '1px solid ' + C.border, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 6, background: cl.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${cl.color}30` }}>
              <ClIcon size={24} color={cl.color} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>{customer.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                    <Phone size={12} /> {fmtPhone(customer.phone)}
                  </a>
                )}
                <ClassBadge customer={customer} />
              </div>
            </div>
          </div>
          <button onClick={() => onCreateOrder(customer)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 4,
            border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            <Plus size={14} /> Novo Pedido
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 18 }}>
          <StatCard label="Total de pedidos"  value={customer.orders}           color="#2563EB" />
          <StatCard label="Valor gasto"       value={fmtBRL(customer.total_spent)} color="#059669" />
          <StatCard label="Ticket médio"      value={fmtBRL(customer.avg_ticket)}  color="#D97706" />
          <StatCard label="Última compra"     value={fmtDate(customer.last_order)} color="#6B7280" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <StatCard label="Primeiro pedido"   value={fmtDate(customer.first_order)} color="#6B7280" />
          {customer.neighborhood && <StatCard label="Bairro" value={customer.neighborhood} color="#6B7280" />}
          {peakHour && <StatCard label="Horário favorito" value={`${peakHour}h`} color="#7C3AED" />}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top itens */}
        {topItems.length > 0 && (
          <div style={{ background: C.card, borderRadius: 6, padding: 18, border: '1px solid ' + C.border }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
              Itens mais comprados
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? C.gold : C.light, width: 18 }}>#{i+1}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text }}>{item.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, background: '#F3F4F6', padding: '2px 8px', borderRadius: 3 }}>{item.qty}×</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico de pedidos */}
        <div style={{ background: C.card, borderRadius: 6, padding: 18, border: '1px solid ' + C.border, gridColumn: topItems.length === 0 ? '1 / -1' : 'auto' }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
            Histórico de pedidos
          </h3>
          {loading ? (
            <p style={{ fontSize: 13, color: C.light }}>Carregando...</p>
          ) : orders.length === 0 ? (
            <p style={{ fontSize: 13, color: C.light }}>Nenhum pedido encontrado</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {orders.map((o, i) => {
                const pm = PM_LABELS[o.payment_method];
                const PMIcon = pm?.icon || CreditCard;
                return (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 4, background: '#F9FAFB', border: '1px solid ' + C.border }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                        Pedido #{o.order_number || String(o.id).slice(-4).toUpperCase()}
                      </p>
                      <p style={{ fontSize: 11, color: C.muted }}>{fmtDate(o.created_at)} · {o.delivery_neighborhood || '—'}</p>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{fmtBRL(o.total)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <PMIcon size={11} color={pm?.color || C.light} />
                        <span style={{ fontSize: 11, color: C.muted }}>{pm?.label || o.payment_method}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#F9FAFB', borderRadius: 5, padding: '10px 13px', border: '1px solid #E5E7EB' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

// ── Customers Main ────────────────────────────────────────────────────────────

export default function Customers({ adminToken, products, drinks, onRefresh }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [selected, setSelected]   = useState(null);  // customer object
  const [view, setView]           = useState('list'); // 'list' | 'profile' | 'create'
  const [createPrefill, setCreatePrefill] = useState(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'get_customers' }),
      });
      const d = await res.json();
      setCustomers(d.customers || []);
    } catch {}
    finally { setLoading(false); }
  }, [adminToken]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filtered = useMemo(() => {
    let list = customers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.neighborhood || '').toLowerCase().includes(q));
    }
    if (filterClass !== 'all') {
      list = list.filter(c => classify(c).label.toLowerCase() === filterClass);
    }
    return list;
  }, [customers, search, filterClass]);

  const stats = useMemo(() => {
    const total = customers.length;
    const vip = customers.filter(c => classify(c).label === 'VIP').length;
    const recorrentes = customers.filter(c => classify(c).label === 'Recorrente').length;
    const inativos = customers.filter(c => classify(c).label === 'Inativo').length;
    return { total, vip, recorrentes, inativos };
  }, [customers]);

  if (view === 'profile' && selected) {
    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <CustomerProfile
          customer={selected}
          adminToken={adminToken}
          products={products}
          drinks={drinks}
          onBack={() => setView('list')}
          onCreateOrder={(c) => { setCreatePrefill(c); setView('create'); }}
        />
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <CreateOrderForm
          prefillCustomer={createPrefill}
          products={products}
          drinks={drinks}
          adminToken={adminToken}
          onSuccess={(order) => { onRefresh(); setView('list'); }}
          onCancel={() => setView(createPrefill ? 'profile' : 'list')}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid ' + C.border, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={17} color="#2563EB" />
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Clientes</span>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 6 }}>
          <MiniStat label="Total" value={stats.total} color="#2563EB" />
          <MiniStat label="VIP" value={stats.vip} color="#D97706" />
          <MiniStat label="Recorrentes" value={stats.recorrentes} color="#059669" />
          <MiniStat label="Inativos" value={stats.inativos} color="#6B7280" />
        </div>

        <div style={{ flex: 1 }} />

        {/* Botão novo pedido rápido */}
        <button onClick={() => { setCreatePrefill(null); setView('create'); }} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 4,
          border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          <Plus size={14} /> Novo Pedido
        </button>
      </div>

      {/* Filtros */}
      <div style={{ background: '#fff', borderBottom: '1px solid ' + C.border, padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.light }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou bairro..."
            style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[{ k: 'all', l: 'Todos' }, { k: 'vip', l: 'VIP' }, { k: 'recorrente', l: 'Recorrentes' }, { k: 'novo', l: 'Novos' }, { k: 'inativo', l: 'Inativos' }].map(f => (
            <button key={f.k} onClick={() => setFilterClass(f.k)} style={{
              padding: '5px 12px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filterClass === f.k ? '#111827' : '#F3F4F6',
              color: filterClass === f.k ? '#fff' : C.muted,
            }}>{f.l}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.light }}>{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px' }}>
        {loading ? (
          <p style={{ fontSize: 14, color: C.light, textAlign: 'center', padding: '60px 0' }}>Carregando clientes...</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 14, color: C.light, textAlign: 'center', padding: '60px 0' }}>Nenhum cliente encontrado</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
            {filtered.map(c => (
              <CustomerCard key={c.phone || c.name} customer={c} onClick={() => { setSelected(c); setView('profile'); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerCard({ customer, onClick }) {
  const cl = classify(customer);
  const ClIcon = cl.icon;
  return (
    <div
      onClick={onClick}
      style={{
        background: C.card, borderRadius: 5, padding: '14px 16px',
        border: '1px solid ' + C.border, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 13,
        transition: 'box-shadow 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 4, background: cl.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${cl.color}25` }}>
        <ClIcon size={18} color={cl.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.name}</p>
          <ClassBadge customer={customer} />
        </div>
        <p style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>
          {fmtPhone(customer.phone)}
          {customer.neighborhood ? ` · ${customer.neighborhood}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ fontSize: 11, color: C.light }}>{customer.orders} pedido{customer.orders !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.success }}>{fmtBRL(customer.total_spent)}</span>
          <span style={{ fontSize: 11, color: C.muted }}>TM {fmtBRL(customer.avg_ticket)}</span>
        </div>
      </div>
      <ChevronRight size={14} color={C.light} />
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '5px 12px', background: color + '10', borderRadius: 4, border: `1px solid ${color}20` }}>
      <p style={{ fontSize: 14, fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: 10, color: C.light }}>{label}</p>
    </div>
  );
}
