'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [pixData, setPixData] = useState(null);
  const [orderCreated, setOrderCreated] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', cpf: '',
    street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipcode: '',
  });

  useEffect(() => {
    // Carregar carrinho
    const c = localStorage.getItem('fumego_cart');
    if (!c || JSON.parse(c).length === 0) {
      router.push('/');
      return;
    }
    setCart(JSON.parse(c));

    // Carregar dados do usuário
    const userData = localStorage.getItem('fumego_user');
    if (userData) {
      const u = JSON.parse(userData);
      setUser(u);
      setForm(prev => ({
        ...prev,
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        cpf: u.cpf || '',
        street: u.address_street || '',
        number: u.address_number || '',
        complement: u.address_complement || '',
        neighborhood: u.address_neighborhood || '',
        city: u.address_city || '',
        state: u.address_state || '',
        zipcode: u.address_zipcode || '',
      }));
    }

    // Taxa de entrega
    supabase.from('settings').select('*').eq('key', 'delivery_fee').single()
      .then(({ data }) => { if (data) setDeliveryFee(Number(data.value) || 0); });
  }, []);

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // ===== BUSCA CEP VIA VIACEP =====
  async function handleCepBlur() {
    const cep = form.zipcode.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch (e) {
      console.error('Erro ao buscar CEP:', e);
    } finally {
      setCepLoading(false);
    }
  }

  function calcSubtotal() {
    let total = 0;
    cart.forEach(item => {
      total += Number(item.product.price);
      item.drinks?.forEach(d => { total += Number(d.price) * d.quantity; });
    });
    return total;
  }

  function calcDiscount() {
    if (!couponApplied) return 0;
    const sub = calcSubtotal();
    if (couponApplied.discount_percent > 0) return sub * (couponApplied.discount_percent / 100);
    return couponApplied.discount_fixed || 0;
  }

  function calcTotal() {
    return Math.max(0, calcSubtotal() + deliveryFee - calcDiscount());
  }

  async function applyCoupon() {
    setCouponError('');
    if (!couponCode.trim()) return;
    try {
      const { data: coupon, error } = await supabase
        .from('coupons').select('*')
        .eq('code', couponCode.toUpperCase().trim())
        .eq('is_active', true).single();
      if (error || !coupon) { setCouponError('Cupom inválido'); return; }
      if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) { setCouponError('Cupom expirado'); return; }
      if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) { setCouponError('Cupom esgotado'); return; }
      if (coupon.is_first_order_only && form.cpf) {
        const { data: usage } = await supabase.from('coupon_usage').select('id')
          .eq('coupon_id', coupon.id).eq('cpf', form.cpf.replace(/\D/g, '')).single();
        if (usage) { setCouponError('Cupom já usado com este CPF'); return; }
      }
      setCouponApplied(coupon);
    } catch (e) { setCouponError('Erro ao validar'); }
  }

  function removeCartItem(itemId) {
    const newCart = cart.filter(c => c.id !== itemId);
    setCart(newCart);
    localStorage.setItem('fumego_cart', JSON.stringify(newCart));
    if (newCart.length === 0) router.push('/');
  }

  function isFormValid() {
    return form.name && form.phone && form.street && form.number && form.neighborhood;
  }

  async function handleSubmitOrder() {
    if (!isFormValid()) {
      alert('Preencha: Nome, Telefone, Rua, Número e Bairro.');
      return;
    }
    setLoading(true);
    try {
      // Criar pedido
      const orderPayload = {
        user_id: user?.id || null,
        customer_name: form.name,
        customer_email: form.email || null,
        customer_phone: form.phone,
        customer_cpf: form.cpf ? form.cpf.replace(/\D/g, '') : null,
        delivery_street: form.street,
        delivery_number: form.number,
        delivery_complement: form.complement || null,
        delivery_neighborhood: form.neighborhood,
        delivery_city: form.city || 'Cidade',
        delivery_state: form.state || 'SP',
        delivery_zipcode: form.zipcode || null,
        subtotal: calcSubtotal(),
        delivery_fee: deliveryFee,
        discount: calcDiscount(),
        total: calcTotal(),
        coupon_code: couponApplied ? couponCode.toUpperCase() : null,
        observations: cart.map(i => i.observations).filter(Boolean).join(' | '),
        payment_method: 'pix',
        payment_status: 'pending',
        status: 'pending',
      };

      const { data: order, error: orderErr } = await supabase.from('orders').insert(orderPayload).select().single();
      if (orderErr) throw orderErr;

      // Itens do pedido
      const items = [];
      cart.forEach(cartItem => {
        items.push({
          order_id: order.id,
          product_id: cartItem.product.id,
          product_name: cartItem.product.name,
          quantity: 1,
          unit_price: Number(cartItem.product.price),
          total_price: Number(cartItem.product.price),
          observations: cartItem.observations || null,
        });
        cartItem.drinks?.forEach(d => {
          items.push({
            order_id: order.id,
            drink_id: d.id,
            product_name: `${d.name} ${d.size}`,
            quantity: d.quantity,
            unit_price: Number(d.price),
            total_price: Number(d.price) * d.quantity,
          });
        });
      });
      await supabase.from('order_items').insert(items);

      // Cupom usage
      if (couponApplied && form.cpf) {
        const cleanCpf = form.cpf.replace(/\D/g, '');
        await supabase.from('coupon_usage').insert({ coupon_id: couponApplied.id, cpf: cleanCpf, user_id: user?.id || null });
        await supabase.from('coupons').update({ times_used: couponApplied.times_used + 1 }).eq('id', couponApplied.id);
      }

      // Gerar PIX
      const totalAmount = calcTotal();
      const cleanCpf = form.cpf ? form.cpf.replace(/\D/g, '') : '';

      const pixRes = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          order_number: order.order_number,
          amount: totalAmount,
          description: `FUMEGO Pizza - Pedido #${order.order_number}`,
          payer_email: form.email || `cliente${Date.now()}@fumego.com.br`,
          payer_name: form.name,
          payer_cpf: cleanCpf,
        }),
      });
      const pix = await pixRes.json();

      if (pix.error) {
        console.error('PIX Error:', pix);
        alert(`Erro no pagamento: ${pix.error}\n\nDetalhes: ${JSON.stringify(pix.details || '')}`);
        return;
      }

      setPixData(pix);
      setOrderCreated(true);

      // Atualizar pedido com PIX
      await supabase.from('orders').update({
        pix_payment_id: pix.payment_id,
        pix_qr_code: pix.qr_code,
        pix_qr_code_base64: pix.qr_code_base64,
      }).eq('id', order.id);

      // Checar pagamento
      startPaymentCheck(order.id);

    } catch (e) {
      console.error('Erro:', e);
      alert('Erro ao processar pedido. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function startPaymentCheck(orderId) {
    setCheckingPayment(true);
    const iv = setInterval(async () => {
      try {
        const { data } = await supabase.from('orders').select('payment_status').eq('id', orderId).single();
        if (data?.payment_status === 'approved') {
          clearInterval(iv);
          setPaymentConfirmed(true);
          setCheckingPayment(false);
          localStorage.removeItem('fumego_cart');
        }
      } catch (e) {}
    }, 5000);
    setTimeout(() => clearInterval(iv), 900000);
  }

  function copyPix() {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      alert('Código PIX copiado!');
    }
  }

  if (cart.length === 0 && !orderCreated) return null;

  // ===== PAGAMENTO CONFIRMADO =====
  if (paymentConfirmed) {
    return (
      <div style={{ minHeight: '100vh', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 'bold', color: '#D4A528', marginBottom: 8 }}>Pagamento Confirmado!</h1>
          <p style={{ color: '#999', marginBottom: 24 }}>Seu pedido está sendo preparado. Obrigado!</p>
          <button className="btn-primary" onClick={() => router.push('/')}>Voltar ao Cardápio</button>
        </div>
      </div>
    );
  }

  // ===== TELA PIX =====
  if (orderCreated && pixData) {
    return (
      <div style={{ minHeight: '100vh', background: '#1A1A1A', padding: 20 }}>
        <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 'bold', color: '#D4A528', marginBottom: 4 }}>Pagamento via PIX</h1>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Escaneie o QR Code ou copie o código</p>

          <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20 }}>
            {pixData.qr_code_base64 ? (
              <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR PIX" style={{ width: 220, height: 220, margin: '0 auto 16px' }} />
            ) : (
              <p style={{ color: '#333', marginBottom: 16 }}>QR Code não disponível. Use o código abaixo:</p>
            )}
            <p style={{ fontSize: 28, fontWeight: 'bold', color: '#1A1A1A' }}>R$ {calcTotal().toFixed(2).replace('.', ',')}</p>
          </div>

          <button className="btn-primary" onClick={copyPix} style={{ marginBottom: 16 }}>📋 Copiar Código PIX</button>

          {pixData.qr_code && (
            <div style={{ background: '#2D2D2D', borderRadius: 10, padding: 12, marginBottom: 16, wordBreak: 'break-all' }}>
              <p style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Código PIX copia e cola:</p>
              <p style={{ fontSize: 12, color: '#ddd', lineHeight: 1.4 }}>{pixData.qr_code}</p>
            </div>
          )}

          {checkingPayment && (
            <p style={{ color: '#D4A528', fontSize: 14, animation: 'pulse 1.5s infinite' }}>⏳ Aguardando pagamento...</p>
          )}
        </div>
      </div>
    );
  }

  // ===== CHECKOUT =====
  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A' }}>
      {/* Header */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#D4A528', fontSize: 20, cursor: 'pointer' }}>←</button>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 18, fontWeight: 'bold', color: '#D4A528' }}>Checkout</h1>
        </div>
      </header>

      <div style={{ padding: '16px 16px 120px' }}>
        {/* ===== CARRINHO ===== */}
        <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #444' }}>
          <h2 style={{ fontSize: 13, fontWeight: 'bold', color: '#D4A528', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>🛒 Seu Carrinho</h2>
          {cart.map((item, idx) => (
            <div key={item.id} style={{ borderBottom: idx < cart.length - 1 ? '1px solid #444' : 'none', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 'bold', color: '#fff' }}>{item.product.name}</p>
                  {item.drinks?.map(d => (
                    <p key={d.id} style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>+ {d.name} {d.size} x{d.quantity}</p>
                  ))}
                  {item.observations && <p style={{ fontSize: 11, color: '#777', fontStyle: 'italic', marginTop: 2 }}>Obs: {item.observations}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 'bold', color: '#fff' }}>
                    R$ {(Number(item.product.price) + (item.drinks?.reduce((s, d) => s + Number(d.price) * d.quantity, 0) || 0)).toFixed(2).replace('.', ',')}
                  </span>
                  <button onClick={() => removeCartItem(item.id)}
                    style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#D4A528', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
            + Adicionar mais itens
          </button>
        </div>

        {/* ===== DADOS PESSOAIS ===== */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 'bold', color: '#D4A528', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Seus Dados</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="input-field" placeholder="Nome completo *" value={form.name} onChange={e => updateForm('name', e.target.value)} />
            <input className="input-field" placeholder="Telefone com DDD *" value={form.phone} onChange={e => updateForm('phone', e.target.value)} type="tel" />
            <input className="input-field" placeholder="E-mail" value={form.email} onChange={e => updateForm('email', e.target.value)} type="email" />
            <input className="input-field" placeholder="CPF (para cupom)" value={form.cpf} onChange={e => updateForm('cpf', e.target.value)} />
          </div>
        </div>

        {/* ===== ENDEREÇO (com CEP) ===== */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 'bold', color: '#D4A528', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Endereço de Entrega</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                placeholder="CEP"
                value={form.zipcode}
                onChange={e => updateForm('zipcode', e.target.value)}
                onBlur={handleCepBlur}
                maxLength={9}
                inputMode="numeric"
              />
              {cepLoading && (
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#D4A528' }}>
                  Buscando...
                </span>
              )}
            </div>
            <input className="input-field" placeholder="Rua / Avenida *" value={form.street} onChange={e => updateForm('street', e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <input className="input-field" placeholder="Número *" value={form.number} onChange={e => updateForm('number', e.target.value)} />
              <input className="input-field" placeholder="Complemento" value={form.complement} onChange={e => updateForm('complement', e.target.value)} />
            </div>
            <input className="input-field" placeholder="Bairro *" value={form.neighborhood} onChange={e => updateForm('neighborhood', e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <input className="input-field" placeholder="Cidade" value={form.city} onChange={e => updateForm('city', e.target.value)} />
              <input className="input-field" placeholder="Estado" value={form.state} onChange={e => updateForm('state', e.target.value)} maxLength={2} />
            </div>
          </div>
        </div>

        {/* ===== CUPOM ===== */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 'bold', color: '#D4A528', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Cupom</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input-field" placeholder="Código" value={couponCode} onChange={e => setCouponCode(e.target.value)} disabled={!!couponApplied} style={{ flex: 1 }} />
            {couponApplied ? (
              <button onClick={() => { setCouponApplied(null); setCouponCode(''); }} style={{ padding: '0 16px', background: '#555', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>Remover</button>
            ) : (
              <button onClick={applyCoupon} className="btn-primary" style={{ width: 'auto', padding: '0 20px' }}>Aplicar</button>
            )}
          </div>
          {couponError && <p style={{ color: '#E53E3E', fontSize: 12, marginTop: 4 }}>{couponError}</p>}
          {couponApplied && <p style={{ color: '#48BB78', fontSize: 12, marginTop: 4 }}>✅ Cupom aplicado! {couponApplied.discount_percent}% de desconto</p>}
        </div>

        {/* ===== VALORES ===== */}
        <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#aaa', marginBottom: 8 }}>
            <span>Subtotal</span>
            <span style={{ color: '#fff' }}>R$ {calcSubtotal().toFixed(2).replace('.', ',')}</span>
          </div>
          {deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#aaa', marginBottom: 8 }}>
              <span>Entrega</span>
              <span style={{ color: '#fff' }}>R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          {calcDiscount() > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span style={{ color: '#48BB78' }}>Desconto</span>
              <span style={{ color: '#48BB78' }}>-R$ {calcDiscount().toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 'bold', borderTop: '1px solid #555', paddingTop: 10, marginTop: 4 }}>
            <span style={{ color: '#D4A528' }}>Total</span>
            <span style={{ color: '#D4A528' }}>R$ {calcTotal().toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        {/* ===== BOTÃO PAGAR ===== */}
        <button className="btn-primary" onClick={handleSubmitOrder} disabled={loading || !isFormValid()}
          style={{ padding: 16, fontSize: 16 }}>
          {loading ? '⏳ Gerando PIX...' : '💳 Pagar com PIX'}
        </button>
      </div>
    </div>
  );
}
