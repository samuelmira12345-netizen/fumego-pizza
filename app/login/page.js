'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
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

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login');
        return;
      }

      localStorage.setItem('fumego_token', data.token);
      localStorage.setItem('fumego_user', JSON.stringify(data.user));
      router.push('/');
    } catch (e) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-fumego-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <span className="text-5xl">🔥</span>
          <h1 className="font-display text-2xl font-bold text-fumego-gold mt-3">Entrar</h1>
          <p className="text-gray-400 text-sm mt-1">Acesse sua conta FUMÊGO</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            className="input-field"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            className="input-field"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <button
            onClick={() => router.push('/register')}
            className="text-fumego-gold text-sm hover:underline"
          >
            Não tem conta? Criar agora
          </button>
          <br />
          <button
            onClick={() => router.push('/')}
            className="text-gray-500 text-sm hover:text-gray-300"
          >
            ← Voltar ao cardápio
          </button>
        </div>
      </div>
    </div>
  );
}
