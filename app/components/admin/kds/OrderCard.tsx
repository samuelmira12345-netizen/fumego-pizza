'use client';

import React from 'react';
import { Bike } from 'lucide-react';
import { S, elapsedMins, getNameInitials, timerColor, fmtElapsed } from './kdsUtils';

export default function OrderCard({ order, onClick, isNew, isReady, onDragStart, deliveryPersonName }: { order: any, onClick: any, isNew: any, isReady: any, onDragStart: any, deliveryPersonName: any }) {
  const cfg  = (S as any)[order.status] || S.pending;
  const mins = elapsedMins(order.created_at);
  const initials = getNameInitials(deliveryPersonName);
  const isDelivering = order.status === 'delivering';
  const isPaidOnline = order.payment_status === 'approved' && ['pix', 'card', 'card_credit', 'card_debit'].includes(order.payment_method);

  const borderColor = isReady ? '#F59E0B' : isNew ? cfg.color : '#D1D5DB';
  const shadow = isReady
    ? '0 0 0 2px #F59E0B40, 0 2px 8px rgba(245,158,11,0.25)'
    : isNew
      ? `0 0 0 2px ${cfg.color}30, 0 2px 6px rgba(0,0,0,0.07)`
      : '0 1px 2px rgba(0,0,0,0.05)';

  return (
    <div
      draggable
      onDragStart={e => { onDragStart(order); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={onClick}
      style={{
        background: isReady ? '#FFFDF5' : '#fff',
        borderRadius: 4,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${cfg.color}`,
        padding: '11px 12px 10px',
        cursor: 'grab',
        boxShadow: shadow,
        transition: 'box-shadow 0.12s, transform 0.1s, opacity 0.1s',
        position: 'relative',
        userSelect: 'none',
        animation: isReady ? 'kdsReadyPulse 1.5s ease-in-out infinite' : undefined,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.12)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = shadow;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {isReady && (
        <div style={{
          position: 'absolute', top: 9, right: isNew ? 22 : 9,
          width: 8, height: 8, borderRadius: '50%', background: '#F59E0B',
          boxShadow: '0 0 0 3px #FEF3C7',
          animation: 'kdsPulse 1.2s ease-in-out infinite',
        }} />
      )}

      {isPaidOnline && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10, fontWeight: 800,
          color: '#065F46', background: '#ECFDF5', border: '1px solid #A7F3D0',
          borderRadius: 999, padding: '2px 7px',
        }}>
          <input type="checkbox" checked readOnly style={{ width: 12, height: 12, accentColor: '#059669' }} />
          PAGO
        </div>
      )}
      {isNew && (
        <div style={{
          position: 'absolute', top: 9, right: 9,
          width: 8, height: 8, borderRadius: '50%', background: '#EF4444',
          boxShadow: '0 0 0 3px #FEE2E2',
          animation: 'kdsPulse 1.2s ease-in-out infinite',
        }} />
      )}

      {/* Número + timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 19, fontWeight: 900, color: '#111827', fontFamily: 'monospace', letterSpacing: -0.5 }}>
          #{order.order_number || String(order.id).slice(-4).toUpperCase()}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
          background: timerColor(mins) + '15',
          color: timerColor(mins),
          border: `1px solid ${timerColor(mins)}35`,
        }}>
          ⏱ {fmtElapsed(mins)}
        </span>
      </div>

      {/* Cliente */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {order.customer_name}
        </p>
        {isDelivering && initials && (
          <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F5F3FF', color: '#6D28D9', border: '1px solid #DDD6FE', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 800 }}>
            <Bike size={12} />
            <span>{initials}</span>
          </div>
        )}
      </div>

    </div>
  );
}
