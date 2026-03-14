import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';

/**
 * GET /api/checkout/available-slots?date=YYYY-MM-DD
 * Retorna os horários disponíveis para agendamento em uma data específica.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Data inválida. Use formato YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: settings } = await supabase.from('settings').select('key, value')
      .in('key', ['scheduling_enabled', 'scheduling_slots']);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value; });

    if (settingsMap.scheduling_enabled !== 'true') {
      return NextResponse.json({ enabled: false, slots: [] });
    }

    let slots: Array<{ time: string; max_orders: number }> = [];
    try { slots = JSON.parse(settingsMap.scheduling_slots || '[]'); } catch {}
    if (!slots.length) return NextResponse.json({ enabled: true, slots: [] });

    const available: Array<{ time: string; max_orders: number; booked: number }> = [];
    for (const slot of slots) {
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
