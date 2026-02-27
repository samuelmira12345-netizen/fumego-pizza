'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Loader2 } from 'lucide-react';

const GOLD   = '#F2A800';
const BG     = '#080600';
const CARD   = '#1C1500';
const BORDER = '#2C1E00';
const MUTED  = '#7A6040';

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
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo / header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Flame size={48} color={GOLD} style={{ filter: 'drop-shadow(0 0 12px rgba(242,168,0,0.5))' }} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-cinzel), Cinzel, Georgia, serif',
            fontSize: 22, fontWeight: 900, color: GOLD,
            letterSpacing: 5, marginTop: 12, textShadow: '0 0 20px rgba(242,168,0,0.35)',
          }}>
            FUMÊGO
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>Acesse sua conta</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="input-field" type="email" placeholder="E-mail"
            value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input-field" type="password" placeholder="Senha"
            value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p style={{ color: '#E04040', fontSize: 13 }}>{error}</p>}
          <div style={{ textAlign: 'right' }}>
            <button type="button" onClick={() => router.push('/forgot-password')}
              style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer', padding: 0 }}>
              Esqueceu a senha?
            </button>
          </div>
          <button className="btn-primary" disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Entrando…</> : 'Entrar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push('/register')}
            style={{ background: 'none', border: 'none', color: GOLD, fontSize: 13, cursor: 'pointer' }}>
            Não tem conta? Criar agora
          </button>
          <button onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer' }}>
            ← Voltar ao cardápio
          </button>
        </div>
      </div>
    </div>
  );
}
