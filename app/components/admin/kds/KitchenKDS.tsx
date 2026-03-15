'use client';

import React, { useState, useEffect } from 'react';
import { ChefHat, X, PackageCheck, Volume2, VolumeX } from 'lucide-react';
import { fmtElapsed, elapsedMins, fmtTime } from './kdsUtils';

// ── KitchenOrderDetailsModal ──────────────────────────────────────────────────

function KitchenOrderDetailsModal({ order, onClose }: { order: any, onClose: any }) {
  if (!order) return null;
  const kitchenItems = (order.order_items || []).filter((item: any) => !item?.drink_id);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ width: 'min(640px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 18 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Detalhes para cozinha</p>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#111827', fontFamily: 'monospace' }}>#{order.order_number || String(order.id).slice(-4).toUpperCase()}</p>
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, width: 32, height: 32, cursor: 'pointer' }}>
            <X size={15} color="#6B7280" />
          </button>
        </div>

        <div style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{order.customer_name}</p>
          <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            ⏱ {fmtElapsed(elapsedMins(order.created_at))} · entrou às {fmtTime(order.created_at)}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {kitchenItems.length > 0 ? kitchenItems.map((item: any, i: any) => (
            <div key={`${order.id}-kitchen-item-${i}`} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#D97706', minWidth: 28, fontFamily: 'monospace' }}>{item.quantity}×</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{item.product_name}</span>
              </div>
              {item.observations && (
                <p style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '4px 8px', marginTop: 6, marginLeft: 26 }}>
                  ⚠️ {item.observations}
                </p>
              )}
            </div>
          )) : (
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Itens não disponíveis.</p>
          )}
        </div>

        {order.observations && (
          <div style={{ marginTop: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: 0.8 }}>Observações gerais</p>
            <p style={{ fontSize: 13, color: '#7F1D1D', marginTop: 4 }}>{order.observations}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KitchenOrderCard ──────────────────────────────────────────────────────────

function KitchenOrderCard({ order, onMarkReady, onOpenDetails, minCardHeight }: { order: any, onMarkReady: any, onOpenDetails: any, minCardHeight: any }) {
  const isItemsLoading = !!order.order_items_loading;
  const [marking, setMarking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checkedItems, setCheckedItems] = useState<any>({});
  const mins = elapsedMins(order.created_at);
  const urgentColor = mins >= 30 ? '#EF4444' : mins >= 20 ? '#D97706' : '#10B981';
  const urgentBg    = mins >= 30 ? '#FEF2F2' : mins >= 20 ? '#FFFBEB' : '#ECFDF5';
  const kitchenItems = (order.order_items || []).filter((item: any) => !item?.drink_id);

  useEffect(() => {
    setCheckedItems({});
  }, [order.id, kitchenItems.length]);

  const isEveryKitchenItemChecked = kitchenItems.length > 0 && kitchenItems.every((item: any, idx: any) => {
    const itemKey = `${item.product_name || 'item'}-${idx}-${item.quantity || 1}`;
    return !!checkedItems[itemKey];
  });

  async function confirmReady() {
    setShowConfirm(false);
    setMarking(true);
    await onMarkReady();
    setMarking(false);
  }

  async function handleToggleItem(item: any, idx: any) {
    const itemKey = `${item.product_name || 'item'}-${idx}-${item.quantity || 1}`;
    const nextChecked = !checkedItems[itemKey];
    const nextState = { ...checkedItems, [itemKey]: nextChecked };
    setCheckedItems(nextState);

    const allChecked = kitchenItems.length > 0 && kitchenItems.every((kItem: any, kIdx: any) => {
      const key = `${kItem.product_name || 'item'}-${kIdx}-${kItem.quantity || 1}`;
      return key === itemKey ? nextChecked : !!nextState[key];
    });

    if (allChecked && !marking) {
      setMarking(true);
      await onMarkReady();
      setMarking(false);
    }
  }

  return (
    <div
      onClick={onOpenDetails}
      style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${urgentColor}35`,
      borderLeft: `5px solid ${urgentColor}`,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: minCardHeight || 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      cursor: 'pointer',
    }}>
      {/* Número + timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 32, fontWeight: 900, color: '#111827', fontFamily: 'monospace', letterSpacing: -1 }}>
          #{order.order_number || String(order.id).slice(-4).toUpperCase()}
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 20, fontWeight: 800, fontFamily: 'monospace',
            color: urgentColor,
            background: urgentBg,
            padding: '4px 10px', borderRadius: 6,
            border: `1px solid ${urgentColor}25`,
          }}>
            ⏱ {fmtElapsed(mins)}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
            Chegou: {fmtTime(order.created_at)}
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{order.customer_name}</span>
        {order.delivery_neighborhood && (
          <span style={{ fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '2px 7px', borderRadius: 4 }}>
            📍 {order.delivery_neighborhood}
          </span>
        )}
      </div>

      {/* Preview de itens para cozinha */}
      <div style={{ marginTop: 4, borderTop: '1px dashed #E5E7EB', paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isItemsLoading ? (
          <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Carregando itens...</p>
        ) : kitchenItems.length === 0 ? (
          <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Sem itens para este pedido.</p>
        ) : (
          kitchenItems.map((item: any, idx: any) => {
            const itemKey = `${item.product_name || 'item'}-${idx}-${item.quantity || 1}`;
            const isChecked = !!checkedItems[itemKey];
            return (
            <div key={`${order.id}-kitchen-preview-item-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={isChecked}
                onClick={e => e.stopPropagation()}
                onChange={() => handleToggleItem(item, idx)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: '#2563EB', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 15, fontWeight: 900, color: '#D97706', minWidth: 26, fontFamily: 'monospace' }}>
                {parseInt(item.quantity, 10) || 1}x
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 14, color: isChecked ? '#2563EB' : '#111827', lineHeight: 1.3, fontWeight: 800, wordBreak: 'break-word' }}>
                  {item.product_name || 'Item'}
                </p>
                {item.observations && (
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2, lineHeight: 1.25, wordBreak: 'break-word' }}>
                    Obs: {item.observations}
                  </p>
                )}
              </div>
            </div>
          )})
        )}
      </div>

      {/* Observações do pedido */}
      {order.observations && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px' }}>
          <p style={{ fontSize: 13, color: '#92400E', fontWeight: 600 }}>⚠️ {order.observations}</p>
        </div>
      )}

      {/* Confirmação */}
      {showConfirm ? (
        <div style={{ background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#15803D', marginBottom: 12 }}>
            ✅ Confirmar que o pedido está pronto?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={e => {
                e.stopPropagation();
                confirmReady();
              }}
              style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
            >
              Sim, está pronto!
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                setShowConfirm(false);
              }}
              style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        /* Botão PRONTO */
        <button
          disabled={marking || isEveryKitchenItemChecked}
          onClick={e => {
            e.stopPropagation();
            setShowConfirm(true);
          }}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            fontSize: 16, fontWeight: 900, cursor: marking || isEveryKitchenItemChecked ? 'not-allowed' : 'pointer',
            background: marking || isEveryKitchenItemChecked ? '#9CA3AF' : '#10B981',
            color: '#fff', letterSpacing: 0.5, transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {marking
            ? 'Registrando...'
            : isEveryKitchenItemChecked
              ? 'Pedido finalizado'
            : <><PackageCheck size={20} /> MARCAR PRONTO</>
          }
        </button>
      )}
    </div>
  );
}

// ── KitchenKDS ────────────────────────────────────────────────────────────────

export default function KitchenKDS({ orders, onMarkReady, soundOn, setSoundOn }: { orders: any, onMarkReady: any, soundOn: any, setSoundOn: any }) {
  const [clockTick, setClockTick] = useState(0);
  const [detailOrderId, setDetailOrderId] = useState<any>(null);
  useEffect(() => {
    const iv = setInterval(() => setClockTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  // Only show orders that need kitchen action (not 'ready' — they disappear after marking)
  const kitchenOrders = orders
    .filter((o: any) => ['confirmed', 'preparing'].includes(o.status))
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const maxItemsInKitchen = Math.max(1, ...kitchenOrders.map((o: any) => (o.order_items || []).filter((item: any) => !item?.drink_id).length || 1));
  const minKitchenCardHeight = 180 + (maxItemsInKitchen * 28);
  const detailOrder = kitchenOrders.find((o: any) => o.id === detailOrderId) || null;

  return (
    <div style={{ flex: 1, background: '#F8FAFC', overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header da cozinha */}
      <div style={{ background: '#fff', borderBottom: '2px solid #E5E7EB', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={22} color="#D97706" />
          </div>
          <div>
            <span style={{ fontSize: 17, fontWeight: 900, color: '#111827', letterSpacing: 0.3 }}>COZINHA — KDS</span>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
              {kitchenOrders.length === 0 ? 'Nenhum pedido em preparo' : `${kitchenOrders.length} pedido${kitchenOrders.length !== 1 ? 's' : ''} em preparo`}
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Clock */}
        <div style={{ textAlign: 'right', padding: '4px 12px', background: '#F3F4F6', borderRadius: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', fontFamily: 'monospace' }}>
            {new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
            {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit' })}
          </div>
        </div>
        <button onClick={() => setSoundOn((s: any) => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: '1px solid ' + (soundOn ? '#A7F3D0' : '#E5E7EB'), background: soundOn ? '#ECFDF5' : '#F9FAFB', color: soundOn ? '#059669' : '#9CA3AF', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />} Som
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {kitchenOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9CA3AF' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ChefHat size={40} color="#D1D5DB" />
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Cozinha liberada!</p>
            <p style={{ fontSize: 14, color: '#9CA3AF' }}>Nenhum pedido aguardando preparo.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <ChefHat size={16} color="#2563EB" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#2563EB', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Em Preparo ({kitchenOrders.length})
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {kitchenOrders.map((o: any) => (
                <KitchenOrderCard
                  key={o.id}
                  order={o}
                  onMarkReady={() => onMarkReady(o.id)}
                  onOpenDetails={() => setDetailOrderId(o.id)}
                  minCardHeight={minKitchenCardHeight}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {detailOrder && (
        <KitchenOrderDetailsModal
          order={detailOrder}
          onClose={() => setDetailOrderId(null)}
        />
      )}
    </div>
  );
}
