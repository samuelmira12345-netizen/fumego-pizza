'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Loader2 } from 'lucide-react';

const GOLD   = '#F2A800';
const BG     = '#080600';
const CARD   = '#1C1500';
const BORDER = '#2C1E00';
const MUTED  = '#7A6040';

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirm: '',
    address_zipcode: '', address_street: '', address_number: '',
    address_complement: '', address_neighborhood: '', address_city: '', address_state: '',
  });
  const [loading, setLoading]     = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError]         = useState('');

  function upd(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleCepBlur() {
    const cep = form.address_zipcode.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          address_street:       data.logradouro || prev.address_street,
          address_neighborhood: data.bairro      || prev.address_neighborhood,
          address_city:         data.localidade  || prev.address_city,
          address_state:        data.uf          || prev.address_state,
        }));
      }
    } catch {}
    finally { setCepLoading(false); }
  }

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
        body: JSON.stringify({
          name: form.name, email: form.email, phone: form.phone, password: form.password,
          address_street:       form.address_street,
          address_number:       form.address_number,
          address_complement:   form.address_complement,
          address_neighborhood: form.address_neighborhood,
          address_city:         form.address_city,
          address_state:        form.address_state,
          address_zipcode:      form.address_zipcode,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao cadastrar'); return; }
      localStorage.setItem('fumego_token', data.token);
      localStorage.setItem('fumego_user', JSON.stringify(data.user));
      router.push('/');
    } catch { setError('Erro de conexão'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo / header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Flame size={44} color={GOLD} style={{ filter: 'drop-shadow(0 0 12px rgba(242,168,0,0.5))' }} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-cinzel), Cinzel, Georgia, serif',
            fontSize: 22, fontWeight: 900, color: GOLD,
            letterSpacing: 5, marginTop: 12, textShadow: '0 0 20px rgba(242,168,0,0.35)',
          }}>
            FUMÊGO
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>Crie sua conta</p>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Dados pessoais ── */}
          <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
              Dados Pessoais
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="input-field" placeholder="Nome completo *" value={form.name} onChange={e => upd('name', e.target.value)} required />
              <input className="input-field" type="email" placeholder="E-mail *" value={form.email} onChange={e => upd('email', e.target.value)} required />
              <input className="input-field" type="tel" placeholder="Telefone com DDD" value={form.phone} onChange={e => upd('phone', e.target.value)} />
              <input className="input-field" type="password" placeholder="Senha (mín. 6 caracteres) *" value={form.password} onChange={e => upd('password', e.target.value)} required />
              <input className="input-field" type="password" placeholder="Confirmar senha *" value={form.confirm} onChange={e => upd('confirm', e.target.value)} required />
            </div>
          </div>

          {/* ── Endereço ── */}
          <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
              Endereço de Entrega
            </p>
            <p style={{ fontSize: 12, color: '#3A2810', marginBottom: 12 }}>
              Opcional — pré-preenche o checkout automaticamente
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <input className="input-field" placeholder="CEP"
                  value={form.address_zipcode}
                  onChange={e => upd('address_zipcode', e.target.value)}
                  onBlur={handleCepBlur}
                  maxLength={9} inputMode="numeric" />
                {cepLoading && (
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: GOLD }}>
                    Buscando…
                  </span>
                )}
              </div>
              <input className="input-field" placeholder="Rua / Avenida" value={form.address_street} onChange={e => upd('address_street', e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <input className="input-field" placeholder="Número" value={form.address_number} onChange={e => upd('address_number', e.target.value)} />
                <input className="input-field" placeholder="Complemento" value={form.address_complement} onChange={e => upd('address_complement', e.target.value)} />
              </div>
              <input className="input-field" placeholder="Bairro" value={form.address_neighborhood} onChange={e => upd('address_neighborhood', e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <input className="input-field" placeholder="Cidade" value={form.address_city} onChange={e => upd('address_city', e.target.value)} />
                <input className="input-field" placeholder="UF" maxLength={2}
                  value={form.address_state} onChange={e => upd('address_state', e.target.value)} />
              </div>
            </div>
          </div>

          {error && <p style={{ color: '#E04040', fontSize: 13, textAlign: 'center' }}>{error}</p>}

          <button className="btn-primary" type="submit" disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cadastrando…</> : 'Criar Conta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push('/login')}
            style={{ background: 'none', border: 'none', color: GOLD, fontSize: 13, cursor: 'pointer' }}>
            Já tem conta? Entrar
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
