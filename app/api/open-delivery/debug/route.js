import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { isODEnabled, isCWPushEnabled, getODConfig, pushEventToCardapioWeb } from '../../../../lib/open-delivery';

/**
 * GET /api/open-delivery/debug
 *
 * Diagnóstico completo da integração Open Delivery.
 * Chame este endpoint para verificar o que está configurado e funcionando.
 *
 * NÃO expõe segredos — apenas indica se estão preenchidos (true/false).
 *
 * Uso: curl https://seusite.com/api/open-delivery/debug
 */
export async function GET() {
  const cfg = getODConfig();

  // ── Vars de ambiente ─────────────────────────────────────────────────────
  const envStatus = {
    OD_CLIENT_ID:     Boolean(process.env.OD_CLIENT_ID),
    OD_CLIENT_SECRET: Boolean(process.env.OD_CLIENT_SECRET),
    OD_APP_ID:        Boolean(process.env.OD_APP_ID),
    OD_MERCHANT_ID:   Boolean(process.env.OD_MERCHANT_ID),
    OD_CW_BASE_URL:   Boolean(process.env.OD_CW_BASE_URL),
    OD_MERCHANT_NAME: Boolean(process.env.OD_MERCHANT_NAME),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  };

  const allEnvOk  = Object.values(envStatus).every(Boolean);
  const pushReady = isODEnabled() && isCWPushEnabled();

  // ── Tabela od_events no Supabase ─────────────────────────────────────────
  let odEventsStatus = null;
  let recentEvents   = [];
  try {
    const supabase = getSupabaseAdmin();
    const { data, error, count } = await supabase
      .from('od_events')
      .select('id, order_id, event_type, created_at, acknowledged_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      odEventsStatus = { ok: false, error: error.message };
    } else {
      odEventsStatus = { ok: true, totalRows: count };
      recentEvents   = data || [];
    }
  } catch (e) {
    odEventsStatus = { ok: false, error: e.message };
  }

  // ── Teste de conexão com CardápioWeb ─────────────────────────────────────
  let cwConnectivity = null;
  if (process.env.OD_CW_BASE_URL) {
    try {
      const res = await fetch(`${process.env.OD_CW_BASE_URL}/v1/merchant`, {
        signal: AbortSignal.timeout(5000),
      });
      cwConnectivity = { ok: res.ok, status: res.status };
    } catch (e) {
      cwConnectivity = { ok: false, error: e.message };
    }
  }

  // ── Resultado ────────────────────────────────────────────────────────────
  const checklist = [
    { item: 'OD_CLIENT_ID definido',     ok: envStatus.OD_CLIENT_ID },
    { item: 'OD_CLIENT_SECRET definido', ok: envStatus.OD_CLIENT_SECRET },
    { item: 'OD_APP_ID definido',        ok: envStatus.OD_APP_ID },
    { item: 'OD_MERCHANT_ID definido',   ok: envStatus.OD_MERCHANT_ID },
    { item: 'OD_CW_BASE_URL definido (push ativo)', ok: envStatus.OD_CW_BASE_URL },
    { item: 'Tabela od_events existe',   ok: odEventsStatus?.ok ?? false },
    { item: 'Conectividade com CardápioWeb ok', ok: cwConnectivity?.ok ?? false },
  ];

  const allOk = checklist.every(c => c.ok);

  return NextResponse.json({
    timestamp:  new Date().toISOString(),
    status: allOk ? 'ok' : 'degraded',
    summary: {
      envVarsConfigured: allEnvOk,
      odEnabled:         isODEnabled(),
      cwPushEnabled:     isCWPushEnabled(),
      tableExists:       odEventsStatus?.ok ?? false,
      allSystemsGo:      allOk,
    },
    envVars: envStatus,
    odEventsTable: odEventsStatus,
    recentEvents,
    cardapioWebConnectivity: cwConnectivity,
    endpoints: {
      token:          `${cfg.baseUrl}/api/open-delivery/oauth/token`,
      eventsPolling:  `${cfg.baseUrl}/api/open-delivery/v1/events-polling`,
      acknowledgment: `${cfg.baseUrl}/api/open-delivery/v1/events/acknowledgment`,
      orderDetails:   `${cfg.baseUrl}/api/open-delivery/v1/orders/{orderId}`,
      pushTest:       `${cfg.baseUrl}/api/open-delivery/debug/push-test`,
    },
    checklist,
  });
}

/**
 * POST /api/open-delivery/debug/push-test
 *
 * Dispara um evento de teste ao CardápioWeb com um orderId fictício.
 * Use para confirmar que o push está funcionando sem precisar fazer um pedido real.
 *
 * Body: { orderId?: string }  — se omitido, usa um UUID aleatório
 */
export async function POST(request) {
  if (!isCWPushEnabled()) {
    return NextResponse.json({
      ok: false,
      error: 'OD_CW_BASE_URL não está configurado. Defina essa variável de ambiente.',
    }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const orderId = body.orderId || crypto.randomUUID();

  const result = await pushEventToCardapioWeb(orderId, 'CREATED');

  return NextResponse.json({ orderId, result }, { status: result.ok ? 200 : 502 });
}
