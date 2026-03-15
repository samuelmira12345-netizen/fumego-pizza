'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import OrderCard from './OrderCard';

const DROP_TARGET_STATUS: Record<string, string> = {
  novos:       'pending',
  agendados:   'scheduled',
  preparo:     'confirmed',
  prontos:     'ready',
  entrega:     'delivering',
  finalizados: 'delivered',
};

interface Props {
  col: any;
  orders: any;
  onCardClick: any;
  newIds: any;
  readyIds: any;
  onDragStart: any;
  onDrop: any;
  deliveryPersonsById: any;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function KDSColumn({
  col, orders, onCardClick, newIds, readyIds, onDragStart, onDrop,
  deliveryPersonsById, collapsed = false, onToggleCollapse,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);

  const cards = orders
    .filter((o: any) => col.statuses.includes(o.status))
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const Icon = col.cfg.icon;

  // ── Collapsed: render thin vertical strip ──────────────────────────────────
  if (collapsed) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          width: 44, minWidth: 44, flexShrink: 0,
          background: col.cfg.headerBg,
          borderRadius: 6,
          cursor: 'pointer',
          overflow: 'hidden',
          transition: 'width 0.2s ease, min-width 0.2s ease',
          position: 'relative',
        }}
        onClick={onToggleCollapse}
        title={`Expandir coluna: ${col.cfg.label}`}
      >
        {/* Count badge */}
        <div style={{
          background: 'rgba(255,255,255,0.2)', color: '#fff',
          fontSize: 12, fontWeight: 900, width: 26, height: 26, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '10px auto 6px',
        }}>
          {cards.length}
        </div>

        {/* Rotated label */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          writingMode: 'vertical-rl', textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 1,
          padding: '6px 0',
          userSelect: 'none',
        }}>
          {col.cfg.label}
        </div>

        {/* Expand icon */}
        <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center' }}>
          <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
        </div>
      </div>
    );
  }

  // ── Expanded: full column ───────────────────────────────────────────────────
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
        height: '100%',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            background: 'rgba(255,255,255,0.22)', color: '#fff',
            fontSize: 13, fontWeight: 900, minWidth: 24, height: 24, borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
          }}>
            {cards.length}
          </div>
          {/* Collapse button */}
          {onToggleCollapse && (
            <button
              onClick={e => { e.stopPropagation(); onToggleCollapse(); }}
              title="Recolher coluna"
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 3,
                width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <ChevronLeft size={13} color="rgba(255,255,255,0.85)" />
            </button>
          )}
        </div>
      </div>

      {isDragOver && (
        <div style={{ padding: '8px 9px 0' }}>
          <div style={{ border: `2px dashed ${col.cfg.headerBg}`, borderRadius: 4, padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: col.cfg.headerBg }}>
            Soltar aqui → {col.cfg.label}
          </div>
        </div>
      )}

      {/* Cards — scrollable, all items always visible */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '9px 9px 12px',
        display: 'flex', flexDirection: 'column', gap: 7,
      }}>
        {cards.length === 0 && !isDragOver ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: col.cfg.color + '70', fontSize: 13 }}>
            <Icon size={26} style={{ margin: '0 auto 9px', display: 'block', opacity: 0.35 }} />
            Nenhum pedido
          </div>
        ) : (
          cards.map((o: any) => (
            <OrderCard
              key={o.id}
              order={o}
              onClick={() => onCardClick(o)}
              isNew={newIds.has(o.id)}
              isReady={readyIds ? readyIds.has(o.id) : false}
              onDragStart={onDragStart}
              deliveryPersonName={deliveryPersonsById[String(o.delivery_person_id)] || o.delivery_person_name || ''}
            />
          ))
        )}
      </div>
    </div>
  );
}
