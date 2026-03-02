import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';

/**
 * GET /api/checkout/available-slots?date=YYYY-MM-DD
 * Retorna os horários disponíveis para agendamento em uma data específica.
 * Um horário é exibido apenas se ainda não atingiu o limite de pedidos.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Data inválida. Use formato YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Carregar configurações de agendamento
    const { data: settings } = await supabase.from('settings').select('key, value')
      .in('key', ['scheduling_enabled', 'scheduling_slots']);

    const settingsMap = {};
    (settings || []).forEach(s => { settingsMap[s.key] = s.value; });

    if (settingsMap.scheduling_enabled !== 'true') {
      return NextResponse.json({ enabled: false, slots: [] });
    }

    let slots = [];
    try { slots = JSON.parse(settingsMap.scheduling_slots || '[]'); } catch {}
    if (!slots.length) return NextResponse.json({ enabled: true, slots: [] });

    // Contar pedidos já agendados para cada slot nessa data (janela de 30 min)
    const available = [];
    for (const slot of slots) {
      const [h, m] = slot.time.split(':').map(Number);
      const slotStart = new Date(`${date}T${slot.time}:00-03:00`);
      const slotEnd   = new Date(slotStart.getTime() + 30 * 60 * 1000);

      const { count } = await supabase.from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('scheduled_for', slotStart.toISOString())
        .lt('scheduled_for', slotEnd.toISOString())
        .not('status', 'eq', 'cancelled');

      if ((count || 0) < slot.max_orders) {
        available.push({ time: slot.time, max_orders: slot.max_orders, booked: count || 0 });
      }
    }

    return NextResponse.json({ enabled: true, slots: available });
  } catch (e) {
    console.error('[available-slots]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
