'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownUp, Warehouse, TrendingUp, TrendingDown,
  RefreshCw, AlertTriangle, Package, DollarSign,
  ChevronDown, ChevronUp, Filter, Calendar,
} from 'lucide-react';

const C = {
  bg: '#F4F5F7', card: '#fff', border: '#E5E7EB',
  text: '#111827', muted: '#6B7280', light: '#9CA3AF',
  gold: '#F2A800', success: '#10B981', danger: '#EF4444',
};

function fmtBRL(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MOVEMENT_LABELS = {
  in:         { label: 'Entrada',  color: '#059669', bg: '#ECFDF5', icon: '▲' },
  out:        { label: 'Saída',    color: '#EF4444', bg: '#FEF2F2', icon: '▼' },
  adjustment: { label: 'Ajuste',   color: '#D97706', bg: '#FFFBEB', icon: '◆' },
  sale:       { label: 'Venda',    color: '#7C3AED', bg: '#EDE9FE', icon: '●' },
};

export default function StockMovements({ adminToken }) {
  const [movements, setMovements]       = useState([]);
  const [ingredients, setIngredients]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterType, setFilterType]     = useState('all');
  const [filterIng, setFilterIng]       = useState('');
  const [showAlerts, setShowAlerts]     = useState(true);
  const [showOverview, setShowOverview] = useState(false);

  // Date range filter – default: last 30 days
  const defaultEnd   = toLocalDateStr(new Date());
  const defaultStart = toLocalDateStr(new Date(Date.now() - 30 * 24 * 3600 * 1000));
  const [dateStart, setDateStart] = useState(defaultStart);
  const [dateEnd,   setDateEnd]   = useState(defaultEnd);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mvRes, ingRes] = await Promise.all([
        fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'get_stock_movements', data: { limit: 300 } }),
        }),
        fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'get_catalog_extra' }),
        }),
      ]);
      const mvData  = await mvRes.json();
      const ingData = await ingRes.json();
      setMovements(mvData.movements || []);
      setIngredients(ingData.ingredients || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const lowStockAlerts = ingredients.filter(ing => {
    const cur = parseFloat(ing.current_stock) || 0;
    const min = parseFloat(ing.min_stock) || 0;
    return min > 0 && cur <= min;
  });

  const totalInventoryValue = ingredients.reduce((sum, ing) => {
    const cur  = parseFloat(ing.current_stock) || 0;
    const cost = parseFloat(ing.cost_per_unit) || 0;
    return sum + cur * cost;
  }, 0);

  const configuredCount = ingredients.filter(ing => (parseFloat(ing.min_stock) || 0) > 0 || (parseFloat(ing.max_stock) || 0) > 0).length;

  // ── Date range filtering ──────────────────────────────────────────────────

  const rangeStart = dateStart ? new Date(dateStart + 'T00:00:00') : null;
  const rangeEnd   = dateEnd   ? new Date(dateEnd   + 'T23:59:59') : null;

  const movementsInRange = movements.filter(m => {
    const d = new Date(m.created_at);
    if (rangeStart && d < rangeStart) return false;
    if (rangeEnd   && d > rangeEnd)   return false;
    return true;
  });

  const filteredMovements = movementsInRange.filter(m => {
    if (filterType !== 'all' && m.movement_type !== filterType) return false;
    if (filterIng && m.ingredient_id !== filterIng) return false;
    return true;
  });

  // ── Summaries for selected period ────────────────────────────────────────

  const periodIn  = movementsInRange.filter(m => m.movement_type === 'in').reduce((s, m) => s + (parseFloat(m.quantity) || 0), 0);
  const periodOut = movementsInRange.filter(m => m.movement_type === 'out' || m.movement_type === 'sale').reduce((s, m) => s + (parseFloat(m.quantity) || 0), 0);
  const periodInCount  = movementsInRange.filter(m => m.movement_type === 'in').length;
  const periodOutCount = movementsInRange.filter(m => m.movement_type === 'out' || m.movement_type === 'sale').length;

  const periodLabel = dateStart === dateEnd
    ? 'no dia'
    : dateStart && dateEnd
      ? `${new Date(dateStart + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${new Date(dateEnd + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
      : 'no período';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <RefreshCw size={24} color={C.muted} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 10, color: C.muted }}>Carregando estoque...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Movimentação do Estoque</h2>
          <p style={{ fontSize: 13, color: C.muted }}>Histórico de entradas, saídas e ajustes de insumos.</p>
        </div>
        <button
          onClick={load}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + C.border, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.text }}
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* ── Seletor de período ────────────────────────────────────────────── */}
      <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Calendar size={16} color={C.gold} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Período:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="date"
            value={dateStart}
            onChange={e => setDateStart(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, color: C.text, background: '#F9FAFB', outline: 'none', cursor: 'pointer' }}
          />
          <span style={{ color: C.muted, fontSize: 13 }}>até</span>
          <input
            type="date"
            value={dateEnd}
            onChange={e => setDateEnd(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, color: C.text, background: '#F9FAFB', outline: 'none', cursor: 'pointer' }}
          />
        </div>
        {/* Quick range buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: 'Hoje',    days: 0 },
            { label: '7 dias',  days: 7 },
            { label: '30 dias', days: 30 },
            { label: '90 dias', days: 90 },
          ].map(({ label, days }) => (
            <button
              key={label}
              onClick={() => {
                const end = new Date();
                const start = days === 0 ? end : new Date(end.getTime() - days * 24 * 3600 * 1000);
                setDateStart(toLocalDateStr(start));
                setDateEnd(toLocalDateStr(end));
              }}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid ' + C.border, background: '#F3F4F6', color: C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              {label}
            </button>
          ))}
        </div>
        {(dateStart || dateEnd) && (
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>
            {movementsInRange.length} movimentação{movementsInRange.length !== 1 ? 'ões' : ''} no período
          </span>
        )}
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <DollarSign size={16} color={C.gold} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Valor em Estoque</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{fmtBRL(totalInventoryValue)}</p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{ingredients.length} insumos cadastrados</p>
        </div>

        <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TrendingUp size={16} color={C.success} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Entradas ({periodLabel})</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.success }}>{periodIn.toFixed(2)}</p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{periodInCount} movimentações</p>
        </div>

        <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TrendingDown size={16} color={C.danger} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saídas ({periodLabel})</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: C.danger }}>{periodOut.toFixed(2)}</p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{periodOutCount} movimentações</p>
        </div>

        <div style={{ background: lowStockAlerts.length > 0 ? '#FEF2F2' : C.card, borderRadius: 12, border: '1px solid ' + (lowStockAlerts.length > 0 ? '#FECACA' : C.border), padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={16} color={lowStockAlerts.length > 0 ? C.danger : C.muted} />
            <span style={{ fontSize: 11, fontWeight: 700, color: lowStockAlerts.length > 0 ? C.danger : C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Alertas de Estoque</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: lowStockAlerts.length > 0 ? C.danger : C.text }}>{lowStockAlerts.length}</p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{configuredCount} insumos com limites</p>
        </div>
      </div>

      {/* ── Alertas de Estoque Baixo ─────────────────────────────────────── */}
      {lowStockAlerts.length > 0 && (
        <div style={{ background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA', padding: 16, marginBottom: 24 }}>
          <button
            onClick={() => setShowAlerts(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showAlerts ? 12 : 0, width: '100%' }}
          >
            <AlertTriangle size={16} color={C.danger} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.danger, flex: 1, textAlign: 'left' }}>
              {lowStockAlerts.length} insumo{lowStockAlerts.length > 1 ? 's' : ''} abaixo do estoque mínimo
            </span>
            {showAlerts ? <ChevronUp size={14} color={C.danger} /> : <ChevronDown size={14} color={C.danger} />}
          </button>
          {showAlerts && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {lowStockAlerts.map(ing => {
                const cur = parseFloat(ing.current_stock) || 0;
                const min = parseFloat(ing.min_stock) || 0;
                return (
                  <div key={ing.id} style={{ background: '#fff', borderRadius: 8, border: '1px solid #FECACA', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Warehouse size={13} color={C.danger} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{ing.name}</p>
                      <p style={{ fontSize: 11, color: C.danger }}>
                        Atual: <strong>{cur.toFixed(2)}</strong> {ing.unit} · Mín: {min.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Visão Geral do Estoque ───────────────────────────────────────── */}
      <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, marginBottom: 24, overflow: 'hidden' }}>
        <button
          onClick={() => setShowOverview(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', border: 'none', borderBottom: showOverview ? '1px solid ' + C.border : 'none', cursor: 'pointer', padding: '14px 20px', width: '100%' }}
        >
          <Package size={16} color={C.muted} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1, textAlign: 'left' }}>Visão Geral dos Insumos</span>
          {showOverview ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
        </button>

        {showOverview && (
          <>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 100px 100px 120px', gap: 0, background: '#F9FAFB', borderBottom: '1px solid ' + C.border, padding: '8px 20px' }}>
              {['Insumo', 'Unid.', 'Atual', 'Mínimo', 'Máximo', 'Valor'].map((h, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
              ))}
            </div>

            {ingredients.length === 0 ? (
              <p style={{ padding: 20, textAlign: 'center', fontSize: 13, color: C.light }}>Nenhum insumo cadastrado.</p>
            ) : (
              ingredients.map((ing, i) => {
                const cur    = parseFloat(ing.current_stock) || 0;
                const min    = parseFloat(ing.min_stock) || 0;
                const max    = parseFloat(ing.max_stock) || 0;
                const cost   = parseFloat(ing.cost_per_unit) || 0;
                const value  = cur * cost;
                const cfgd   = min > 0 || max > 0;
                const status = !cfgd ? null : cur <= 0 ? 'empty' : cur <= min ? 'low' : 'ok';
                const statusColor = status === 'empty' ? C.danger : status === 'low' ? '#D97706' : status === 'ok' ? C.success : C.light;
                const statusBg    = status === 'empty' ? '#FEF2F2' : status === 'low' ? '#FFFBEB' : status === 'ok' ? '#ECFDF5' : 'transparent';
                const statusLabel = status === 'empty' ? 'Esgotado' : status === 'low' ? 'Baixo' : status === 'ok' ? 'OK' : '—';

                return (
                  <div key={ing.id} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 100px 100px 120px', gap: 0, alignItems: 'center', padding: '10px 20px', borderBottom: i < ingredients.length - 1 ? '1px solid ' + C.border + '80' : 'none', background: status === 'empty' ? '#FFF5F5' : status === 'low' ? '#FFFDF0' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ing.name}</span>
                      {status && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: statusBg, color: statusColor }}>
                          {statusLabel}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: C.muted }}>{ing.unit}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: statusColor, textAlign: 'right' }}>
                      {cur.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 12, color: C.muted, textAlign: 'right' }}>{min > 0 ? min.toFixed(2) : '—'}</span>
                    <span style={{ fontSize: 12, color: C.muted, textAlign: 'right' }}>{max > 0 ? max.toFixed(2) : '—'}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#059669', textAlign: 'right' }}>{fmtBRL(value)}</span>
                  </div>
                );
              })
            )}

            {/* Total row */}
            {ingredients.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 20px', borderTop: '2px solid ' + C.border, background: '#F9FAFB', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>VALOR TOTAL DO ESTOQUE:</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{fmtBRL(totalInventoryValue)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Tabela de Movimentações ──────────────────────────────────────── */}
      <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid ' + C.border, background: '#F9FAFB', flexWrap: 'wrap' }}>
          <Filter size={14} color={C.muted} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Filtrar por:</span>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', background: '#fff', color: C.text, cursor: 'pointer' }}
          >
            <option value="all">Todos os tipos</option>
            <option value="in">Entrada</option>
            <option value="out">Saída</option>
            <option value="adjustment">Ajuste</option>
            <option value="sale">Venda</option>
          </select>

          <select
            value={filterIng}
            onChange={e => setFilterIng(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', background: '#fff', color: C.text, cursor: 'pointer', minWidth: 160 }}
          >
            <option value="">Todos os insumos</option>
            {ingredients.map(ing => (
              <option key={ing.id} value={ing.id}>{ing.name}</option>
            ))}
          </select>

          <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, fontWeight: 600 }}>
            {filteredMovements.length} registro{filteredMovements.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 2fr 90px 80px 1fr 1fr', gap: 0, background: '#F9FAFB', borderBottom: '1px solid ' + C.border, padding: '8px 20px' }}>
          {['Data/Hora', 'Insumo', 'Tipo', 'Qtd.', 'Motivo', 'Observações'].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>
          ))}
        </div>

        {filteredMovements.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: C.light }}>
            <ArrowDownUp size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 13 }}>Nenhuma movimentação encontrada.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Use o painel "Estoque" na aba Insumos para registrar entradas e saídas.</p>
          </div>
        ) : (
          filteredMovements.map((mv, i) => {
            const mvInfo  = MOVEMENT_LABELS[mv.movement_type] || { label: mv.movement_type, color: C.muted, bg: '#F3F4F6', icon: '•' };
            const ingName = mv.ingredients?.name || ingredients.find(g => g.id === mv.ingredient_id)?.name || '—';
            const ingUnit = mv.ingredients?.unit || ingredients.find(g => g.id === mv.ingredient_id)?.unit || '';
            const qty     = parseFloat(mv.quantity) || 0;

            return (
              <div key={mv.id || i} style={{ display: 'grid', gridTemplateColumns: '140px 2fr 90px 80px 1fr 1fr', gap: 0, alignItems: 'center', padding: '10px 20px', borderBottom: i < filteredMovements.length - 1 ? '1px solid ' + C.border + '60' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{fmtDate(mv.created_at)}</span>

                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ingName}</span>
                  {ingUnit && <span style={{ fontSize: 11, color: C.light, marginLeft: 4 }}>({ingUnit})</span>}
                </div>

                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: mvInfo.bg, color: mvInfo.color, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  {mvInfo.icon} {mvInfo.label}
                </span>

                <span style={{ fontSize: 13, fontWeight: 700, color: mv.movement_type === 'in' ? C.success : mv.movement_type === 'out' || mv.movement_type === 'sale' ? C.danger : '#D97706' }}>
                  {mv.movement_type === 'in' ? '+' : mv.movement_type === 'adjustment' ? '=' : '−'}{qty.toFixed(3)}
                </span>

                <span style={{ fontSize: 12, color: C.text }}>{mv.reason || <span style={{ color: C.light }}>—</span>}</span>

                <span style={{ fontSize: 11, color: C.muted }}>{mv.notes || <span style={{ color: C.light }}>—</span>}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
