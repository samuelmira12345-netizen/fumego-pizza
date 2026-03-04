import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { isODEnabled, isCWPushEnabled, getODConfig, pushEventToCardapioWeb, orderURL, signWebhookBody } from '../../../../lib/open-delivery';

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

  // NEXT_PUBLIC_APP_URL é CRÍTICO: se ausente, orderURL() retorna URL relativa
  // e o CardápioWeb não consegue buscar detalhes do pedido.
  const appBaseUrl      = process.env.NEXT_PUBLIC_APP_URL || '';
  const orderUrlValid   = appBaseUrl.startsWith('http');
  const sampleOrderUrl  = orderURL('EXAMPLE-ORDER-ID');

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
  // Testamos POST /v1/newEvent com payload mínimo (dry-run).
  // GET sem auth sempre retorna 302 (redirect para login) — isso é normal e não indica erro.
  let cwConnectivity = null;
  if (process.env.OD_CW_BASE_URL) {
    try {
      const cwBaseUrl  = process.env.OD_CW_BASE_URL;
      const appId      = process.env.OD_APP_ID || process.env.OD_CLIENT_ID || '';
      const merchantId = process.env.OD_MERCHANT_ID || '';
      const testBody   = JSON.stringify({
        eventId:   'debug-connectivity-test',
        eventType: 'PING',
        orderId:   'debug-test',
        orderURL:  orderURL('debug-test'),
        createdAt: new Date().toISOString(),
      });
      const sig = signWebhookBody(testBody);
      const res = await fetch(`${cwBaseUrl}/v1/newEvent`, {
        method: 'POST',
        headers: {
          'Content-Type':     'application/json',
          'X-App-Id':         appId,
          'X-App-MerchantId': merchantId,
          'X-App-Signature':  sig,
        },
        body: testBody,
        signal: AbortSignal.timeout(5000),
      });
      const responseText = await res.text().catch(() => '');
      // 200/201/204 = sucesso
      // 400/422    = endpoint existe, payload inválido (conectividade ok)
      // 401/403    = endpoint existe, credenciais rejeitadas
      // 404        = endpoint não encontrado → OD_CW_BASE_URL errada
      // 5xx / erro = problema de rede ou servidor fora
      const endpointFound = res.status !== 404;
      const reachable     = res.status < 500 && endpointFound;
      cwConnectivity = {
        ok: reachable,
        status: res.status,
        response: responseText.slice(0, 200),
        ...(res.ok ? { note: 'Servidor aceitou o evento' } : {}),
        ...(res.status === 404 ? { warning: 'Endpoint /v1/newEvent não encontrado — OD_CW_BASE_URL está errada. Tente https://integracao.cardapioweb.com/api/open_delivery' } : {}),
        ...(!reachable && res.status >= 500 ? { warning: 'Servidor retornou 5xx — verifique OD_CW_BASE_URL' } : {}),
        ...((res.status === 401 || res.status === 403) ? { warning: 'Credenciais rejeitadas — verifique OD_APP_ID / OD_MERCHANT_ID' } : {}),
      };
    } catch (e) {
      cwConnectivity = { ok: false, error: e.message };
    }
  }

  // ── Resultado ────────────────────────────────────────────────────────────
  const checklist = [
    { item: 'OD_CLIENT_ID definido',                ok: envStatus.OD_CLIENT_ID },
    { item: 'OD_CLIENT_SECRET definido',            ok: envStatus.OD_CLIENT_SECRET },
    { item: 'OD_APP_ID definido',                   ok: envStatus.OD_APP_ID },
    { item: 'OD_MERCHANT_ID definido',              ok: envStatus.OD_MERCHANT_ID },
    { item: 'OD_CW_BASE_URL definido (push ativo)', ok: envStatus.OD_CW_BASE_URL },
    {
      item: 'NEXT_PUBLIC_APP_URL definido e válido (orderURL acessível pelo CardápioWeb)',
      ok:   orderUrlValid,
      ...(orderUrlValid ? {} : { fix: 'Defina NEXT_PUBLIC_APP_URL=https://SEU-DOMINIO.com' }),
    },
    { item: 'Tabela od_events existe',              ok: odEventsStatus?.ok ?? false,
      ...(odEventsStatus?.ok ? {} : { fix: 'Execute open-delivery-schema.sql no Supabase SQL Editor' }),
    },
    { item: 'Conectividade com CardápioWeb ok',     ok: cwConnectivity?.ok ?? false },
    { item: 'GET /v1/merchant implementado',        ok: true },
    { item: 'GET /v1/merchantStatus implementado',  ok: true },
    { item: 'PATCH /v1/orders/{id}/details impl.',  ok: true },
    { item: 'POST /v1/orders/{id}/tracking impl.',  ok: true },
    { item: 'POST /v1/orders/{id}/validateCode impl.', ok: true },
    { item: 'GET /v1/versions/* implementados',     ok: true },
  ];

  const allOk = checklist.every(c => c.ok);

  return NextResponse.json({
    timestamp:  new Date().toISOString(),
    status: allOk ? 'ok' : 'degraded',
    summary: {
      envVarsConfigured:   allEnvOk,
      odEnabled:           isODEnabled(),
      cwPushEnabled:       isCWPushEnabled(),
      orderUrlValid,
      tableExists:         odEventsStatus?.ok ?? false,
      allSystemsGo:        allOk,
    },
    envVars: envStatus,
    // Mostra a URL que seria enviada ao CardápioWeb para buscar pedidos.
    // Se começar com "/" (relativa), o CardápioWeb NÃO conseguirá acessá-la!
    sampleOrderUrl,
    orderUrlStatus: orderUrlValid
      ? 'OK — URL absoluta e válida'
      : `ERRO — URL relativa ("${sampleOrderUrl}"). Defina NEXT_PUBLIC_APP_URL=https://SEU-DOMINIO.com`,
    odEventsTable: odEventsStatus,
    recentEvents,
    cardapioWebConnectivity: cwConnectivity,
    endpoints: {
      token:              `${cfg.baseUrl}/api/open-delivery/oauth/token`,
      merchant:           `${cfg.baseUrl}/api/open-delivery/v1/merchant`,
      merchantStatus:     `${cfg.baseUrl}/api/open-delivery/v1/merchantStatus`,
      merchantAvail:      `${cfg.baseUrl}/api/open-delivery/v1/merchant/{merchantId}/status`,
      eventsPolling:      `${cfg.baseUrl}/api/open-delivery/v1/events-polling`,
      acknowledgment:     `${cfg.baseUrl}/api/open-delivery/v1/events/acknowledgment`,
      orderDetails:       `${cfg.baseUrl}/api/open-delivery/v1/orders/{orderId}`,
      orderTracking:      `${cfg.baseUrl}/api/open-delivery/v1/orders/{orderId}/tracking`,
      orderValidateCode:  `${cfg.baseUrl}/api/open-delivery/v1/orders/{orderId}/validateCode`,
      orderDetails_patch: `${cfg.baseUrl}/api/open-delivery/v1/orders/{orderId}/details`,
      versionMerchant:    `${cfg.baseUrl}/api/open-delivery/v1/versions/merchant`,
      versionOrderingApp: `${cfg.baseUrl}/api/open-delivery/v1/versions/orderingApp`,
      pushTest:           `${cfg.baseUrl}/api/open-delivery/debug/push-test`,
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
