import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { computeStoreStatus, DEFAULT_BUSINESS_HOURS } from '../../../../../../../lib/store-hours';
import { logger } from '../../../../../../../lib/logger';

/**
 * GET /api/open-delivery/v1/merchant/{merchantId}/status
 *
 * Retorna o status atual de disponibilidade do estabelecimento e
 * os horários de funcionamento de cada serviço.
 *
 * Response 200: MerchantStatus
 */
export async function GET(request, { params }) {
  const decoded = verifyODToken(request);
  const apiKey  = request.headers.get('x-polling-key') || request.headers.get('x-api-key');
  const expectedApiKey = process.env.OD_API_KEY;

  if (!decoded && !(apiKey && expectedApiKey && apiKey === expectedApiKey)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { merchantId } = params;
    const supabase = getSupabaseAdmin();

    const { data: rows } = await supabase
      .from('settings')
      .select('key,value')
      .in('key', ['store_open', 'business_hours']);

    const rawSettings = (rows || []).reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    const { open: isOpen } = computeStoreStatus({
      store_open:     rawSettings.store_open,
      business_hours: rawSettings.business_hours,
    });

    let businessHours = DEFAULT_BUSINESS_HOURS;
    if (rawSettings.business_hours) {
      try { businessHours = JSON.parse(rawSettings.business_hours); } catch { /* usa padrão */ }
    }

    const DAY_MAP = {
      sunday:    'SUNDAY',
      monday:    'MONDAY',
      tuesday:   'TUESDAY',
      wednesday: 'WEDNESDAY',
      thursday:  'THURSDAY',
      friday:    'FRIDAY',
      saturday:  'SATURDAY',
    };

    const odHours = Object.entries(businessHours)
      .filter(([, h]) => h.enabled)
      .map(([day, h]) => ({
        dayOfWeek:   DAY_MAP[day],
        timePeriods: [{ startTime: h.open || '18:00', endTime: h.close || '23:00' }],
      }));

    const response = {
      id:     merchantId,
      status: { available: isOpen },
      services: [
        {
          id:     'delivery-service',
          type:   'DELIVERY',
          status: { available: isOpen },
          hours:  odHours,
        },
      ],
    };

    logger.info('[OD Merchant Status]', { merchantId, isOpen });
    return NextResponse.json(response);
  } catch (e) {
    logger.error('[OD Merchant Status] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
