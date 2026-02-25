'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCoupon, setShowCoupon] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', cpf: '', password: '', confirm: '' });

  function up(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Senhas não coincidem'); return; }
    if (form.password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, cpf: form.cpf, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao criar conta'); return; }
      localStorage.setItem('fumego_token', data.token);
      localStorage.setItem('fumego_user', JSON.stringify(data.user));
      setShowCoupon(true);
    } catch (e) { setError('Erro de conexão'); } finally { setLoading(false); }
  }

  if (showCoupon) {
    return (
      <div style={{ minHeight: '100vh', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>🎉</div>
          <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 'bold', color: '#D4A528', marginBottom: 8 }}>Conta Criada!</h2>
          <p style={{ color: '#ccc', marginBottom: 24, fontSize: 14 }}>Bem-vindo(a) à FUMÊGO! Seu cupom:</p>
          <div style={{ background: '#2D2D2D', border: '2px dashed #D4A528', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Cupom de desconto</p>
            <p style={{ fontFamily: 'Georgia,serif', fontSize: 32, fontWeight: 'bold', color: '#D4A528', letterSpacing: 3 }}>BEMVINDO</p>
            <p style={{ fontSize: 13, color: '#E8C547', marginTop: 8 }}>10% de desconto no 1º pedido!</p>
          </div>
          <button className="btn-primary" onClick={() => router.push('/')}>Começar a Pedir! 🍕</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>🔥</div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 'bold', color: '#D4A528', marginTop: 12 }}>Criar Conta</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Ganhe um cupom de desconto!</p>
        </div>
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input-field" placeholder="Nome completo *" value={form.name} onChange={e => up('name', e.target.value)} required />
          <input className="input-field" type="email" placeholder="E-mail *" value={form.email} onChange={e => up('email', e.target.value)} required />
          <input className="input-field" type="tel" placeholder="Telefone" value={form.phone} onChange={e => up('phone', e.target.value)} />
          <input className="input-field" placeholder="CPF (para cupom)" value={form.cpf} onChange={e => up('cpf', e.target.value)} />
          <input className="input-field" type="password" placeholder="Senha (mín 6 caract.) *" value={form.password} onChange={e => up('password', e.target.value)} required />
          <input className="input-field" type="password" placeholder="Confirmar senha *" value={form.confirm} onChange={e => up('confirm', e.target.value)} required />
          {error && <p style={{ color: '#E53E3E', fontSize: 13 }}>{error}</p>}
          <button className="btn-primary" disabled={loading}>{loading ? 'Criando...' : 'Criar Conta'}</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', color: '#D4A528', fontSize: 13, cursor: 'pointer' }}>Já tem conta? Entrar</button>
          <br />
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>← Voltar</button>
        </div>
      </div>
    </div>
  );
}
