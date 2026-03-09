'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Plus, X,
} from 'lucide-react';
import DateRangePicker from './DateRangePicker';

const C = {
  gold: '#F2A800', bg: '#F4F5F7', card: '#ffffff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  success: '#10B981', danger: '#EF4444', blue: '#3B82F6',
  orange: '#F97316', purple: '#8B5CF6', teal: '#14B8A6',
};

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const PM_LABELS = { pix:'PIX', card:'Cartão de Crédito', cash:'Dinheiro', card_delivery:'Cartão na Entrega' };

const CATEGORIES_RECEITA = ['Receitas de vendas','Serviços','Outras receitas'];
const CATEGORIES_DESPESA = ['Pessoal','Imóvel','Energia Elétrica','Água','Telecom','Entregadores','Insumos','Marketing','Impostos','Outros'];

const fmtBRL = v => (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = iso => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric' });
const todaySP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

function StatusBadge({ status }) {
  const MAP = {
    recebido:      { label: 'Recebido',  bg: 'rgba(16,185,129,0.1)',   color: C.success },
    pago:          { label: 'Pago',      bg: 'rgba(16,185,129,0.1)',   color: C.success },
    cancelado:     { label: 'Cancelado', bg: 'rgba(239,68,68,0.1)',    color: C.danger  },
    a_receber:     { label: 'A receber', bg: 'rgba(59,130,246,0.1)',   color: C.blue    },
    a_pagar:       { label: 'A pagar',   bg: 'rgba(249,115,22,0.1)',   color: C.orange  },
    vencido:       { label: 'Vencido',   bg: 'rgba(239,68,68,0.12)',   color: C.danger  },
    transferencia: { label: 'Transferência', bg: 'rgba(139,92,246,0.1)', color: C.purple },
  };
  const s = MAP[status] || MAP.pago;
  return (
    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function SummaryChip({ label, amount, color, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 8, background: C.card, border: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmtBRL(amount)}</span>
      {count != null && <span style={{ fontSize: 11, color: C.light }}>({count})</span>}
    </div>
  );
}

function AddModal({ adminToken, onClose, onSaved }) {
  const [form, setForm] = useState({
    entry_type: 'despesa',
    description: '',
    category: CATEGORIES_DESPESA[0],
    amount: '',
    payment_method: 'cash',
    date: todaySP(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categories = form.entry_type === 'receita' ? CATEGORIES_RECEITA : CATEGORIES_DESPESA;

  function handleChange(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (field === 'entry_type') {
        next.category = value === 'receita' ? CATEGORIES_RECEITA[0] : CATEGORIES_DESPESA[0];
      }
      return next;
    });
  }

  async function handleSave() {
    if (!form.description.trim()) { setError('Informe a descrição.'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Informe o valor.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'lancamento_add', ...form }),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); setSaving(false); return; }
      onSaved();
      onClose();
    } catch (e) { setError('Erro ao salvar.'); setSaving(false); }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
    fontSize: 13, color: C.text, outline: 'none', background: '#fff', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.card, borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Adicionar Lançamento</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Tipo */}
          <div>
            <label style={labelStyle}>Tipo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ key: 'receita', label: 'Receita' }, { key: 'despesa', label: 'Despesa' }].map(t => (
                <button key={t.key} onClick={() => handleChange('entry_type', t.key)} style={{
                  flex: 1, padding: '9px 12px', border: `1px solid ${form.entry_type === t.key ? (t.key === 'receita' ? C.success : C.danger) : C.border}`,
                  borderRadius: 8, background: form.entry_type === t.key ? (t.key === 'receita' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)') : '#fff',
                  color: form.entry_type === t.key ? (t.key === 'receita' ? C.success : C.danger) : C.muted,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Data */}
          <div>
            <label style={labelStyle}>Data</label>
            <input type="date" value={form.date} onChange={e => handleChange('date', e.target.value)} style={inputStyle} />
          </div>

          {/* Descrição */}
          <div>
            <label style={labelStyle}>Descrição</label>
            <input value={form.description} onChange={e => handleChange('description', e.target.value)}
              placeholder="Ex: Pagamento fornecedor" style={inputStyle} />
          </div>

          {/* Categoria */}
          <div>
            <label style={labelStyle}>Categoria</label>
            <select value={form.category} onChange={e => handleChange('category', e.target.value)} style={inputStyle}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Valor */}
          <div>
            <label style={labelStyle}>Valor (R$)</label>
            <input type="number" min="0" step="0.01" value={form.amount}
              onChange={e => handleChange('amount', e.target.value)}
              placeholder="0,00" style={inputStyle} />
          </div>

          {/* Forma de pagamento */}
          <div>
            <label style={labelStyle}>Forma de Pagamento</label>
            <select value={form.payment_method} onChange={e => handleChange('payment_method', e.target.value)} style={inputStyle}>
              <option value="cash">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="card">Cartão de Crédito</option>
              <option value="card_delivery">Cartão na Entrega</option>
            </select>
          </div>

          {error && <div style={{ fontSize: 12, color: C.danger, background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '0 20px 20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 8, background: C.gold, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar Lançamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

function firstOfMonthSP() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
}
function todaySP2() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export default function LancamentosTab({ adminToken, refreshTick }) {
  const [subTab, setSubTab] = useState('todos');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [dateRange, setDateRange] = useState({ from: firstOfMonthSP(), to: todaySP2(), fromTime: '00:00', toTime: '23:59' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/financial?action=lancamentos&from=${dateRange.from}&to=${dateRange.to}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const d = await res.json();
      if (!d.error) setData(d);
    } catch {}
    setLoading(false);
  }, [adminToken, dateRange.from, dateRange.to]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const s = data?.summary || {};
  const allEntries = subTab === 'receber' ? (data?.receitas || [])
                   : subTab === 'pagar'   ? (data?.despesas || [])
                   : (data?.todos || []);

  const filtered = allEntries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q);
  });

  const SUBTABS = [
    { key: 'pagar',   label: 'Contas a Pagar' },
    { key: 'receber', label: 'Contas a Receber' },
    { key: 'todos',   label: 'Todos os Lançamentos' },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showModal && (
        <AddModal adminToken={adminToken} onClose={() => setShowModal(false)} onSaved={load} />
      )}

      {/* Sub-tab bar */}
      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, display: 'flex', overflow: 'hidden' }}>
        {SUBTABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{
            flex: 1, padding: '11px 16px', border: 'none', background: subTab === t.key ? C.gold : 'none',
            color: subTab === t.key ? '#fff' : C.muted, fontSize: 13, fontWeight: subTab === t.key ? 700 : 500,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Period */}
        <DateRangePicker value={dateRange} onChange={v => setDateRange(v)} />

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', flex: 1, minWidth: 180 }}>
          <Search size={13} color={C.light} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquise pela descrição"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: C.text, width: '100%' }} />
        </div>

        <button onClick={load} style={{ padding: '8px 12px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: C.muted }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>

        {/* Adicionar button */}
        <button onClick={() => setShowModal(true)} style={{
          padding: '8px 16px', background: C.gold, border: 'none', borderRadius: 8,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          color: '#fff', fontSize: 13, fontWeight: 700,
        }}>
          <Plus size={15} /> Adicionar
        </button>
      </div>

      {/* Summary chips */}
      {data && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {subTab === 'receber' && <>
            <SummaryChip label="Recebidos"       amount={s.receitasRecebidas} color={C.success} />
            <SummaryChip label="A receber"       amount={s.receitasAberto}   color={C.blue} />
            <SummaryChip label="Total do período" amount={s.receitasRecebidas + s.receitasAberto} color={C.text} />
          </>}
          {subTab === 'pagar' && <>
            <SummaryChip label="Pagos"           amount={s.totalDespesas}   color={C.success} />
            <SummaryChip label="A pagar"         amount={s.despesasAberto}  color={C.orange} />
            <SummaryChip label="Total do período" amount={s.totalDespesas + s.despesasAberto} color={C.text} />
          </>}
          {subTab === 'todos' && <>
            <SummaryChip label="Receitas realizadas" amount={s.receitasRecebidas} color={C.success} />
            <SummaryChip label="Receitas em aberto"  amount={s.receitasAberto}    color={C.blue} />
            <SummaryChip label="Despesas realizadas" amount={s.totalDespesas}     color={C.danger} />
            <SummaryChip label="Despesas em aberto"  amount={s.despesasAberto}    color={C.orange} />
            <SummaryChip label="Total do período"    amount={s.totalPeriodo}      color={s.totalPeriodo >= 0 ? C.success : C.danger} />
          </>}
        </div>
      )}

      {/* Table */}
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Data','Descrição','Categoria','Conta','Status','Valor'].map((h, i) => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: i === 5 ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase',
                    letterSpacing: 0.4, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.light }}>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.light, fontSize: 13 }}>
                  Nenhum lançamento encontrado
                </td></tr>
              ) : filtered.map((e) => {
                const isExpense   = e.type === 'despesa';
                const isTransfer  = e.type === 'transferencia';
                const isCancelled = e.status === 'cancelado';
                const valColor    = isExpense ? C.danger : isCancelled ? C.light : C.success;
                return (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: isCancelled ? 0.55 : 1 }}>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
                      {fmtDate(e.created_at)}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: C.text, maxWidth: 260 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description}
                      </span>
                      {e.payment_method && (
                        <span style={{ fontSize: 11, color: C.light }}>{PM_LABELS[e.payment_method] || e.payment_method}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: C.muted }}>{e.category || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: C.muted }}>{e.account  || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <StatusBadge status={isTransfer ? 'transferencia' : e.status} />
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: valColor, whiteSpace: 'nowrap' }}>
                      {isExpense ? '-' : isTransfer ? '' : '+'}{fmtBRL(e.value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div style={{ padding: '10px 14px', background: '#FAFAFA', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
            <span style={{ fontSize: 12, color: C.muted }}>{filtered.length} registros</span>
          </div>
        )}
      </div>
    </div>
  );
}
