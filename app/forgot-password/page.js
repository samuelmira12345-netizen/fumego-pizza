'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Loader2 } from 'lucide-react';

const GOLD   = '#F2A800';
const BG     = '#080600';
const CARD   = '#1C1500';
const BORDER = '#2C1E00';
const MUTED  = '#7A6040';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao enviar e-mail'); return; }
      setSent(true);
    } catch { setError('Erro de conexão'); }
    finally { setLoading(false); }
  }

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
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>Recuperação de senha</p>
        </div>

        <div style={{ background: CARD, borderRadius: 16, padding: 20, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p style={{ color: '#48BB78', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>E-mail enviado!</p>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6 }}>
                Se este e-mail estiver cadastrado, você receberá em breve um link para redefinir sua senha. Verifique também a caixa de spam.
              </p>
            </div>
          ) : (
            <>
              <p style={{ color: MUTED, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                Digite seu e-mail cadastrado e enviaremos um link para você criar uma nova senha.
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  className="input-field"
                  type="email"
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                {error && <p style={{ color: '#E04040', fontSize: 13 }}>{error}</p>}
                <button className="btn-primary" type="submit" disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Enviando…</>
                    : 'Enviar link de recuperação'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push('/login')}
            style={{ background: 'none', border: 'none', color: GOLD, fontSize: 13, cursor: 'pointer' }}>
            ← Voltar ao login
          </button>
        </div>
      </div>
    </div>
  );
}
