'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, X, RefreshCw, DollarSign, Percent,
  TrendingUp, AlertCircle, CheckCircle, ChevronDown, ChevronUp,
  Building2, Zap, Users, Wifi, Droplets, ShoppingCart, Calculator,
} from 'lucide-react';

const C = {
  gold: '#F2A800', bg: '#F4F5F7', card: '#ffffff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  success: '#10B981', danger: '#EF4444', blue: '#3B82F6',
  orange: '#F97316', purple: '#8B5CF6', teal: '#14B8A6',
};

const fmtBRL = (v: any) => (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CATEGORY_ICONS: Record<string, any> = {
  'Imóvel':         Building2,
  'Energia Elétrica': Zap,
  'Pessoal':        Users,
  'Telecom':        Wifi,
  'Água':           Droplets,
  'Insumos':        ShoppingCart,
  'Imposto':        Calculator,
  'Outros':         DollarSign,
};

const FIXED_CATEGORIES = ['Pessoal','Imóvel','Energia Elétrica','Água','Telecom','Insumos','Marketing','Outros'];
const TAX_CATEGORIES   = ['Imposto','Outros'];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box',
  background: '#FAFAFA',
};

function Modal({ title, onClose, children }: { title: any; onClose: () => void; children: any }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.card, borderRadius: 14, padding: '28px 32px', width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{title}</p>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.light }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: any; children: any }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

// ── Cost form (shared for fixed + tax) ────────────────────────────────────────
function CostForm({ initial, type, onSave, onCancel, saving }: { initial: any; type: string; onSave: (form: any) => void; onCancel: () => void; saving: boolean }) {
  const [form, setForm] = useState(initial || {
    name: '', description: '', type, amount: '', rate: '', base: 'gross',
    category: type === 'fixed' ? 'Outros' : 'Imposto', is_active: true,
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const valid = form.name.trim() && (type === 'fixed' ? form.amount !== '' : form.rate !== '');

  return (
    <div>
      <Row label="Nome *">
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder={type === 'fixed' ? 'Ex: Aluguel' : 'Ex: Simples Nacional'} style={inputStyle} />
      </Row>
      <Row label="Descrição">
        <input value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Descrição opcional" style={inputStyle} />
      </Row>
      {type === 'fixed' && (
        <Row label="Valor Mensal (R$) *">
          <input type="number" step="0.01" min="0" value={form.amount || ''} onChange={e => set('amount', e.target.value)} placeholder="0,00" style={inputStyle} />
        </Row>
      )}
      {type === 'tax' && (
        <>
          <Row label="Alíquota (%) *">
            <input type="number" step="0.01" min="0" max="100" value={form.rate || ''} onChange={e => set('rate', e.target.value)} placeholder="Ex: 6.00 para 6%" style={inputStyle} />
          </Row>
          <Row label="Base de Cálculo">
            <select value={form.base || 'gross'} onChange={e => set('base', e.target.value)} style={{ ...inputStyle }}>
              <option value="gross">Receita Bruta</option>
              <option value="net">Receita Líquida</option>
            </select>
          </Row>
        </>
      )}
      <Row label="Categoria">
        <select value={form.category || ''} onChange={e => set('category', e.target.value)} style={{ ...inputStyle }}>
          {(type === 'fixed' ? FIXED_CATEGORIES : TAX_CATEGORIES).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Row>
      <Row label="Status">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text }}>
          <input type="checkbox" checked={form.is_active !== false} onChange={e => set('is_active', e.target.checked)} />
          Ativo
        </label>
      </Row>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', background: '#F9FAFB', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={() => valid && onSave(form)} disabled={!valid || saving}
          style={{ flex: 2, padding: '10px', background: C.gold, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: valid && !saving ? 'pointer' : 'not-allowed', opacity: !valid ? 0.5 : 1 }}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ── Cost card ─────────────────────────────────────────────────────────────────
function CostCard({ item, onEdit, onDelete, type }: { item: any; onEdit: (item: any) => void; onDelete: (id: any) => void; type: string }) {
  const Icon = CATEGORY_ICONS[item.category] || DollarSign;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', background: item.is_active ? C.card : '#FAFAFA',
      border: `1px solid ${C.border}`, borderRadius: 10,
      opacity: item.is_active ? 1 : 0.6,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: type === 'fixed' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={type === 'fixed' ? C.blue : C.danger} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
          {!item.is_active && <span style={{ fontSize: 10, color: C.light, marginLeft: 6 }}>(inativo)</span>}
        </div>
        {item.description && <div style={{ fontSize: 11, color: C.muted }}>{item.description}</div>}
        <div style={{ fontSize: 11, color: C.light, marginTop: 2 }}>
          {item.category}
          {type === 'tax' && ` · base: ${item.base === 'gross' ? 'Receita Bruta' : 'Receita Líquida'}`}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {type === 'fixed' ? (
          <div style={{ fontSize: 15, fontWeight: 700, color: C.blue }}>{fmtBRL(item.amount)}</div>
        ) : (
          <div style={{ fontSize: 15, fontWeight: 700, color: C.danger }}>{parseFloat(item.rate || 0).toFixed(2)}%</div>
        )}
        <div style={{ fontSize: 10, color: C.light }}>{type === 'fixed' ? '/mês' : 'alíquota'}</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => onEdit(item)} style={{ padding: '6px 8px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', color: C.muted, display: 'flex' }}>
          <Edit2 size={13} />
        </button>
        <button onClick={() => onDelete(item.id)} style={{ padding: '6px 8px', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, cursor: 'pointer', color: C.danger, display: 'flex' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CustosTab({ adminToken, refreshTick }: { adminToken: string; refreshTick: number }) {
  const [subTab, setSubTab]   = useState('fixos');
  const [costs, setCosts]     = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [modal, setModal]     = useState<any>(null); // { type: 'fixed'|'tax', item?: cost }
  const [revenue, setRevenue] = useState<any>(null); // current month revenue for calculator

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [costsRes, revRes] = await Promise.all([
        fetch('/api/admin/financial?action=custos', { headers: { Authorization: `Bearer ${adminToken}` } }),
        fetch(`/api/admin/financial?action=overview&from=${currentMonthFrom()}&to=${currentMonthTo()}`, { headers: { Authorization: `Bearer ${adminToken}` } }),
      ]);
      const costsData = await costsRes.json();
      const revData   = await revRes.json();
      if (!costsData.error) setCosts(costsData.costs || []);
      if (!revData.error)   setRevenue(revData.overview || null);
    } catch {}
    setLoading(false);
  }, [adminToken]);

  useEffect(() => { load(); }, [load, refreshTick]);

  function currentMonthFrom() {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
  }
  function currentMonthTo() {
    const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${last}`;
  }

  async function handleSave(form: any) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'custos_save', ...form }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setModal(null);
      await load();
    } catch { alert('Erro de conexão'); }
    setSaving(false);
  }

  async function handleDelete(id: any) {
    if (!confirm('Remover este item?')) return;
    try {
      await fetch('/api/admin/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'custos_delete', id }),
      });
      await load();
    } catch { alert('Erro ao remover'); }
  }

  const fixedCosts  = costs.filter(c => c.type === 'fixed');
  const taxCosts    = costs.filter(c => c.type === 'tax');
  const activeFixed = fixedCosts.filter(c => c.is_active !== false);
  const activeTaxes = taxCosts.filter(c => c.is_active !== false);

  const totalFixedMonthly = activeFixed.reduce((s, c) => s + parseFloat(c.amount || 0), 0);

  // Calculator
  const grossRevenue     = parseFloat(revenue?.grossRevenue     || 0);
  const netRevenue       = parseFloat(revenue?.netRevenue       || grossRevenue);
  const monthlyProjection = parseFloat(revenue?.monthlyProjection || grossRevenue);

  function calcTax(tax: any, base: any) {
    const b = tax.base === 'net' ? base.net : base.gross;
    return (b * parseFloat(tax.rate || 0)) / 100;
  }

  const totalTaxesCurrent    = activeTaxes.reduce((s, t) => s + calcTax(t, { gross: grossRevenue,     net: netRevenue }),     0);
  const totalTaxesProjection = activeTaxes.reduce((s, t) => s + calcTax(t, { gross: monthlyProjection, net: monthlyProjection * 0.97 }), 0);

  const SUBTABS = [
    { key: 'fixos',      label: 'Custos Fixos' },
    { key: 'impostos',   label: 'Impostos / Variáveis' },
    { key: 'calculadora', label: 'Calculadora' },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {SUBTABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{
            flex: 1, padding: '11px 16px', border: 'none',
            background: subTab === t.key ? C.gold : 'none',
            color: subTab === t.key ? '#fff' : C.muted,
            fontSize: 13, fontWeight: subTab === t.key ? 700 : 500, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── CUSTOS FIXOS ── */}
      {subTab === 'fixos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Custos Fixos Mensais</div>
              <div style={{ fontSize: 12, color: C.muted }}>Despesas que se repetem todo mês</div>
            </div>
            <button onClick={() => setModal({ type: 'fixed' })} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: C.gold, border: 'none', borderRadius: 8,
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              <Plus size={14} /> Adicionar
            </button>
          </div>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
            <div style={{ background: C.card, borderRadius: 10, padding: '14px 18px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Total Mensal</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{fmtBRL(totalFixedMonthly)}</div>
            </div>
            <div style={{ background: C.card, borderRadius: 10, padding: '14px 18px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Itens Ativos</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{activeFixed.length}</div>
            </div>
            {grossRevenue > 0 && (
              <div style={{ background: C.card, borderRadius: 10, padding: '14px 18px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>% da Receita Bruta</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: totalFixedMonthly / grossRevenue > 0.3 ? C.danger : C.success }}>
                  {((totalFixedMonthly / grossRevenue) * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>

          {/* List */}
          {fixedCosts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, color: C.light, fontSize: 13 }}>
              Nenhum custo fixo cadastrado. Clique em "Adicionar" para começar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fixedCosts.map(c => (
                <CostCard key={c.id} item={c} type="fixed" onEdit={item => setModal({ type: 'fixed', item })} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── IMPOSTOS ── */}
      {subTab === 'impostos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Impostos e Custos Variáveis</div>
              <div style={{ fontSize: 12, color: C.muted }}>Calculados como percentual da receita</div>
            </div>
            <button onClick={() => setModal({ type: 'tax' })} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: C.gold, border: 'none', borderRadius: 8,
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              <Plus size={14} /> Adicionar
            </button>
          </div>

          {/* Warning */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10 }}>
            <AlertCircle size={15} color={C.orange} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
              As alíquotas são apenas referências. Consulte seu contador para os valores exatos do seu regime tributário.
            </p>
          </div>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
            <div style={{ background: C.card, borderRadius: 10, padding: '14px 18px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Carga Tributária Atual</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.danger }}>{fmtBRL(totalTaxesCurrent)}</div>
            </div>
            <div style={{ background: C.card, borderRadius: 10, padding: '14px 18px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Alíquota Total</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>
                {activeTaxes.reduce((s, t) => s + parseFloat(t.rate || 0), 0).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* List */}
          {taxCosts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, color: C.light, fontSize: 13 }}>
              Nenhum imposto cadastrado. Clique em "Adicionar" para começar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {taxCosts.map(c => (
                <CostCard key={c.id} item={c} type="tax" onEdit={item => setModal({ type: 'tax', item })} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CALCULADORA ── */}
      {subTab === 'calculadora' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Calculadora de Custos</div>

          {/* Revenue base */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
            {[
              { label: 'Receita Bruta (atual)', value: grossRevenue,     color: C.blue   },
              { label: 'Projeção do Mês',       value: monthlyProjection, color: C.purple },
              { label: 'Custos Fixos',          value: totalFixedMonthly, color: C.orange },
              { label: 'Impostos (atual)',       value: totalTaxesCurrent, color: C.danger },
            ].map(k => (
              <div key={k.label} style={{ background: C.card, borderRadius: 10, padding: '14px 18px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{fmtBRL(k.value)}</div>
              </div>
            ))}
          </div>

          {/* Fixed costs breakdown */}
          {activeFixed.length > 0 && (
            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>
                Custos Fixos Mensais
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left',  fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>Item</th>
                    <th style={{ padding: '8px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>Categoria</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>Valor/mês</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>% da Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFixed.map(c => {
                    const pct = grossRevenue > 0 ? (parseFloat(c.amount || 0) / grossRevenue) * 100 : 0;
                    return (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '9px 14px', fontSize: 13, color: C.text }}>{c.name}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: 11, color: C.muted }}>{c.category}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.blue }}>{fmtBRL(c.amount)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, color: pct > 10 ? C.danger : C.muted }}>{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: '#F9FAFB', borderTop: `2px solid ${C.border}` }}>
                    <td colSpan={2} style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: C.text }}>Total</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: C.blue }}>{fmtBRL(totalFixedMonthly)}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: C.muted }}>
                      {grossRevenue > 0 ? ((totalFixedMonthly / grossRevenue) * 100).toFixed(1) : '—'}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Tax calculator */}
          {activeTaxes.length > 0 && (
            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>
                Calculadora de Impostos
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left',  fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>Imposto</th>
                    <th style={{ padding: '8px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>Base</th>
                    <th style={{ padding: '8px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>Alíquota</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>Valor Atual</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase' }}>Projeção Mês</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTaxes.map(t => {
                    const valCurrent = calcTax(t, { gross: grossRevenue, net: netRevenue });
                    const valProj    = calcTax(t, { gross: monthlyProjection, net: monthlyProjection * 0.97 });
                    return (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '9px 14px', fontSize: 13, color: C.text }}>{t.name}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: 11, color: C.muted }}>
                          {t.base === 'net' ? 'Receita Líquida' : 'Receita Bruta'}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: C.text }}>
                          {parseFloat(t.rate || 0).toFixed(2)}%
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.danger }}>{fmtBRL(valCurrent)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.orange }}>{fmtBRL(valProj)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: '#F9FAFB', borderTop: `2px solid ${C.border}` }}>
                    <td colSpan={3} style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: C.text }}>Total de Impostos</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: C.danger }}>{fmtBRL(totalTaxesCurrent)}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: C.orange }}>{fmtBRL(totalTaxesProjection)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Final summary */}
          {(activeFixed.length > 0 || activeTaxes.length > 0) && grossRevenue > 0 && (
            <div style={{ background: 'rgba(242,168,0,0.06)', borderRadius: 12, border: '1px solid rgba(242,168,0,0.3)', padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>Resumo Financeiro do Período</div>
              {[
                { label: 'Receita Bruta',             value: grossRevenue,                           color: C.success },
                { label: '(-) Custos Fixos',          value: -totalFixedMonthly,                     color: C.blue    },
                { label: '(-) Impostos Estimados',    value: -totalTaxesCurrent,                     color: C.danger  },
                { label: '(=) Resultado após custos', value: grossRevenue - totalFixedMonthly - totalTaxesCurrent, color: null },
              ].map((row, i) => {
                const color = row.color || (row.value >= 0 ? C.success : C.danger);
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? `1px solid rgba(242,168,0,0.15)` : 'none' }}>
                    <span style={{ fontSize: i === 3 ? 14 : 13, fontWeight: i === 3 ? 700 : 400, color: i === 3 ? C.text : C.muted }}>{row.label}</span>
                    <span style={{ fontSize: i === 3 ? 16 : 13, fontWeight: i === 3 ? 800 : 600, color }}>{fmtBRL(row.value)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {activeFixed.length === 0 && activeTaxes.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, color: C.light, fontSize: 13 }}>
              Cadastre custos fixos e impostos nas abas acima para ver a calculadora.
            </div>
          )}
        </div>
      )}

      {/* ── Modal (add/edit) ── */}
      {modal && (
        <Modal
          title={modal.item ? `Editar ${modal.type === 'fixed' ? 'Custo Fixo' : 'Imposto'}` : `Novo ${modal.type === 'fixed' ? 'Custo Fixo' : 'Imposto'}`}
          onClose={() => setModal(null)}
        >
          <CostForm
            initial={modal.item}
            type={modal.type}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  );
}
