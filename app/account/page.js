'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2 } from 'lucide-react';

const GOLD       = '#F2A800';
const GOLD_LIGHT = '#FFD060';
const BG         = '#080600';
const CARD       = '#1C1500';
const BORDER     = '#2C1E00';
const MUTED      = '#7A6040';

// Defined OUTSIDE AccountPage to prevent unmount/remount on every render
function Section({ title, children }) {
  return (
    <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 14 }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [msg, setMsg]             = useState('');
  const [error, setError]         = useState('');

  const [form, setForm] = useState({
    name: '', email: '', phone: '', cpf: '',
    address_zipcode: '', address_street: '', address_number: '',
    address_complement: '', address_neighborhood: '', address_city: '', address_state: '',
    current_password: '', new_password: '', confirm_password: '',
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fumego_user');
      if (!raw) { router.push('/login'); return; }
      const u = JSON.parse(raw);
      setUser(u);
      setForm(prev => ({
        ...prev,
        name:                 u.name                 || '',
        email:                u.email                || '',
        phone:                u.phone                || '',
        cpf:                  u.cpf                  || '',
        address_zipcode:      u.address_zipcode      || '',
        address_street:       u.address_street       || '',
        address_number:       u.address_number       || '',
        address_complement:   u.address_complement   || '',
        address_neighborhood: u.address_neighborhood || '',
        address_city:         u.address_city         || '',
        address_state:        u.address_state        || '',
      }));
    } catch { router.push('/login'); }
  }, []);

  function upd(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleCepBlur(e) {
    // Usa e.target.value diretamente para evitar closure stale com estado React
    const rawValue = e?.target?.value ?? form.address_zipcode;
    const cep = rawValue.replace(/\D/g, '');
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

  async function handleSave(e) {
    e.preventDefault();
    setMsg(''); setError('');
    if (form.new_password && form.new_password !== form.confirm_password) {
      setError('As novas senhas não coincidem'); return;
    }
    setLoading(true);
    try {
      // JWT enviado via cookie httpOnly (sem precisar do token no body)
      const body = {
        name:  form.name,  email: form.email,
        phone: form.phone, cpf:   form.cpf,
        address_street:       form.address_street,
        address_number:       form.address_number,
        address_complement:   form.address_complement,
        address_neighborhood: form.address_neighborhood,
        address_city:         form.address_city,
        address_state:        form.address_state,
        address_zipcode:      form.address_zipcode,
      };
      if (form.new_password) {
        body.current_password = form.current_password;
        body.new_password     = form.new_password;
      }
      const res  = await fetch('/api/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // envia cookie httpOnly automaticamente
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao salvar'); return; }
      localStorage.setItem('fumego_user', JSON.stringify(data.user));
      setUser(data.user);
      setForm(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
      setMsg('Dados salvos com sucesso!');
      setTimeout(() => setMsg(''), 4000);
    } catch { setError('Erro de conexão'); }
    finally { setLoading(false); }
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      {/* Header */}
      <header className="header" style={{ justifyContent: 'space-between' }}>
        <button onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: GOLD, fontSize: 22, cursor: 'pointer', width: 32 }}>
          ←
        </button>
        <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 18, fontWeight: 700, color: GOLD }}>
          Minha Conta
        </h1>
        <div style={{ width: 32 }} />
      </header>

      {/* Avatar */}
      <div style={{ textAlign: 'center', padding: '28px 0 16px' }}>
        <div style={{
          width: 68, height: 68, borderRadius: '50%', margin: '0 auto',
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 900, color: BG,
          boxShadow: `0 0 24px rgba(242,168,0,0.4)`,
        }}>
          {user.name?.charAt(0).toUpperCase()}
        </div>
        <p style={{ color: '#fff', fontWeight: 700, marginTop: 10, fontSize: 16 }}>{user.name}</p>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{user.email}</p>
      </div>

      <form onSubmit={handleSave} style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Dados Pessoais */}
        <Section title="Dados Pessoais">
          <input className="input-field" placeholder="Nome completo *"
            value={form.name} onChange={e => upd('name', e.target.value)} required />
          <input className="input-field" type="email" placeholder="E-mail *"
            value={form.email} onChange={e => upd('email', e.target.value)} required />
          <input className="input-field" type="tel" placeholder="Telefone com DDD"
            value={form.phone} onChange={e => upd('phone', e.target.value)} />
          <input className="input-field" placeholder="CPF"
            value={form.cpf} onChange={e => upd('cpf', e.target.value)} />
        </Section>

        {/* Endereço Padrão */}
        <Section title="Endereço Padrão de Entrega">
          <p style={{ color: '#3A2810', fontSize: 12, marginTop: -4, marginBottom: 4 }}>
            Preenchido automaticamente no checkout
          </p>
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
          <input className="input-field" placeholder="Rua / Avenida"
            value={form.address_street} onChange={e => upd('address_street', e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <input className="input-field" placeholder="Número"
              value={form.address_number} onChange={e => upd('address_number', e.target.value)} />
            <input className="input-field" placeholder="Complemento"
              value={form.address_complement} onChange={e => upd('address_complement', e.target.value)} />
          </div>
          <input className="input-field" placeholder="Bairro"
            value={form.address_neighborhood} onChange={e => upd('address_neighborhood', e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <input className="input-field" placeholder="Cidade"
              value={form.address_city} onChange={e => upd('address_city', e.target.value)} />
            <input className="input-field" placeholder="UF" maxLength={2}
              value={form.address_state} onChange={e => upd('address_state', e.target.value)} />
          </div>
        </Section>

        {/* Alterar Senha */}
        <Section title="Alterar Senha">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -4, marginBottom: 4 }}>
            <p style={{ color: '#3A2810', fontSize: 12, margin: 0 }}>
              Preencha apenas se quiser trocar a senha
            </p>
            <button type="button" onClick={() => router.push('/forgot-password')}
              style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer', padding: 0 }}>
              Esqueceu a senha?
            </button>
          </div>
          <input className="input-field" type="password" placeholder="Senha atual"
            value={form.current_password} onChange={e => upd('current_password', e.target.value)} />
          <input className="input-field" type="password" placeholder="Nova senha (mín. 6 caracteres)"
            value={form.new_password} onChange={e => upd('new_password', e.target.value)} />
          <input className="input-field" type="password" placeholder="Confirmar nova senha"
            value={form.confirm_password} onChange={e => upd('confirm_password', e.target.value)} />
        </Section>

        {/* Feedback */}
        {error && (
          <p style={{ color: '#E04040', fontSize: 13, textAlign: 'center' }}>{error}</p>
        )}
        {msg && (
          <p style={{ color: '#48BB78', fontSize: 13, textAlign: 'center' }}>{msg}</p>
        )}

        <button className="btn-primary" type="submit" disabled={loading}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading
            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Salvando…</>
            : <><Save size={16} /> Salvar Alterações</>}
        </button>
      </form>
    </div>
  );
}
