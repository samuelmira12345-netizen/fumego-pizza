'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const router = useRouter();
  const [orderData, setOrderData] = useState(null);
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

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    zipcode: '',
  });

  useEffect(() => {
    const data = localStorage.getItem('fumego_order');
    if (!data) {
      router.push('/');
      return;
    }
    setOrderData(JSON.parse(data));

    // Carregar dados do usuário se logado
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
        zipcode: u.address_zipcode || '',
      }));
    }

    // Carregar taxa de entrega
    supabase.from('settings').select('*').eq('key', 'delivery_fee').single()
      .then(({ data }) => {
        if (data) setDeliveryFee(Number(data.value) || 0);
      });
  }, []);

  function calcSubtotal() {
    if (!orderData) return 0;
    let total = orderData.product.price;
    orderData.drinks?.forEach(d => { total += d.price * d.quantity; });
    return total;
  }

  function calcDiscount() {
    if (!couponApplied) return 0;
    const subtotal = calcSubtotal();
    if (couponApplied.discount_percent > 0) {
      return subtotal * (couponApplied.discount_percent / 100);
    }
    return couponApplied.discount_fixed || 0;
  }

  function calcTotal() {
    return calcSubtotal() + deliveryFee - calcDiscount();
  }

  async function applyCoupon() {
    setCouponError('');
    if (!couponCode.trim()) return;

    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase().trim())
        .eq('is_active', true)
        .single();

      if (error || !coupon) {
        setCouponError('Cupom inválido ou expirado');
        return;
      }

      if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
        setCouponError('Cupom expirado');
        return;
      }

      if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
        setCouponError('Cupom esgotado');
        return;
      }

      // Verificar se é cupom de primeiro pedido
      if (coupon.is_first_order_only && form.cpf) {
        const { data: usage } = await supabase
          .from('coupon_usage')
          .select('id')
          .eq('coupon_id', coupon.id)
          .eq('cpf', form.cpf)
          .single();

        if (usage) {
          setCouponError('Este cupom já foi usado com seu CPF');
          return;
        }
      }

      setCouponApplied(coupon);
    } catch (e) {
      setCouponError('Erro ao validar cupom');
    }
  }

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function isFormValid() {
    return form.name && form.phone && form.street && form.number && form.neighborhood;
  }

  async function handleSubmitOrder() {
    if (!isFormValid()) {
      alert('Preencha os campos obrigatórios: Nome, Telefone, Rua, Número e Bairro.');
      return;
    }

    setLoading(true);
    try {
      // Criar pedido no banco
      const orderPayload = {
        user_id: user?.id || null,
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        customer_cpf: form.cpf,
        delivery_street: form.street,
        delivery_number: form.number,
        delivery_complement: form.complement,
        delivery_neighborhood: form.neighborhood,
        delivery_city: form.city || 'Cidade',
        delivery_state: 'SP',
        delivery_zipcode: form.zipcode,
        subtotal: calcSubtotal(),
        delivery_fee: deliveryFee,
        discount: calcDiscount(),
        total: calcTotal(),
        coupon_code: couponApplied ? couponCode.toUpperCase() : null,
        observations: orderData.observations || '',
        payment_method: 'pix',
        payment_status: 'pending',
        status: 'pending',
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();

      if (orderError) throw orderError;

      // Inserir itens do pedido
      const items = [];
      items.push({
        order_id: order.id,
        product_id: orderData.product.id,
        product_name: orderData.product.name,
        quantity: 1,
        unit_price: orderData.product.price,
        total_price: orderData.product.price,
        observations: orderData.observations || '',
      });

      if (orderData.drinks) {
        orderData.drinks.forEach(d => {
          items.push({
            order_id: order.id,
            drink_id: d.id,
            product_name: d.name + ' ' + d.size,
            quantity: d.quantity,
            unit_price: d.price,
            total_price: d.price * d.quantity,
          });
        });
      }

      await supabase.from('order_items').insert(items);

      // Registrar uso do cupom
      if (couponApplied && form.cpf) {
        await supabase.from('coupon_usage').insert({
          coupon_id: couponApplied.id,
          cpf: form.cpf,
          user_id: user?.id || null,
        });
        await supabase.from('coupons').update({
          times_used: couponApplied.times_used + 1,
        }).eq('id', couponApplied.id);
      }

      // Gerar PIX via Mercado Pago
      const pixResponse = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          amount: calcTotal(),
          description: `FUMÊGO - Pedido #${order.order_number}`,
          payer_email: form.email || 'cliente@fumego.com.br',
          payer_name: form.name,
          payer_cpf: form.cpf,
        }),
      });

      const pix = await pixResponse.json();

      if (pix.error) {
        throw new Error(pix.error);
      }

      setPixData(pix);
      setOrderCreated(true);

      // Atualizar pedido com dados do PIX
      await supabase.from('orders').update({
        pix_payment_id: pix.payment_id,
        pix_qr_code: pix.qr_code,
        pix_qr_code_base64: pix.qr_code_base64,
        pix_expires_at: pix.expires_at,
      }).eq('id', order.id);

      // Iniciar verificação de pagamento
      startPaymentCheck(order.id);

    } catch (e) {
      console.error('Erro ao criar pedido:', e);
      alert('Erro ao processar pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function startPaymentCheck(orderId) {
    setCheckingPayment(true);
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('payment_status')
          .eq('id', orderId)
          .single();

        if (data?.payment_status === 'approved') {
          clearInterval(interval);
          setPaymentConfirmed(true);
          setCheckingPayment(false);
          localStorage.removeItem('fumego_order');
        }
      } catch (e) {}
    }, 5000); // Verifica a cada 5 segundos

    // Parar após 15 minutos
    setTimeout(() => clearInterval(interval), 900000);
  }

  function copyPixCode() {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      alert('Código PIX copiado!');
    }
  }

  if (!orderData) return null;

  // ============ TELA DE PAGAMENTO CONFIRMADO ============
  if (paymentConfirmed) {
    return (
      <div className="min-h-screen bg-fumego-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="font-display text-2xl font-bold text-fumego-gold mb-2">
            Pagamento Confirmado!
          </h1>
          <p className="text-gray-400 mb-6">
            Seu pedido está sendo preparado. Obrigado por escolher a FUMÊGO!
          </p>
          <button onClick={() => router.push('/')} className="btn-primary">
            Voltar ao Cardápio
          </button>
        </div>
      </div>
    );
  }

  // ============ TELA DO PIX ============
  if (orderCreated && pixData) {
    return (
      <div className="min-h-screen bg-fumego-black p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="font-display text-2xl font-bold text-fumego-gold">Pagamento via PIX</h1>
            <p className="text-gray-400 text-sm mt-1">Escaneie o QR Code ou copie o código</p>
          </div>

          <div className="bg-white rounded-2xl p-6 text-center mb-6">
            {pixData.qr_code_base64 && (
              <img
                src={`data:image/png;base64,${pixData.qr_code_base64}`}
                alt="QR Code PIX"
                className="w-56 h-56 mx-auto mb-4"
              />
            )}
            <p className="text-3xl font-bold text-fumego-black">
              R$ {calcTotal().toFixed(2).replace('.', ',')}
            </p>
          </div>

          <button onClick={copyPixCode} className="btn-primary w-full mb-4">
            📋 Copiar Código PIX
          </button>

          {checkingPayment && (
            <div className="text-center">
              <div className="animate-pulse text-fumego-gold text-sm">
                ⏳ Aguardando confirmação do pagamento...
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ FORMULÁRIO DE CHECKOUT ============
  return (
    <div className="min-h-screen bg-fumego-black">
      <header className="sticky top-0 z-50 bg-fumego-black/95 backdrop-blur border-b border-fumego-gold/30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-fumego-gold text-xl">←</button>
          <h1 className="font-display text-lg font-bold text-fumego-gold">Finalizar Pedido</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Resumo do Pedido */}
        <div className="bg-fumego-dark rounded-xl p-4 border border-gray-800">
          <h2 className="text-sm font-bold text-fumego-gold uppercase tracking-wider mb-3">Seu Pedido</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">{orderData.product.name}</span>
              <span className="text-white font-bold">R$ {orderData.product.price.toFixed(2).replace('.', ',')}</span>
            </div>
            {orderData.drinks?.map(d => (
              <div key={d.id} className="flex justify-between text-sm">
                <span className="text-gray-300">{d.name} {d.size} x{d.quantity}</span>
                <span className="text-white font-bold">R$ {(d.price * d.quantity).toFixed(2).replace('.', ',')}</span>
              </div>
            ))}
            {orderData.observations && (
              <p className="text-xs text-gray-500 mt-2 italic">Obs: {orderData.observations}</p>
            )}
          </div>
        </div>

        {/* Dados Pessoais */}
        <div>
          <h2 className="text-sm font-bold text-fumego-gold uppercase tracking-wider mb-3">Seus Dados</h2>
          <div className="space-y-3">
            <input className="input-field" placeholder="Nome completo *" value={form.name} onChange={e => updateForm('name', e.target.value)} />
            <input className="input-field" placeholder="Telefone com DDD *" value={form.phone} onChange={e => updateForm('phone', e.target.value)} type="tel" />
            <input className="input-field" placeholder="E-mail (opcional)" value={form.email} onChange={e => updateForm('email', e.target.value)} type="email" />
            <input className="input-field" placeholder="CPF (para cupom)" value={form.cpf} onChange={e => updateForm('cpf', e.target.value)} />
          </div>
        </div>

        {/* Endereço de Entrega */}
        <div>
          <h2 className="text-sm font-bold text-fumego-gold uppercase tracking-wider mb-3">Endereço de Entrega</h2>
          <div className="space-y-3">
            <input className="input-field" placeholder="Rua / Avenida *" value={form.street} onChange={e => updateForm('street', e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <input className="input-field" placeholder="Número *" value={form.number} onChange={e => updateForm('number', e.target.value)} />
              <input className="input-field col-span-2" placeholder="Complemento" value={form.complement} onChange={e => updateForm('complement', e.target.value)} />
            </div>
            <input className="input-field" placeholder="Bairro *" value={form.neighborhood} onChange={e => updateForm('neighborhood', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input-field" placeholder="Cidade" value={form.city} onChange={e => updateForm('city', e.target.value)} />
              <input className="input-field" placeholder="CEP" value={form.zipcode} onChange={e => updateForm('zipcode', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Cupom */}
        <div>
          <h2 className="text-sm font-bold text-fumego-gold uppercase tracking-wider mb-3">Cupom de Desconto</h2>
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="Digite o código"
              value={couponCode}
              onChange={e => setCouponCode(e.target.value)}
              disabled={!!couponApplied}
            />
            {couponApplied ? (
              <button
                className="btn-secondary text-sm px-4"
                onClick={() => { setCouponApplied(null); setCouponCode(''); }}
              >
                Remover
              </button>
            ) : (
              <button className="btn-primary text-sm px-4" onClick={applyCoupon}>
                Aplicar
              </button>
            )}
          </div>
          {couponError && <p className="text-red-400 text-xs mt-1">{couponError}</p>}
          {couponApplied && (
            <p className="text-green-400 text-xs mt-1">
              ✅ Cupom aplicado! {couponApplied.discount_percent > 0 ? `${couponApplied.discount_percent}% de desconto` : `R$ ${couponApplied.discount_fixed} de desconto`}
            </p>
          )}
        </div>

        {/* Resumo de Valores */}
        <div className="bg-fumego-dark rounded-xl p-4 border border-gray-800 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal</span>
            <span className="text-white">R$ {calcSubtotal().toFixed(2).replace('.', ',')}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Entrega</span>
              <span className="text-white">R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          {calcDiscount() > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-400">Desconto</span>
              <span className="text-green-400">-R$ {calcDiscount().toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold border-t border-gray-700 pt-2 mt-2">
            <span className="text-fumego-gold">Total</span>
            <span className="text-fumego-gold">R$ {calcTotal().toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        {/* Botão Pagar */}
        <button
          className="btn-primary w-full py-4 text-lg"
          onClick={handleSubmitOrder}
          disabled={loading || !isFormValid()}
        >
          {loading ? '⏳ Gerando PIX...' : '💳 Pagar com PIX'}
        </button>

        <p className="text-center text-xs text-gray-600 pb-4">
          Ao finalizar, você concorda com nossos termos. Pagamento seguro via Mercado Pago.
        </p>
      </div>
    </div>
  );
}
