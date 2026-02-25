'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCouponPopup, setShowCouponPopup] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    password: '',
    confirmPassword: '',
  });

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (form.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          cpf: form.cpf,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta');
        return;
      }

      localStorage.setItem('fumego_token', data.token);
      localStorage.setItem('fumego_user', JSON.stringify(data.user));

      // Mostrar popup do cupom BEMVINDO
      setShowCouponPopup(true);
    } catch (e) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function handleClosePopup() {
    setShowCouponPopup(false);
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-fumego-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <span className="text-5xl">🔥</span>
          <h1 className="font-display text-2xl font-bold text-fumego-gold mt-3">Criar Conta</h1>
          <p className="text-gray-400 text-sm mt-1">Crie sua conta e ganhe um cupom de desconto!</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <input className="input-field" placeholder="Nome completo *" value={form.name} onChange={e => updateForm('name', e.target.value)} required />
          <input className="input-field" type="email" placeholder="E-mail *" value={form.email} onChange={e => updateForm('email', e.target.value)} required />
          <input className="input-field" type="tel" placeholder="Telefone com DDD" value={form.phone} onChange={e => updateForm('phone', e.target.value)} />
          <input className="input-field" placeholder="CPF (para cupom de desconto)" value={form.cpf} onChange={e => updateForm('cpf', e.target.value)} />
          <input className="input-field" type="password" placeholder="Senha (mín. 6 caracteres) *" value={form.password} onChange={e => updateForm('password', e.target.value)} required />
          <input className="input-field" type="password" placeholder="Confirmar senha *" value={form.confirmPassword} onChange={e => updateForm('confirmPassword', e.target.value)} required />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <button onClick={() => router.push('/login')} className="text-fumego-gold text-sm hover:underline">
            Já tem conta? Fazer login
          </button>
          <br />
          <button onClick={() => router.push('/')} className="text-gray-500 text-sm hover:text-gray-300">
            ← Voltar ao cardápio
          </button>
        </div>
      </div>

      {/* POPUP DO CUPOM BEMVINDO */}
      {showCouponPopup && (
        <div className="modal-overlay" onClick={handleClosePopup}>
          <div className="modal-content text-center" onClick={e => e.stopPropagation()}>
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="font-display text-2xl font-bold text-fumego-gold mb-2">
              Conta Criada!
            </h2>
            <p className="text-gray-300 mb-6">
              Bem-vindo(a) à FUMÊGO! Aqui está seu cupom de desconto:
            </p>
            <div className="bg-fumego-black rounded-xl p-6 border-2 border-dashed border-fumego-gold mb-6">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Cupom de desconto</p>
              <p className="font-display text-3xl font-bold text-fumego-gold tracking-wider">
                BEMVINDO
              </p>
              <p className="text-sm text-fumego-gold-light mt-2">10% de desconto no seu primeiro pedido!</p>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Válido para o primeiro pedido por CPF. Use no checkout!
            </p>
            <button onClick={handleClosePopup} className="btn-primary w-full">
              Começar a Pedir! 🍕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
