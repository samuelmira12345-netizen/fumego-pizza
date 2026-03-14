'use client';

import {
  Loader2, RefreshCw, Plug, Check, CheckCircle2, Bike, X,
} from 'lucide-react';

const GOLD = '#D4A528';

const STATUS_COLORS: Record<string, string> = {
  waiting_confirmation: '#F6AD55',
  confirmed:            '#63B3ED',
  released:             '#68D391',
  waiting_to_catch:     '#F6AD55',
  delivered:            '#48BB78',
  closed:               '#718096',
  canceled:             '#E04040',
  scheduled_confirmed:  '#B794F4',
};

const STATUS_LABELS: Record<string, string> = {
  waiting_confirmation: 'Aguardando',
  confirmed:            'Confirmado',
  released:             'Em Entrega',
  waiting_to_catch:     'Aguard. Retirada',
  delivered:            'Entregue',
  closed:               'Finalizado',
  canceled:             'Cancelado',
  scheduled_confirmed:  'Agendado',
};

const ORDER_TYPE_LABEL: Record<string, string> = { delivery: 'Delivery', takeout: 'Retirada', onsite: 'Mesa', closed_table: 'Comanda' };
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  money: 'Dinheiro', credit_card: 'Cartão Crédito',
  debit_card: 'Cartão Débito', pix: 'PIX', online_credit_card: 'Cartão Online',
};

export default function CardapioWebTab({
  orders, loading, syncing, msg,
  onRefresh, onSync, onOrderAction,
}: {
  orders: any[];
  loading: boolean;
  syncing: boolean;
  msg: string;
  onRefresh: () => void;
  onSync: () => void;
  onOrderAction: (id: any, action: string, reason?: string) => void;
}) {
  return (
    <div>
      {/* Cabeçalho com botões */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: GOLD, fontWeight: 'bold', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plug size={16} color={GOLD} /> Pedidos CardápioWeb
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{ padding: '8px 12px', background: '#333', color: GOLD, border: '1px solid #444', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            onClick={onSync}
            disabled={syncing}
            style={{ padding: '8px 12px', background: GOLD, color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plug size={13} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
            {syncing ? 'Sincronizando...' : 'Sincronizar API'}
          </button>
        </div>
      </div>

      {msg && (
        <p style={{
          fontSize: 13, textAlign: 'center', marginBottom: 12, padding: '8px 12px', borderRadius: 8,
          background: msg.includes('✅') ? 'rgba(72,187,120,0.1)' : 'rgba(224,64,64,0.1)',
          color: msg.includes('✅') ? '#48BB78' : '#E04040',
        }}>
          {msg}
        </p>
      )}

      {loading && orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          <p>Carregando pedidos...</p>
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, background: '#2D2D2D', borderRadius: 12, border: '1px dashed #444' }}>
          <Plug size={32} color="#555" style={{ marginBottom: 12 }} />
          <p style={{ color: '#888', fontSize: 14, marginBottom: 6 }}>Nenhum pedido do CardápioWeb encontrado.</p>
          <p style={{ color: '#666', fontSize: 12 }}>
            Clique em "Sincronizar API" para buscar pedidos recentes, ou aguarde novos pedidos via webhook.
          </p>
        </div>
      )}

      {orders.map(o => {
        const addr = o.delivery_address || {};
        const items = Array.isArray(o.items) ? o.items : [];
        const payments = Array.isArray(o.payments) ? o.payments : [];
        const statusColor = STATUS_COLORS[o.status] || '#888';
        const isActionable = ['waiting_confirmation', 'confirmed', 'released', 'waiting_to_catch', 'delivered'].includes(o.status);

        return (
          <div key={o.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${statusColor}44` }}>
            {/* Cabeçalho */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ color: GOLD, fontWeight: 'bold', fontSize: 15 }}>
                    #{o.cw_display_id || o.cw_order_id}
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 'bold', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55` }}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                  {o.order_type && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#333', color: '#aaa' }}>
                      {ORDER_TYPE_LABEL[o.order_type] || o.order_type}
                    </span>
                  )}
                </div>
                <span style={{ color: '#666', fontSize: 11 }}>
                  {o.cw_created_at ? new Date(o.cw_created_at).toLocaleString('pt-BR') : '—'}
                </span>
              </div>
              <span style={{ color: GOLD, fontWeight: 'bold', fontSize: 16 }}>
                R$ {Number(o.total || 0).toFixed(2).replace('.', ',')}
              </span>
            </div>

            <p style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>
              {o.customer_name || '—'} {o.customer_phone ? `· ${o.customer_phone}` : ''}
            </p>

            {addr?.street && (
              <p style={{ color: '#aaa', fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Bike size={11} />
                {addr.street}{addr.number ? `, ${addr.number}` : ''}
                {addr.neighborhood ? ` — ${addr.neighborhood}` : ''}
                {addr.complement ? ` (${addr.complement})` : ''}
              </p>
            )}

            {items.length > 0 && (
              <div style={{ background: '#1C1500', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                {items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#ccc', marginBottom: i < items.length - 1 ? 4 : 0 }}>
                    <span>{item.quantity}x {item.name}</span>
                    <span style={{ color: GOLD }}>R$ {Number(item.total_price || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                ))}
                {o.delivery_fee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#777', marginTop: 4, paddingTop: 4, borderTop: '1px solid #333' }}>
                    <span>Taxa de entrega</span>
                    <span>R$ {Number(o.delivery_fee).toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
              </div>
            )}

            {payments.length > 0 && (
              <p style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>
                {payments.map(p => PAYMENT_METHOD_LABEL[p.payment_method] || p.payment_method).join(' + ')}
              </p>
            )}

            {o.observation && (
              <p style={{ color: '#777', fontSize: 11, fontStyle: 'italic', marginBottom: 8 }}>
                Obs: {o.observation}
              </p>
            )}

            {/* Botões de ação */}
            {isActionable && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {o.status === 'waiting_confirmation' && (
                  <button
                    onClick={() => onOrderAction(o.cw_order_id, 'confirm')}
                    style={{ flex: 1, padding: '8px', background: 'rgba(99,179,237,0.15)', color: '#63B3ED', border: '1px solid rgba(99,179,237,0.4)', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  >
                    <Check size={13} /> Confirmar
                  </button>
                )}
                {o.status === 'confirmed' && (
                  <button
                    onClick={() => onOrderAction(o.cw_order_id, 'ready')}
                    style={{ flex: 1, padding: '8px', background: 'rgba(104,211,145,0.15)', color: '#68D391', border: '1px solid rgba(104,211,145,0.4)', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  >
                    <CheckCircle2 size={13} /> Pronto / Saiu
                  </button>
                )}
                {o.status === 'released' && (
                  <button
                    onClick={() => onOrderAction(o.cw_order_id, 'delivered')}
                    style={{ flex: 1, padding: '8px', background: 'rgba(72,187,120,0.15)', color: '#48BB78', border: '1px solid rgba(72,187,120,0.4)', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  >
                    <CheckCircle2 size={13} /> Entregue
                  </button>
                )}
                {(o.status === 'waiting_to_catch' || o.status === 'delivered') && (
                  <button
                    onClick={() => onOrderAction(o.cw_order_id, 'finalize')}
                    style={{ flex: 1, padding: '8px', background: 'rgba(113,128,150,0.15)', color: '#A0AEC0', border: '1px solid rgba(113,128,150,0.4)', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  >
                    <CheckCircle2 size={13} /> Finalizar
                  </button>
                )}
                {['waiting_confirmation', 'confirmed'].includes(o.status) && (
                  <button
                    onClick={() => {
                      const reason = prompt('Motivo do cancelamento (opcional):');
                      if (reason !== null) onOrderAction(o.cw_order_id, 'cancel', reason);
                    }}
                    style={{ padding: '8px 12px', background: 'rgba(224,64,64,0.1)', color: '#E04040', border: '1px solid rgba(224,64,64,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <X size={13} /> Cancelar
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
