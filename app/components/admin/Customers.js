'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, User, Phone, MapPin, ShoppingBag, TrendingUp, Clock,
  Star, Award, UserCheck, UserX, ChevronRight, X, Plus, Minus,
  Printer, ArrowLeft, Package, CreditCard, Zap, Banknote,
  ChefHat, AlertCircle, Check,
  Download, Filter, LayoutGrid, List, ChevronUp, ChevronDown,
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

// ── Classificação RFV (Recência + Frequência + Valor) ─────────────────────────

function classifyRFV(c) {
  const days = daysSince(c.last_order);
  const freq = c.orders || 0;
  const val  = c.total_spent || 0;

  if (days <= 14 && freq >= 4 && val >= 120)
    return { label: 'Campeão',   key: 'campeao',   color: '#7C3AED', bg: '#EDE9FE', icon: Award      };
  if (days <= 30 && freq >= 3)
    return { label: 'Leal',      key: 'leal',       color: '#059669', bg: '#ECFDF5', icon: UserCheck  };
  if (freq <= 2 && days <= 60)
    return { label: 'Promissor', key: 'promissor',  color: '#2563EB', bg: '#EFF6FF', icon: User       };
  if (days > 30 && days <= 60)
    return { label: 'Em risco',  key: 'em_risco',   color: '#D97706', bg: '#FFFBEB', icon: AlertCircle};
  if (days > 60)
    return { label: 'Perdido',   key: 'perdido',    color: '#EF4444', bg: '#FEF2F2', icon: UserX      };
  return     { label: 'Leal',      key: 'leal',       color: '#059669', bg: '#ECFDF5', icon: UserCheck  };
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

// ── Badge RFV ──────────────────────────────────────────────────────────────────

function RFVBadge({ customer }) {
  const cl = classifyRFV(customer);
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

// ── Exportações ───────────────────────────────────────────────────────────────

function exportCSV(customers) {
  const BOM = '\uFEFF';
  const headers = ['Nome', 'Telefone', 'Bairro', 'Cidade', 'Pedidos', 'Total gasto (R$)', 'Ticket médio (R$)', 'Primeiro pedido', 'Último pedido', 'Segmento RFV'];
  const rows = customers.map(c => [
    c.name || '', c.phone || '', c.neighborhood || '', c.city || '',
    c.orders,
    (c.total_spent || 0).toFixed(2).replace('.', ','),
    (c.avg_ticket  || 0).toFixed(2).replace('.', ','),
    c.first_order ? new Date(c.first_order).toLocaleDateString('pt-BR') : '',
    c.last_order  ? new Date(c.last_order).toLocaleDateString('pt-BR')  : '',
    classifyRFV(c).label,
  ]);
  const csv = BOM + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientes_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportXLS(customers) {
  const headers = ['Nome', 'Telefone', 'Bairro', 'Cidade', 'Pedidos', 'Total gasto', 'Ticket médio', 'Primeiro pedido', 'Último pedido', 'Segmento RFV'];
  const rows = customers.map(c => [
    c.name || '', c.phone || '', c.neighborhood || '', c.city || '',
    c.orders,
    (c.total_spent || 0).toFixed(2),
    (c.avg_ticket  || 0).toFixed(2),
    c.first_order ? new Date(c.first_order).toLocaleDateString('pt-BR') : '',
    c.last_order  ? new Date(c.last_order).toLocaleDateString('pt-BR')  : '',
    classifyRFV(c).label,
  ]);
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientes_${new Date().toISOString().slice(0,10)}.xls`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: C.card, borderRadius: 6, padding: 18, border: '1px solid ' + C.border }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Cliente</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FormField label="Nome *" value={customer.name} onChange={v => setCustomer(p => ({...p, name: v}))} placeholder="Nome completo" />
              <FormField label="Telefone" value={customer.phone} onChange={v => setCustomer(p => ({...p, phone: v}))} placeholder="(11) 99999-9999" />
            </div>
          </div>

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: C.card, borderRadius: 6, padding: 18, border: '1px solid ' + C.border }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Produtos</h3>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.light, pointerEvents: 'none' }} />
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
        <p style={{ fontSize: 11, color: C.light, textAlign: 'center' }}>O pedido será criado direto em <strong>Em Preparo</strong> no PDV</p>
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

  const cl = classifyRFV(customer);
  const ClIcon = cl.icon;

  return (
    <div style={{ padding: '20px 28px 60px', maxWidth: 800, margin: '0 auto' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 4, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 600, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Todos os clientes
      </button>

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
                <RFVBadge customer={customer} />
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 18 }}>
          <StatCard label="Total de pedidos"  value={customer.orders}              color="#2563EB" />
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
              {orders.map((o) => {
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

// ── Tabela de Clientes ────────────────────────────────────────────────────────

function CustomersTable({ customers, onSelect, sortKey, sortDir, onSort }) {
  const cols = [
    { key: 'name',        label: 'Nome' },
    { key: 'phone',       label: 'Telefone' },
    { key: 'neighborhood',label: 'Bairro' },
    { key: 'orders',      label: 'Pedidos',      align: 'right' },
    { key: 'total_spent', label: 'Total gasto',   align: 'right' },
    { key: 'avg_ticket',  label: 'Ticket médio',  align: 'right' },
    { key: 'last_order',  label: 'Último pedido' },
    { key: 'rfv',         label: 'Segmento',      noSort: true },
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 1 }}>
            {cols.map(col => (
              <th key={col.key}
                onClick={() => !col.noSort && onSort(col.key)}
                style={{
                  padding: '10px 14px', textAlign: col.align || 'left',
                  fontSize: 11, fontWeight: 700, color: '#6B7280',
                  letterSpacing: 0.5, textTransform: 'uppercase',
                  cursor: col.noSort ? 'default' : 'pointer',
                  userSelect: 'none', whiteSpace: 'nowrap', background: '#F9FAFB',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.label}
                  {!col.noSort && (
                    sortKey === col.key
                      ? (sortDir === 'asc' ? <ChevronUp size={11} color="#374151" /> : <ChevronDown size={11} color="#374151" />)
                      : <ChevronDown size={11} color="#D1D5DB" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => {
            const cl = classifyRFV(c);
            const ClIcon = cl.icon;
            return (
              <tr key={c.phone || c.name}
                onClick={() => onSelect(c)}
                style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: '#fff' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F0F9FF'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
              >
                <td style={{ padding: '10px 14px', fontWeight: 600, color: C.text }}>{c.name || '—'}</td>
                <td style={{ padding: '10px 14px', color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>{fmtPhone(c.phone)}</td>
                <td style={{ padding: '10px 14px', color: C.muted }}>{c.neighborhood || '—'}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#2563EB', textAlign: 'right' }}>{c.orders}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#059669', textAlign: 'right' }}>{fmtBRL(c.total_spent)}</td>
                <td style={{ padding: '10px 14px', color: C.muted, textAlign: 'right' }}>{fmtBRL(c.avg_ticket)}</td>
                <td style={{ padding: '10px 14px', color: C.muted, whiteSpace: 'nowrap' }}>{fmtDate(c.last_order)}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                    background: cl.bg, color: cl.color,
                  }}>
                    <ClIcon size={11} />
                    {cl.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── MiniStat ──────────────────────────────────────────────────────────────────

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '5px 12px', background: color + '10', borderRadius: 4, border: `1px solid ${color}20` }}>
      <p style={{ fontSize: 14, fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: 10, color: C.light }}>{label}</p>
    </div>
  );
}

// ── Customers Main ────────────────────────────────────────────────────────────

export default function Customers({ adminToken, products, drinks, onRefresh }) {
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterRfv, setFilterRfv]   = useState('all');
  const [selected, setSelected]     = useState(null);
  const [view, setView]             = useState('list');
  const [createPrefill, setCreatePrefill] = useState(null);

  // View mode: 'cards' | 'table'
  const [viewMode, setViewMode]     = useState('cards');

  // Sort (table)
  const [sortKey, setSortKey]       = useState('orders');
  const [sortDir, setSortDir]       = useState('desc');

  // Advanced filters
  const [showAdvanced, setShowAdvanced]   = useState(false);
  const [filterPhoneEnd, setFilterPhoneEnd]   = useState('');
  const [filterMinOrders, setFilterMinOrders] = useState('');
  const [filterMaxOrders, setFilterMaxOrders] = useState('');
  const [filterMinTicket, setFilterMinTicket] = useState('');
  const [filterMaxTicket, setFilterMaxTicket] = useState('');
  const [filterLastDays, setFilterLastDays]   = useState('');

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

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const filtered = useMemo(() => {
    let list = customers;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.neighborhood || '').toLowerCase().includes(q)
      );
    }

    if (filterRfv !== 'all') {
      list = list.filter(c => classifyRFV(c).key === filterRfv);
    }

    if (filterPhoneEnd.trim()) {
      const end = filterPhoneEnd.replace(/\D/g, '');
      if (end) list = list.filter(c => (c.phone || '').replace(/\D/g, '').endsWith(end));
    }
    if (filterMinOrders !== '') list = list.filter(c => (c.orders || 0) >= parseInt(filterMinOrders));
    if (filterMaxOrders !== '') list = list.filter(c => (c.orders || 0) <= parseInt(filterMaxOrders));
    if (filterMinTicket !== '') list = list.filter(c => (c.avg_ticket || 0) >= parseFloat(filterMinTicket));
    if (filterMaxTicket !== '') list = list.filter(c => (c.avg_ticket || 0) <= parseFloat(filterMaxTicket));
    if (filterLastDays  !== '') list = list.filter(c => daysSince(c.last_order) <= parseInt(filterLastDays));

    return list;
  }, [customers, search, filterRfv, filterPhoneEnd, filterMinOrders, filterMaxOrders, filterMinTicket, filterMaxTicket, filterLastDays]);

  const sorted = useMemo(() => {
    if (viewMode !== 'table') return filtered;
    return [...filtered].sort((a, b) => {
      let aVal = sortKey === 'rfv' ? classifyRFV(a).label : (a[sortKey] ?? '');
      let bVal = sortKey === 'rfv' ? classifyRFV(b).label : (b[sortKey] ?? '');
      if (typeof aVal === 'number' && typeof bVal === 'number')
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal), 'pt-BR')
        : String(bVal).localeCompare(String(aVal), 'pt-BR');
    });
  }, [filtered, viewMode, sortKey, sortDir]);

  const stats = useMemo(() => {
    const seg = label => customers.filter(c => classifyRFV(c).label === label).length;
    return {
      total:      customers.length,
      campeoes:   seg('Campeão'),
      leais:      seg('Leal'),
      promissores:seg('Promissor'),
      emRisco:    seg('Em risco'),
      perdidos:   seg('Perdido'),
    };
  }, [customers]);

  const hasAdvancedFilter = filterPhoneEnd || filterMinOrders || filterMaxOrders || filterMinTicket || filterMaxTicket || filterLastDays;

  function clearAdvanced() {
    setFilterPhoneEnd(''); setFilterMinOrders(''); setFilterMaxOrders('');
    setFilterMinTicket(''); setFilterMaxTicket(''); setFilterLastDays('');
  }

  // ── Views ──────────────────────────────────────────────────────────────────

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
          onSuccess={() => { onRefresh(); setView('list'); }}
          onCancel={() => setView(createPrefill ? 'profile' : 'list')}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid ' + C.border, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={17} color="#2563EB" />
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Clientes</span>
        </div>

        {/* RFV Stats */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 6, flexWrap: 'wrap' }}>
          <MiniStat label="Total"      value={stats.total}       color="#2563EB" />
          <MiniStat label="Campeões"   value={stats.campeoes}    color="#7C3AED" />
          <MiniStat label="Leais"      value={stats.leais}       color="#059669" />
          <MiniStat label="Em risco"   value={stats.emRisco}     color="#D97706" />
          <MiniStat label="Perdidos"   value={stats.perdidos}    color="#EF4444" />
        </div>

        <div style={{ flex: 1 }} />

        {/* Exportar */}
        <button onClick={() => exportCSV(filtered)} title="Exportar CSV" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 5, border: '1px solid #E5E7EB',
          background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <Download size={13} /> CSV
        </button>
        <button onClick={() => exportXLS(filtered)} title="Exportar Excel" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 5, border: '1px solid #E5E7EB',
          background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <Download size={13} /> Excel
        </button>

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: 5, overflow: 'hidden' }}>
          <button onClick={() => setViewMode('cards')} title="Cartões" style={{
            padding: '6px 10px', border: 'none', cursor: 'pointer',
            background: viewMode === 'cards' ? '#111827' : '#fff',
            color: viewMode === 'cards' ? '#fff' : '#6B7280',
            display: 'flex', alignItems: 'center',
          }}><LayoutGrid size={14} /></button>
          <button onClick={() => setViewMode('table')} title="Tabela" style={{
            padding: '6px 10px', border: 'none', cursor: 'pointer',
            background: viewMode === 'table' ? '#111827' : '#fff',
            color: viewMode === 'table' ? '#fff' : '#6B7280',
            display: 'flex', alignItems: 'center',
          }}><List size={14} /></button>
        </div>
      </div>

      {/* Filtros básicos */}
      <div style={{ background: '#fff', borderBottom: '1px solid ' + C.border, padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 240 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.light, pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nome, telefone ou bairro..."
            style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[
            { k: 'all',       l: 'Todos' },
            { k: 'campeao',   l: 'Campeões' },
            { k: 'leal',      l: 'Leais' },
            { k: 'promissor', l: 'Promissores' },
            { k: 'em_risco',  l: 'Em risco' },
            { k: 'perdido',   l: 'Perdidos' },
          ].map(f => (
            <button key={f.k} onClick={() => setFilterRfv(f.k)} style={{
              padding: '5px 12px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filterRfv === f.k ? '#111827' : '#F3F4F6',
              color: filterRfv === f.k ? '#fff' : C.muted,
            }}>{f.l}</button>
          ))}
        </div>

        <button onClick={() => setShowAdvanced(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 4,
          border: `1px solid ${hasAdvancedFilter ? '#2563EB' : C.border}`,
          background: hasAdvancedFilter ? '#EFF6FF' : '#fff',
          color: hasAdvancedFilter ? '#2563EB' : C.muted,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <Filter size={12} /> Filtros{hasAdvancedFilter ? ' ●' : ''}
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.light }}>
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filtros avançados */}
      {showAdvanced && (
        <div style={{ background: '#F8FAFC', borderBottom: '1px solid ' + C.border, padding: '12px 24px', display: 'flex', alignItems: 'flex-end', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          {[
            { label: 'Final do telefone', value: filterPhoneEnd, set: setFilterPhoneEnd, placeholder: 'ex: 9999', width: 90, maxLength: 5 },
            { label: 'Pedidos mín.', value: filterMinOrders, set: setFilterMinOrders, placeholder: '0', width: 70, type: 'number' },
            { label: 'Pedidos máx.', value: filterMaxOrders, set: setFilterMaxOrders, placeholder: '∞', width: 70, type: 'number' },
            { label: 'Ticket mín. (R$)', value: filterMinTicket, set: setFilterMinTicket, placeholder: '0', width: 80, type: 'number' },
            { label: 'Ticket máx. (R$)', value: filterMaxTicket, set: setFilterMaxTicket, placeholder: '∞', width: 80, type: 'number' },
            { label: 'Últ. compra ≤ X dias', value: filterLastDays, set: setFilterLastDays, placeholder: '∞', width: 80, type: 'number' },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.light, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</label>
              <input
                type={f.type || 'text'}
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                maxLength={f.maxLength}
                style={{ width: f.width, padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none' }}
              />
            </div>
          ))}
          {hasAdvancedFilter && (
            <button onClick={clearAdvanced} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 4, border: 'none',
              background: '#FEE2E2', color: '#B91C1C', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              <X size={12} /> Limpar
            </button>
          )}
        </div>
      )}

      {/* Conteúdo: cards ou tabela */}
      <div style={{ flex: 1, overflowY: 'auto', padding: viewMode === 'table' ? 0 : '14px 24px' }}>
        {loading ? (
          <p style={{ fontSize: 14, color: C.light, textAlign: 'center', padding: '60px 0' }}>Carregando clientes...</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 14, color: C.light, textAlign: 'center', padding: '60px 0' }}>Nenhum cliente encontrado</p>
        ) : viewMode === 'table' ? (
          <CustomersTable
            customers={sorted}
            onSelect={c => { setSelected(c); setView('profile'); }}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
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
  const cl = classifyRFV(customer);
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
          <RFVBadge customer={customer} />
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
