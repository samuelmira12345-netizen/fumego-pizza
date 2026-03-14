'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Flame, Loader2 } from 'lucide-react';

const GOLD   = '#F2A800';
const BG     = '#080600';
const CARD   = '#1C1500';
const BORDER = '#2C1E00';
const MUTED  = '#7A6040';

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token') || '';

  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [done, setDone]                       = useState(false);
  const [error, setError]                     = useState('');

  useEffect(() => {
    if (!token) setError('Link inválido ou expirado. Solicite um novo.');
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem'); return; }
    if (newPassword.length < 6) { setError('A senha deve ter pelo menos 6 caracteres'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao redefinir senha'); return; }
      setDone(true);
    } catch { setError('Erro de conexão'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ background: CARD, borderRadius: 16, padding: 20, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <p style={{ color: '#48BB78', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Senha redefinida!</p>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            Sua senha foi alterada com sucesso. Você já pode fazer login com a nova senha.
          </p>
          <button className="btn-primary" onClick={() => router.push('/login')}>
            Ir para o login
          </button>
        </div>
      ) : (
        <>
          <p style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>
            Digite e confirme sua nova senha.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              className="input-field"
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              disabled={!token}
            />
            <input
              className="input-field"
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              disabled={!token}
            />
            {error && <p style={{ color: '#E04040', fontSize: 13 }}>{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading || !token}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Redefinindo…</>
                : 'Redefinir senha'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

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
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>Redefinir senha</p>
        </div>

        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>

        <div style={{ textAlign: 'center' }}>
          <button onClick={() => router.push('/login')}
            style={{ background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer' }}>
            ← Voltar ao login
          </button>
        </div>
      </div>
    </div>
  );
}
