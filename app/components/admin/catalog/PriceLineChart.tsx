'use client';

import React, { useState } from 'react';
import { C } from './catalogUtils';

export default function PriceLineChart({ points }: { points: any }) {
  const [hovered, setHovered] = useState<any>(null);
  if (!points || points.length < 2) return null;

  const prices = points.map((p: any) => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const W = 400, H = 80, padL = 8, padR = 8, padT = 16, padB = 16;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = points.length;

  function px(i: any) { return padL + (i / (n - 1)) * chartW; }
  function py(price: any) { return padT + chartH - ((price - minP) / range) * chartH; }

  const polyPoints = points.map((p: any, i: any) => `${px(i)},${py(p.price)}`).join(' ');

  function fmtBRLshort(v: any) {
    if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
    return `R$${(v || 0).toFixed(2).replace('.', ',')}`;
  }

  return (
    <div style={{ position: 'relative' }}>
      {hovered !== null && (
        <div style={{
          position: 'absolute', top: 0,
          left: `clamp(40px, ${(hovered / (n - 1)) * 100}%, calc(100% - 40px))`,
          transform: 'translateX(-50%)',
          background: '#111827', color: '#fff', padding: '4px 9px', borderRadius: 6,
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none',
        }}>
          {fmtBRLshort(points[hovered].price)}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} onMouseLeave={() => setHovered(null)}>
        {/* Grid lines */}
        {[0, 0.5, 1].map(t => {
          const y = padT + t * chartH;
          return <line key={t} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F3F4F6" strokeWidth="1" />;
        })}
        {/* Line */}
        <polyline points={polyPoints} fill="none" stroke="#F2A800" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Area fill */}
        <polyline points={`${padL},${padT + chartH} ${polyPoints} ${W - padR},${padT + chartH}`} fill="rgba(242,168,0,0.08)" stroke="none" />
        {/* Points */}
        {points.map((p: any, i: any) => (
          <circle key={i} cx={px(i)} cy={py(p.price)} r={hovered === i ? 5 : 3.5}
            fill={p.isCurrent ? '#6366F1' : '#F2A800'} stroke="#fff" strokeWidth="1.5"
            opacity={hovered !== null && hovered !== i ? 0.4 : 1}
          />
        ))}
        {/* Hover zones */}
        {points.map((p: any, i: any) => (
          <rect key={`h-${i}`} x={px(i) - (chartW / n / 2)} y={padT} width={chartW / n} height={chartH}
            fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setHovered(i)} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.light, marginTop: 2 }}>
        <span>{new Date(points[0].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} (atual)</span>
      </div>
    </div>
  );
}
