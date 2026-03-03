'use client';

import { Loader2, Landmark, CreditCard, Banknote, Clock, Package } from 'lucide-react';

const GOLD = '#D4A528';

export default function OrdersTab({ orders, hasMoreOrders, loadingMore, onUpdateStatus, onLoadMore }) {
  return (
    <div>
      {orders.map(o => (
        <div key={o.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: GOLD, fontWeight: 'bold' }}>#{o.order_number}</span>
            <span style={{ color: '#888', fontSize: 12 }}>{new Date(o.created_at).toLocaleString('pt-BR')}</span>
          </div>
          <p style={{ color: '#fff', fontSize: 14 }}>{o.customer_name} - {o.customer_phone}</p>
          <p style={{ color: '#aaa', fontSize: 12 }}>{o.delivery_street}, {o.delivery_number} - {o.delivery_neighborhood}</p>

          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <p style={{ color: GOLD, fontWeight: 'bold' }}>
              R$ {Number(o.total).toFixed(2).replace('.', ',')}
            </p>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 'bold',
              background: o.payment_method === 'pix' ? '#0066CC' : o.payment_method === 'card' ? '#9333EA' : '#48BB78',
              color: '#fff',
            }}>
              {o.payment_method === 'pix'
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Landmark size={11} /> PIX</span>
                : o.payment_method === 'card'
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CreditCard size={11} /> Cartão</span>
                : <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Banknote size={11} /> Dinheiro</span>
              }
            </span>
          </div>

          {o.scheduled_for && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, padding: '4px 8px', background: 'rgba(183,148,244,0.15)', border: '1px solid rgba(183,148,244,0.3)', borderRadius: 8, width: 'fit-content' }}>
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

          {/* Itens do pedido */}
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
              style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
            >
              <option value="pending">Pendente</option>
              <option value="scheduled">Agendado</option>
              <option value="confirmed">Confirmado</option>
              <option value="preparing">Preparando</option>
              <option value="delivering">Entregando</option>
              <option value="delivered">Entregue</option>
              <option value="cancelled">Cancelado</option>
            </select>
            <select
              value={o.payment_status}
              onChange={e => onUpdateStatus(o.id, 'payment_status', e.target.value)}
              style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
            >
              <option value="pending">Pag. Pendente</option>
              <option value="approved">Pag. Aprovado</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </div>
        </div>
      ))}

      {hasMoreOrders && (
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
    </div>
  );
}
