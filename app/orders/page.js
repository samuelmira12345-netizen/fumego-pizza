'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Pizza, GlassWater, MapPin, Clock, Landmark, CreditCard, Banknote, ShoppingBag, ClipboardList, Search, X, ChevronDown } from 'lucide-react';

const GOLD   = '#F2A800';
const BG     = '#080600';
const CARD   = '#1C1500';
const BORDER = '#2C1E00';
const MUTED  = '#7A6040';

const STATUS = {
  pending:    { label: 'Aguardando',        color: '#F2A800', bg: 'rgba(242,168,0,0.15)'   },
  confirmed:  { label: 'Confirmado',        color: '#60A5FA', bg: 'rgba(96,165,250,0.15)'  },
  preparing:  { label: 'Preparando',        color: '#F97316', bg: 'rgba(249,115,22,0.15)'  },
  delivering: { label: 'Saiu para entrega', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' },
  delivered:  { label: 'Entregue',          color: '#48BB78', bg: 'rgba(72,187,120,0.15)'  },
  cancelled:  { label: 'Cancelado',         color: '#E04040', bg: 'rgba(224,64,64,0.15)'   },
  scheduled:  { label: 'Agendado',          color: '#B794F4', bg: 'rgba(183,148,244,0.15)' },
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
];

const PAY_ICON = {
  pix:          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Landmark size={12} /> PIX</span>,
  card:         <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CreditCard size={12} /> Cartão</span>,
  cash:         <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Banknote size={12} /> Dinheiro</span>,
  card_delivery:<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CreditCard size={12} /> Cartão na entrega</span>,
};

const ONGOING_STATUS = ['pending', 'confirmed', 'preparing', 'delivering', 'scheduled'];
const PAGE_SIZE = 3;

function fmtDate(str) {
  return new Date(str).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtMoney(v) {
  return Number(v).toFixed(2).replace('.', ',');
}

function timeElapsed(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `há ${diff} min`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `há ${h}h ${m}min` : `há ${h}h`;
}

function OrderCard({ order }) {
  const s = STATUS[order.status] || STATUS.pending;
  const isOngoing = ONGOING_STATUS.includes(order.status);
  return (
    <div style={{
      background: CARD, borderRadius: 16, padding: 16, marginBottom: 12,
      border: `1px solid ${BORDER}`,
    }}>
      {/* Cabeçalho do pedido */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
            Pedido #{order.order_number}
          </p>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{fmtDate(order.created_at)}</p>
          {isOngoing && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: GOLD, marginTop: 4 }}>
              <Clock size={11} color={GOLD} /> {timeElapsed(order.created_at)}
            </p>
          )}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
          color: s.color, background: s.bg, letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}>
          {s.label}
        </span>
      </div>

      {/* Itens */}
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10, marginBottom: 10 }}>
        {order.order_items?.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <p style={{ fontSize: 13, color: item.drink_id ? MUTED : '#e8e8e8', display: 'flex', alignItems: 'center', gap: 5 }}>
              {item.drink_id
                ? <GlassWater size={12} color={MUTED} />
                : <Pizza size={12} color="#e8e8e8" />}
              {item.product_name}
              {item.quantity > 1 ? ` ×${item.quantity}` : ''}
            </p>
            <p style={{ fontSize: 13, color: MUTED }}>
              R$ {fmtMoney(item.total_price)}
            </p>
          </div>
        ))}
        {order.observations && (
          <p style={{ fontSize: 11, color: '#3A2810', fontStyle: 'italic', marginTop: 6 }}>
            Obs: {order.observations}
          </p>
        )}
      </div>

      {/* Endereço de entrega */}
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginBottom: 8 }}>
        <p style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={12} color={MUTED} />
          {order.delivery_street}, {order.delivery_number}
          {order.delivery_complement ? ` – ${order.delivery_complement}` : ''}
          {' '}{order.delivery_neighborhood}
        </p>
      </div>

      {/* Rodapé */}
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 12, color: MUTED }}>
          {PAY_ICON[order.payment_method] || order.payment_method}
        </p>
        <p style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>
          R$ {fmtMoney(order.total)}
        </p>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [user, setUser]           = useState(null);
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('ongoing');

  // Histórico: busca, filtro e paginação
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fumego_user');
      if (!raw) { router.push('/login'); return; }
      const u = JSON.parse(raw);
      setUser(u);
      fetchOrders();
    } catch { router.push('/login'); }
  }, []);

  // Reseta paginação quando troca de aba ou muda filtro/busca
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab, search, statusFilter]);

  async function fetchOrders() {
    try {
      // Autenticação via cookie httpOnly (enviado automaticamente pelo browser)
      const res = await fetch('/api/orders', {
        credentials: 'include',
      });
      const d = await res.json();
      if (res.ok && d.orders) setOrders(d.orders);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const ongoing = orders.filter(o => ONGOING_STATUS.includes(o.status));
  const past    = orders.filter(o => !ONGOING_STATUS.includes(o.status));

  // Filtragem do histórico por busca e status
  const pastFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return past.filter(o => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(o.order_number).includes(q) ||
        (o.order_items || []).some(i => (i.product_name || '').toLowerCase().includes(q))
      );
    });
  }, [past, search, statusFilter]);

  const pastVisible = pastFiltered.slice(0, visibleCount);
  const hasMore     = visibleCount < pastFiltered.length;

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: BG }}>

      {/* Header */}
      <header className="header" style={{ justifyContent: 'space-between' }}>
        <button onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: GOLD, fontSize: 22, cursor: 'pointer', width: 32 }}>
          ←
        </button>
        <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 18, fontWeight: 700, color: GOLD }}>
          Meus Pedidos
        </h1>
        <div style={{ width: 32 }} />
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
        {[
          { id: 'ongoing', label: 'Em andamento', count: ongoing.length },
          { id: 'past',    label: 'Histórico',    count: past.length    },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '13px 16px',
            background: 'none', border: 'none',
            color: tab === t.id ? GOLD : MUTED,
            fontWeight: tab === t.id ? 700 : 400,
            fontSize: 14, cursor: 'pointer',
            borderBottom: tab === t.id ? `2px solid ${GOLD}` : '2px solid transparent',
            transition: 'color 0.15s',
            fontFamily: 'inherit',
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                marginLeft: 6, background: tab === t.id ? GOLD : '#2C1E00',
                color: tab === t.id ? BG : MUTED,
                fontSize: 11, fontWeight: 700,
                padding: '1px 7px', borderRadius: 20, display: 'inline-block',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 16px 48px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <p style={{ color: GOLD, fontSize: 13, animation: 'pulse 1.5s infinite', letterSpacing: 2 }}>
              Carregando…
            </p>
          </div>

        ) : tab === 'ongoing' ? (
          ongoing.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <ShoppingBag size={52} color={MUTED} />
              </div>
              <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6 }}>
                Nenhum pedido em andamento no momento.
              </p>
              <button onClick={() => router.push('/')}
                style={{ marginTop: 20, background: `linear-gradient(135deg, ${GOLD}, #FFD060)`, color: BG, border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Fazer um pedido →
              </button>
            </div>
          ) : (
            ongoing.map(order => <OrderCard key={order.id} order={order} />)
          )

        ) : (
          /* ── Histórico ── */
          <>
            {/* Barra de busca e filtro */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={13} style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: MUTED, pointerEvents: 'none',
                }} />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por #pedido ou produto…"
                  aria-label="Buscar no histórico"
                  style={{
                    width: '100%', padding: '9px 30px 9px 30px',
                    background: CARD, border: `1px solid ${BORDER}`,
                    borderRadius: 10, color: '#fff', fontSize: 13,
                    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label="Limpar busca"
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: 2,
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                aria-label="Filtrar por status"
                style={{
                  background: CARD, color: statusFilter ? '#fff' : MUTED,
                  border: `1px solid ${BORDER}`, borderRadius: 10,
                  padding: '9px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {STATUS_FILTER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Contagem quando há filtro */}
            {(search || statusFilter) && pastFiltered.length > 0 && (
              <p style={{ color: MUTED, fontSize: 12, marginBottom: 10 }}>
                {pastFiltered.length} pedido{pastFiltered.length !== 1 ? 's' : ''} encontrado{pastFiltered.length !== 1 ? 's' : ''}
              </p>
            )}

            {/* Lista */}
            {pastVisible.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <ClipboardList size={52} color={MUTED} />
                </div>
                <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6 }}>
                  {search || statusFilter
                    ? 'Nenhum pedido encontrado com esses filtros.'
                    : 'Você ainda não tem pedidos concluídos.'}
                </p>
              </div>
            ) : (
              pastVisible.map(order => <OrderCard key={order.id} order={order} />)
            )}

            {/* Botão Carregar mais */}
            {hasMore && (
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                style={{
                  width: '100%', padding: '13px 0', marginTop: 4,
                  background: 'none', border: `1px solid ${BORDER}`,
                  borderRadius: 12, color: GOLD, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'inherit',
                }}
              >
                <ChevronDown size={16} />
                Ver mais pedidos ({pastFiltered.length - visibleCount} restante{pastFiltered.length - visibleCount !== 1 ? 's' : ''})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
