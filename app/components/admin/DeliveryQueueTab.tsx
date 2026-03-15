'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Loader2, Truck, DollarSign,
  Package, X, CheckCircle, AlertCircle, RefreshCw, BarChart2, GripVertical,
} from 'lucide-react';
import { createAdminClient } from '../../../lib/api-client';
import { clientError } from '../../../lib/client-logger';

// ── Theme (light mode) ────────────────────────────────────────────────────────
const C = {
  gold:    '#D97706',
  bg:      '#F8FAFC',
  card:    '#FFFFFF',
  border:  '#E5E7EB',
  text:    '#111827',
  muted:   '#6B7280',
  light:   '#9CA3AF',
  success: '#059669',
  danger:  '#EF4444',
  purple:  '#7C3AED',
  blue:    '#2563EB',
  subHeader: '#F9FAFB',
};

const DRIVER_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#BE185D'];

function fmtBRL(v: any) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtTime(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}


const STATUS_LABEL: Record<string, string> = {
  ready:      '📦 Aguardando',
  delivering: '🏍️ Em rota',
  delivered:  '✅ Entregue',
  cancelled:  '❌ Cancelado',
};
const STATUS_COLOR: Record<string, string> = {
  ready:      '#D97706',
  delivering: '#7C3AED',
  delivered:  '#059669',
  cancelled:  '#EF4444',
};

// ── Night Summary Modal ───────────────────────────────────────────────────────

function NightModal({ person, orders, totalEarned, loading, onClose }: { person: any; orders: any[]; totalEarned: any; loading: boolean; onClose: () => void }) {
  const delivered   = orders.filter((o: any) => o.status === 'delivered');
  const inProgress  = orders.filter((o: any) => ['ready', 'delivering'].includes(o.status));
  const cancelled   = orders.filter((o: any) => o.status === 'cancelled');
  const totalOrders = orders.reduce((s: number, o: any) => s + (parseFloat(o.total) || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: '85dvh', display: 'flex', flexDirection: 'column', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.subHeader }}>
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
            { label: 'Entregues',   value: delivered.length,    color: C.success },
            { label: 'Em rota',     value: inProgress.length,   color: C.purple  },
            { label: 'Cancelados',  value: cancelled.length,    color: C.danger  },
            { label: 'Taxa receb.', value: fmtBRL(totalEarned), color: C.gold    },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#F3F4F6', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
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
              orders.map((o: any, idx: number) => (
                <div key={o.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, background: C.subHeader }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.subHeader }}>
          <p style={{ fontSize: 12, color: C.muted }}>
            {delivered.length} pedido(s) entregue(s) · valor total: <strong style={{ color: C.text }}>{fmtBRL(totalOrders)}</strong>
          </p>
          <p style={{ fontSize: 16, fontWeight: 800, color: C.gold }}>Taxa: {fmtBRL(totalEarned)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Queue Row (drag-and-drop) ─────────────────────────────────────────────────

function QueueRow({ order, index, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }: { order: any; index: number; isDragging: boolean; isDragOver: boolean; onDragStart: any; onDragOver: any; onDrop: any; onDragEnd: any }) {
  const isDelivered = order.status === 'delivered';
  const isActive    = order.status === 'delivering';

  return (
    <div
      draggable={!isDelivered}
      onDragStart={isDelivered ? undefined : onDragStart}
      onDragOver={isDelivered ? undefined : onDragOver}
      onDrop={isDelivered ? undefined : onDrop}
      onDragEnd={isDelivered ? undefined : onDragEnd}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10, background: isDragOver ? '#EEF2FF' : C.card,
        border: `1px solid ${isDragOver ? '#818CF8' : isDelivered ? '#D1FAE5' : isActive ? '#EDE9FE' : C.border}`,
        opacity: isDragging ? 0.4 : isDelivered ? 0.7 : 1,
        cursor: isDelivered ? 'default' : 'grab',
        transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
        userSelect: 'none',
      }}
    >
      {/* Drag handle */}
      {!isDelivered ? (
        <GripVertical size={16} color={C.light} style={{ flexShrink: 0 }} />
      ) : (
        <CheckCircle size={16} color={C.success} style={{ flexShrink: 0 }} />
      )}

      {/* Priority badge */}
      {!isDelivered && (
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: isActive ? '#EDE9FE' : '#F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${isActive ? '#A78BFA' : C.border}`,
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: isActive ? C.purple : C.muted }}>{index + 1}°</span>
        </div>
      )}

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
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DeliveryQueueTab({ adminToken }: { adminToken: string }) {
  const api = useMemo(() => createAdminClient(adminToken), [adminToken]);
  const [persons, setPersons]               = useState<any[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(true);
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [queue, setQueue]                   = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue]     = useState(false);
  const [reordering, setReordering]         = useState(false);

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const [draggingId, setDraggingId]   = useState<string | null>(null);
  const [dragOverId, setDragOverId]   = useState<string | null>(null);

  // Night summary modal
  const [nightModal, setNightModal]     = useState<any>(null);
  const [loadingModal, setLoadingModal] = useState(false);

  // Load delivery persons
  useEffect(() => {
    setLoadingPersons(true);
    api.delivery.getPersons()
      .then(j => setPersons((j.persons || []).filter((p: any) => p.is_active)))
      .catch(() => {})
      .finally(() => setLoadingPersons(false));
  }, [api]);

  const loadQueue = useCallback(async (personId: string) => {
    setLoadingQueue(true);
    try {
      const j = await api.delivery.getQueue({ person_id: personId });
      setQueue(j.orders || []);
    } catch (e) { clientError(e); }
    finally { setLoadingQueue(false); }
  }, [api]);

  function selectPerson(id: string) {
    setSelectedId(id);
    loadQueue(id);
  }

  async function openNightModal(person: any) {
    const todaySP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    setNightModal({ person, orders: [], totalEarned: 0 });
    setLoadingModal(true);
    try {
      const j = await api.delivery.getHistory({ person_id: person.id, from: todaySP, to: todaySP });
      setNightModal({ person, orders: j.orders || [], totalEarned: j.totalEarned || 0 });
    } catch (e) { clientError(e); }
    finally { setLoadingModal(false); }
  }

  // ── Drag & Drop handlers ────────────────────────────────────────────────────

  function handleDragStart(order: any) {
    dragIndex.current = openOrders.findIndex(o => o.id === order.id);
    setDraggingId(order.id);
  }

  function handleDragOver(e: React.DragEvent, order: any) {
    e.preventDefault();
    setDragOverId(order.id);
  }

  async function handleDrop(targetOrder: any) {
    const fromIdx = dragIndex.current;
    const toIdx   = openOrders.findIndex(o => o.id === targetOrder.id);
    if (fromIdx === null || fromIdx === toIdx) return;

    // Reorder openOrders
    const reordered = [...openOrders];
    const [moved]   = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Rebuild full queue: reordered open orders + delivered orders at end
    const next = [...reordered, ...doneOrders];
    setQueue(next);
    setDraggingId(null);
    setDragOverId(null);
    dragIndex.current = null;

    setReordering(true);
    try {
      await api.delivery.setPriority({ ordered_ids: next.map(o => o.id) });
    } catch (e) { clientError(e); }
    finally { setReordering(false); }
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
    dragIndex.current = null;
  }

  const selectedPerson = persons.find(p => p.id === selectedId);
  const openOrders     = queue.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const doneOrders     = queue.filter(o => o.status === 'delivered');
  const totalFees      = doneOrders.reduce((s, o) => s + (parseFloat(o.delivery_fee) || 0), 0);

  return (
    <div style={{ background: C.bg, borderRadius: 12, padding: 0 }}>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, minHeight: 480 }}>

        {/* ── Driver list (left panel) ── */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: C.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, background: C.subHeader }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Entregadores</p>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Clique para ver a fila de entregas</p>
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
                const color    = DRIVER_COLORS[idx % DRIVER_COLORS.length];
                const isActive = p.id === selectedId;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                      background: isActive ? '#EEF2FF' : C.card,
                      borderBottom: `1px solid ${C.border}`,
                      borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
                    }}
                  >
                    {/* Main select area */}
                    <button
                      onClick={() => selectPerson(p.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        flex: 1, minWidth: 0, background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left', padding: 0,
                      }}
                      title="Clique para ver a fila de pedidos"
                    >
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid rgba(255,255,255,0.3)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{(p.name || '?')[0].toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: isActive ? C.blue : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </p>
                        <p style={{ fontSize: 10, color: C.muted }}>
                          {isActive ? '✓ Selecionado' : 'Ver fila →'}
                        </p>
                      </div>
                    </button>

                    {/* Night summary button — clearly separated */}
                    <button
                      onClick={() => openNightModal(p)}
                      title="Resumo da noite"
                      style={{
                        flexShrink: 0, padding: '5px 7px', borderRadius: 7,
                        background: '#F3F4F6', border: `1px solid ${C.border}`,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        color: C.muted, fontSize: 10, fontWeight: 600,
                      }}
                    >
                      <BarChart2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Queue panel (right) ── */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: C.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {!selectedId ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, gap: 10 }}>
              <Truck size={36} color={C.light} />
              <p style={{ fontSize: 14, color: C.muted }}>Selecione um entregador à esquerda para ver a fila</p>
            </div>
          ) : (
            <>
              {/* Queue header */}
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.subHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    Fila de entregas — {selectedPerson?.name}
                  </p>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {openOrders.length} pendente(s) · {doneOrders.length} entregue(s) · taxa acumulada: <span style={{ color: C.gold, fontWeight: 700 }}>{fmtBRL(totalFees)}</span>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {reordering && <Loader2 size={14} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />}
                  <button
                    onClick={() => loadQueue(selectedId)}
                    disabled={loadingQueue}
                    style={{ padding: '6px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: C.muted, fontSize: 12 }}
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', gap: 8 }}>
                  <Package size={32} color={C.light} />
                  <p style={{ fontSize: 13, color: C.muted }}>Nenhum pedido hoje para este entregador</p>
                </div>
              ) : (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 520 }}>
                  {/* Info note */}
                  {openOrders.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8, marginBottom: 4 }}>
                      <AlertCircle size={13} color={C.blue} />
                      <p style={{ fontSize: 11, color: C.blue }}>
                        Arraste os pedidos para reordenar a fila. O entregador só acessa o próximo pedido quando o atual for entregue.
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
                          isDragging={draggingId === order.id}
                          isDragOver={dragOverId === order.id}
                          onDragStart={() => handleDragStart(order)}
                          onDragOver={(e: React.DragEvent) => handleDragOver(e, order)}
                          onDrop={() => handleDrop(order)}
                          onDragEnd={handleDragEnd}
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
                          isDragging={false}
                          isDragOver={false}
                          onDragStart={() => {}}
                          onDragOver={() => {}}
                          onDrop={() => {}}
                          onDragEnd={() => {}}
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
