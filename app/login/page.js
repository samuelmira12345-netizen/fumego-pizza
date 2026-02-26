'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao fazer login'); return; }
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
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 'bold', color: '#D4A528', marginTop: 12 }}>Entrar</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Acesse sua conta FUMÊGO</p>
        </div>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="input-field" type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input-field" type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p style={{ color: '#E53E3E', fontSize: 13 }}>{error}</p>}
          <button className="btn-primary" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => router.push('/register')} style={{ background: 'none', border: 'none', color: '#D4A528', fontSize: 13, cursor: 'pointer' }}>Não tem conta? Criar agora</button>
          <br />
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>← Voltar ao cardápio</button>
        </div>
      </div>
    </div>
  );
}
