'use client';

import { useState, useMemo, useEffect } from 'react';
import { Loader2, Landmark, CreditCard, Banknote, Clock, Search, X, Calendar, Bookmark, Plus, Trash2 } from 'lucide-react';

const GOLD = '#D4A528';
const SAVED_FILTERS_KEY = 'fumego_saved_filters';

const STATUS_TABS = [
  { key: '',           label: 'Todos',       color: '#888',    bg: '#333'                     },
  { key: 'pending',    label: 'Pendente',    color: '#F2A800', bg: 'rgba(242,168,0,0.15)'     },
  { key: 'scheduled',  label: 'Agendado',    color: '#B794F4', bg: 'rgba(183,148,244,0.15)'   },
  { key: 'confirmed',  label: 'Confirmado',  color: '#60A5FA', bg: 'rgba(96,165,250,0.15)'    },
  { key: 'preparing',  label: 'Preparando',  color: '#F97316', bg: 'rgba(249,115,22,0.15)'    },
  { key: 'ready',      label: '✅ Pronto',   color: '#F59E0B', bg: 'rgba(245,158,11,0.15)'    },
  { key: 'delivering', label: 'Entregando',  color: '#A78BFA', bg: 'rgba(167,139,250,0.15)'   },
  { key: 'delivered',  label: 'Entregue',    color: '#48BB78', bg: 'rgba(72,187,120,0.15)'    },
  { key: 'cancelled',  label: 'Cancelado',   color: '#E04040', bg: 'rgba(224,64,64,0.15)'     },
];

const DATE_PRESETS = [
  { key: 'all',        label: 'Tudo'             },
  { key: 'today',      label: 'Hoje'             },
  { key: 'yesterday',  label: 'Ontem'            },
  { key: 'week',       label: '7 dias'           },
  { key: 'last_week',  label: 'Sem. passada'     },
  { key: 'month',      label: 'Mês atual'        },
  { key: 'last_month', label: 'Mês passado'      },
  { key: 'last30',     label: 'Últ. 30 dias'     },
  { key: 'last60',     label: 'Últ. 60 dias'     },
  { key: 'last90',     label: 'Últ. 90 dias'     },
  { key: 'custom',     label: 'Período'          },
];

function toLocalDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function daysAgoStr(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function weekStartStr() {
  return daysAgoStr(6);
}
function lastWeekStartStr() {
  return daysAgoStr(13);
}
function lastWeekEndStr() {
  return daysAgoStr(7);
}
function monthStartStr() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function lastMonthStartStr() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function lastMonthEndStr() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function resolveDateRange(preset, customFrom, customTo) {
  const t = todayStr();
  switch (preset) {
    case 'today':      return { fromDate: t,                  toDate: t };
    case 'yesterday':  return { fromDate: yesterdayStr(),     toDate: yesterdayStr() };
    case 'week':       return { fromDate: weekStartStr(),     toDate: t };
    case 'last_week':  return { fromDate: lastWeekStartStr(), toDate: lastWeekEndStr() };
    case 'month':      return { fromDate: monthStartStr(),    toDate: t };
    case 'last_month': return { fromDate: lastMonthStartStr(), toDate: lastMonthEndStr() };
    case 'last30':     return { fromDate: daysAgoStr(29),     toDate: t };
    case 'last60':     return { fromDate: daysAgoStr(59),     toDate: t };
    case 'last90':     return { fromDate: daysAgoStr(89),     toDate: t };
    case 'custom':     return { fromDate: customFrom,         toDate: customTo };
    default:           return { fromDate: '',                 toDate: '' };
  }
}

// ── Filtros salvos ─────────────────────────────────────────────────────────────

function loadSavedFilters() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '[]');
  } catch { return []; }
}
function persistSavedFilters(filters) {
  try { localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters)); } catch {}
}

export default function OrdersTab({ orders, hasMoreOrders, loadingMore, onUpdateStatus, onLoadMore }) {
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [datePreset, setDatePreset]     = useState('all');
  const [customFrom, setCustomFrom]     = useState('');
  const [customTo, setCustomTo]         = useState('');

  // Filtros salvos
  const [savedFilters, setSavedFilters]       = useState(() => loadSavedFilters());
  const [showSaveDialog, setShowSaveDialog]   = useState(false);
  const [newFilterName, setNewFilterName]     = useState('');

  useEffect(() => { persistSavedFilters(savedFilters); }, [savedFilters]);

  function applyFilter(f) {
    setSearch(f.search || '');
    setStatusFilter(f.statusFilter || '');
    setDatePreset(f.datePreset || 'all');
    setCustomFrom(f.customFrom || '');
    setCustomTo(f.customTo || '');
  }

  function saveCurrentFilter() {
    if (!newFilterName.trim()) return;
    const newFilter = {
      id: Date.now(),
      name: newFilterName.trim(),
      search, statusFilter, datePreset, customFrom, customTo,
    };
    setSavedFilters(prev => [...prev, newFilter]);
    setNewFilterName('');
    setShowSaveDialog(false);
  }

  function deleteFilter(id) {
    setSavedFilters(prev => prev.filter(f => f.id !== id));
  }

  const { fromDate, toDate } = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  );

  const filteredByDateAndSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      if (fromDate || toDate) {
        const d = toLocalDate(o.created_at);
        if (fromDate && d < fromDate) return false;
        if (toDate   && d > toDate)   return false;
      }
      if (!q) return true;
      return (
        String(o.order_number).includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        (o.delivery_neighborhood || '').toLowerCase().includes(q) ||
        (o.delivery_street || '').toLowerCase().includes(q)
      );
    });
  }, [orders, fromDate, toDate, search]);

  const countByStatus = useMemo(() => {
    const counts = {};
    for (const tab of STATUS_TABS) {
      counts[tab.key] = tab.key === ''
        ? filteredByDateAndSearch.length
        : filteredByDateAndSearch.filter(o => o.status === tab.key).length;
    }
    return counts;
  }, [filteredByDateAndSearch]);

  const filtered = useMemo(() => {
    if (!statusFilter) return filteredByDateAndSearch;
    return filteredByDateAndSearch.filter(o => o.status === statusFilter);
  }, [filteredByDateAndSearch, statusFilter]);

  const hasFilter = search || statusFilter || datePreset !== 'all';

  return (
    <div>
      {/* ── Filtros salvos ── */}
      {savedFilters.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#666', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Filtros salvos</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {savedFilters.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#2D2D2D', borderRadius: 20, border: '1px solid #444', overflow: 'hidden' }}>
                <button
                  onClick={() => applyFilter(f)}
                  style={{ padding: '4px 10px 4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', color: GOLD }}
                >
                  {f.name}
                </button>
                <button
                  onClick={() => deleteFilter(f.id)}
                  style={{ padding: '4px 8px 4px 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center' }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Busca ── */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }} />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, #pedido, telefone, bairro, rua…"
          aria-label="Buscar pedidos"
          style={{
            width: '100%', padding: '9px 32px 9px 30px',
            background: '#2D2D2D', border: '1px solid #444',
            borderRadius: 8, color: '#fff', fontSize: 13,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Limpar busca"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 2 }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Filtro de data — presets ── */}
      <div style={{ marginBottom: datePreset === 'custom' ? 8 : 12 }}>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4, flexWrap: 'wrap' }}>
          <Calendar size={14} color="#888" style={{ flexShrink: 0, marginTop: 6 }} />
          {DATE_PRESETS.map(p => (
            <button key={p.key} onClick={() => setDatePreset(p.key)}
              style={{
                flexShrink: 0,
                padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: datePreset === p.key ? GOLD : '#333',
                color: datePreset === p.key ? '#000' : '#aaa',
                transition: 'background 0.15s',
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Inputs de período personalizado ── */}
      {datePreset === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ color: '#888', fontSize: 12, flexShrink: 0 }}>De</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', background: '#2D2D2D', border: '1px solid #444', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
          <span style={{ color: '#888', fontSize: 12, flexShrink: 0 }}>até</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            min={customFrom || undefined}
            style={{ flex: 1, padding: '7px 10px', background: '#2D2D2D', border: '1px solid #444', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
        </div>
      )}

      {/* ── Abas de status ── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #333' }}>
        {STATUS_TABS.map(tab => {
          const active = statusFilter === tab.key;
          const cnt = countByStatus[tab.key] || 0;
          return (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              style={{
                flexShrink: 0,
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                border: active ? `2px solid ${tab.color}` : '2px solid transparent',
                background: active ? tab.bg : '#2A2A2A',
                color: active ? tab.color : '#888',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s',
              }}>
              {tab.label}
              <span style={{
                background: active ? tab.color : '#444',
                color: active ? '#000' : '#aaa',
                fontSize: 10, fontWeight: 800,
                padding: '1px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center',
              }}>
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Barra de ações / contagem ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        {filtered.length > 0 ? (
          <p style={{ color: '#666', fontSize: 12 }}>
            {filtered.length} pedido{filtered.length !== 1 ? 's' : ''}
            {statusFilter ? ` · ${STATUS_TABS.find(t => t.key === statusFilter)?.label}` : ''}
            {datePreset !== 'all' ? ` · ${DATE_PRESETS.find(p => p.key === datePreset)?.label}` : ''}
          </p>
        ) : <span />}

        {hasFilter && (
          <button
            onClick={() => setShowSaveDialog(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid #555', background: 'none', color: GOLD, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            <Bookmark size={11} /> Salvar filtro
          </button>
        )}
      </div>

      {/* ── Diálogo salvar filtro ── */}
      {showSaveDialog && (
        <div style={{ background: '#2D2D2D', borderRadius: 8, padding: '12px 14px', marginBottom: 12, border: '1px solid #555' }}>
          <p style={{ color: '#aaa', fontSize: 12, marginBottom: 8 }}>Nome do filtro:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newFilterName}
              onChange={e => setNewFilterName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveCurrentFilter()}
              placeholder="Ex.: Clientes recorrentes 90 dias"
              autoFocus
              style={{ flex: 1, padding: '7px 10px', background: '#1A1A1A', border: '1px solid #555', borderRadius: 6, color: '#fff', fontSize: 12, outline: 'none' }}
            />
            <button onClick={saveCurrentFilter} style={{ padding: '7px 14px', borderRadius: 6, background: GOLD, border: 'none', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Salvar
            </button>
            <button onClick={() => setShowSaveDialog(false)} style={{ padding: '7px 10px', borderRadius: 6, background: 'none', border: '1px solid #555', color: '#888', fontSize: 12, cursor: 'pointer' }}>
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── Lista vazia ── */}
      {filtered.length === 0 && (
        <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
          {hasFilter ? 'Nenhum pedido encontrado com esses filtros.' : 'Nenhum pedido ainda.'}
        </p>
      )}

      {/* ── Pedidos ── */}
      {filtered.map(o => {
        const tab = STATUS_TABS.find(t => t.key === o.status) || STATUS_TABS[0];
        return (
          <div key={o.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ color: GOLD, fontWeight: 'bold' }}>#{o.order_number}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ color: '#888', fontSize: 11 }}>{new Date(o.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                  color: tab.color, background: tab.bg,
                }}>
                  {tab.label}
                </span>
              </div>
            </div>

            <p style={{ color: '#fff', fontSize: 14 }}>{o.customer_name} — {o.customer_phone}</p>
            <p style={{ color: '#aaa', fontSize: 12 }}>{o.delivery_street}, {o.delivery_number} — {o.delivery_neighborhood}</p>

            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <p style={{ color: GOLD, fontWeight: 'bold' }}>
                R$ {Number(o.total).toFixed(2).replace('.', ',')}
              </p>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 'bold',
                background:
                  o.payment_method === 'pix'          ? '#0066CC'
                  : o.payment_method === 'card'        ? '#9333EA'
                  : o.payment_method === 'card_delivery' ? '#0E7490'
                  : '#48BB78',
                color: '#fff',
              }}>
                {o.payment_method === 'pix'
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Landmark size={11} /> PIX</span>
                  : o.payment_method === 'card'
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CreditCard size={11} /> Cartão</span>
                  : o.payment_method === 'card_delivery'
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CreditCard size={11} /> Cartão entrega</span>
                  : <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Banknote size={11} /> Dinheiro</span>
                }
              </span>
            </div>

            {o.scheduled_for && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 8px', background: 'rgba(183,148,244,0.15)', border: '1px solid rgba(183,148,244,0.3)', borderRadius: 8, width: 'fit-content' }}>
                <Clock size={11} color="#B794F4" />
                <span style={{ fontSize: 11, color: '#B794F4', fontWeight: 700 }}>
                  Agendado: {new Date(o.scheduled_for).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}

            {o.observations && (
              <p style={{ color: '#777', fontSize: 11, fontStyle: 'italic', marginTop: 4 }}>
                Obs: {o.observations}
              </p>
            )}

            {o.order_items && o.order_items.length > 0 && (
              <div style={{ background: '#1A1A1A', borderRadius: 8, padding: '8px 10px', margin: '8px 0' }}>
                {o.order_items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#ccc', marginBottom: i < o.order_items.length - 1 ? 3 : 0 }}>
                    <span>{item.quantity}x {item.product_name}</span>
                    <span style={{ color: GOLD }}>R$ {Number(item.total_price).toFixed(2).replace('.', ',')}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <select
                value={o.status}
                onChange={e => onUpdateStatus(o.id, 'status', e.target.value)}
                aria-label={`Status do pedido #${o.order_number}`}
                style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
              >
                <option value="pending">Pendente</option>
                <option value="scheduled">Agendado</option>
                <option value="confirmed">Confirmado</option>
                <option value="preparing">Preparando</option>
                <option value="ready">✅ Pronto</option>
                <option value="delivering">Entregando</option>
                <option value="delivered">Entregue</option>
                <option value="cancelled">Cancelado</option>
              </select>
              <select
                value={o.payment_status}
                onChange={e => onUpdateStatus(o.id, 'payment_status', e.target.value)}
                aria-label={`Status de pagamento do pedido #${o.order_number}`}
                style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
              >
                <option value="pending">Pag. Pendente</option>
                <option value="approved">Pag. Aprovado</option>
                <option value="refunded">Reembolsado</option>
              </select>
            </div>
          </div>
        );
      })}

      {/* ── Carregar mais ── */}
      {hasMoreOrders && !hasFilter && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          style={{
            width: '100%', padding: '12px', background: '#333', color: GOLD,
            border: `1px solid ${GOLD}`, borderRadius: 10, fontSize: 14, fontWeight: 'bold',
            cursor: 'pointer', opacity: loadingMore ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loadingMore
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...</>
            : 'Carregar mais pedidos'
          }
        </button>
      )}

      {hasMoreOrders && hasFilter && (
        <p style={{ color: '#666', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Filtros ativos. Limpe os filtros e clique em "Carregar mais" para ver pedidos anteriores.
        </p>
      )}
    </div>
  );
}
