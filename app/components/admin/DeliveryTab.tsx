'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Plus, Loader2, X, Trash2, RefreshCw, Save, Edit2,
  User, Phone, Mail, Lock, MapPin, Clock, Truck,
  DollarSign, ChevronDown, ChevronUp, Check, Eye, EyeOff,
  Navigation, AlertTriangle, BarChart2, ThumbsUp, ThumbsDown,
  Timer, PackageCheck, AlertCircle, Flame,
} from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import { clientError } from '../../../lib/client-logger';

// Leaflet requires browser APIs — load only on client side
const DeliveryZoneMap = dynamic(() => import('./DeliveryZoneMap'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 420, background: '#EEF4EE' }}>
      <Loader2 size={24} color="#22C55E" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  ),
});

const DriverTrackingMap = dynamic(() => import('./DriverTrackingMap'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 480, background: '#EEF8FF' }}>
      <Loader2 size={24} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  ),
});

const DeliveryHeatMap = dynamic(() => import('./DeliveryHeatMap'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 480, background: '#EEF4EE', borderRadius: 8 }}>
      <Loader2 size={24} color="#10B981" className="animate-spin" />
    </div>
  ),
});

const C = {
  bg: '#F4F5F7', card: '#fff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  gold: '#F2A800', success: '#10B981', danger: '#EF4444',
  purple: '#7C3AED', blue: '#2563EB',
};

function fmtBRL(v: any) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: any) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
}

function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function daysAgoSP(n: any) {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

const BLANK_PERSON = { name: '', phone: '', email: '', password: '', is_active: true };
const BLANK_ZONE   = { neighborhood: '', city: '', fee: '', estimated_mins: '30', is_active: true, sort_order: '0' };

// ── Shared fetch helper ───────────────────────────────────────────────────────

async function adminPost(action: any, data: any, token: any) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ action, data }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro desconhecido');
  return json;
}

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'persons',  label: 'Entregadores', icon: User },
  { key: 'zones',    label: 'Zonas',        icon: MapPin },
  { key: 'tracking', label: 'Localização',  icon: Navigation },
  { key: 'metrics',  label: 'Métricas',     icon: DollarSign },
  { key: 'analysis', label: 'Análise',      icon: BarChart2 },
];

// ═════════════════════════════════════════════════════════════════════════════
// Persons Tab
// ═════════════════════════════════════════════════════════════════════════════

function PersonsTab({ adminToken }: { adminToken: any }) {
  const [persons, setPersons]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [form, setForm]                 = useState<any>(null); // null = closed, {} = new, {id,...} = edit
  const [showHistory, setShowHistory]   = useState<any>(null); // person id
  const [history, setHistory]           = useState<any[]>([]);
  const [histLoading, setHistLoading]   = useState(false);
  const [showPwd, setShowPwd]           = useState(false);
  const [msg, setMsg]                   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await adminPost('get_delivery_persons', {}, adminToken);
      setPersons(j.persons || []);
    } catch (e) { clientError(e); }
    finally { setLoading(false); }
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.name || !form.email) { setMsg('Nome e email são obrigatórios'); return; }
    if (!form.id && !form.password) { setMsg('Senha obrigatória para novo entregador'); return; }
    setSaving(true);
    setMsg('');
    try {
      await adminPost('save_delivery_person', form, adminToken);
      setMsg('✅ Salvo com sucesso!');
      setForm(null);
      load();
    } catch (e) { setMsg('Erro: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleActive(person: any) {
    try {
      await adminPost('save_delivery_person', { ...person, is_active: !person.is_active }, adminToken);
      load();
    } catch (e) { alert('Erro: ' + (e as Error).message); }
  }

  async function deletePerson(id: any) {
    if (!confirm('Desativar este entregador?')) return;
    try {
      await adminPost('delete_delivery_person', { id }, adminToken);
      load();
    } catch (e) { alert('Erro: ' + (e as Error).message); }
  }

  async function loadHistory(personId: any) {
    if (showHistory === personId) { setShowHistory(null); return; }
    setShowHistory(personId);
    setHistLoading(true);
    try {
      const j = await adminPost('get_delivery_history', { person_id: personId }, adminToken);
      setHistory(j.orders || []);
    } catch (e) { clientError(e); }
    finally { setHistLoading(false); }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Entregadores</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnGhost}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={() => { setForm({ ...BLANK_PERSON }); setMsg(''); }} style={btnPrimary}>
            <Plus size={14} /> Novo
          </button>
        </div>
      </div>

      {/* Form */}
      {form && (
        <div style={{ background: '#F9FAFB', border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>
              {form.id ? 'Editar Entregador' : 'Novo Entregador'}
            </h4>
            <button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Nome *</label>
              <input style={inputStyle} placeholder="Nome completo" value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Telefone</label>
              <input style={inputStyle} placeholder="(11) 99999-9999" value={form.phone || ''} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} type="email" placeholder="email@exemplo.com" value={form.email || ''} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>{form.id ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 36 }}
                  type={showPwd ? 'text' : 'password'}
                  placeholder={form.id ? 'Nova senha…' : 'Senha de acesso'}
                  value={form.password || ''}
                  onChange={e => setForm((f: any) => ({ ...f, password: e.target.value }))}
                />
                <button
                  onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: C.text }}>
              <input type="checkbox" checked={!!form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} />
              Ativo
            </label>
          </div>
          {msg && <p style={{ fontSize: 12, color: msg.startsWith('✅') ? C.success : C.danger, marginBottom: 10 }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
              {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando…</> : <><Save size={13} /> Salvar</>}
            </button>
            <button onClick={() => setForm(null)} style={btnGhost}>Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <Loader2 size={22} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : persons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: C.muted, fontSize: 14 }}>
          Nenhum entregador cadastrado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {persons.map(p => (
            <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: p.is_active ? '#EFF6FF' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={18} color={p.is_active ? C.blue : C.light} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{p.name}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700,
                      background: p.is_active ? '#D1FAE5' : '#F3F4F6',
                      color: p.is_active ? '#065F46' : C.muted,
                    }}>
                      {p.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                    {p.phone && <span style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} /> {p.phone}</span>}
                    {p.email && <span style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={11} /> {p.email}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => loadHistory(p.id)}
                    title="Histórico"
                    style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }}
                  >
                    {showHistory === p.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Histórico
                  </button>
                  <button
                    onClick={() => { setForm({ id: p.id, name: p.name, phone: p.phone || '', email: p.email || '', password: '', is_active: p.is_active }); setMsg(''); }}
                    title="Editar"
                    style={{ ...btnGhost, padding: '5px 9px' }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => deletePerson(p.id)}
                    title="Desativar"
                    style={{ ...btnGhost, padding: '5px 9px', color: C.danger, borderColor: '#FECACA' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* History panel */}
              {showHistory === p.id && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px', background: '#FAFAFA' }}>
                  {histLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                      <Loader2 size={18} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : history.length === 0 ? (
                    <p style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>Nenhuma entrega encontrada.</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Últimas entregas</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.success }}>
                          Ganho em taxas: {fmtBRL(history.filter(o => o.status === 'delivered').reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0))}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {history.slice(0, 20).map(o => (
                          <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
                            <div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>#{o.order_number}</span>
                              <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{o.customer_name}</span>
                              {o.delivery_neighborhood && <span style={{ fontSize: 11, color: C.light, marginLeft: 6 }}>· {o.delivery_neighborhood}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{
                                fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 700,
                                background: o.status === 'delivered' ? '#D1FAE5' : '#FEF3C7',
                                color: o.status === 'delivered' ? '#065F46' : '#92400E',
                              }}>
                                {o.status === 'delivered' ? 'Entregue' : 'Em andamento'}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Pedido {fmtBRL(o.total)}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>Taxa {fmtBRL(o.delivery_fee)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Zones Tab
// ═════════════════════════════════════════════════════════════════════════════

const RING_COLORS = ['#15803D', '#22C55E', '#4ADE80', '#86EFAC', '#BBF7D0'];

function ZonesTab({ adminToken }: { adminToken: any }) {
  const [originAddress, setOriginAddress] = useState({
    zipcode: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    complement: '',
  });
  const [originCoords, setOriginCoords] = useState({ lat: '', lng: '' });
  const [rules, setRules] = useState([{ radius_km: '3', fee: '5', estimated_mins: '35', is_active: true }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await adminPost('get_data', {}, adminToken);
      const settings = j.settings || [];
      const map: Record<string, any> = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));
      let details = null;
      if (map.delivery_origin_address_details) {
        try {
          const parsed = JSON.parse(map.delivery_origin_address_details);
          if (parsed && typeof parsed === 'object') details = parsed;
        } catch {}
      }
      if (!details && map.delivery_origin_address) {
        const parts = String(map.delivery_origin_address).split(',').map(p => p.trim()).filter(Boolean);
        details = {
          street: parts[0] || '',
          number: parts[1] || '',
          neighborhood: parts[2] || '',
          city: parts[3] || '',
          state: '',
          zipcode: '',
          complement: '',
        };
      }
      setOriginAddress(prev => ({ ...prev, ...(details || {}) }));
      if (map.delivery_origin_lat && map.delivery_origin_lng) {
        setOriginCoords({ lat: map.delivery_origin_lat, lng: map.delivery_origin_lng });
      }
      if (map.delivery_radius_rules) {
        try {
          const parsed = JSON.parse(map.delivery_radius_rules);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRules(parsed.map(r => ({
              radius_km: String(r.radius_km ?? ''),
              fee: String(r.fee ?? ''),
              estimated_mins: String(r.estimated_mins ?? '40'),
              is_active: r.is_active !== false,
            })));
          }
        } catch {}
      }
    } catch (e) { clientError(e); }
    finally { setLoading(false); }
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  function addRule() {
    setRules(prev => [...prev, { radius_km: '', fee: '', estimated_mins: '40', is_active: true }]);
  }

  function updateOrigin(field: any, value: any) {
    setOriginAddress(prev => ({ ...prev, [field]: value }));
  }

  function buildOriginAddressLine(address: any) {
    return [
      `${address.street || ''}${address.number ? `, ${address.number}` : ''}`,
      address.complement,
      address.neighborhood,
      address.city,
      address.state,
      address.zipcode,
    ].filter(Boolean).join(', ');
  }

  function updateRule(index: any, patch: any) {
    setRules(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRule(index: any) {
    setRules(prev => prev.filter((_, i) => i !== index));
  }

  const manualCoordsValid = Number.isFinite(parseFloat(originCoords.lat)) && parseFloat(originCoords.lat) !== 0
    && Number.isFinite(parseFloat(originCoords.lng)) && parseFloat(originCoords.lng) !== 0;

  async function saveRadiusConfig() {
    // If no manual coords, require full store address for geocoding
    if (!manualCoordsValid) {
      const requiredStoreFields = [
        ['zipcode', 'CEP'],
        ['street', 'Rua/Avenida'],
        ['number', 'Número'],
        ['neighborhood', 'Bairro'],
        ['city', 'Cidade'],
        ['state', 'UF'],
      ];
      const missing = requiredStoreFields
        .filter(([field]) => !String((originAddress as any)[field] || '').trim())
        .map(([, label]) => label);
      if (missing.length > 0) {
        setMsg(`Preencha o endereço completo da loja ou informe as coordenadas manualmente: ${missing.join(', ')}`);
        return;
      }
    }

    const cleaned = rules
      .map(r => ({
        radius_km: parseFloat(r.radius_km),
        fee: parseFloat(r.fee),
        estimated_mins: parseInt(r.estimated_mins, 10) || 40,
        is_active: r.is_active !== false,
      }))
      .filter(r => Number.isFinite(r.radius_km) && r.radius_km > 0 && Number.isFinite(r.fee));

    if (cleaned.length === 0) { setMsg('Cadastre ao menos 1 faixa de raio válida'); return; }

    cleaned.sort((a, b) => a.radius_km - b.radius_km);

    setSaving(true);
    setMsg('');
    try {
      const normalizedStoreAddress = {
        ...originAddress,
        zipcode: String(originAddress.zipcode || '').replace(/\D/g, ''),
        state: String(originAddress.state || '').trim().toUpperCase(),
      };
      await adminPost('save_setting', { key: 'delivery_origin_address_details', value: JSON.stringify(normalizedStoreAddress) }, adminToken);
      await adminPost('save_setting', { key: 'delivery_origin_address', value: buildOriginAddressLine(normalizedStoreAddress) }, adminToken);
      await adminPost('save_setting', { key: 'delivery_radius_rules', value: JSON.stringify(cleaned) }, adminToken);

      if (manualCoordsValid) {
        // Manual coords take priority — save directly without geocoding
        const lat = parseFloat(originCoords.lat);
        const lng = parseFloat(originCoords.lng);
        await adminPost('save_setting', { key: 'delivery_origin_lat', value: String(lat) }, adminToken);
        await adminPost('save_setting', { key: 'delivery_origin_lng', value: String(lng) }, adminToken);
        setMsg(`✅ Configuração salva! Coordenadas manuais: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      } else {
        // Geocode store address and cache lat/lng
        setMsg('Salvando... Geocodificando endereço da loja...');
        try {
          const geoRes = await fetch('/api/delivery/geocode-store', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(normalizedStoreAddress),
          });
          const geoData = await geoRes.json();
          if (geoData.lat && geoData.lng) {
            await adminPost('save_setting', { key: 'delivery_origin_lat', value: String(geoData.lat) }, adminToken);
            await adminPost('save_setting', { key: 'delivery_origin_lng', value: String(geoData.lng) }, adminToken);
            setOriginCoords({ lat: String(geoData.lat), lng: String(geoData.lng) });
            setMsg(`✅ Configuração salva! Coordenadas geocodificadas: ${geoData.lat.toFixed(6)}, ${geoData.lng.toFixed(6)}`);
          } else {
            setMsg('Configuração salva, mas não foi possível geocodificar o endereço. O sistema tentará novamente no próximo cálculo de frete.');
          }
        } catch {
          setMsg('Configuração salva, mas erro ao geocodificar. O sistema tentará novamente no próximo cálculo de frete.');
        }
      }
    } catch (e) {
      setMsg('Erro: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function clearCoords() {
    try {
      await adminPost('save_setting', { key: 'delivery_origin_lat', value: '' }, adminToken);
      await adminPost('save_setting', { key: 'delivery_origin_lng', value: '' }, adminToken);
      setOriginCoords({ lat: '', lng: '' });
      setMsg('Coordenadas removidas. O sistema geocodificará o endereço automaticamente no próximo salvamento.');
    } catch (e) {
      setMsg('Erro ao limpar coordenadas: ' + (e as Error).message);
    }
  }

  const [addressOpen, setAddressOpen] = useState(!manualCoordsValid);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Zonas por Raio</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnGhost}><RefreshCw size={14} /> Atualizar</button>
          <button onClick={saveRadiusConfig} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando…</> : <><Save size={13} /> Salvar</>}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: msg.startsWith('✅') ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msg.startsWith('✅') ? '#86EFAC' : '#FECACA'}`, fontSize: 12, color: msg.startsWith('✅') ? '#15803D' : C.danger }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader2 size={24} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* ── Main panel: map + zone list ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14, minHeight: 420 }}>

            {/* Map side */}
            <div style={{ position: 'relative', minHeight: 420 }}>
              <DeliveryZoneMap rules={rules} originCoords={originCoords} />
              {!manualCoordsValid && (
                <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '6px 14px', fontSize: 11, color: '#92400E', fontWeight: 600, zIndex: 1000, whiteSpace: 'nowrap', border: '1px solid #FDE68A', pointerEvents: 'none' }}>
                  ⚠ Configure as coordenadas da loja para ver os raios no mapa correto
                </div>
              )}
            </div>

            {/* Zone list side */}
            <div style={{ borderLeft: `1px solid ${C.border}`, background: '#fff', display: 'flex', flexDirection: 'column' }}>
              {/* Panel header */}
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: '#F9FAFB' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Zonas de entrega</p>
                <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{rules.filter(r => r.is_active !== false && parseFloat(r.radius_km) > 0).length} zona(s) ativa(s)</p>
              </div>

              {/* Zone cards */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rules.length === 0 ? (
                  <p style={{ fontSize: 12, color: C.light, textAlign: 'center', padding: '20px 0' }}>Nenhuma zona cadastrada</p>
                ) : (
                  rules.map((r, i) => {
                    const km     = parseFloat(r.radius_km);
                    const active = r.is_active !== false;
                    const color  = RING_COLORS[i % RING_COLORS.length];
                    return (
                      <div key={`zone-${i}`} style={{ border: `1px solid ${active ? '#D1FAE5' : C.border}`, borderRadius: 10, padding: '10px 12px', background: active ? '#F0FDF4' : '#F9FAFB' }}>
                        {/* Top: indicator + radius + toggle + delete */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: active ? color : '#D1D5DB', border: `2px solid ${active ? color : '#9CA3AF'}`, flexShrink: 0 }} />
                          <input
                            type="number" min="0.1" step="0.1"
                            value={r.radius_km}
                            onChange={e => updateRule(i, { radius_km: e.target.value })}
                            placeholder="km"
                            style={{ ...inputStyle, padding: '5px 7px', fontSize: 13, fontWeight: 700, width: 60, textAlign: 'center', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>km</span>
                          <div style={{ flex: 1 }} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted, cursor: 'pointer' }}>
                            <input type="checkbox" checked={active} onChange={e => updateRule(i, { is_active: e.target.checked })} style={{ width: 13, height: 13 }} />
                            Ativa
                          </label>
                          <button onClick={() => removeRule(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FCA5A5', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {/* Bottom: fee + time */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <div>
                            <label style={{ ...labelStyle, marginBottom: 3, fontSize: 9 }}>Taxa R$</label>
                            <input
                              type="number" min="0" step="0.5"
                              value={r.fee}
                              onChange={e => updateRule(i, { fee: e.target.value })}
                              placeholder="0,00"
                              style={{ ...inputStyle, padding: '5px 7px', fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, marginBottom: 3, fontSize: 9 }}>Tempo (min)</label>
                            <input
                              type="number" min="5" step="5"
                              value={r.estimated_mins}
                              onChange={e => updateRule(i, { estimated_mins: e.target.value })}
                              placeholder="30"
                              style={{ ...inputStyle, padding: '5px 7px', fontSize: 12 }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add zone button */}
              <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}` }}>
                <button onClick={addRule} style={{ ...btnGhost, width: '100%', justifyContent: 'center', background: '#F0FDF4', borderColor: '#86EFAC', color: '#15803D', fontWeight: 700 }}>
                  <Plus size={14} /> Nova zona
                </button>
              </div>
            </div>
          </div>

          {/* ── Address / coords config — collapsible ───────────────────── */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
            <button
              onClick={() => setAddressOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', background: '#F9FAFB', border: 'none', cursor: 'pointer', borderBottom: addressOpen ? `1px solid ${C.border}` : 'none' }}
            >
              <MapPin size={14} color={C.gold} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1, textAlign: 'left' }}>
                Endereço e coordenadas da loja
              </span>
              {manualCoordsValid && (
                <span style={{ fontSize: 10, background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                  Coordenadas ativas
                </span>
              )}
              {addressOpen ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
            </button>

            {addressOpen && (
              <div style={{ padding: 16, background: C.card }}>
                <p style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                  O sistema calcula a distância do pedido a partir deste endereço e aplica a taxa da zona correspondente no checkout.
                </p>

                {/* Address fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>CEP *</label>
                    <input style={inputStyle} placeholder="00000-000" value={originAddress.zipcode} onChange={e => updateOrigin('zipcode', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>UF *</label>
                    <input style={inputStyle} placeholder="MG" maxLength={2} value={originAddress.state} onChange={e => updateOrigin('state', e.target.value.toUpperCase())} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Rua / Avenida *</label>
                    <input style={inputStyle} placeholder="Ex: Av. Brasil" value={originAddress.street} onChange={e => updateOrigin('street', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Número *</label>
                    <input style={inputStyle} placeholder="Ex: 123" value={originAddress.number} onChange={e => updateOrigin('number', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Complemento</label>
                    <input style={inputStyle} placeholder="Sala, loja, referência" value={originAddress.complement} onChange={e => updateOrigin('complement', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Bairro *</label>
                    <input style={inputStyle} placeholder="Ex: Centro" value={originAddress.neighborhood} onChange={e => updateOrigin('neighborhood', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Cidade *</label>
                    <input style={inputStyle} placeholder="Ex: Belo Horizonte" value={originAddress.city} onChange={e => updateOrigin('city', e.target.value)} />
                  </div>
                </div>

                {/* Manual coordinates */}
                <div style={{ background: manualCoordsValid ? '#F0FDF4' : '#F9FAFB', border: `1px solid ${manualCoordsValid ? '#86EFAC' : C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: manualCoordsValid ? '#15803D' : C.text }}>
                        Coordenadas manuais (opcional)
                        {manualCoordsValid && <span style={{ marginLeft: 8, fontSize: 10, background: '#DCFCE7', color: '#15803D', padding: '1px 7px', borderRadius: 10 }}>PRIORIDADE ATIVA</span>}
                      </p>
                      <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {manualCoordsValid ? 'Usadas no cálculo de distância.' : 'Se preenchidas, têm prioridade sobre o endereço.'}
                      </p>
                    </div>
                    {manualCoordsValid && (
                      <button onClick={clearCoords} style={{ ...btnGhost, fontSize: 11, padding: '5px 10px', color: C.danger, borderColor: '#FECACA' }}>
                        <X size={12} /> Limpar
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Latitude</label>
                      <input style={{ ...inputStyle, borderColor: manualCoordsValid ? '#86EFAC' : C.border }} type="number" step="any" placeholder="Ex: -19.920557" value={originCoords.lat} onChange={e => setOriginCoords(prev => ({ ...prev, lat: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Longitude</label>
                      <input style={{ ...inputStyle, borderColor: manualCoordsValid ? '#86EFAC' : C.border }} type="number" step="any" placeholder="Ex: -43.938545" value={originCoords.lng} onChange={e => setOriginCoords(prev => ({ ...prev, lng: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tracking Tab
// ═════════════════════════════════════════════════════════════════════════════

function TrackingTab({ adminToken }: { adminToken: any }) {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lastUpdate, setLastUpdate] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await adminPost('get_driver_locations', {}, adminToken);
      setLocations(j.locations || []);
      setLastUpdate(new Date());
    } catch (e) { clientError(e); }
    finally { setLoading(false); }
  }, [adminToken]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const DRIVER_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#BE185D'];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Localização dos Entregadores</h3>
          {lastUpdate && (
            <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · atualiza a cada 30s
            </p>
          )}
        </div>
        <button onClick={load} disabled={loading} style={{ ...btnGhost, opacity: loading ? 0.5 : 1 }}>
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Atualizar
        </button>
      </div>

      {loading && locations.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <Loader2 size={22} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : locations.length === 0 ? (
        /* Empty state — still show map as placeholder */
        <div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14, height: 480 }}>
            <DriverTrackingMap locations={[]} />
          </div>
          <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted }}>
            <Navigation size={28} color={C.light} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Nenhum entregador ativo no momento</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>As localizações aparecem quando há pedidos em entrega com GPS ativo.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', minHeight: 480 }}>

          {/* Mapa */}
          <div style={{ position: 'relative', minHeight: 480 }}>
            <DriverTrackingMap locations={locations} />
            {/* Legenda sobreposta */}
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {locations.map((loc, idx) => {
                const name  = loc.delivery_persons?.name || 'Entregador';
                const age   = loc.driver_location_at
                  ? Math.floor((Date.now() - new Date(loc.driver_location_at).getTime()) / 60000)
                  : null;
                const color = DRIVER_COLORS[idx % DRIVER_COLORS.length];
                return (
                  <div key={loc.delivery_person_id} style={{ background: 'rgba(255,255,255,0.93)', borderRadius: 20, padding: '4px 10px 4px 6px', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 6px rgba(0,0,0,0.18)' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{name[0].toUpperCase()}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{name.split(' ')[0]}</span>
                    {age !== null && (
                      <span style={{ fontSize: 10, color: age < 5 ? C.success : age < 15 ? C.gold : C.danger, fontWeight: 600 }}>
                        · {age < 1 ? 'agora' : `${age}min`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Painel lateral — cards dos entregadores */}
          <div style={{ borderLeft: `1px solid ${C.border}`, background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: '#F9FAFB' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Em campo</p>
              <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{locations.length} entregador(es) ativo(s)</p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {locations.map((loc, idx) => {
                const name  = loc.delivery_persons?.name || 'Entregador';
                const age   = loc.driver_location_at
                  ? Math.floor((Date.now() - new Date(loc.driver_location_at).getTime()) / 60000)
                  : null;
                const color = DRIVER_COLORS[idx % DRIVER_COLORS.length];
                const statusColor = age === null ? C.muted : age < 5 ? C.success : age < 15 ? C.gold : C.danger;
                const ageLabel    = age === null ? '—' : age < 1 ? 'agora' : `há ${age} min`;

                return (
                  <div key={loc.delivery_person_id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', background: '#FAFAFA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{name[0].toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
                        <p style={{ fontSize: 10, color: statusColor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                          <Clock size={9} /> {ageLabel}
                        </p>
                      </div>
                    </div>
                    <p style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', letterSpacing: 0.2 }}>
                      {Number(loc.driver_location_lat).toFixed(5)}, {Number(loc.driver_location_lng).toFixed(5)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtMins(mins: any) {
  if (!Number.isFinite(mins)) return '—';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function MetricsTab({ adminToken }: { adminToken: any }) {
  const [periodRange, setPeriodRange] = useState(() => ({ from: daysAgoSP(30), to: todaySP() }));
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await adminPost('get_delivery_metrics', {
        from: periodRange?.from,
        to: periodRange?.to,
      }, adminToken);
      setSummary(j.summary || null);
      setRows(j.persons || []);
    } catch (e) {
      clientError(e);
      alert('Erro ao carregar métricas de entrega');
    } finally {
      setLoading(false);
    }
  }, [adminToken, periodRange?.from, periodRange?.to]);

  useEffect(() => { load(); }, [load]);

  const maxDelivered = Math.max(...rows.map(r => r.delivered_count || 0), 1);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Métricas de Entrega</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DateRangePicker value={periodRange} onChange={setPeriodRange} />
          <button onClick={load} style={btnGhost}><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
          <MetricCard label="Entregas concluídas" value={summary.total_delivered} color={C.success} />
          <MetricCard label="Em andamento" value={summary.total_in_progress} color={C.purple} />
          <MetricCard label="Taxas (entregadores)" value={fmtBRL(summary.total_delivery_fees)} color={C.gold} />
          <MetricCard label="Valor dos pedidos" value={fmtBRL(summary.total_orders_value)} color={C.blue} />
          <MetricCard label="Tempo médio" value={fmtMins(summary.avg_delivery_minutes)} color={C.text} />
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 34 }}>
          <Loader2 size={22} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : rows.length === 0 ? (
        <p style={{ color: C.muted, textAlign: 'center', padding: '24px 0' }}>Sem dados no período selecionado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, idx) => {
            const width = `${Math.max(10, Math.round(((r.delivered_count || 0) / maxDelivered) * 100))}%`;
            return (
              <div key={r.delivery_person_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{idx + 1}. {r.name}</p>
                    <p style={{ fontSize: 11, color: C.muted }}>Última entrega: {fmtDate(r.last_delivery_at)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: C.text }}>✅ {r.delivered_count} entregas</span>
                    <span style={{ fontSize: 12, color: C.gold }}>💰 {fmtBRL(r.delivery_fees_total)}</span>
                    <span style={{ fontSize: 12, color: C.blue }}>🧾 {fmtBRL(r.orders_total_value)}</span>
                    <span style={{ fontSize: 12, color: C.purple }}>⏱ {fmtMins(r.avg_delivery_minutes)}</span>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 8, background: '#EEF2F7', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width, height: '100%', background: 'linear-gradient(90deg,#7C3AED,#2563EB)' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: any, value: any, color: any }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
      <p style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 19, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Analysis Tab  (Análise de Entregas)
// ═════════════════════════════════════════════════════════════════════════════

interface TimeRow {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  tooltip: string;
  iconBg: string;
}

function TimeMetricRow({ icon, label, value, tooltip, iconBg }: TimeRow) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
          <span title={tooltip} style={{ fontSize: 10, color: C.light, cursor: 'help', background: '#F3F4F6', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>?</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginTop: 2 }}>
          {value ?? '—'}
        </div>
      </div>
    </div>
  );
}

function DeadlineRow({ icon, label, value, color, tooltip }: { icon: React.ReactNode; label: string; value: string | number; color: string; tooltip: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
          <span title={tooltip} style={{ fontSize: 10, color: C.light, cursor: 'help', background: '#F3F4F6', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>?</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function AnalysisTab({ adminToken }: { adminToken: any }) {
  const [periodRange, setPeriodRange] = useState(() => ({ from: todaySP(), to: todaySP() }));
  const [loading, setLoading]         = useState(true);
  const [data, setData]               = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await adminPost('get_delivery_analysis', {
        from: periodRange?.from,
        to:   periodRange?.to,
      }, adminToken);
      setData(j);
    } catch (e) {
      clientError(e);
      alert('Erro ao carregar análise de entregas');
    } finally {
      setLoading(false);
    }
  }, [adminToken, periodRange?.from, periodRange?.to]);

  useEffect(() => { load(); }, [load]);

  const coveragePct = data && data.count > 0
    ? Math.round((data.coverageCount / data.count) * 100)
    : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Análise de Entregas</h3>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Indicadores de performance e mapa de calor</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DateRangePicker value={periodRange} onChange={setPeriodRange} />
          <button onClick={load} disabled={loading} style={{ ...btnGhost, opacity: loading ? 0.6 : 1 }}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Atualizar
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader2 size={26} color={C.gold} className="animate-spin" />
        </div>
      ) : !data ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── KPI summary cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <SummaryCard label="Entregas"           value={data.count}                     color={C.success} />
            <SummaryCard label="Faturamento"        value={fmtBRL(data.totalRevenue)}       color={C.success} />
            <SummaryCard label="Ticket médio"       value={fmtBRL(data.avgTicket)}          color={C.success} />
            <SummaryCard label="Taxas de entrega"   value={fmtBRL(data.totalDeliveryFees)}  color={C.success} />
            <SummaryCard label="Duração média"      value={fmtMins(data.avgTotalMins)}      color={C.success} />
          </div>

          {/* ── Tempo e Prazo side by side ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>

            {/* Métricas de tempo */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>Métricas de tempo</h4>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Indicadores que mostram como está a performance da sua operação</p>

              <TimeMetricRow
                iconBg="#DCFCE7"
                icon={<Check size={18} color={C.success} />}
                label="Tempo de preparo"
                value={fmtMins(data.avgPrepMins)}
                tooltip="Tempo médio desde o recebimento do pedido até o entregador sair (inclui cozinha + espera)"
              />
              <TimeMetricRow
                iconBg="#DBEAFE"
                icon={<Truck size={18} color={C.blue} />}
                label="Tempo de entrega"
                value={fmtMins(data.avgDeliveryMins)}
                tooltip="Tempo médio da saída do entregador até a entrega ao cliente"
              />
              <TimeMetricRow
                iconBg="#F3E8FF"
                icon={<Timer size={18} color={C.purple} />}
                label="Duração total do pedido"
                value={fmtMins(data.avgTotalMins)}
                tooltip="Tempo médio do pedido realizado até a entrega"
              />
              <div style={{ padding: '10px 0 0', fontSize: 11, color: C.muted }}>
                Com base em <strong>{coveragePct}%</strong> dos pedidos ({data.coverageCount} de {data.count})
              </div>
            </div>

            {/* Análise dos prazos */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>Análise dos prazos de entrega</h4>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Indicadores que mostram como sua operação está lidando com prazos</p>
              {data.deliveryTimeStr && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '4px 10px', marginBottom: 10, fontSize: 11, color: '#92400E', fontWeight: 600 }}>
                  <Clock size={12} /> Prazo prometido no site: {data.deliveryTimeStr}
                </div>
              )}

              <DeadlineRow
                icon={<ThumbsUp size={18} color={C.success} />}
                label="Entregas no prazo"
                value={data.onTimeCount}
                color={C.success}
                tooltip="Pedidos entregues dentro do prazo prometido no site"
              />
              <DeadlineRow
                icon={<ThumbsDown size={18} color={C.danger} />}
                label="Entregas atrasadas"
                value={data.lateCount}
                color={data.lateCount > 0 ? C.danger : C.success}
                tooltip="Pedidos entregues após o prazo prometido"
              />
              <DeadlineRow
                icon={<AlertCircle size={18} color="#F59E0B" />}
                label="Atraso médio"
                value={fmtMins(data.avgDelayMins)}
                color={data.avgDelayMins > 0 ? '#D97706' : C.success}
                tooltip="Tempo médio de atraso entre os pedidos atrasados"
              />
              <DeadlineRow
                icon={<Flame size={18} color={C.danger} />}
                label="Maior atraso"
                value={fmtMins(data.maxDelayMins)}
                color={data.maxDelayMins > 0 ? C.danger : C.success}
                tooltip="Maior tempo de atraso registrado no período"
              />

              {data.coverageCount > 0 && (
                <p style={{ fontSize: 11, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
                  Os dados acima referem-se a <strong>{coveragePct}%</strong> dos pedidos, que possuem data de criação e entrega registradas.
                </p>
              )}
            </div>
          </div>

          {/* ── Mapa de calor ── */}
          {data.addressGroups?.length > 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>Mapa de entregas</h4>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                Representação visual das concentrações geográficas dos pedidos — identifique padrões e otimize rotas.
                {' '}<span style={{ fontStyle: 'italic' }}>Os bairros são geocodificados automaticamente via OpenStreetMap.</span>
              </p>
              <DeliveryHeatMap addressGroups={data.addressGroups} height={520} />

              {/* Top neighborhoods table */}
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Bairros mais frequentes</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {data.addressGroups.slice(0, 10).map((g: any, i: number) => {
                    const pct = Math.round((g.count / data.count) * 100);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.muted, minWidth: 18, textAlign: 'right' }}>{i + 1}.</span>
                        <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{g.neighborhood}{g.city ? `, ${g.city}` : ''}</span>
                        <div style={{ width: 80, height: 6, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #2563EB)' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.text, minWidth: 28, textAlign: 'right' }}>{g.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : data.count > 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px', textAlign: 'center' }}>
              <MapPin size={28} color={C.light} style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: C.muted }}>Nenhum endereço com bairro registrado no período.</p>
            </div>
          ) : null}

          {/* Empty state */}
          {data.count === 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
              <PackageCheck size={32} color={C.light} style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Nenhuma entrega no período</p>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Selecione um período com entregas concluídas.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main DeliveryTab
// ═════════════════════════════════════════════════════════════════════════════

export default function DeliveryTab({ adminToken }: { adminToken: any }) {
  const [activeTab, setActiveTab] = useState('persons');

  return (
    <div style={{ padding: '24px 32px', paddingBottom: 60, maxWidth: 960, margin: '0 auto' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, alignSelf: 'flex-start', width: 'fit-content' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: active ? C.gold : 'transparent',
                color: active ? '#000' : C.muted,
                fontSize: 13, fontWeight: active ? 700 : 500,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'persons'  && <PersonsTab  adminToken={adminToken} />}
      {activeTab === 'zones'    && <ZonesTab    adminToken={adminToken} />}
      {activeTab === 'tracking' && <TrackingTab adminToken={adminToken} />}
      {activeTab === 'metrics'  && <MetricsTab  adminToken={adminToken} />}
      {activeTab === 'analysis' && <AnalysisTab adminToken={adminToken} />}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: C.gold, color: '#000', fontSize: 13, fontWeight: 700,
};

const btnGhost = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer',
  background: C.card, color: C.text, fontSize: 13, fontWeight: 500,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: C.muted,
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 8,
  border: `1px solid ${C.border}`, background: '#fff',
  color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
