'use client';

import React, { useState } from 'react';
import OrderCard from './OrderCard';

const DROP_TARGET_STATUS: Record<string, string> = {
  novos:       'pending',
  agendados:   'scheduled',
  preparo:     'confirmed',
  prontos:     'ready',
  entrega:     'delivering',
  finalizados: 'delivered',
};

export default function KDSColumn({ col, orders, onCardClick, newIds, readyIds, onDragStart, onDrop, deliveryPersonsById }: { col: any, orders: any, onCardClick: any, newIds: any, readyIds: any, onDragStart: any, onDrop: any, deliveryPersonsById: any }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const cards = orders
    .filter((o: any) => col.statuses.includes(o.status))
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const Icon = col.cfg.icon;
  const isFinalized = col.id === 'finalizados';
  const visible = isFinalized ? cards.slice(-8) : cards;
  return (
    <div
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => { e.preventDefault(); setIsDragOver(false); onDrop(DROP_TARGET_STATUS[col.id]); }}
      style={{
        display: 'flex', flexDirection: 'column',
        flex: '1 1 260px', minWidth: 220,
        background: isDragOver ? col.cfg.bg : '#F8FAFC',
        borderRadius: 6,
        border: `${isDragOver ? 2 : 1}px solid ${isDragOver ? col.cfg.headerBg : col.cfg.border}`,
        maxHeight: '100%',
        overflow: 'hidden',
        transition: 'border 0.12s, background 0.12s',
      }}
    >
      <div style={{
        background: col.cfg.headerBg,
        padding: '10px 13px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, borderRadius: isDragOver ? '4px 4px 0 0' : '5px 5px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <Icon size={14} color="#fff" />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 0.8 }}>{col.cfg.label}</span>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.22)', color: '#fff',
          fontSize: 13, fontWeight: 900, minWidth: 24, height: 24, borderRadius: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
        }}>
          {cards.length}
        </div>
      </div>

      {isDragOver && (
        <div style={{ padding: '8px 9px 0' }}>
          <div style={{ border: `2px dashed ${col.cfg.headerBg}`, borderRadius: 4, padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: col.cfg.headerBg }}>
            Soltar aqui → {col.cfg.label}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '9px 9px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {visible.length === 0 && !isDragOver ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: col.cfg.color + '70', fontSize: 13 }}>
            <Icon size={26} style={{ margin: '0 auto 9px', display: 'block', opacity: 0.35 }} />
            Nenhum pedido
          </div>
        ) : (
          <>
            {isFinalized && cards.length > 8 && (
              <p style={{ textAlign: 'center', fontSize: 11, color: col.cfg.color, fontWeight: 600, padding: '3px 0' }}>
                +{cards.length - 8} pedidos anteriores
              </p>
            )}
            {visible.map((o: any) => (
              <OrderCard
                key={o.id}
                order={o}
                onClick={() => onCardClick(o)}
                isNew={newIds.has(o.id)}
                isReady={readyIds ? readyIds.has(o.id) : false}
                onDragStart={onDragStart}
                deliveryPersonName={deliveryPersonsById[String(o.delivery_person_id)] || o.delivery_person_name || ''}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
