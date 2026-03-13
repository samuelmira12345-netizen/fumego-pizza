'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, ChevronUp, ChevronDown, Truck, DollarSign,
  Package, Clock, X, CheckCircle, AlertCircle, RefreshCw,
} from 'lucide-react';

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  gold:    '#D4A528',
  bg:      '#1A1A1A',
  card:    '#232323',
  border:  '#3A3A3A',
  text:    '#F3F4F6',
  muted:   '#9CA3AF',
  light:   '#6B7280',
  success: '#10B981',
  danger:  '#EF4444',
  purple:  '#7C3AED',
  blue:    '#2563EB',
};

const DRIVER_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#BE185D'];

function fmtBRL(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

async function adminPost(action, data, token) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ action, data }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro desconhecido');
  return json;
}

const STATUS_LABEL = {
  ready:      '📦 Aguardando',
  delivering: '🏍️ Em rota',
  delivered:  '✅ Entregue',
  cancelled:  '❌ Cancelado',
};
const STATUS_COLOR = {
  ready:      '#F59E0B',
  delivering: '#A78BFA',
  delivered:  '#34D399',
  cancelled:  '#EF4444',
};

// ── Night Summary Modal ───────────────────────────────────────────────────────

function NightModal({ person, orders, totalEarned, loading, onClose }) {
  const delivered   = orders.filter(o => o.status === 'delivered');
  const inProgress  = orders.filter(o => ['ready', 'delivering'].includes(o.status));
  const cancelled   = orders.filter(o => o.status === 'cancelled');
  const totalOrders = orders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: '85dvh', display: 'flex', flexDirection: 'column', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1A1A1A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{(person.name || '?')[0].toUpperCase()}</span>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{person.name}</p>
              <p style={{ fontSize: 11, color: C.muted }}>Resumo da noite</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Entregues',   value: delivered.length,        color: C.success },
            { label: 'Em rota',     value: inProgress.length,       color: '#A78BFA' },
            { label: 'Cancelados',  value: cancelled.length,        color: C.danger  },
            { label: 'Taxa receb.', value: fmtBRL(totalEarned),     color: C.gold    },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#2A2A2A', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 17, fontWeight: 800, color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.muted, padding: '20px 0', fontSize: 13 }}>Nenhum pedido esta noite</p>
            ) : (
              orders.map((o, idx) => (
                <div key={o.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, background: '#1E1E1E' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: '#2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.muted }}>#{idx + 1}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                      Pedido #{o.order_number || String(o.id).slice(-4).toUpperCase()}
                      {' '}
                      <span style={{ fontWeight: 400, color: C.muted }}>— {o.customer_name}</span>
                    </p>
                    <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {o.delivery_street}, {o.delivery_number} · {o.delivery_neighborhood}
                    </p>
                    <p style={{ fontSize: 10, color: C.light, marginTop: 1 }}>
                      Criado: {fmtTime(o.created_at)}
                      {o.driver_delivered_at && ` · Entregue: ${fmtTime(o.driver_delivered_at)}`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[o.status] || C.muted }}>{STATUS_LABEL[o.status] || o.status}</p>
                    <p style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>taxa: {fmtBRL(o.delivery_fee)}</p>
                    <p style={{ fontSize: 10, color: C.muted }}>total: {fmtBRL(o.total)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer total */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1A1A1A' }}>
          <p style={{ fontSize: 12, color: C.muted }}>
            {delivered.length} pedido(s) entregue(s) · valor total dos pedidos: <strong style={{ color: C.text }}>{fmtBRL(totalOrders)}</strong>
          </p>
          <p style={{ fontSize: 16, fontWeight: 800, color: C.gold }}>Taxa: {fmtBRL(totalEarned)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Queue Row ─────────────────────────────────────────────────────────────────

function QueueRow({ order, index, total, onMoveUp, onMoveDown, reordering }) {
  const isDelivered = order.status === 'delivered';
  const isActive    = order.status === 'delivering';
  const isPending   = order.status === 'ready';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 10, background: '#1E1E1E',
      border: `1px solid ${isDelivered ? '#065F46' : isActive ? '#4C1D95' : C.border}`,
      opacity: isDelivered ? 0.65 : 1,
    }}>
      {/* Priority badge */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: isDelivered ? '#065F46' : isActive ? '#4C1D95' : '#2A2A2A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `2px solid ${isDelivered ? C.success : isActive ? '#A78BFA' : C.border}`,
      }}>
        {isDelivered
          ? <CheckCircle size={14} color={C.success} />
          : <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? '#A78BFA' : C.muted }}>{index + 1}°</span>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          #{order.order_number || String(order.id).slice(-4).toUpperCase()} — {order.customer_name}
        </p>
        <p style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
          {order.delivery_street}, {order.delivery_number} · {order.delivery_neighborhood}
        </p>
        <p style={{ fontSize: 10, marginTop: 1 }}>
          <span style={{ color: STATUS_COLOR[order.status] || C.muted, fontWeight: 600 }}>
            {STATUS_LABEL[order.status] || order.status}
          </span>
          <span style={{ color: C.light }}> · {fmtBRL(order.delivery_fee)} taxa</span>
        </p>
      </div>

      {/* Reorder buttons */}
      {!isDelivered && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0 || reordering}
            style={{ padding: '4px 6px', background: index === 0 ? '#2A2A2A' : '#333', border: `1px solid ${C.border}`, borderRadius: 5, cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.35 : 1 }}
          >
            <ChevronUp size={13} color={C.muted} />
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1 || reordering}
            style={{ padding: '4px 6px', background: index === total - 1 ? '#2A2A2A' : '#333', border: `1px solid ${C.border}`, borderRadius: 5, cursor: index === total - 1 ? 'not-allowed' : 'pointer', opacity: index === total - 1 ? 0.35 : 1 }}
          >
            <ChevronDown size={13} color={C.muted} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DeliveryQueueTab({ adminToken }) {
  const [persons, setPersons]         = useState([]);
  const [loadingPersons, setLoadingPersons] = useState(true);
  const [selectedId, setSelectedId]   = useState(null);
  const [queue, setQueue]             = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [reordering, setReordering]   = useState(false);

  // Night summary modal
  const [nightModal, setNightModal]   = useState(null); // { person, orders, totalEarned }
  const [loadingModal, setLoadingModal] = useState(false);

  // Load delivery persons
  useEffect(() => {
    setLoadingPersons(true);
    adminPost('get_delivery_persons', {}, adminToken)
      .then(j => setPersons((j.persons || []).filter(p => p.is_active)))
      .catch(() => {})
      .finally(() => setLoadingPersons(false));
  }, [adminToken]);

  const loadQueue = useCallback(async (personId) => {
    setLoadingQueue(true);
    try {
      const j = await adminPost('get_delivery_queue', { person_id: personId }, adminToken);
      setQueue(j.orders || []);
    } catch (e) { console.error(e); }
    finally { setLoadingQueue(false); }
  }, [adminToken]);

  function selectPerson(id) {
    setSelectedId(id);
    loadQueue(id);
  }

  async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= queue.length) return;
    const next = [...queue];
    [next[index], next[target]] = [next[target], next[index]];
    setQueue(next);
    setReordering(true);
    try {
      await adminPost('set_delivery_priority', { ordered_ids: next.map(o => o.id) }, adminToken);
    } catch (e) { console.error(e); }
    finally { setReordering(false); }
  }

  async function openNightModal(person) {
    const todaySP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    setNightModal({ person, orders: [], totalEarned: 0 });
    setLoadingModal(true);
    try {
      const j = await adminPost('get_delivery_history', { person_id: person.id, from: todaySP, to: todaySP }, adminToken);
      setNightModal({ person, orders: j.orders || [], totalEarned: j.totalEarned || 0 });
    } catch (e) { console.error(e); }
    finally { setLoadingModal(false); }
  }

  const selectedPerson = persons.find(p => p.id === selectedId);
  const openOrders     = queue.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const doneOrders     = queue.filter(o => o.status === 'delivered');
  const totalFees      = doneOrders.reduce((s, o) => s + (parseFloat(o.delivery_fee) || 0), 0);

  return (
    <div>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, minHeight: 480 }}>

        {/* ── Driver list (left panel) ── */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: C.card }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, background: '#1A1A1A' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Entregadores</p>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Selecione para ver fila</p>
          </div>

          {loadingPersons ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={20} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : persons.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 12, padding: '20px 14px' }}>Nenhum entregador ativo</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {persons.map((p, idx) => {
                const color     = DRIVER_COLORS[idx % DRIVER_COLORS.length];
                const isActive  = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPerson(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                      background: isActive ? '#2A2A2A' : 'transparent',
                      border: 'none', borderBottom: `1px solid ${C.border}`,
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid rgba(255,255,255,0.15)' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{(p.name || '?')[0].toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#fff' : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        onClick={(e) => { e.stopPropagation(); openNightModal(p); }}
                        title="Clique no nome para ver o resumo da noite"
                      >
                        {p.name}
                      </p>
                      <p style={{ fontSize: 10, color: C.light }}>ver resumo →</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Queue panel (right) ── */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: C.card }}>
          {!selectedId ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, color: C.muted, gap: 10 }}>
              <Truck size={36} color={C.light} />
              <p style={{ fontSize: 14, color: C.muted }}>Selecione um entregador à esquerda</p>
            </div>
          ) : (
            <>
              {/* Queue header */}
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    Fila de entregas — {selectedPerson?.name}
                  </p>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {openOrders.length} pendente(s) · {doneOrders.length} entregue(s) · taxa acumulada: <span style={{ color: C.gold, fontWeight: 700 }}>{fmtBRL(totalFees)}</span>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {reordering && <Loader2 size={14} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />}
                  <button
                    onClick={() => loadQueue(selectedId)}
                    disabled={loadingQueue}
                    style={{ padding: '6px 10px', background: '#2A2A2A', border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: C.muted, fontSize: 12 }}
                  >
                    <RefreshCw size={13} style={loadingQueue ? { animation: 'spin 1s linear infinite' } : {}} />
                    Atualizar
                  </button>
                  <button
                    onClick={() => openNightModal(selectedPerson)}
                    style={{ padding: '6px 12px', background: C.purple, border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#fff', fontSize: 12, fontWeight: 700 }}
                  >
                    <DollarSign size={13} /> Resumo da noite
                  </button>
                </div>
              </div>

              {/* Queue items */}
              {loadingQueue ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={22} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : queue.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', gap: 8, color: C.muted }}>
                  <Package size={32} color={C.light} />
                  <p style={{ fontSize: 13 }}>Nenhum pedido hoje para este entregador</p>
                </div>
              ) : (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 520 }}>
                  {/* Info note */}
                  {openOrders.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, marginBottom: 4 }}>
                      <AlertCircle size={13} color='#A78BFA' />
                      <p style={{ fontSize: 11, color: '#A78BFA' }}>
                        Use as setas para reordenar a fila. O entregador só acessa o próximo pedido quando o atual for entregue.
                      </p>
                    </div>
                  )}

                  {/* Active/pending orders */}
                  {openOrders.length > 0 && (
                    <>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Em fila</p>
                      {openOrders.map((order, idx) => (
                        <QueueRow
                          key={order.id}
                          order={order}
                          index={idx}
                          total={openOrders.length}
                          onMoveUp={(i) => {
                            // Find real index in full queue
                            const ri = queue.indexOf(openOrders[i]);
                            move(ri, -1);
                          }}
                          onMoveDown={(i) => {
                            const ri = queue.indexOf(openOrders[i]);
                            move(ri, 1);
                          }}
                          reordering={reordering}
                        />
                      ))}
                    </>
                  )}

                  {/* Delivered orders */}
                  {doneOrders.length > 0 && (
                    <>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 2 }}>Já entregues</p>
                      {doneOrders.map((order, idx) => (
                        <QueueRow
                          key={order.id}
                          order={order}
                          index={idx}
                          total={0}
                          onMoveUp={() => {}}
                          onMoveDown={() => {}}
                          reordering={false}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Night summary modal */}
      {nightModal && (
        <NightModal
          person={nightModal.person}
          orders={nightModal.orders}
          totalEarned={nightModal.totalEarned}
          loading={loadingModal}
          onClose={() => setNightModal(null)}
        />
      )}
    </div>
  );
}
