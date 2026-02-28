import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase';
import { verifyODToken, getODConfig } from '../../../../../lib/open-delivery';
import { computeStoreStatus, DEFAULT_BUSINESS_HOURS } from '../../../../../lib/store-hours';
import { logger } from '../../../../../lib/logger';

/**
 * GET /api/open-delivery/v1/merchant
 *
 * Retorna os dados completos do estabelecimento no padrão Open Delivery,
 * incluindo informações básicas, serviços e cardápio completo (pizzas + bebidas).
 *
 * Autenticação: Bearer token (JWT) ou API Key via header X-Polling-Key.
 *
 * Variáveis de ambiente opcionais para enriquecer os dados do merchant:
 *   OD_STORE_DESCRIPTION       - Descrição do restaurante
 *   OD_STORE_PHONE             - Telefone/WhatsApp (ex: +5511999999999)
 *   OD_STORE_ADDRESS_STREET    - Rua
 *   OD_STORE_ADDRESS_NUMBER    - Número
 *   OD_STORE_ADDRESS_COMPLEMENT- Complemento
 *   OD_STORE_ADDRESS_DISTRICT  - Bairro
 *   OD_STORE_ADDRESS_CITY      - Cidade
 *   OD_STORE_ADDRESS_STATE     - UF (ex: SP)
 *   OD_STORE_ADDRESS_ZIPCODE   - CEP sem formatação (ex: 01310100)
 *   OD_DELIVERY_RADIUS_METERS  - Raio de entrega em metros (padrão: 5000)
 */
export async function GET(request) {
  // Aceita tanto Bearer token quanto X-Polling-Key para máxima compatibilidade
  const decoded = verifyODToken(request);
  const apiKey  = request.headers.get('x-polling-key') || request.headers.get('x-api-key');
  const expectedApiKey = process.env.OD_API_KEY;

  if (!decoded && !(apiKey && expectedApiKey && apiKey === expectedApiKey)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const cfg      = getODConfig();

    // Busca paralela: produtos ativos, bebidas ativas, configurações
    const [productsRes, drinksRes, settingsRes] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('drinks').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('settings').select('key,value'),
    ]);

    const products = productsRes.data || [];
    const drinks   = drinksRes.data   || [];
    const rawSettings = (settingsRes.data || []).reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    // Status atual da loja
    const { open: isOpen } = computeStoreStatus({
      store_open:     rawSettings.store_open,
      business_hours: rawSettings.business_hours,
    });

    // Horários de funcionamento (settings ou padrão)
    let businessHours = DEFAULT_BUSINESS_HOURS;
    if (rawSettings.business_hours) {
      try { businessHours = JSON.parse(rawSettings.business_hours); } catch { /* usa padrão */ }
    }

    const merchantId   = cfg.merchantId   || 'fumego-pizza';
    const merchantName = cfg.merchantName || rawSettings.merchant_name || 'Fumêgo Pizza';
    const menuId       = 'main-menu';
    const serviceId    = 'delivery-service';

    // ── Categorias do cardápio ──────────────────────────────────────────────

    const pizzaItems = products.map((p, idx) => ({
      id:           p.id,
      name:         p.name,
      description:  p.description || undefined,
      externalCode: p.slug,
      index:        p.sort_order ?? idx + 1,
      price:        { value: Number(p.price), currency: 'BRL' },
      status:       { available: p.is_active !== false },
      ...(p.image_url ? { image: { URL: p.image_url } } : {}),
    }));

    const drinkItems = drinks.map((d, idx) => ({
      id:          d.id,
      name:        d.size ? `${d.name} ${d.size}` : d.name,
      description: d.size ? `${d.name} – ${d.size}` : undefined,
      externalCode: d.id,
      index:        d.sort_order ?? idx + 1,
      price:        { value: Number(d.price), currency: 'BRL' },
      status:       { available: d.is_active !== false },
    }));

    const categories = [];
    if (pizzaItems.length > 0) {
      categories.push({
        id:           'cat-pizzas',
        name:         'Pizzas',
        index:        1,
        status:       { available: true },
        itemOfferings: pizzaItems,
      });
    }
    if (drinkItems.length > 0) {
      categories.push({
        id:           'cat-bebidas',
        name:         'Bebidas',
        index:        2,
        status:       { available: true },
        itemOfferings: drinkItems,
      });
    }

    // ── Horários no formato OD ──────────────────────────────────────────────

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

    // ── Endereço do estabelecimento ─────────────────────────────────────────

    const address = {
      country:    'BR',
      state:      process.env.OD_STORE_ADDRESS_STATE      || '',
      city:       process.env.OD_STORE_ADDRESS_CITY       || '',
      district:   process.env.OD_STORE_ADDRESS_DISTRICT   || '',
      street:     process.env.OD_STORE_ADDRESS_STREET     || '',
      number:     process.env.OD_STORE_ADDRESS_NUMBER     || '',
      complement: process.env.OD_STORE_ADDRESS_COMPLEMENT || '',
      postalCode: (process.env.OD_STORE_ADDRESS_ZIPCODE || '').replace(/\D/g, ''),
    };

    // ── Contatos ────────────────────────────────────────────────────────────

    const contacts = [];
    const phone = process.env.OD_STORE_PHONE;
    if (phone) contacts.push({ type: 'PHONE', value: phone });

    // ── Montagem do objeto Merchant ─────────────────────────────────────────

    const deliveryFee    = Number(rawSettings.delivery_fee || 0);
    const deliveryRadius = Number(process.env.OD_DELIVERY_RADIUS_METERS || 5000);

    const merchant = {
      id:           merchantId,
      name:         merchantName,
      description:  process.env.OD_STORE_DESCRIPTION || undefined,
      merchantType: 'RESTAURANT',
      merchantStatus: { available: isOpen },
      currency:     'BRL',
      address,
      ...(contacts.length > 0 ? { contacts } : {}),
      services: [
        {
          id:     serviceId,
          name:   'Entrega',
          type:   'DELIVERY',
          status: { available: isOpen },
          menuId,
          hours:  odHours,
          area: {
            availabilityRadius: deliveryRadius,
          },
          ...(deliveryFee > 0
            ? { fees: [{ type: 'DELIVERY_FEE', value: deliveryFee, currency: 'BRL' }] }
            : {}),
        },
      ],
      menus: [
        {
          id:         menuId,
          name:       'Cardápio',
          externalCode: 'main',
          categories,
        },
      ],
    };

    logger.info('[OD Merchant] Cardápio retornado', {
      products: products.length,
      drinks: drinks.length,
    });

    return NextResponse.json(merchant);
  } catch (e) {
    logger.error('[OD Merchant] Erro', e);
    return NextResponse.json({ message: e.message }, { status: 503 });
  }
}
