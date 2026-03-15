'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Phone, MapPin, Clock, ChefHat, Truck, Bike, CheckCircle, XCircle,
  Printer, RefreshCw, Volume2, VolumeX, X, Bell, Calendar,
  CreditCard, Zap, Banknote, AlertTriangle, User, List,
  EyeOff, Eye, ChevronDown, Plus, ShoppingBag, Star,
  ArrowRight, PackageCheck, Timer, LayoutList, FilePenLine,
} from 'lucide-react';
import ManualOrderDrawer, { ProductPicker } from './ManualOrderDrawer';
import OrdersTab from './OrdersTab';
import DeliveryQueueTab from './DeliveryQueueTab';
import {
  S, COLUMNS, PM,
  fmtBRL, fmtPhone, fmtTime, fmtDateFull, fmtElapsed,
  getNameInitials, buildAddress, getMapsLinks,
  elapsedMins, timerColor, diffMins,
  todaySP, daysAgoSP, weekStartSP, orderDateSP,
  playBeep, playReadyChime,
} from './kds/kdsUtils';
import OrderCard from './kds/OrderCard';
import KDSColumn from './kds/KDSColumn';
import OrderModal, { QuickStat } from './kds/OrderModal';
import KitchenKDS from './kds/KitchenKDS';
import { clientError } from '../../lib/client-logger';

function useSecondTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);
  return tick;
}
// ── KDS Board Principal ───────────────────────────────────────────────────────

const KDSBoard = React.memo(function KDSBoard({
  orders, onUpdateStatus, onUpdatePayment, onRefresh, onRefreshOrders, adminToken, loading,
  products, drinks, hasMoreOrders, loadingMore, onLoadMore,
}: { orders: any, onUpdateStatus: any, onUpdatePayment: any, onRefresh: any, onRefreshOrders: any, adminToken: any, loading: any, products: any, drinks: any, hasMoreOrders: any, loadingMore: any, onLoadMore: any }) {
  const [modal, setModal]               = useState<any>(null);
  const [items, setItems]               = useState<any[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<any>({});
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsLoadingByOrder, setItemsLoadingByOrder] = useState<any>({});
  const [soundOn, setSoundOn]           = useState(true);
  const [newIds, setNewIds]             = useState(new Set());
  const [readyIds, setReadyIds]         = useState(new Set());
  const [countdown, setCountdown]       = useState(15);
  const [showRevenue, setShowRevenue]   = useState(true);
  const [dragging, setDragging]         = useState<any>(null);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [showDrawer, setShowDrawer]     = useState(false);
  const [viewMode, setViewMode]         = useState('kanban'); // 'kanban' | 'lista' | 'cozinha'
  const [deliveryPersons, setDeliveryPersons] = useState<any[]>([]);
  const [deliveryPrompt, setDeliveryPrompt] = useState({ open: false, orderId: null, deliveryPersonId: '' });
  const [assigningDelivery, setAssigningDelivery] = useState(false);
  const deliveryPersonsLoadedRef         = useRef(false);
  const fetchingItemsRef                = useRef(new Set());
  const seenIdsRef                      = useRef<Set<any> | null>(null);
  const prevStatusRef                   = useRef<Record<string, any>>({});
  const onUpdateRef                     = useRef(onUpdateStatus);
  const tick                            = useSecondTick();

  useEffect(() => { onUpdateRef.current = onUpdateStatus; }, [onUpdateStatus]);

  // Auto-close orders open for more than 24h
  useEffect(() => {
    if (!orders.length) return;
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    orders
      .filter((o: any) => !['cancelled', 'delivered'].includes(o.status) && o.created_at < cutoff)
      .forEach((o: any) => onUpdateRef.current(o.id, 'status', 'delivered'));
  }, [orders]);

  // Mapa telefone/nome → contagem de pedidos (todos os pedidos carregados)
  const customerOrderCount: Record<string, any> = useMemo(() => {
    const map: Record<string, any> = {};
    for (const o of orders) {
      const key = o.customer_phone || o.customer_name;
      if (key) map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [orders]);

  const today = todaySP();
  const cutoff24h = useMemo(() => new Date(Date.now() - 24 * 3600 * 1000).toISOString(), [tick]);

  // Show: today's orders + orders still open from last 24h (cross-midnight)
  // 'delivered' orders with pending payment stay visible until payment is registered
  // 'delivered' + paid (approved) orders move to history only
  const visible = useMemo(() => orders.filter((o: any) => {
    if (o.status === 'cancelled') return false;
    // Delivered + paid → only in history (hidden from kanban)
    if (o.status === 'delivered' && o.payment_status === 'approved') return false;
    const isToday = orderDateSP(o.created_at) === today;
    const isOpenRecent = o.created_at >= cutoff24h;
    // Unpaid delivered orders stay visible regardless of date (to avoid losing track)
    const isUnpaidDelivered = o.status === 'delivered' && o.payment_status !== 'approved';
    return isToday || isOpenRecent || isUnpaidDelivered;
  }), [orders, today, cutoff24h]);

  const fetchOrderItems = useCallback(async (orderId: any) => {
    if (!orderId || fetchingItemsRef.current.has(orderId)) return null;
    fetchingItemsRef.current.add(orderId);
    setItemsLoadingByOrder((prev: any) => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'get_order_items', data: { order_id: orderId } }),
      });
      const d = await res.json();
      const nextItems = Array.isArray(d.items) ? d.items : [];
      setItemsByOrder((prev: any) => ({ ...prev, [orderId]: nextItems }));
      return nextItems;
    } catch {
      setItemsByOrder((prev: any) => ({ ...prev, [orderId]: [] }));
      return [];
    } finally {
      fetchingItemsRef.current.delete(orderId);
      setItemsLoadingByOrder((prev: any) => ({ ...prev, [orderId]: false }));
    }
  }, [adminToken]);

  function getOrderItems(order: any) {
    const cached = itemsByOrder[order.id];
    if (Array.isArray(cached) && cached.length > 0) return cached;
    if (Array.isArray(order.order_items) && order.order_items.length > 0) return order.order_items;
    return Array.isArray(cached) ? cached : [];
  }

  useEffect(() => {
    const ids = visible
      .filter((o: any) => !Object.prototype.hasOwnProperty.call(itemsByOrder, o.id))
      .map((o: any) => o.id)
      .slice(0, 10);

    if (ids.length === 0) return;
    ids.forEach((id: any) => { fetchOrderItems(id); });
  }, [visible, itemsByOrder, fetchOrderItems]);

  const visibleWithItems = visible.map((o: any) => ({
    ...o,
    order_items: getOrderItems(o),
    order_items_loading: !!itemsLoadingByOrder[o.id],
  }));

  const deliveryPersonsById = useMemo(() => deliveryPersons.reduce((acc: any, person: any) => {
    acc[String(person.id)] = person.name || '';
    return acc;
  }, {}), [deliveryPersons]);

  useEffect(() => {
    if (!adminToken || deliveryPersonsLoadedRef.current) return;
    ensureDeliveryPersons();
  }, [adminToken]);

  const todayOrders  = useMemo(() => orders.filter((o: any) => orderDateSP(o.created_at) === today), [orders, today]);
  const activeToday  = useMemo(() => todayOrders.filter((o: any) => !['cancelled','delivered'].includes(o.status)).length, [todayOrders]);
  const doneToday    = useMemo(() => todayOrders.filter((o: any) => o.status === 'delivered').length, [todayOrders]);
  const revenueToday = useMemo(() => todayOrders.filter((o: any) => o.status !== 'cancelled').reduce((s: any, o: any) => s + (parseFloat(o.total) || 0), 0), [todayOrders]);

  // Detectar novos pedidos → beep + highlight
  useEffect(() => {
    if (!orders.length) return;
    const cur = new Set(orders.map((o: any) => o.id));
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(cur) as any;
      return;
    }
    const added = new Set([...cur].filter((id: any) => !(seenIdsRef.current as any).has(id)));
    cur.forEach((id: any) => (seenIdsRef.current as any).add(id));
    if (added.size > 0) {
      setNewIds(added);
      if (soundOn) playBeep();
      setTimeout(() => setNewIds(new Set()), 12000);
      orders
        .filter((o: any) => added.has(o.id) && o.status === 'pending')
        .forEach((o: any) => onUpdateRef.current(o.id, 'status', 'confirmed'));
    }
  }, [orders, soundOn]);

  // Detectar pedidos que entraram em 'ready' → campainha
  useEffect(() => {
    if (!orders.length) return;
    const newReady = new Set();
    orders.forEach((o: any) => {
      const prev = (prevStatusRef.current as any)[o.id];
      if (o.status === 'ready' && prev !== undefined && prev !== 'ready') {
        newReady.add(o.id);
      }
      (prevStatusRef.current as any)[o.id] = o.status;
    });
    if (newReady.size > 0) {
      setReadyIds(newReady);
      if (soundOn) playReadyChime();
      setTimeout(() => setReadyIds(new Set()), 10000);
    }
  }, [orders, soundOn]);

  // Auto-refresh a cada 15s
  const refreshOrders = onRefreshOrders || onRefresh;
  useEffect(() => {
    setCountdown(15);
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { refreshOrders(); return 15; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [refreshOrders]);

  async function openModal(order: any) {
    setModal(order);
    setItems(getOrderItems(order));
    setItemsLoading(true);
    try {
      const fresh = await fetchOrderItems(order.id);
      setItems(Array.isArray(fresh) ? fresh : []);
    } finally {
      setItemsLoading(false);
    }
  }

  async function ensureDeliveryPersons() {
    if (deliveryPersonsLoadedRef.current || !adminToken) return;
    deliveryPersonsLoadedRef.current = true;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'get_delivery_persons', data: {} }),
      });
      const d = await res.json();
      setDeliveryPersons((d.persons || []).filter((p: any) => p.is_active));
    } catch (e) {
      clientError(e);
      deliveryPersonsLoadedRef.current = false;
    }
  }

  async function assignDeliveryPerson(orderId: any, personId: any, startDelivery = false) {
    if (!adminToken || !orderId) return false;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'assign_delivery', data: { order_id: orderId, delivery_person_id: personId || null, start_delivery: startDelivery } }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Erro ao atribuir entregador');
      return true;
    } catch (e) {
      clientError(e);
      alert('Erro ao atribuir entregador: ' + ((e as Error).message || 'erro desconhecido'));
      return false;
    }
  }

  async function verifyAdminPassword(password: any) {
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) return false;
      const d = await res.json();
      return !!d.token;
    } catch {
      return false;
    }
  }

  async function handleAction(orderId: any, field: any, value: any) {
    if (field === 'cancel' || field === 'delete') {
      const validPass = await verifyAdminPassword(value);
      if (!validPass) {
        alert('Senha de admin inválida.');
        return false;
      }

      if (field === 'cancel') {
        onUpdateStatus(orderId, 'status', 'cancelled');
        setModal((prev: any) => prev?.id === orderId ? { ...prev, status: 'cancelled' } : prev);
        return true;
      }

      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'delete_order', data: { id: orderId } }),
        });
        const d = await res.json();
        if (!res.ok || d.error) throw new Error(d.error || 'Erro ao inativar pedido');
        await refreshOrders();
        return true;
      } catch (e) {
        alert('Erro ao inativar pedido: ' + ((e as Error).message || 'erro desconhecido'));
        return false;
      }
    }

    // Reabrir pedido (delivered ou cancelled → confirmed)
    if (field === 'reopen') {
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'restore_order', data: { id: orderId } }),
        });
        const d = await res.json();
        if (!res.ok || d.error) throw new Error(d.error || 'Erro ao reabrir pedido');
        // Optimistic update
        onUpdateStatus(orderId, 'status', 'confirmed');
        setModal((prev: any) => prev?.id === orderId ? { ...prev, status: 'confirmed', delivered_at: null } : prev);
        await refreshOrders();
        return true;
      } catch (e) {
        alert('Erro ao reabrir pedido: ' + ((e as Error).message || 'erro desconhecido'));
        return false;
      }
    }

    // Agendar pedido (any active status → scheduled)
    if (field === 'schedule') {
      try {
        const { scheduled_for } = value || {};
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ action: 'update_order', data: { id: orderId, status: 'scheduled', scheduled_for } }),
        });
        const d = await res.json();
        if (!res.ok || d.error) throw new Error(d.error || 'Erro ao agendar pedido');
        onUpdateStatus(orderId, 'status', 'scheduled');
        onUpdateStatus(orderId, 'scheduled_for', scheduled_for);
        setModal((prev: any) => prev?.id === orderId ? { ...prev, status: 'scheduled', scheduled_for } : prev);
        return true;
      } catch (e) {
        alert('Erro ao agendar pedido: ' + ((e as Error).message || 'erro desconhecido'));
        return false;
      }
    }

    if (field === 'status' && value === 'delivering') {
      const order = orders.find((o: any) => o.id === orderId);
      await ensureDeliveryPersons();
      setDeliveryPrompt({
        open: true,
        orderId,
        deliveryPersonId: order?.delivery_person_id || '',
      });
      return true;
    }
    onUpdateStatus(orderId, field, value);
    setModal((prev: any) => prev?.id === orderId ? { ...prev, [field]: value } : prev);
    return true;
  }

  async function confirmStartDelivery() {
    if (!deliveryPrompt.orderId || !deliveryPrompt.deliveryPersonId || assigningDelivery) return;
    setAssigningDelivery(true);
    const ok = await assignDeliveryPerson(deliveryPrompt.orderId, deliveryPrompt.deliveryPersonId, true);
    if (ok) {
      onUpdateStatus(deliveryPrompt.orderId, 'delivery_person_id', deliveryPrompt.deliveryPersonId);
      onUpdateStatus(deliveryPrompt.orderId, 'status', 'delivering');
      setModal((prev: any) => prev?.id === deliveryPrompt.orderId
        ? { ...prev, delivery_person_id: deliveryPrompt.deliveryPersonId, status: 'delivering' }
        : prev);
      setDeliveryPrompt({ open: false, orderId: null, deliveryPersonId: '' });
    }
    setAssigningDelivery(false);
  }

  async function handlePaymentUpdate(orderId: any, updates: any) {
    if (onUpdatePayment) {
      await onUpdatePayment(orderId, updates);
    } else {
      // fallback: update fields one by one
      for (const [field, value] of Object.entries(updates)) {
        onUpdateStatus(orderId, field, value);
      }
    }
    setModal((prev: any) => prev?.id === orderId ? { ...prev, ...updates } : prev);
  }

  async function handleAddressUpdate(orderId: any, updates: any) {
    onUpdateStatus(orderId, 'delivery_street', updates.delivery_street || null);
    onUpdateStatus(orderId, 'delivery_number', updates.delivery_number || null);
    onUpdateStatus(orderId, 'delivery_complement', updates.delivery_complement || null);
    onUpdateStatus(orderId, 'delivery_neighborhood', updates.delivery_neighborhood || null);
    onUpdateStatus(orderId, 'delivery_city', updates.delivery_city || null);
    onUpdateStatus(orderId, 'delivery_zipcode', updates.delivery_zipcode || null);
    setModal((prev: any) => prev?.id === orderId ? { ...prev, ...updates } : prev);
  }

  async function handleItemsUpdate(orderId: any, nextItems: any) {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'update_order_items', data: { id: orderId, items: nextItems } }),
    });
    const d = await res.json();
    if (!res.ok || d.error) {
      throw new Error(d.error || 'Erro ao atualizar itens');
    }

    const refreshedItems = Array.isArray(d.items) ? d.items : [];
    setItems(refreshedItems);
    setItemsByOrder((prev: any) => ({ ...prev, [orderId]: refreshedItems }));

    const totalsUpdate = {
      subtotal: d.subtotal,
      total: d.total,
    };
    onUpdateStatus(orderId, 'subtotal', d.subtotal);
    onUpdateStatus(orderId, 'total', d.total);
    setModal((prev: any) => prev?.id === orderId ? { ...prev, ...totalsUpdate } : prev);

    if (onRefreshOrders) onRefreshOrders();
  }

  function handlePrint(type = 'balcao') {
    if (!modal) return;
    const body = items.map((i: any) =>
      `  ${i.quantity}x ${i.product_name.padEnd(22)} ${fmtBRL(i.total_price)}`
    ).join('\n');

    let txt;
    if (type === 'cozinha') {
      txt = [
        `════════════════════════`,
        `  COZINHA — #${modal.order_number || modal.id.slice(-4)}`,
        `  ${fmtTime(modal.created_at)}`,
        `════════════════════════`,
        `  ${modal.delivery_street || ''}, ${modal.delivery_number || ''}${modal.delivery_complement ? ' — ' + modal.delivery_complement : ''}`,
        `  ${modal.delivery_neighborhood || ''}`,
        `────────────────────────`,
        body,
        `════════════════════════`,
        modal.observations ? `  OBS: ${modal.observations}` : '',
      ].filter(l => l !== undefined).join('\n');
    } else if (type === 'fiscal') {
      txt = [
        `════════════════════════`,
        `  PEDIDO #${modal.order_number || modal.id.slice(-4)}`,
        `  ${fmtDateFull(modal.created_at)}`,
        `════════════════════════`,
        `  ${modal.customer_name}`,
        modal.customer_cpf ? `  CPF: ${modal.customer_cpf}` : `  CPF: não informado`,
        `  ${fmtPhone(modal.customer_phone) || ''}`,
        ``,
        `  ${modal.delivery_street || ''}, ${modal.delivery_number || ''}${modal.delivery_complement ? ' — ' + modal.delivery_complement : ''}`,
        `  ${modal.delivery_neighborhood || ''}${modal.delivery_city ? ', ' + modal.delivery_city : ''}`,
        `════════════════════════`,
        body,
        `────────────────────────`,
        parseFloat(modal.discount) > 0     ? `  Desconto:     -${fmtBRL(modal.discount)}` : '',
        parseFloat(modal.delivery_fee) > 0 ? `  Taxa entrega:  ${fmtBRL(modal.delivery_fee)}` : '',
        `  TOTAL:         ${fmtBRL(modal.total)}`,
        `  ${(PM as any)[modal.payment_method]?.label || modal.payment_method || ''}`,
        `════════════════════════`,
        modal.observations ? `  OBS: ${modal.observations}` : '',
      ].filter(l => l !== undefined).join('\n');
    } else {
      // balcao (padrão)
      txt = [
        `════════════════════════`,
        `  PEDIDO #${modal.order_number || modal.id.slice(-4)}`,
        `  ${fmtDateFull(modal.created_at)}`,
        `════════════════════════`,
        `  ${modal.customer_name}`,
        `  ${fmtPhone(modal.customer_phone) || ''}`,
        ``,
        `  ${modal.delivery_street || ''}, ${modal.delivery_number || ''}${modal.delivery_complement ? ' — ' + modal.delivery_complement : ''}`,
        `  ${modal.delivery_neighborhood || ''}${modal.delivery_city ? ', ' + modal.delivery_city : ''}`,
        `════════════════════════`,
        body,
        `────────────────────────`,
        parseFloat(modal.discount) > 0     ? `  Desconto:     -${fmtBRL(modal.discount)}` : '',
        parseFloat(modal.delivery_fee) > 0 ? `  Taxa entrega:  ${fmtBRL(modal.delivery_fee)}` : '',
        `  TOTAL:         ${fmtBRL(modal.total)}`,
        `  ${(PM as any)[modal.payment_method]?.label || modal.payment_method || ''}`,
        `════════════════════════`,
        modal.observations ? `  OBS: ${modal.observations}` : '',
      ].filter(l => l !== undefined).join('\n');
    }

    const fontSize = type === 'cozinha' ? '16px' : '13px';
    const w = window.open('', '_blank', 'width=400,height=600');
    if (w) {
      w.document.write(`<html><body><pre style="font-family:monospace;font-size:${fontSize};padding:16px;white-space:pre">${txt}</pre><script>window.onload=()=>window.print()<\/script></body></html>`);
      w.document.close();
    }
  }

  const hasScheduled   = visible.some((o: any) => o.status === 'scheduled');
  const preparing_count = visible.filter((o: any) => ['confirmed', 'preparing', 'ready'].includes(o.status)).length;
  const cols = COLUMNS.filter((c: any) => c.id !== 'agendados' || hasScheduled);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#F1F3F5', overflow: 'hidden' }}>

      {/* ── Barra superior ────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '9px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 8, overflowX: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ShoppingBag size={18} color="#D97706" />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>PDV</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 7, marginLeft: 6, flexShrink: 0 }}>
          <QuickStat label="Ativos"      value={activeToday}          color="#D97706" />
          <QuickStat label="Finalizados" value={doneToday}            color="#059669" />
          <QuickStat label="Faturado"    value={fmtBRL(revenueToday)} color="#2563EB" hidden={!showRevenue} />
          <button
            onClick={() => setShowRevenue(s => !s)}
            title={showRevenue ? 'Ocultar faturamento' : 'Mostrar faturamento'}
            style={{ display: 'flex', alignItems: 'center', padding: '4px 7px', borderRadius: 4, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', color: '#6B7280' }}
          >
            {showRevenue ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Toggle Kanban / Cozinha / Histórico / Entregas */}
        <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid #E5E7EB', flexShrink: 0, marginLeft: 'auto' }}>
          {[
            { key: 'kanban',   label: 'Kanban',    icon: <ChefHat size={13} /> },
            { key: 'cozinha',  label: 'Cozinha',   icon: <PackageCheck size={13} /> },
            { key: 'lista',    label: 'Histórico', icon: <LayoutList size={13} /> },
            { key: 'entregas', label: '🚴 Entregas', icon: null },
          ].map((m, i) => (
            <button key={m.key}
              onClick={() => setViewMode(m.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', border: 'none', borderLeft: i > 0 ? '1px solid #E5E7EB' : 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: viewMode === m.key ? (m.key === 'cozinha' ? '#1C1C1E' : m.key === 'entregas' ? '#7C3AED' : '#111827') : '#fff',
                color: viewMode === m.key ? (m.key === 'cozinha' ? '#F59E0B' : '#fff') : '#6B7280',
              }}
            >
              {m.icon} {m.label}
              {m.key === 'cozinha' && preparing_count > 0 && (
                <span style={{ fontSize: 9, fontWeight: 900, background: '#2563EB', color: '#fff', borderRadius: 8, padding: '1px 5px', marginLeft: 2 }}>
                  {preparing_count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Indicador de data atual */}
        {viewMode === 'kanban' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#F3F4F6', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap' }}>
            <Calendar size={12} color="#6B7280" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>· pedidos de hoje + abertos &lt;24h</span>
          </div>
        )}

        {/* Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9CA3AF', minWidth: 52, justifyContent: 'flex-end', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: loading ? '#F59E0B' : '#10B981' }} />
          {countdown}s
        </div>

        {/* Refresh */}
        <button onClick={() => { onRefresh(); setCountdown(10); }} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 4, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
          <RefreshCw size={12} style={loading ? { animation: 'kdsSpin 1s linear infinite' } : {}} />
          Atualizar
        </button>

        {/* Som */}
        <button onClick={() => setSoundOn(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 4, border: '1px solid ' + (soundOn ? '#A7F3D0' : '#E5E7EB'), background: soundOn ? '#ECFDF5' : '#F9FAFB', color: soundOn ? '#059669' : '#9CA3AF', fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
          {soundOn ? 'Som' : 'Mudo'}
        </button>

        {/* Novo Pedido */}
        <button onClick={() => setShowDrawer(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 4, border: 'none', background: '#111827', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
          <Plus size={13} /> Novo Pedido
        </button>
      </div>

      {/* ── Vista Cozinha KDS ─────────────────────────────────────────────── */}
      {viewMode === 'cozinha' && (
        <KitchenKDS
          orders={visibleWithItems}
          onMarkReady={(id: any) => handleAction(id, 'status', 'ready')}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
        />
      )}

      {/* ── Vista Kanban ──────────────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div
          style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '12px 16px', display: 'flex', gap: 11, alignItems: 'stretch' }}
          onDragEnd={() => setDragging(null)}
        >
          {cols.map(col => (
            <KDSColumn
              key={col.id}
              col={col}
              orders={visibleWithItems}
              onCardClick={openModal}
              newIds={newIds}
              readyIds={readyIds}
              onDragStart={(order: any) => setDragging(order)}
              deliveryPersonsById={deliveryPersonsById}
              onDrop={(targetStatus: any) => {
                if (dragging && dragging.status !== targetStatus) {
                  handleAction(dragging.id, 'status', targetStatus);
                }
                setDragging(null);
              }}
              collapsed={collapsedCols.has(col.id)}
              onToggleCollapse={() => setCollapsedCols(prev => {
                const next = new Set(prev);
                if (next.has(col.id)) next.delete(col.id); else next.add(col.id);
                return next;
              })}
            />
          ))}
        </div>
      )}

      {/* ── Vista Lista / Histórico ──────────────────────────────────────── */}
      {viewMode === 'lista' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#1A1A1A' }}>
          <OrdersTab
            orders={orders}
            hasMoreOrders={hasMoreOrders}
            loadingMore={loadingMore}
            onUpdateStatus={handleAction}
            onLoadMore={onLoadMore}
            adminToken={adminToken}
          />
        </div>
      )}

      {/* ── Vista Gestão de Entregas ──────────────────────────────────────── */}
      {viewMode === 'entregas' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#1A1A1A' }}>
          <DeliveryQueueTab adminToken={adminToken} />
        </div>
      )}

      {/* ── Modal detalhes ───────────────────────────────────────────────── */}
      {modal && (
        <OrderModal
          order={modal}
          items={items}
          itemsLoading={itemsLoading}
          onClose={() => setModal(null)}
          onAction={handleAction}
          onPaymentUpdate={(updates: any) => handlePaymentUpdate(modal.id, updates)}
          onAddressUpdate={(updates: any) => handleAddressUpdate(modal.id, updates)}
          onItemsUpdate={(nextItems: any) => handleItemsUpdate(modal.id, nextItems)}
          onPrint={handlePrint}
          adminToken={adminToken}
          customerOrderCount={customerOrderCount}
          deliveryPersons={deliveryPersons}
          onAssignDeliveryPerson={assignDeliveryPerson}
          onEnsureDeliveryPersons={ensureDeliveryPersons}
          products={products || []}
          drinks={drinks || []}
        />
      )}

      {deliveryPrompt.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 430, background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Atribuição obrigatória de entregador</h3>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
              Para mover o pedido para <strong>Em entrega</strong>, selecione quem saiu para entrega.
            </p>
            <select
              value={deliveryPrompt.deliveryPersonId}
              onChange={e => setDeliveryPrompt((prev: any) => ({ ...prev, deliveryPersonId: e.target.value }))}
              style={{ width: '100%', padding: '9px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, marginBottom: 12 }}
            >
              <option value="">— Selecione o entregador —</option>
              {deliveryPersons.map((dp: any) => (
                <option key={dp.id} value={dp.id}>{dp.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeliveryPrompt({ open: false, orderId: null, deliveryPersonId: '' })}
                style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#6B7280', cursor: 'pointer', fontSize: 12 }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmStartDelivery}
                disabled={!deliveryPrompt.deliveryPersonId || assigningDelivery}
                style={{ padding: '8px 12px', borderRadius: 7, border: 'none', background: (!deliveryPrompt.deliveryPersonId || assigningDelivery) ? '#9CA3AF' : '#7C3AED', color: '#fff', cursor: (!deliveryPrompt.deliveryPersonId || assigningDelivery) ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                {assigningDelivery ? 'Confirmando...' : 'Confirmar saída para entrega'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawer novo pedido manual ─────────────────────────────────────── */}
      {showDrawer && (
        <ManualOrderDrawer
          adminToken={adminToken}
          products={products || []}
          drinks={drinks || []}
          onClose={() => setShowDrawer(false)}
          onSuccess={() => { setShowDrawer(false); refreshOrders(); }}
        />
      )}

      <style>{`
        @keyframes kdsPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes kdsSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes kdsReadyPulse {
          0%, 100% { box-shadow: 0 0 0 2px #F59E0B40, 0 2px 8px rgba(245,158,11,0.25); }
          50%       { box-shadow: 0 0 0 4px #F59E0B60, 0 2px 12px rgba(245,158,11,0.4); }
        }
      `}</style>
    </div>
  );
});

export default KDSBoard;
