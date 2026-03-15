'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, UserX, UserCheck, X, Check, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';

const ALL_TABS = [
  { key: 'dashboard',   label: 'Dashboard' },
  { key: 'orders',      label: 'Pedidos' },
  { key: 'clients',     label: 'Clientes' },
  { key: 'catalog',     label: 'Catálogo' },
  { key: 'coupons',     label: 'Cupons' },
  { key: 'cardapioweb', label: 'CardápioWeb' },
  { key: 'deliveries',  label: 'Entregas' },
  { key: 'analytics',   label: 'Analytics' },
  { key: 'financial',   label: 'Financeiro' },
  { key: 'stock',       label: 'Estoque' },
  { key: 'reports',     label: 'Relatórios' },
  { key: 'settings',    label: 'Configurações' },
];

const C = {
  bg:        '#F4F5F7',
  card:      '#ffffff',
  border:    '#E5E7EB',
  text:      '#111827',
  textMuted: '#6B7280',
  gold:      '#F2A800',
  danger:    '#EF4444',
  success:   '#10B981',
};

interface SubAdmin {
  id: string;
  username: string;
  role: 'master' | 'sub';
  allowed_tabs: string[] | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

async function adminPost(action: string, data: Record<string, unknown>, token: string) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, data }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Erro HTTP ${res.status}`);
  return json;
}

export default function SubAdminsTab({ adminToken }: { adminToken: string }) {
  const [subAdmins, setSubAdmins]   = useState<SubAdmin[]>([]);
  const [loading, setLoading]       = useState(true);
  const [msg, setMsg]               = useState('');

  // Form state
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTabs, setFormTabs]     = useState<string[]>([]);
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminPost('list_sub_admins', {}, adminToken);
      setSubAdmins(d.subAdmins ?? []);
    } catch (e) {
      setMsg('❌ ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  function showMessage(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 3500);
  }

  function openCreate() {
    setEditingId(null);
    setFormUsername('');
    setFormPassword('');
    setFormTabs([]);
    setShowForm(true);
  }

  function openEdit(sa: SubAdmin) {
    setEditingId(sa.id);
    setFormUsername(sa.username);
    setFormPassword('');
    setFormTabs(sa.allowed_tabs ?? []);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function toggleTab(key: string) {
    setFormTabs(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    if (!formUsername.trim()) { showMessage('❌ Username é obrigatório'); return; }
    if (!editingId && !formPassword.trim()) { showMessage('❌ Senha é obrigatória'); return; }

    setSaving(true);
    try {
      if (editingId) {
        const updateData: Record<string, unknown> = { id: editingId, allowedTabs: formTabs };
        if (formPassword.trim()) updateData.password = formPassword.trim();
        await adminPost('update_sub_admin', updateData, adminToken);
        showMessage('✅ Sub-admin atualizado!');
      } else {
        await adminPost('create_sub_admin', {
          username: formUsername.trim(),
          password: formPassword.trim(),
          allowedTabs: formTabs,
        }, adminToken);
        showMessage('✅ Sub-admin criado!');
      }
      closeForm();
      await load();
    } catch (e) {
      showMessage('❌ ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(sa: SubAdmin) {
    const action = sa.is_active ? 'deactivate_sub_admin' : 'reactivate_sub_admin';
    try {
      await adminPost(action, { id: sa.id }, adminToken);
      showMessage(sa.is_active ? '✅ Sub-admin desativado' : '✅ Sub-admin reativado');
      await load();
    } catch (e) {
      showMessage('❌ ' + (e as Error).message);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Gerenciar Sub-Admins</h2>
          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            Crie usuários com acesso restrito a abas específicas do painel.
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: C.gold, color: '#000',
            border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <Plus size={15} /> Novo Sub-Admin
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: msg.includes('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: msg.includes('✅') ? C.success : C.danger,
          fontSize: 13, fontWeight: 600,
        }}>
          {msg}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: C.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 520,
            maxHeight: '90vh', overflowY: 'auto', position: 'relative',
          }}>
            <button
              onClick={closeForm}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={18} color={C.textMuted} />
            </button>

            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>
              {editingId ? 'Editar Sub-Admin' : 'Novo Sub-Admin'}
            </h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>
                Username
              </label>
              <input
                className="input-field"
                type="text"
                value={formUsername}
                onChange={e => setFormUsername(e.target.value)}
                disabled={!!editingId}
                placeholder="ex: joao"
                style={{ background: editingId ? '#F9FAFB' : '#fff', color: C.text, borderColor: C.border }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>
                {editingId ? 'Nova senha (deixe em branco para não alterar)' : 'Senha'}
              </label>
              <input
                className="input-field"
                type="password"
                value={formPassword}
                onChange={e => setFormPassword(e.target.value)}
                placeholder={editingId ? 'Nova senha (opcional)' : 'Senha'}
                style={{ background: '#fff', color: C.text, borderColor: C.border }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>
                Abas permitidas
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ALL_TABS.map(tab => {
                  const active = formTabs.includes(tab.key);
                  return (
                    <button
                      key={tab.key}
                      onClick={() => toggleTab(tab.key)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        border: `1.5px solid ${active ? C.gold : C.border}`,
                        background: active ? 'rgba(242,168,0,0.12)' : '#F9FAFB',
                        color: active ? C.gold : C.textMuted,
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
                {formTabs.length === 0
                  ? 'Nenhuma aba selecionada — sub-admin não verá nada.'
                  : `${formTabs.length} aba(s) selecionada(s).`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1, padding: '10px', background: C.gold, color: '#000',
                  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {saving
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
                  : <><Check size={14} /> {editingId ? 'Salvar Alterações' : 'Criar Sub-Admin'}</>
                }
              </button>
              <button
                onClick={closeForm}
                style={{
                  padding: '10px 20px', background: '#F3F4F6', color: C.text,
                  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={28} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : subAdmins.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: C.textMuted }}>
          <ShieldCheck size={40} color={C.border} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>Nenhum sub-admin cadastrado.</p>
          <p style={{ fontSize: 12 }}>Clique em "Novo Sub-Admin" para começar.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {subAdmins.map(sa => (
            <div
              key={sa.id}
              style={{
                background: C.card, borderRadius: 12, padding: '16px 20px',
                border: `1px solid ${sa.is_active ? C.border : 'rgba(239,68,68,0.2)'}`,
                opacity: sa.is_active ? 1 : 0.7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {sa.is_active
                      ? <ShieldCheck size={15} color={C.success} />
                      : <ShieldOff size={15} color={C.danger} />
                    }
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{sa.username}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                      background: sa.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: sa.is_active ? C.success : C.danger,
                    }}>
                      {sa.is_active ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {(sa.allowed_tabs ?? []).length === 0 ? (
                      <span style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic' }}>Sem abas permitidas</span>
                    ) : (
                      (sa.allowed_tabs ?? []).map(key => {
                        const tab = ALL_TABS.find(t => t.key === key);
                        return (
                          <span key={key} style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                            background: 'rgba(242,168,0,0.1)', color: C.gold,
                          }}>
                            {tab?.label ?? key}
                          </span>
                        );
                      })
                    )}
                  </div>

                  <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>
                    Criado: {formatDate(sa.created_at)}
                    {sa.last_login_at && <> · Último login: {formatDate(sa.last_login_at)}</>}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => openEdit(sa)}
                    title="Editar"
                    style={{
                      padding: '6px 12px', background: '#F3F4F6', border: '1px solid ' + C.border,
                      color: C.text, borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(sa)}
                    title={sa.is_active ? 'Desativar' : 'Reativar'}
                    style={{
                      padding: '6px 12px',
                      background: sa.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                      border: `1px solid ${sa.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                      color: sa.is_active ? C.danger : C.success,
                      borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {sa.is_active
                      ? <><UserX size={12} /> Desativar</>
                      : <><UserCheck size={12} /> Reativar</>
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
