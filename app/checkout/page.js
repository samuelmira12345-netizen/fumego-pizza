'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, X, ClipboardCopy, Loader2, CheckCircle2,
  Landmark, CreditCard, Banknote, Clock, Truck, CalendarClock,
} from 'lucide-react';
import { useScrollToStep } from '../../hooks/useScrollToStep';

const GOLD   = '#F2A800';
const BG     = '#080600';
const CARD   = '#1C1500';
const BORDER = '#2C1E00';
const MUTED  = '#7A6040';
const GREEN  = '#48BB78';
const RED    = '#E04040';

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryTime, setDeliveryTime] = useState('40–60 min');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [pixData, setPixData] = useState(null);
  const [orderCreated, setOrderCreated] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [pixError, setPixError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [cashOrderDone, setCashOrderDone] = useState(false);
  const [cashChange, setCashChange] = useState('');
  const [paymentExpired, setPaymentExpired] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [formError, setFormError] = useState('');

  // Cashback
  const [cashbackBalance, setCashbackBalance] = useState(0);
  const [cashbackTxs, setCashbackTxs]         = useState([]);
  const [useCashbackBalance, setUseCashbackBalance] = useState(false);

  // Agendamento
  const [schedulingEnabled, setSchedulingEnabled] = useState(false);
  const [schedulingMaxDays, setSchedulingMaxDays] = useState(3);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Refs para limpeza de timers ao desmontar o componente
  const pollingIntervalRef = useRef(null);
  const pollingTimeoutRef = useRef(null);

  // Chave de idempotência: gerada uma vez por sessão de checkout.
  // Enviada ao server via X-Idempotency-Key para evitar pedidos duplicados
  // caso o usuário clique duas vezes em "Confirmar" ou a rede reenvie a requisição.
  const idempotencyKeyRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  );

  // Guarda de submissão em andamento: impede duplo envio mesmo se o estado
  // ainda não foi atualizado (evita duplo clique antes do re-render).
  const isSubmittingRef = useRef(false);

  // Scroll guiado entre passos do checkout
  const scrollToStep = useScrollToStep(300);

  // Modal de confirmação exibido antes de enviar o pedido
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', cpf: '',
    street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipcode: '',
  });

  // Limpa o intervalo de polling e o timeout ao desmontar o componente
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const c = localStorage.getItem('fumego_cart');
    if (!c || JSON.parse(c).length === 0) { router.push('/'); return; }
    const parsedCart = JSON.parse(c);
    setCart(parsedCart);
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'BRL',
        items: parsedCart.map(i => ({ item_name: i.product?.name, item_id: i.product?.slug })),
      });
    }

    const userData = localStorage.getItem('fumego_user');
    if (userData) {
      const u = JSON.parse(userData);
      setUser(u);
      setForm(prev => ({
        ...prev,
        name: u.name || '', email: u.email || '', phone: u.phone || '', cpf: u.cpf || '',
        street: u.address_street || '', number: u.address_number || '',
        complement: u.address_complement || '', neighborhood: u.address_neighborhood || '',
        city: u.address_city || '', state: u.address_state || '', zipcode: u.address_zipcode || '',
      }));
      // Busca saldo de cashback do usuário
      if (u.id) {
        fetch(`/api/cashback/balance?user_id=${u.id}`)
          .then(r => r.json())
          .then(data => { setCashbackBalance(data.balance || 0); setCashbackTxs(data.transactions || []); })
          .catch(() => {});
      }
    }

    supabase.from('settings').select('*')
      .in('key', ['delivery_fee', 'delivery_time', 'instagram_url', 'scheduling_enabled', 'scheduling_max_days'])
      .then(({ data }) => {
        if (data) {
          const fee   = data.find(s => s.key === 'delivery_fee');
          const time  = data.find(s => s.key === 'delivery_time');
          const insta = data.find(s => s.key === 'instagram_url');
          const schEn = data.find(s => s.key === 'scheduling_enabled');
          const schMx = data.find(s => s.key === 'scheduling_max_days');
          if (fee)   setDeliveryFee(Number(fee.value) || 0);
          if (time)  setDeliveryTime(time.value || '40–60 min');
          if (insta) setInstagramUrl(insta.value || '');
          if (schEn?.value === 'true') setSchedulingEnabled(true);
          if (schMx) setSchedulingMaxDays(parseInt(schMx.value) || 3);
        }
      });
  }, []);

  function updateForm(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  async function loadAvailableSlots(date) {
    if (!date) { setAvailableSlots([]); setSelectedSlot(''); return; }
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/checkout/available-slots?date=${date}`);
      const data = await res.json();
      setAvailableSlots(data.slots || []);
      setSelectedSlot('');
    } catch { setAvailableSlots([]); }
    finally { setLoadingSlots(false); }
  }

  function getMinDate() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return d.toISOString().slice(0, 10);
  }

  function getMaxDate() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    d.setDate(d.getDate() + schedulingMaxDays);
    return d.toISOString().slice(0, 10);
  }

  function getScheduledFor() {
    if (!isScheduled || !scheduledDate || !selectedSlot) return null;
    return new Date(`${scheduledDate}T${selectedSlot}:00-03:00`).toISOString();
  }

  async function handleCepBlur(e) {
    // Usa e.target.value diretamente para evitar closure stale com estado React
    const rawValue = e?.target?.value ?? form.zipcode;
    const cep = rawValue.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          street:       data.logradouro  || prev.street,
          neighborhood: data.bairro      || prev.neighborhood,
          city:         data.localidade  || prev.city,
          state:        data.uf          || prev.state,
        }));
      }
    } catch (e) { console.error('Erro CEP:', e); }
    finally { setCepLoading(false); }
  }

  function calcSubtotal() {
    let total = 0;
    cart.forEach(item => {
      total += Number(item.product.price);
      if (item.option?.extra_price) total += item.option.extra_price;
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

  /** Total antes de aplicar o cashback */
  function calcBeforeCashback() { return Math.max(0, calcSubtotal() + deliveryFee - calcDiscount()); }

  /** Desconto de cashback: máximo 50% do total pré-cashback */
  function calcCashbackDiscount() {
    if (!useCashbackBalance || cashbackBalance <= 0) return 0;
    return Math.min(cashbackBalance, calcBeforeCashback() * 0.5);
  }

  function calcTotal() { return Math.max(0, calcBeforeCashback() - calcCashbackDiscount()); }

  async function applyCoupon() {
    setCouponError('');
    if (!couponCode.trim()) return;
    try {
      const { data: coupon, error } = await supabase.from('coupons').select('*')
        .eq('code', couponCode.toUpperCase().trim()).eq('is_active', true).single();
      if (error || !coupon) { setCouponError('Cupom inválido'); return; }
      if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) { setCouponError('Cupom expirado'); return; }
      if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) { setCouponError('Cupom esgotado'); return; }
      setCouponApplied(coupon);
      setUseCashbackBalance(false); // cupom e cashback não podem ser usados juntos
    } catch (e) { setCouponError('Erro ao validar'); }
  }

  function removeCartItem(itemId) {
    const newCart = cart.filter(c => c.id !== itemId);
    setCart(newCart);
    localStorage.setItem('fumego_cart', JSON.stringify(newCart));
    if (newCart.length === 0) router.push('/');
  }

  function isFormValid() {
    if (!form.name || !form.phone || !form.street || !form.number || !form.neighborhood) return false;
    if (isScheduled && (!scheduledDate || !selectedSlot)) return false;
    return true;
  }

  async function createOrder() {
    const observations = [
      ...cart.map(i => i.observations).filter(Boolean),
      paymentMethod === 'cash' && cashChange ? `Troco para: R$ ${cashChange}` : '',
    ].filter(Boolean).join(' | ');

    const scheduledFor = getScheduledFor();
    const orderPayload = {
      user_id: user?.id || null,
      customer_name: form.name, customer_email: form.email || null,
      customer_phone: form.phone,
      // customer_cpf é hasheado server-side pela API /api/checkout/create-order
      delivery_street: form.street, delivery_number: form.number,
      delivery_complement: form.complement || null, delivery_neighborhood: form.neighborhood,
      delivery_city: form.city || 'Cidade', delivery_state: form.state || 'MG',
      delivery_zipcode: form.zipcode || null,
      subtotal: calcSubtotal(), delivery_fee: deliveryFee, discount: calcDiscount(),
      cashback_used: calcCashbackDiscount(), total: calcTotal(),
      coupon_code: couponApplied ? couponCode.toUpperCase() : null,
      observations,
      payment_method: paymentMethod,
      payment_status: 'pending',
      status: scheduledFor ? 'scheduled' : 'pending',
      scheduled_for: scheduledFor || null,
    };

    const items = [];
    cart.forEach(cartItem => {
      const optionPrice = cartItem.option?.extra_price || 0;
      const optionNote  = cartItem.option ? cartItem.option.label : null;
      const obsNote     = cartItem.observations || null;
      const fullObs     = [optionNote, obsNote].filter(Boolean).join(' | ') || null;
      items.push({
        product_id: cartItem.product.id, product_name: cartItem.product.name,
        quantity: 1,
        unit_price:  Number(cartItem.product.price) + optionPrice,
        total_price: Number(cartItem.product.price) + optionPrice,
        observations: fullObs,
      });
      cartItem.drinks?.forEach(d => {
        items.push({
          drink_id: d.id, product_name: `${d.name} ${d.size}`,
          quantity: d.quantity, unit_price: Number(d.price), total_price: Number(d.price) * d.quantity,
        });
      });
    });

    // Criação do pedido via API server-side para garantir hash do CPF.
    // O header X-Idempotency-Key garante que cliques duplos ou retransmissões
    // de rede não criem pedidos duplicados.
    const res = await fetch('/api/checkout/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKeyRef.current,
      },
      body: JSON.stringify({
        orderPayload,
        items,
        coupon: couponApplied || null,
        cpf: form.cpf || null,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erro ao criar pedido');
    return result.order;
  }

  /** Valida o formulário e, se válido, abre o modal de confirmação. */
  function handleSubmitOrder() {
    if (!isFormValid()) {
      const missing = [];
      if (!form.name.trim())         missing.push('Nome completo');
      if (!form.phone.trim())        missing.push('Telefone com DDD');
      if (!form.street.trim())       missing.push('Rua / Avenida');
      if (!form.number.trim())       missing.push('Número');
      if (!form.neighborhood.trim()) missing.push('Bairro');
      if (isScheduled && !scheduledDate)  missing.push('Data de agendamento');
      if (isScheduled && !selectedSlot)   missing.push('Horário de agendamento');
      setFormError(`Preencha os campos obrigatórios antes de finalizar: ${missing.join(', ')}.`);
      if (!form.name.trim() || !form.phone.trim()) {
        scrollToStep('checkout-personal');
      } else if (!form.street.trim() || !form.number.trim() || !form.neighborhood.trim()) {
        scrollToStep('checkout-address');
      } else if (isScheduled && (!scheduledDate || !selectedSlot)) {
        scrollToStep('checkout-scheduling');
      }
      return;
    }
    setFormError('');
    setShowConfirmModal(true);
  }

  /** Chamado após o usuário confirmar no modal — executa a submissão real. */
  async function doSubmitOrder() {
    setShowConfirmModal(false);

    // Guarda contra duplo clique
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setLoading(true);
    setPixError(null);

    try {
      const order = await createOrder();

      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'purchase', {
          transaction_id: String(order.id),
          value:          calcTotal(),
          currency:       'BRL',
          items: cart.map(i => ({ item_name: i.product?.name, item_id: i.product?.slug, price: i.product?.price })),
        });
      }

      if (paymentMethod === 'pix') {
        const cleanCpf = form.cpf ? form.cpf.replace(/\D/g, '') : '';
        const pixRes = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: order.id, order_number: order.order_number, amount: calcTotal(),
            description: `FUMEGO Pizza - Pedido #${order.order_number}`,
            payer_email: form.email || `cliente${Date.now()}@fumego.com.br`,
            payer_name: form.name, payer_cpf: cleanCpf,
          }),
        });
        const pix = await pixRes.json();
        if (pix.error) { setPixError(pix); return; }
        // PIX data já foi salvo no banco pela API /api/create-payment (server-side)
        setPixData(pix);
        setOrderCreated(true);
        startPaymentCheck(order.id, user?.id || null, calcTotal());
      }

      else if (paymentMethod === 'card') {
        const cardRes = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: order.id, order_number: order.order_number, amount: calcTotal(),
            description: `FUMEGO Pizza - Pedido #${order.order_number}`,
            payer_email: form.email || `cliente${Date.now()}@fumego.com.br`,
            payer_name: form.name,
            payer_cpf: form.cpf ? form.cpf.replace(/\D/g, '') : '',
            payment_type: 'card',
          }),
        });
        const cardData = await cardRes.json();
        if (cardData.error) { setPixError(cardData); return; }
        if (cardData.checkout_url) { window.location.href = cardData.checkout_url; return; }
        setPixData(cardData);
        setOrderCreated(true);
      }

      else if (paymentMethod === 'cash' || paymentMethod === 'card_delivery') {
        // Cashback será gerado quando a loja finalizar o pedido (status → "delivered")
        localStorage.removeItem('fumego_cart');
        setCashOrderDone(true);
        setOrderCreated(true);
      }

    } catch (e) {
      console.error('Erro:', e);
      setFormError(e.message || 'Erro ao processar pedido. Verifique os dados e tente novamente.');
      // Libera a guarda de submissão para o usuário poder tentar novamente
      isSubmittingRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  function startPaymentCheck(orderId, userId, orderTotal) {
    setCheckingPayment(true);
    let expired = false;

    const iv = setInterval(async () => {
      if (expired) return;
      try {
        const res = await fetch(`/api/payment-status/${orderId}`);
        const data = await res.json();
        if (data?.payment_status === 'approved') {
          clearInterval(iv);
          pollingIntervalRef.current = null;
          setPaymentConfirmed(true);
          setCheckingPayment(false);
          localStorage.removeItem('fumego_cart');
          // Gera cashback após confirmação do pagamento PIX/cartão
          if (userId) {
            fetch('/api/cashback/earn', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId, order_id: orderId, order_total: orderTotal }),
            }).catch(() => {});
          }
        } else if (data?.payment_status === 'cancelled') {
          clearInterval(iv);
          pollingIntervalRef.current = null;
          setPaymentExpired(true);
          setCheckingPayment(false);
        }
      } catch (e) {}
    }, 5000);

    pollingIntervalRef.current = iv;

    const tid = setTimeout(async () => {
      expired = true;
      clearInterval(iv);
      pollingIntervalRef.current = null;
      pollingTimeoutRef.current = null;
      setCheckingPayment(false);
      try {
        // Cancela via API (server-side, sem cliente anon)
        await fetch(`/api/payment-status/${orderId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel' }),
        });
        setPaymentExpired(true);
      } catch (e) {}
    }, 900000);

    pollingTimeoutRef.current = tid;
  }

  function copyPix() {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2500);
    }
  }

  if (cart.length === 0 && !orderCreated) return null;

  // ===== PAGAMENTO CONFIRMADO =====
  if (paymentConfirmed) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <CheckCircle2 size={64} color={GREEN} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 24, fontWeight: 'bold', color: GOLD, marginBottom: 8 }}>
            Pagamento Confirmado!
          </h1>
          <p style={{ color: MUTED, marginBottom: 12 }}>Seu pedido está sendo preparado. Obrigado!</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: GOLD, fontSize: 14, marginBottom: 24 }}>
            <Clock size={16} color={GOLD} />
            <span>Previsão de entrega: {deliveryTime}</span>
          </div>
          <button className="btn-primary" onClick={() => router.push('/')}>Voltar ao Cardápio</button>
          {instagramUrl && (
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: '12px 24px', border: `1px solid ${BORDER}`, borderRadius: 14, color: '#fff', fontSize: 14, fontWeight: 600, background: 'rgba(255,255,255,0.04)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#igGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <defs><linearGradient id="igGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f09433"/><stop offset="50%" stopColor="#e6683c"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs>
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
                Nos siga no Instagram
              </div>
            </a>
          )}
        </div>
      </div>
    );
  }

  // ===== PEDIDO DINHEIRO CONFIRMADO =====
  if (cashOrderDone) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <CheckCircle2 size={64} color={GREEN} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 24, fontWeight: 'bold', color: GOLD, marginBottom: 8 }}>
            Pedido Enviado!
          </h1>
          <p style={{ color: MUTED, marginBottom: 8 }}>
            Pagamento: {paymentMethod === 'card_delivery' ? 'Cartão na entrega' : 'Dinheiro na entrega'}
          </p>
          <p style={{ color: GOLD, fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>
            Total: R$ {calcTotal().toFixed(2).replace('.', ',')}
          </p>
          {cashChange && (
            <p style={{ color: MUTED, fontSize: 14, marginBottom: 8 }}>Troco para: R$ {cashChange}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: GOLD, fontSize: 14, marginBottom: 8 }}>
            <Clock size={16} color={GOLD} />
            <span>Previsão de entrega: {deliveryTime}</span>
          </div>
          {paymentMethod === 'cash' && (
            <p style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>Prepare o valor em espécie. Obrigado!</p>
          )}
          {paymentMethod === 'card_delivery' && (
            <p style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>A maquininha será levada pelo entregador. Obrigado!</p>
          )}
          <button className="btn-primary" onClick={() => router.push('/')}>Voltar ao Cardápio</button>
          {instagramUrl && (
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: '12px 24px', border: `1px solid ${BORDER}`, borderRadius: 14, color: '#fff', fontSize: 14, fontWeight: 600, background: 'rgba(255,255,255,0.04)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#igGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <defs><linearGradient id="igGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f09433"/><stop offset="50%" stopColor="#e6683c"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs>
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
                Nos siga no Instagram
              </div>
            </a>
          )}
        </div>
      </div>
    );
  }

  // ===== PAGAMENTO EXPIRADO / CANCELADO =====
  if (paymentExpired) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <X size={64} color={RED} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 24, fontWeight: 'bold', color: RED, marginBottom: 8 }}>
            Pagamento não confirmado
          </h1>
          <p style={{ color: MUTED, marginBottom: 24 }}>O tempo para pagamento expirou e o pedido foi cancelado automaticamente.</p>
          <button className="btn-primary" onClick={() => router.push('/')}>Voltar ao Cardápio</button>
        </div>
      </div>
    );
  }

  // ===== TELA PIX =====
  if (orderCreated && pixData) {
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: 20 }}>
        <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 22, fontWeight: 'bold', color: GOLD, marginBottom: 4 }}>
            Pagamento via PIX
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginBottom: 20 }}>Escaneie o QR Code ou copie o código</p>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20 }}>
            {pixData.qr_code_base64 ? (
              <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR PIX" style={{ width: 220, height: 220, margin: '0 auto 16px' }} />
            ) : (
              <p style={{ color: '#333', marginBottom: 16 }}>QR Code não disponível. Use o código abaixo:</p>
            )}
            <p style={{ fontSize: 28, fontWeight: 'bold', color: '#1A1A1A' }}>R$ {calcTotal().toFixed(2).replace('.', ',')}</p>
          </div>
          <button className="btn-primary" onClick={copyPix}
            style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: pixCopied ? '#2D7D46' : undefined }}>
            <ClipboardCopy size={16} /> {pixCopied ? 'Copiado!' : 'Copiar Código PIX'}
          </button>
          {pixCopied && (
            <p style={{ color: GREEN, fontSize: 13, marginBottom: 8, textAlign: 'center' }}>Código copiado para a área de transferência</p>
          )}
          {pixData.qr_code && (
            <div style={{ background: CARD, borderRadius: 10, padding: 12, marginBottom: 16, wordBreak: 'break-all', border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>Código PIX copia e cola:</p>
              <p style={{ fontSize: 12, color: '#ddd', lineHeight: 1.4 }}>{pixData.qr_code}</p>
            </div>
          )}
          {checkingPayment && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: GOLD, fontSize: 14 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Aguardando pagamento...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== CHECKOUT =====
  return (
    <div style={{ minHeight: '100vh', background: BG, animation: 'checkoutFadeIn 0.22s ease-out' }}>
      <style>{`@keyframes checkoutFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <header className="header" style={{ justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 22, cursor: 'pointer', width: 32 }}>←</button>
        <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 18, fontWeight: 'bold', color: GOLD }}>Checkout</h1>
        <div style={{ width: 32 }} />
      </header>

      <div style={{ padding: '16px 16px 120px' }}>

        {/* CARRINHO */}
        <div style={{ background: CARD, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={15} color={GOLD} /> Seu Carrinho
          </h2>
          {cart.map((item, idx) => (
            <div key={item.id} style={{ borderBottom: idx < cart.length - 1 ? `1px solid ${BORDER}` : 'none', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 'bold', color: '#fff' }}>{item.product.name}</p>
                  {item.option && <p style={{ fontSize: 12, color: GOLD, marginTop: 2 }}>{item.option.label}{item.option.extra_price > 0 ? ` (+R$ ${Number(item.option.extra_price).toFixed(2).replace('.', ',')})` : ''}</p>}
                  {item.drinks?.map(d => <p key={d.id} style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>+ {d.name} {d.size} x{d.quantity}</p>)}
                  {item.observations && <p style={{ fontSize: 11, color: '#3A2810', fontStyle: 'italic', marginTop: 2 }}>Obs: {item.observations}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 'bold', color: '#fff' }}>
                    R$ {(Number(item.product.price) + (item.option?.extra_price || 0) + (item.drinks?.reduce((s, d) => s + Number(d.price) * d.quantity, 0) || 0)).toFixed(2).replace('.', ',')}
                  </span>
                  <button onClick={() => removeCartItem(item.id)}
                    style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
            + Adicionar mais itens
          </button>
        </div>

        {/* DADOS PESSOAIS */}
        <div id="checkout-personal" style={{ marginBottom: 16 }}>
          {user ? (
            /* Usuário logado — exibe resumo limpo */
            <div style={{ background: CARD, borderRadius: 16, padding: 14, border: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{user.name}</p>
                {user.phone && <p style={{ fontSize: 12, color: MUTED }}>{user.phone}</p>}
                {user.email && <p style={{ fontSize: 12, color: MUTED }}>{user.email}</p>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, background: 'rgba(72,187,120,0.12)', padding: '4px 10px', borderRadius: 20 }}>
                Logado
              </span>
            </div>
          ) : (
            /* Visitante — formulário completo */
            <>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Seus Dados</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="input-field" placeholder="Nome completo *" value={form.name} onChange={e => updateForm('name', e.target.value)} />
                <input className="input-field" placeholder="Telefone com DDD *" value={form.phone} onChange={e => updateForm('phone', e.target.value)} type="tel" />
                <input className="input-field" placeholder="E-mail" value={form.email} onChange={e => updateForm('email', e.target.value)} type="email" />
                <input className="input-field" placeholder="CPF (para cupom/PIX)" value={form.cpf} onChange={e => updateForm('cpf', e.target.value)}
                  onBlur={() => { if (form.name.trim() && form.phone.trim()) scrollToStep('checkout-address'); }} />
              </div>
            </>
          )}
        </div>

        {/* ENDEREÇO */}
        <div id="checkout-address" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Endereço de Entrega</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <input className="input-field" placeholder="CEP" value={form.zipcode}
                onChange={e => updateForm('zipcode', e.target.value)} onBlur={handleCepBlur} maxLength={9} inputMode="numeric" />
              {cepLoading && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: GOLD }}>Buscando...</span>}
            </div>
            <input className="input-field" placeholder="Rua / Avenida *" value={form.street} onChange={e => updateForm('street', e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <input className="input-field" placeholder="Número *" value={form.number} onChange={e => updateForm('number', e.target.value)} />
              <input className="input-field" placeholder="Complemento" value={form.complement} onChange={e => updateForm('complement', e.target.value)} />
            </div>
            <input className="input-field" placeholder="Bairro *" value={form.neighborhood}
              onChange={e => updateForm('neighborhood', e.target.value)}
              onBlur={e => { if (e.target.value.trim()) scrollToStep(schedulingEnabled ? 'checkout-scheduling' : 'checkout-payment'); }} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <input className="input-field" placeholder="Cidade" value={form.city} onChange={e => updateForm('city', e.target.value)} />
              <input className="input-field" placeholder="Estado" value={form.state} onChange={e => updateForm('state', e.target.value)} maxLength={2} />
            </div>
          </div>
        </div>

        {/* AGENDAMENTO */}
        {schedulingEnabled && (
          <div id="checkout-scheduling" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarClock size={15} color={GOLD} /> Quando deseja receber?
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[false, true].map(val => (
                <div key={String(val)} onClick={() => { setIsScheduled(val); if (!val) { setScheduledDate(''); setSelectedSlot(''); scrollToStep('checkout-payment'); } }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: isScheduled === val ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
                    background: isScheduled === val ? 'rgba(242,168,0,0.08)' : CARD,
                  }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: isScheduled === val ? `6px solid ${GOLD}` : `2px solid ${BORDER}`, background: isScheduled === val ? BG : 'transparent' }} />
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 'bold', color: '#fff' }}>{val ? 'Agendar entrega' : 'Entrega imediata'}</p>
                    <p style={{ fontSize: 12, color: MUTED }}>{val ? 'Escolha data e horário' : 'O pedido vai para a cozinha agora'}</p>
                  </div>
                </div>
              ))}
            </div>

            {isScheduled && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: MUTED, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Data</label>
                  <input type="date" className="input-field"
                    min={getMinDate()} max={getMaxDate()}
                    value={scheduledDate}
                    onChange={e => { setScheduledDate(e.target.value); loadAvailableSlots(e.target.value); }} />
                </div>

                {scheduledDate && (
                  <div>
                    <label style={{ fontSize: 11, color: MUTED, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Horário disponível</label>
                    {loadingSlots ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13, padding: '12px 0' }}>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Verificando horários...
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <p style={{ color: RED, fontSize: 13, padding: '10px 0' }}>Nenhum horário disponível para esta data.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {availableSlots.map(slot => (
                          <button key={slot.time} onClick={() => { setSelectedSlot(slot.time); scrollToStep('checkout-payment'); }}
                            style={{
                              padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                              border: selectedSlot === slot.time ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
                              background: selectedSlot === slot.time ? 'rgba(242,168,0,0.12)' : CARD,
                              color: selectedSlot === slot.time ? GOLD : '#fff',
                            }}>
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CUPOM */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Cupom</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input-field" placeholder="Código" value={couponCode} onChange={e => setCouponCode(e.target.value)} disabled={!!couponApplied} style={{ flex: 1 }} />
            {couponApplied ? (
              <button onClick={() => { setCouponApplied(null); setCouponCode(''); }}
                style={{ padding: '0 16px', background: '#333', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                Remover
              </button>
            ) : (
              <button onClick={applyCoupon} className="btn-primary" style={{ width: 'auto', padding: '0 20px' }}>Aplicar</button>
            )}
          </div>
          {couponError && <p style={{ color: RED, fontSize: 12, marginTop: 4 }}>{couponError}</p>}
          {couponApplied && <p style={{ color: GREEN, fontSize: 12, marginTop: 4 }}>Cupom aplicado!</p>}
        </div>

        {/* CASHBACK — exibido apenas para usuários com saldo disponível */}
        {user && cashbackBalance > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
              Saldo de Cashback
            </h2>
            <div
              onClick={() => {
                const enabling = !useCashbackBalance;
                setUseCashbackBalance(enabling);
                if (enabling) { setCouponApplied(null); setCouponCode(''); } // cupom e cashback não podem ser usados juntos
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                border: useCashbackBalance ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
                background: useCashbackBalance ? 'rgba(242,168,0,0.08)' : CARD,
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: useCashbackBalance ? `6px solid ${GOLD}` : `2px solid ${BORDER}`,
                background: useCashbackBalance ? BG : 'transparent',
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Usar Saldo de Cashback</p>
                <p style={{ fontSize: 12, color: MUTED }}>
                  Disponível: R$ {cashbackBalance.toFixed(2).replace('.', ',')} · Máx. 50% do pedido
                </p>
              </div>
            </div>

            {/* Breakdown ao vivo quando cashback está ativado */}
            {useCashbackBalance && (
              <div style={{
                marginTop: 10, background: 'rgba(242,168,0,0.05)',
                border: `1px solid ${GOLD}33`, borderRadius: 12, padding: '12px 16px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED }}>
                  <span>Valor do pedido</span>
                  <span style={{ color: '#fff' }}>R$ {calcBeforeCashback().toFixed(2).replace('.', ',')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: GREEN }}>
                  <span>Desconto Cashback (máx. 50%)</span>
                  <span>− R$ {calcCashbackDiscount().toFixed(2).replace('.', ',')}</span>
                </div>
                <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: GOLD }}>
                  <span>Total a Pagar</span>
                  <span>R$ {calcTotal().toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FORMA DE PAGAMENTO — alvo do scroll após endereço preenchido */}
        <div id="checkout-payment" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Forma de Pagamento</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { id: 'pix',          Icon: Landmark,   label: 'PIX',                 desc: 'Pagamento instantâneo' },
              { id: 'card',         Icon: CreditCard,  label: 'Cartão (online)',      desc: 'Crédito ou Débito (Mercado Pago)' },
              { id: 'card_delivery',Icon: CreditCard,  label: 'Cartão na entrega',   desc: 'Maquininha na hora da entrega' },
              { id: 'cash',         Icon: Banknote,    label: 'Dinheiro',             desc: 'Pagar na entrega' },
            ].map(pm => (
              <div key={pm.id} onClick={() => { setPaymentMethod(pm.id); scrollToStep('checkout-submit'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                  border: paymentMethod === pm.id ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
                  background: paymentMethod === pm.id ? 'rgba(242,168,0,0.08)' : CARD,
                  transition: 'all 0.2s',
                }}>
                <pm.Icon size={22} color={paymentMethod === pm.id ? GOLD : MUTED} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 'bold', color: '#fff' }}>{pm.label}</p>
                  <p style={{ fontSize: 12, color: MUTED }}>{pm.desc}</p>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: paymentMethod === pm.id ? `6px solid ${GOLD}` : `2px solid ${BORDER}`,
                  background: paymentMethod === pm.id ? BG : 'transparent',
                }} />
              </div>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <div style={{ marginTop: 10 }}>
              <input className="input-field" placeholder="Troco para quanto? (opcional)" value={cashChange}
                onChange={e => setCashChange(e.target.value)} inputMode="numeric" />
            </div>
          )}
          {paymentMethod === 'card_delivery' && (
            <p style={{ marginTop: 10, fontSize: 12, color: MUTED, paddingLeft: 4 }}>
              A maquininha será levada junto com o pedido. Aceitamos débito e crédito.
            </p>
          )}
        </div>

        {/* VALORES */}
        <div style={{ background: CARD, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: MUTED, marginBottom: 8 }}>
            <span>Subtotal</span><span style={{ color: '#fff' }}>R$ {calcSubtotal().toFixed(2).replace('.', ',')}</span>
          </div>
          {deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: MUTED, marginBottom: 8 }}>
              <span>Entrega</span><span style={{ color: '#fff' }}>R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          {calcDiscount() > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span style={{ color: GREEN }}>Desconto cupom</span><span style={{ color: GREEN }}>-R$ {calcDiscount().toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          {calcCashbackDiscount() > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span style={{ color: GREEN }}>Cashback</span><span style={{ color: GREEN }}>-R$ {calcCashbackDiscount().toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 'bold', borderTop: `1px solid ${BORDER}`, paddingTop: 10, marginTop: 4 }}>
            <span style={{ color: GOLD }}>Total</span><span style={{ color: GOLD }}>R$ {calcTotal().toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        {/* ERRO PIX */}
        {pixError && (
          <div style={{ background: 'rgba(224,64,64,0.1)', border: `1px solid ${RED}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ color: RED, fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}>{pixError.error}</p>
            {pixError.details && <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.5 }}>{pixError.details}</p>}
            <button onClick={() => setPixError(null)}
              style={{ marginTop: 10, background: 'none', border: `1px solid ${RED}`, color: RED, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        )}

        {/* ERRO DE FORMULÁRIO */}
        {formError && (
          <div style={{ background: 'rgba(224,64,64,0.1)', border: `1px solid ${RED}`, borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
            <p style={{ color: RED, fontSize: 14 }}>{formError}</p>
          </div>
        )}

        {/* BOTÃO — alvo do scroll após forma de pagamento selecionada */}
        <div id="checkout-submit">
          <button className="btn-primary" onClick={handleSubmitOrder} disabled={loading || !isFormValid()}
            style={{ padding: 16, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading
              ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Processando...</>
              : paymentMethod === 'pix'
                ? <><Landmark size={18} /> Pagar com PIX</>
                : paymentMethod === 'card'
                  ? <><CreditCard size={18} /> Pagar com Cartão (online)</>
                  : paymentMethod === 'card_delivery'
                    ? <><CreditCard size={18} /> Finalizar (Cartão na Entrega)</>
                    : <><Banknote size={18} /> Finalizar Pedido (Dinheiro)</>}
          </button>
        </div>

        {/* MODAL DE CONFIRMAÇÃO DO PEDIDO */}
        {showConfirmModal && (
          <div
            role="presentation"
            onClick={() => setShowConfirmModal(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(4px)', zIndex: 100,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-order-title"
              onClick={e => e.stopPropagation()}
              style={{
                background: '#141000', borderRadius: '20px 20px 0 0',
                border: `1px solid #2C1E00`, borderBottom: 'none',
                width: '100%', maxWidth: 480, padding: '24px 20px 36px',
                animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              <h3 id="confirm-order-title" style={{
                color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 4,
                fontFamily: 'var(--font-playfair), Georgia, serif',
              }}>
                Confirmar pedido?
              </h3>
              <p style={{ color: '#7A6040', fontSize: 13, marginBottom: 20 }}>
                {form.street}, {form.number} — {form.neighborhood}
              </p>

              {/* Resumo do carrinho */}
              <div style={{ background: '#1C1500', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                {cart.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ccc', marginBottom: i < cart.length - 1 ? 6 : 0 }}>
                    <span>{item.product.name}{item.option ? ` (${item.option.label})` : ''}</span>
                    <span style={{ color: GOLD }}>R$ {(Number(item.product.price) + (item.option?.extra_price || 0)).toFixed(2).replace('.', ',')}</span>
                  </div>
                ))}
              </div>

              {/* Forma de pagamento e total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#7A6040', marginBottom: 6 }}>
                <span>Pagamento</span>
                <span style={{ color: '#ccc' }}>
                  {paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'card' ? 'Cartão online' : paymentMethod === 'card_delivery' ? 'Cartão na entrega' : 'Dinheiro'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, borderTop: '1px solid #2C1E00', paddingTop: 12, marginBottom: 20 }}>
                <span style={{ color: GOLD }}>Total</span>
                <span style={{ color: GOLD }}>R$ {calcTotal().toFixed(2).replace('.', ',')}</span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 14,
                    background: 'none', border: '1px solid #2C1E00',
                    color: '#7A6040', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Voltar
                </button>
                <button
                  onClick={doSubmitOrder}
                  style={{
                    flex: 2, padding: '14px 0', borderRadius: 14,
                    background: GOLD, border: 'none',
                    color: '#080600', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Confirmar pedido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
