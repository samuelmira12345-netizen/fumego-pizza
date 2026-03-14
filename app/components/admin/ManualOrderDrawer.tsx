'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Phone, Search, User, UserPlus, MapPin, ChefHat,
  Plus, Minus, GlassWater, Trash2, Check, ArrowRight,
  CreditCard, Zap, Banknote, AlertCircle, Package, ShoppingBag,
} from 'lucide-react';

// ── Opções de personalização (mesmo que o site) ───────────────────────────────

const PRODUCT_OPTIONS = {
  calabresa:  [
    { label: 'Sem cebola', extra_price: 0 },
    { label: 'Com cebola', extra_price: 2 },
  ],
  marguerita: [
    { label: 'Sem alho',        extra_price: 0 },
    { label: 'Com alho',        extra_price: 0 },
    { label: 'Alho caprichado', extra_price: 2 },
  ],
};

const COMBO_SLUGS = ['combo-classico'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: any) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPhone(p: any) {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p;
}

const C = {
  bg: '#F1F3F5', card: '#fff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  gold: '#D97706', success: '#059669', danger: '#EF4444',
  blue: '#2563EB',
};

const PM_OPTIONS = [
  { k: 'cash',          label: 'Dinheiro', icon: Banknote,   color: C.success },
  { k: 'card_delivery', label: 'Cartão',   icon: CreditCard, color: '#7C3AED' },
  { k: 'pix',           label: 'PIX',      icon: Zap,        color: C.blue },
];

// ── Sub-component: Option row (radio estilo site) ─────────────────────────────

function OptionRow({ opt, selected, onSelect }: { opt: any, selected: any, onSelect: any }) {
  return (
    <div
      onClick={() => onSelect(opt)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 13px', borderRadius: 6, cursor: 'pointer',
        border: selected ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
        background: selected ? '#FFFBEB' : '#F9FAFB',
        transition: 'border 0.12s, background 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
          border: selected ? `5px solid ${C.gold}` : `2px solid ${C.border}`,
          background: selected ? '#fff' : 'transparent',
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{opt.label}</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: opt.extra_price > 0 ? C.gold : C.light }}>
        {opt.extra_price > 0 ? `+${fmtBRL(opt.extra_price)}` : 'Incluso'}
      </span>
    </div>
  );
}

// ── Sub-component: Product picker modal (inline) ───────────────────────────────

export function ProductPicker({ products, drinks, onAdd, onClose }: { products: any, drinks: any, onAdd: any, onClose: any }) {
  const [step, setStep]       = useState('products'); // 'products' | 'configure'
  const [selected, setSelected] = useState<any>(null);
  const [option, setOption]   = useState<any>(null);
  const [option2, setOption2] = useState<any>(null);
  const [selDrinks, setSelDrinks] = useState<any[]>([]);
  const [obs, setObs]         = useState('');
  const [search, setSearch]   = useState('');

  // Admin pode selecionar qualquer produto não-oculto (independente de estoque)
  const active = products.filter((p: any) => !p.is_hidden);
  const filteredProducts = search.trim()
    ? active.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()))
    : active;

  const isCombo    = selected && COMBO_SLUGS.includes(selected.slug);
  const singleOpts = selected ? (PRODUCT_OPTIONS as any)[selected.slug] : null;
  const needsOption = isCombo || !!singleOpts;

  const extraPrice = (option?.extra_price || 0) + (option2?.extra_price || 0);
  const drinkTotal = selDrinks.reduce((s, d) => s + d.price * d.qty, 0);
  const itemTotal  = selected ? parseFloat(selected.price) + extraPrice : 0;

  function pickProduct(p: any) {
    setSelected(p);
    setOption(null);
    setOption2(null);
    setSelDrinks([]);
    setObs('');
    setStep('configure');
  }

  function toggleDrink(drink: any) {
    setSelDrinks(prev => {
      const has = prev.find(d => d.id === drink.id);
      if (has) return prev.filter(d => d.id !== drink.id);
      return [...prev, { ...drink, qty: 1 }];
    });
  }

  function changeDrinkQty(id: any, delta: any) {
    setSelDrinks(prev => prev
      .map(d => d.id === id ? { ...d, qty: d.qty + delta } : d)
      .filter(d => d.qty > 0)
    );
  }

  function doAdd() {
    if (!selected) return;
    // build item(s)
    const obsLabel = [
      option?.label, option2?.label, obs.trim()
    ].filter(Boolean).join(' | ') || null;

    onAdd({
      product_name: selected.name,
      quantity: 1,
      unit_price: parseFloat(selected.price) + extraPrice,
      total_price: parseFloat(selected.price) + extraPrice,
      observations: obsLabel,
    });

    // Add drinks as separate items
    selDrinks.forEach(d => {
      onAdd({
        product_name: `${d.name}${d.size ? ` (${d.size})` : ''}`,
        quantity: d.qty,
        unit_price: parseFloat(d.price),
        total_price: parseFloat(d.price) * d.qty,
        observations: null,
        is_drink: true,
      });
    });

    // Reset to pick another product
    setStep('products');
    setSelected(null);
    setSearch('');
  }

  const canAdd = !needsOption || (option && (!isCombo || option2));

  if (step === 'configure' && selected) {
    return (
      <div>
        {/* Back */}
        <button onClick={() => setStep('products')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 12, border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 12px', fontWeight: 600 }}>
          ← Voltar para produtos
        </button>

        {/* Product header */}
        <div style={{ background: '#F9FAFB', borderRadius: 6, padding: '12px 14px', border: '1px solid ' + C.border, marginBottom: 14 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 2 }}>{selected.name}</p>
          <p style={{ fontSize: 13, color: C.gold, fontWeight: 700 }}>{fmtBRL(selected.price)}</p>
          {selected.description && <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{selected.description}</p>}
        </div>

        {/* Combo: opção 1 (Calabresa) */}
        {isCombo && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>🍕 Pizza Calabresa</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PRODUCT_OPTIONS.calabresa.map(opt => (
                <OptionRow key={opt.label} opt={opt} selected={option?.label === opt.label} onSelect={setOption} />
              ))}
            </div>
          </div>
        )}

        {/* Combo: opção 2 (Marguerita) */}
        {isCombo && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>🍕 Pizza Marguerita</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PRODUCT_OPTIONS.marguerita.map(opt => (
                <OptionRow key={opt.label} opt={opt} selected={option2?.label === opt.label} onSelect={setOption2} />
              ))}
            </div>
          </div>
        )}

        {/* Sabor único */}
        {!isCombo && singleOpts && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Opções</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {singleOpts.map((opt: any) => (
                <OptionRow key={opt.label} opt={opt} selected={option?.label === opt.label} onSelect={setOption} />
              ))}
            </div>
          </div>
        )}

        {/* Bebidas */}
        {drinks.filter((d: any) => d.is_active).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              <GlassWater size={11} style={{ display: 'inline', marginRight: 5 }} />Bebidas
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {drinks.filter((d: any) => d.is_active).map((drink: any) => {
                const sel = selDrinks.find((d: any) => d.id === drink.id);
                return (
                  <div key={drink.id} onClick={() => toggleDrink(drink)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 13px', borderRadius: 6, cursor: 'pointer',
                    border: sel ? `2px solid #10B981` : `1px solid ${C.border}`,
                    background: sel ? '#ECFDF5' : '#F9FAFB',
                    transition: 'border 0.12s, background 0.12s',
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{drink.name}</p>
                      <p style={{ fontSize: 11, color: C.muted }}>{drink.size} · {fmtBRL(drink.price)}</p>
                    </div>
                    {sel ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => changeDrinkQty(drink.id, -1)} style={{ width: 26, height: 26, borderRadius: 4, border: '1px solid ' + C.border, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Minus size={11} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#10B981', minWidth: 16, textAlign: 'center' }}>{sel.qty}</span>
                        <button onClick={() => changeDrinkQty(drink.id, 1)} style={{ width: 26, height: 26, borderRadius: 4, border: 'none', background: '#10B981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={11} color="#fff" />
                        </button>
                      </div>
                    ) : (
                      <Plus size={14} color={C.light} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Observações */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Observações</p>
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Ex: sem tomate, borda bem assada..."
            rows={2}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid ' + C.border, fontSize: 12, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        {/* Subtotal + botão */}
        <div style={{ borderTop: '1px solid ' + C.border, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <p style={{ fontSize: 11, color: C.muted }}>Subtotal deste item</p>
            <p style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{fmtBRL(itemTotal + drinkTotal)}</p>
          </div>
          <button
            onClick={doAdd}
            disabled={!canAdd}
            style={{
              padding: '10px 20px', borderRadius: 5, border: 'none',
              background: canAdd ? '#111827' : '#E5E7EB',
              color: canAdd ? '#fff' : C.light,
              fontSize: 13, fontWeight: 800, cursor: canAdd ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            <Plus size={14} /> Adicionar ao pedido
          </button>
        </div>
      </div>
    );
  }

  // step === 'products'
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.light, pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar produto..."
          style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 5, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#F9FAFB' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
        {filteredProducts.map((p: any) => (
          <div key={p.id} onClick={() => pickProduct(p)} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 13px', borderRadius: 5, border: '1px solid ' + C.border,
            background: '#F9FAFB', cursor: 'pointer', transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
          onMouseLeave={e => e.currentTarget.style.background = '#F9FAFB'}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.name}</p>
              {p.description && <p style={{ fontSize: 11, color: C.muted }}>{p.description}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{fmtBRL(p.price)}</span>
              <ArrowRight size={13} color={C.light} />
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <p style={{ fontSize: 13, color: C.light, textAlign: 'center', padding: '20px 0' }}>Nenhum produto encontrado</p>
        )}
      </div>
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export default function ManualOrderDrawer({ adminToken, products, drinks, onClose, onSuccess }: { adminToken: any, products: any, drinks: any, onClose: any, onSuccess: any }) {
  const [step, setStep]           = useState('phone'); // 'phone' | 'order'
  const [phone, setPhone]         = useState('');
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer]   = useState<any>(null); // found customer
  const [isNew, setIsNew]         = useState(false); // clicked "novo cadastro"
  const [form, setForm]           = useState({
    name: '', phone: '', street: '', number: '', complement: '',
    neighborhood: '', city: '',
  });
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payStatus, setPayStatus] = useState('pending');
  const [globalObs, setGlobalObs] = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suffixResults, setSuffixResults] = useState<any[]>([]); // when searching by 4 digits

  function handlePhoneChange(v: any) {
    setPhone(v);
    setCustomer(null);
    setIsNew(false);
    setSuffixResults([]);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    const digits = v.replace(/\D/g, '');
    if (digits.length === 4) {
      searchDebounce.current = setTimeout(() => searchBySuffix(digits), 500);
    } else if (digits.length >= 10) {
      searchDebounce.current = setTimeout(() => searchCustomer(digits), 400);
    }
  }

  async function searchBySuffix(suffix: any) {
    setSearching(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'search_phone_suffix', data: { suffix } }),
      });
      const d = await res.json();
      setSuffixResults(d.customers || []);
    } catch {}
    finally { setSearching(false); }
  }

  function selectSuffixCustomer(c: any) {
    setSuffixResults([]);
    setPhone(c.customer_phone || '');
    setForm(prev => ({
      ...prev,
      name: c.customer_name || prev.name,
      phone: c.customer_phone || prev.phone,
      neighborhood: c.delivery_neighborhood || prev.neighborhood,
      city: c.delivery_city || prev.city,
      street: c.delivery_street || prev.street,
      number: c.delivery_number || prev.number,
    }));
    setCustomer({ phone: c.customer_phone, name: c.customer_name });
  }

  async function searchCustomer(digits: any) {
    setSearching(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'get_customer_profile', data: { phone: digits } }),
      });
      const d = await res.json();
      if ((d.orders || []).length > 0) {
        const latest = d.orders[0];
        setCustomer({ phone: digits, orders: d.orders, latest });
        setForm(prev => ({
          ...prev,
          name: latest.customer_name || prev.name,
          phone: digits,
          neighborhood: latest.delivery_neighborhood || prev.neighborhood,
          city: latest.delivery_city || prev.city,
          street: latest.delivery_street || prev.street,
          number: latest.delivery_number || prev.number,
        }));
      } else {
        setCustomer(null);
      }
    } catch {}
    finally { setSearching(false); }
  }

  function proceedToOrder() {
    setForm(prev => ({ ...prev, phone: phone.replace(/\D/g, '') }));
    setStep('order');
  }

  function addItem(item: any) {
    // Adiciona ao carrinho mas mantém o picker aberto para o cliente poder pedir mais itens
    setCartItems(prev => [...prev, { ...item, _id: Date.now() + Math.random() }]);
  }

  function removeItem(id: any) {
    setCartItems(prev => prev.filter(i => i._id !== id));
  }

  const subtotal = cartItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const fee      = parseFloat(deliveryFee) || 0;
  const total    = subtotal + fee;

  async function submit() {
    if (!form.name.trim())   { setError('Nome do cliente é obrigatório'); return; }
    if (cartItems.length === 0) { setError('Adicione pelo menos um produto'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
          action: 'create_manual_order',
          data: {
            customer_name: form.name,
            customer_phone: form.phone || null,
            delivery_street: form.street || null,
            delivery_number: form.number || null,
            delivery_complement: form.complement || null,
            delivery_neighborhood: form.neighborhood || null,
            delivery_city: form.city || null,
            subtotal, discount: 0, delivery_fee: fee, total,
            payment_method: payMethod,
            payment_status: payStatus,
            observations: globalObs || null,
            items: cartItems.map(i => ({
              product_name: i.product_name,
              quantity: i.quantity,
              unit_price: i.unit_price,
              total_price: i.unit_price * i.quantity,
              observations: i.observations || null,
            })),
          },
        }),
      });
      const d = await res.json();
      if (!d.success) { setError(d.error || 'Erro ao criar pedido'); return; }
      onSuccess(d.order);
    } catch { setError('Erro de conexão'); }
    finally { setSaving(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      {/* Backdrop — cobre o viewport inteiro, fica abaixo do drawer */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)' }}
      />

      {/* Drawer — posicionado absolutamente à direita, acima do backdrop */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 520, background: '#fff', display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <ChefHat size={18} color="#D97706" />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Novo Pedido Manual</h2>
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 5, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color={C.muted} />
          </button>
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', borderBottom: '1px solid ' + C.border, flexShrink: 0 }}>
          {[{ k: 'phone', label: '1. Cliente' }, { k: 'order', label: '2. Pedido' }].map(s => (
            <div key={s.k} style={{
              flex: 1, padding: '10px', textAlign: 'center',
              fontSize: 12, fontWeight: 700,
              borderBottom: step === s.k ? '2px solid #111827' : '2px solid transparent',
              color: step === s.k ? '#111827' : C.light,
            }}>{s.label}</div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>

          {/* ── STEP 1: CLIENTE ─────────────────────────────────────────── */}
          {step === 'phone' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Busca por telefone */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6 }}>
                  <Phone size={12} style={{ display: 'inline', marginRight: 5 }} />
                  Buscar cliente por telefone
                </label>
                <p style={{ fontSize: 11, color: C.light, marginBottom: 6 }}>
                  Digite o número completo ou os 4 últimos dígitos
                </p>
                <div style={{ position: 'relative' }}>
                  <input
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    placeholder="(11) 99999-9999 ou últimos 4 dígitos"
                    style={{ width: '100%', padding: '10px 36px 10px 12px', borderRadius: 5, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                  {searching && (
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid #E5E7EB', borderTopColor: C.muted, borderRadius: '50%', animation: 'kdrSpin 0.8s linear infinite', pointerEvents: 'none' }} />
                  )}
                </div>

                {/* Resultados busca por 4 dígitos */}
                {suffixResults.length > 0 && (
                  <div style={{ border: '1px solid ' + C.border, borderRadius: 6, overflow: 'hidden', marginTop: 6 }}>
                    <p style={{ fontSize: 11, color: C.light, padding: '6px 12px', background: '#F9FAFB', borderBottom: '1px solid ' + C.border, fontWeight: 600 }}>
                      Selecione o cliente
                    </p>
                    {suffixResults.map((c, i) => (
                      <div key={i} onClick={() => selectSuffixCustomer(c)} style={{
                        padding: '10px 12px', cursor: 'pointer',
                        borderBottom: i < suffixResults.length - 1 ? '1px solid ' + C.border : 'none',
                        background: '#fff',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <User size={14} color={C.muted} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.customer_name}</p>
                          <p style={{ fontSize: 11, color: C.light }}>{fmtPhone(c.customer_phone)}{c.delivery_neighborhood ? ` · ${c.delivery_neighborhood}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cliente encontrado */}
              {customer && !isNew && (
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 5, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={16} color="#059669" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#065F46', marginBottom: 2 }}>
                        {customer.name || customer.latest?.customer_name}
                      </p>
                      <p style={{ fontSize: 12, color: '#047857' }}>{fmtPhone(customer.phone)}</p>
                      {(customer.latest?.delivery_neighborhood || form.neighborhood) && (
                        <p style={{ fontSize: 12, color: '#047857' }}>
                          <MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />
                          {customer.latest?.delivery_street || form.street}{customer.latest?.delivery_number ? `, ${customer.latest.delivery_number}` : ''}{(customer.latest?.delivery_neighborhood || form.neighborhood) ? ` — ${customer.latest?.delivery_neighborhood || form.neighborhood}` : ''}
                        </p>
                      )}
                      {(customer.orders?.length > 0) && (
                        <p style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>
                          {customer.orders.length} pedido{customer.orders.length !== 1 ? 's' : ''} anteriores · endereço pré-preenchido
                        </p>
                      )}
                      {!customer.orders && (
                        <p style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>Cliente encontrado · endereço pré-preenchido</p>
                      )}
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', flexShrink: 0, marginTop: 4 }} />
                  </div>
                </div>
              )}

              {/* Não encontrado */}
              {!searching && !customer && phone.replace(/\D/g, '').length >= 10 && !isNew && (
                <div style={{ background: '#FEF9EC', border: '1px solid #FDE68A', borderRadius: 6, padding: '12px 14px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>
                    ⚠ Telefone não encontrado no histórico
                  </p>
                  <button onClick={() => setIsNew(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 5,
                    border: 'none', background: '#D97706', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>
                    <UserPlus size={14} /> Novo Cadastro
                  </button>
                </div>
              )}

              {/* Formulário completo (novo cliente ou edição) */}
              {(isNew || customer) && (
                <div style={{ background: '#F9FAFB', borderRadius: 6, padding: 16, border: '1px solid ' + C.border }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                    {isNew ? '📋 Dados do Novo Cliente' : '📋 Confirmar / Editar Dados'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <FF label="Nome *" value={form.name} onChange={(v: any) => setForm((p: any) => ({...p, name: v}))} placeholder="Nome completo" />
                    <FF label="Telefone" value={form.phone} onChange={(v: any) => setForm((p: any) => ({...p, phone: v}))} placeholder="(11) 99999-9999" />
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                      <FF label="Rua / Av." value={form.street} onChange={(v: any) => setForm((p: any) => ({...p, street: v}))} placeholder="Rua..." />
                      <FF label="Nº" value={form.number} onChange={(v: any) => setForm((p: any) => ({...p, number: v}))} placeholder="Nº" />
                    </div>
                    <FF label="Complemento" value={form.complement} onChange={(v: any) => setForm((p: any) => ({...p, complement: v}))} placeholder="Apto, Casa..." />
                    <FF label="Bairro" value={form.neighborhood} onChange={(v: any) => setForm((p: any) => ({...p, neighborhood: v}))} placeholder="Bairro" />
                    <FF label="Cidade" value={form.city} onChange={(v: any) => setForm((p: any) => ({...p, city: v}))} placeholder="Cidade" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: PEDIDO ──────────────────────────────────────────── */}
          {step === 'order' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Resumo cliente */}
              <div style={{ background: '#F9FAFB', borderRadius: 5, padding: '10px 13px', border: '1px solid ' + C.border, display: 'flex', alignItems: 'center', gap: 10 }}>
                <User size={14} color={C.muted} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{form.name}</p>
                  {form.neighborhood && <p style={{ fontSize: 11, color: C.muted }}>{form.street}, {form.number} — {form.neighborhood}</p>}
                </div>
                <button onClick={() => setStep('phone')} style={{ marginLeft: 'auto', fontSize: 11, color: C.blue, border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Editar</button>
              </div>

              {/* Picker de produtos */}
              {showPicker ? (
                <div style={{ background: '#fff', borderRadius: 6, padding: 16, border: '1px solid ' + C.border }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase' }}>Adicionar item</p>
                    <button onClick={() => setShowPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
                      <X size={14} />
                    </button>
                  </div>
                  <ProductPicker products={products} drinks={drinks} onAdd={addItem} onClose={() => setShowPicker(false)} />
                </div>
              ) : (
                <button onClick={() => setShowPicker(true)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '10px', borderRadius: 5, border: '2px dashed #D1D5DB',
                  background: '#F9FAFB', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  transition: 'border-color 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#111827'; e.currentTarget.style.color = '#111827'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = C.muted; }}
                >
                  <Plus size={15} /> Adicionar produto / bebida
                </button>
              )}

              {/* Carrinho */}
              {cartItems.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 6, border: '1px solid ' + C.border, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShoppingBag size={13} color={C.muted} />
                    <p style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase' }}>Itens do Pedido</p>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</span>
                  </div>
                  {cartItems.map(item => (
                    <div key={item._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.quantity}× {item.product_name}</p>
                        {item.observations && <p style={{ fontSize: 11, color: '#B45309' }}>⚠ {item.observations}</p>}
                        <p style={{ fontSize: 12, color: C.muted }}>{fmtBRL(item.unit_price)} un.</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{fmtBRL(item.unit_price * item.quantity)}</span>
                      <button onClick={() => removeItem(item._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.light }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagamento + taxa + obs global */}
              <div style={{ background: '#fff', borderRadius: 6, padding: 16, border: '1px solid ' + C.border }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: C.light, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Pagamento</p>
                <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
                  {PM_OPTIONS.map(pm => {
                    const PMIcon = pm.icon;
                    return (
                      <button key={pm.k} onClick={() => setPayMethod(pm.k)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 5,
                        border: `1px solid ${payMethod === pm.k ? pm.color : C.border}`,
                        background: payMethod === pm.k ? pm.color + '12' : '#F9FAFB',
                        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      }}>
                        <PMIcon size={15} color={payMethod === pm.k ? pm.color : C.light} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: payMethod === pm.k ? pm.color : C.light }}>{pm.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
                  {[{ k: 'pending', l: 'Aguardando' }, { k: 'paid', l: 'Pago' }].map(s => (
                    <button key={s.k} onClick={() => setPayStatus(s.k)} style={{
                      flex: 1, padding: '7px', borderRadius: 5,
                      border: `1px solid ${payStatus === s.k ? '#111827' : C.border}`,
                      background: payStatus === s.k ? '#111827' : '#F9FAFB',
                      color: payStatus === s.k ? '#fff' : C.muted,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>{s.l}</button>
                  ))}
                </div>
                <FF label="Taxa de entrega (R$)" value={deliveryFee} onChange={setDeliveryFee} placeholder="5,00" type="number" />
                <div style={{ marginTop: 9 }}>
                  <FF label="Observações gerais" value={globalObs} onChange={setGlobalObs} placeholder="Algum recado para a entrega..." multiline />
                </div>
              </div>

              {/* Totais */}
              {cartItems.length > 0 && (
                <div style={{ background: '#F9FAFB', borderRadius: 5, padding: '12px 14px', border: '1px solid ' + C.border }}>
                  {fee > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>Taxa entrega</span>
                    <span style={{ fontSize: 12, color: C.text }}>{fmtBRL(fee)}</span>
                  </div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: fee > 0 ? 8 : 0, borderTop: fee > 0 ? '1px solid ' + C.border : 'none' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Total</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{fmtBRL(total)}</span>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '10px 13px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5 }}>
                  <AlertCircle size={13} color="#EF4444" />
                  <span style={{ fontSize: 12, color: '#B91C1C' }}>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid ' + C.border, flexShrink: 0 }}>
          {step === 'phone' ? (
            <button
              onClick={proceedToOrder}
              disabled={!form.name.trim() && !customer && !isNew}
              style={{
                width: '100%', padding: '12px', borderRadius: 5, border: 'none',
                background: (form.name.trim() || customer || isNew) ? '#111827' : '#E5E7EB',
                color: (form.name.trim() || customer || isNew) ? '#fff' : C.light,
                fontSize: 14, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              Continuar para o pedido <ArrowRight size={15} />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('phone')} style={{ padding: '12px 18px', borderRadius: 5, border: '1px solid ' + C.border, background: '#fff', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ← Voltar
              </button>
              <button onClick={submit} disabled={saving || cartItems.length === 0} style={{
                flex: 1, padding: '12px', borderRadius: 5, border: 'none',
                background: saving || cartItems.length === 0 ? '#E5E7EB' : '#111827',
                color: saving || cartItems.length === 0 ? C.light : '#fff',
                fontSize: 14, fontWeight: 800, cursor: saving || cartItems.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <ChefHat size={15} />
                {saving ? 'Criando...' : `Criar Pedido · ${fmtBRL(total)}`}
              </button>
            </div>
          )}
          <p style={{ fontSize: 11, color: C.light, textAlign: 'center', marginTop: 8 }}>
            Pedido criado direto em <strong>Em Preparo</strong> no KDS
          </p>
        </div>
      </div>

      <style>{`
        @keyframes kdrSpin {
          from { transform: translateY(-50%) rotate(0deg); }
          to   { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function FF({ label, value, onChange, placeholder, type, multiline }: { label: any, value: any, onChange: any, placeholder: any, type?: any, multiline?: any }) {
  const s: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #E5E7EB',
    fontSize: 12, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit',
  };
  return (
    <div>
      <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...s, resize: 'vertical', minHeight: 52 }} />
        : <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s} />
      }
    </div>
  );
}
