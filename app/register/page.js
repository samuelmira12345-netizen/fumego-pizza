'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

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
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao cadastrar'); return; }
      localStorage.setItem('fumego_token', data.token);
      localStorage.setItem('fumego_user', JSON.stringify(data.user));
      router.push('/');
    } catch (e) { setError('Erro de conexão'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🔥</div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 'bold', color: '#D4A528', marginTop: 12 }}>Criar Conta</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Cadastre-se na FUMÊGO</p>
        </div>
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="input-field" placeholder="Nome completo" value={form.name} onChange={e => update('name', e.target.value)} required />
          <input className="input-field" type="email" placeholder="E-mail" value={form.email} onChange={e => update('email', e.target.value)} required />
          <input className="input-field" type="tel" placeholder="Telefone com DDD" value={form.phone} onChange={e => update('phone', e.target.value)} />
          <input className="input-field" type="password" placeholder="Senha (mín. 6 caracteres)" value={form.password} onChange={e => update('password', e.target.value)} required />
          <input className="input-field" type="password" placeholder="Confirmar senha" value={form.confirm} onChange={e => update('confirm', e.target.value)} required />
          {error && <p style={{ color: '#E53E3E', fontSize: 13 }}>{error}</p>}
          <button className="btn-primary" disabled={loading}>{loading ? 'Cadastrando...' : 'Criar Conta'}</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', color: '#D4A528', fontSize: 13, cursor: 'pointer' }}>Já tem conta? Entrar</button>
          <br />
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>← Voltar ao cardápio</button>
        </div>
      </div>
    </div>
  );
}
