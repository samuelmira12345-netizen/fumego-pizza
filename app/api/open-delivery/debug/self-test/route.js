import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase';
import {
  getODConfig,
  isODEnabled,
  isCWPushEnabled,
  issueAccessToken,
  verifyODToken,
  pushEventToCardapioWeb,
  formatOrderAsOD,
  orderURL,
  signWebhookBody,
} from '../../../../../lib/open-delivery';
import { logger } from '../../../../../lib/logger';

/**
 * POST /api/open-delivery/debug/self-test
 *
 * Smoke-test completo da integração Open Delivery.
 * Testa cada passo da cadeia e expõe previews parciais dos valores
 * configurados para facilitar diagnóstico sem expor segredos completos.
 *
 * Query params:
 *   dryRun=true  — pula o push real ao CardápioWeb (padrão: false)
 */
export async function POST(request) {
  const url     = new URL(request.url);
  const dryRun  = url.searchParams.get('dryRun') === 'true';
  const cfg     = getODConfig();
  const results = [];

  function step(name, ok, detail = {}) {
    results.push({ step: name, ok, ...detail });
  }

  // Helper para mascarar valores (mostra primeiros 8 chars)
  function mask(value) {
    if (!value) return '(não definido)';
    if (value.length <= 8) return value.slice(0, 4) + '****';
    return value.slice(0, 8) + '…';
  }

  // ── 1. Variáveis de ambiente ──────────────────────────────────────────────
  const envChecks = {
    OD_CLIENT_ID:        Boolean(process.env.OD_CLIENT_ID),
    OD_CLIENT_SECRET:    Boolean(process.env.OD_CLIENT_SECRET),
    OD_APP_ID:           Boolean(process.env.OD_APP_ID),
    OD_MERCHANT_ID:      Boolean(process.env.OD_MERCHANT_ID),
    OD_CW_BASE_URL:      Boolean(process.env.OD_CW_BASE_URL),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  };
  const appUrlValid = (process.env.NEXT_PUBLIC_APP_URL || '').startsWith('http');
  const envOk = Object.values(envChecks).every(Boolean) && appUrlValid;

  // Mostra previews parciais para o usuário comparar com o portal do CardápioWeb
  step('env_vars', envOk, {
    vars:   envChecks,
    // Previews dos primeiros 8 caracteres (compare com o portal do CardápioWeb)
    previews: {
      OD_APP_ID_preview:        mask(process.env.OD_APP_ID),
      OD_MERCHANT_ID_preview:   mask(process.env.OD_MERCHANT_ID),
      OD_CLIENT_ID_preview:     mask(process.env.OD_CLIENT_ID),
      OD_CW_BASE_URL:           process.env.OD_CW_BASE_URL || '(não definido)',
      NEXT_PUBLIC_APP_URL:      process.env.NEXT_PUBLIC_APP_URL || '(não definido)',
    },
    sampleOrderUrl:  orderURL('ORDER-UUID-EXAMPLE'),
    orderUrlValid:   appUrlValid,
    ...(appUrlValid ? {} : {
      fix: 'NEXT_PUBLIC_APP_URL deve começar com https://. CardápioWeb recebe URL relativa e não consegue buscar detalhes do pedido!',
    }),
  });

  // ── 2. Tabela od_events (com info de expiração) ───────────────────────────
  let recentEvents = [];
  try {
    const supabase = getSupabaseAdmin();
    const { data, error, count } = await supabase
      .from('od_events')
      .select('id, order_id, event_type, created_at, acknowledged_at, expires_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      step('od_events_table', false, {
        error: error.message,
        fix: 'Execute o arquivo open-delivery-schema.sql no Supabase SQL Editor',
      });
    } else {
      recentEvents = data || [];
      const now = new Date();
      const pendingCount   = recentEvents.filter(e => !e.acknowledged_at).length;
      const expiredCount   = recentEvents.filter(e => !e.acknowledged_at && e.expires_at && new Date(e.expires_at) < now).length;
      const validCount     = recentEvents.filter(e => !e.acknowledged_at && (!e.expires_at || new Date(e.expires_at) >= now)).length;

      step('od_events_table', true, {
        totalRows: count,
        pendingEvents: pendingCount,
        validForPolling: validCount,
        expiredEvents: expiredCount,
        recentEvents: recentEvents.map(e => ({
          ...e,
          expired: e.expires_at ? new Date(e.expires_at) < now : false,
        })),
        note: pendingCount === 0
          ? 'Nenhum evento pendente.'
          : `${pendingCount} pendente(s): ${validCount} válido(s) para polling, ${expiredCount} expirado(s) (>24h).`,
        ...(expiredCount > 0 ? {
          warning: 'Eventos expirados NÃO aparecem no polling. CardápioWeb só vê eventos das últimas 24h. Use push-retry para reenviar os pedidos antigos.',
        } : {}),
      });
    }
  } catch (e) {
    step('od_events_table', false, { error: e.message });
  }

  // ── 3. OAuth token (geração + verificação local) ───────────────────────────
  let generatedToken = null;
  try {
    generatedToken = issueAccessToken(cfg.merchantId || 'test');
    const mockRequest = {
      headers: { get: (h) => h === 'authorization' ? `Bearer ${generatedToken}` : null },
    };
    const decoded = verifyODToken(mockRequest);
    if (!decoded) {
      step('oauth_token', false, { error: 'Token gerado mas falhou na verificação. Verifique OD_CLIENT_SECRET.' });
    } else {
      step('oauth_token', true, {
        tokenLength:  generatedToken.length,
        tokenPreview: generatedToken.slice(0, 20) + '…',
        decodedSub:   decoded.sub,
        decodedScope: decoded.scope,
        expiresIn:    '3600s',
        note: 'Geração de token local OK.',
      });
    }
  } catch (e) {
    step('oauth_token', false, {
      error: e.message,
      fix: 'Verifique se OD_CLIENT_SECRET está definido corretamente.',
    });
  }

  // ── 4. Simula o que o CardápioWeb faz: autentica em nossos endpoints ───────
  // O CardápioWeb chama nosso /oauth/token com OD_CLIENT_ID + OD_CLIENT_SECRET
  // para obter um Bearer token, e depois usa esse token para GET /v1/orders/{id}
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!baseUrl) {
      step('cardapioweb_auth_simulation', false, {
        error: 'NEXT_PUBLIC_APP_URL não definido — não é possível simular a autenticação',
        fix: 'Defina NEXT_PUBLIC_APP_URL nas variáveis de ambiente',
      });
    } else {
      const tokenRes = await fetch(`${baseUrl}/api/open-delivery/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type:    'client_credentials',
          client_id:     process.env.OD_CLIENT_ID,
          client_secret: process.env.OD_CLIENT_SECRET,
        }),
        signal: AbortSignal.timeout(8_000),
      });
      const tokenBody = await tokenRes.json().catch(() => ({}));

      if (!tokenRes.ok || !tokenBody.access_token) {
        step('cardapioweb_auth_simulation', false, {
          httpStatus: tokenRes.status,
          error: tokenBody.error || JSON.stringify(tokenBody),
          fix: [
            'O CardápioWeb não consegue autenticar em nossos endpoints.',
            'OD_CLIENT_ID deve ser o "ID do estabelecimento" do portal CardápioWeb.',
            'OD_CLIENT_SECRET deve ser o "Segredo do estabelecimento" do portal CardápioWeb.',
            `OD_CLIENT_ID atual começa com: ${mask(process.env.OD_CLIENT_ID)}`,
          ].join(' | '),
        });
      } else {
        // Testa também o GET /v1/orders com esse token (usando o pedido mais recente)
        let orderTestNote = 'Token OAuth válido.';
        if (recentEvents.length > 0) {
          const testOrderId = recentEvents[0].order_id;
          const orderRes = await fetch(`${baseUrl}/api/open-delivery/v1/orders/${testOrderId}`, {
            headers: { 'Authorization': `Bearer ${tokenBody.access_token}` },
            signal: AbortSignal.timeout(8_000),
          }).catch(() => null);
          if (orderRes?.ok) {
            orderTestNote = `Token OAuth válido. GET /v1/orders/${testOrderId.slice(0,8)}… retornou ${orderRes.status} — CardápioWeb consegue buscar detalhes do pedido ✓`;
          } else {
            orderTestNote = `Token OAuth válido mas GET /v1/orders retornou ${orderRes?.status ?? 'erro de rede'} — verifique o endpoint de pedidos.`;
          }
        }
        step('cardapioweb_auth_simulation', true, {
          note: orderTestNote,
        });
      }
    }
  } catch (e) {
    step('cardapioweb_auth_simulation', false, { error: e.message });
  }

  // ── 5. Pedido mais recente formatado como OD ──────────────────────────────
  try {
    const supabase = getSupabaseAdmin();
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!orders || orders.length === 0) {
      step('order_format', true, { note: 'Nenhum pedido encontrado no banco ainda.' });
    } else {
      const order = orders[0];
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      const formatted = formatOrderAsOD(order, items || []);

      const formatIssues = [];
      if (!formatted.id)                  formatIssues.push('id ausente');
      if (!formatted.merchant?.id)        formatIssues.push('merchant.id ausente');
      if (!formatted.items?.length)       formatIssues.push('items[] vazio');
      if (!formatted.customer?.name)      formatIssues.push('customer.name ausente');
      if (!formatted.total?.orderAmount)  formatIssues.push('total.orderAmount ausente');

      step('order_format', formatIssues.length === 0, {
        orderId:      order.id,
        orderNumber:  order.order_number,
        status:       order.status,
        itemsCount:   (items || []).length,
        orderURL:     orderURL(order.id),
        formatIssues: formatIssues.length > 0 ? formatIssues : undefined,
        odPreview: {
          id:          formatted.id,
          displayId:   formatted.displayId,
          type:        formatted.type,
          lastEvent:   formatted.lastEvent,
          merchant:    formatted.merchant,
          itemsCount:  formatted.items?.length,
          total:       formatted.total,
          customer:    { name: formatted.customer?.name, phone: formatted.customer?.phone },
          hasDelivery: Boolean(formatted.delivery),
          payments:    formatted.payments,
        },
      });
    }
  } catch (e) {
    step('order_format', false, { error: e.message });
  }

  // ── 6. Push ao CardápioWeb ────────────────────────────────────────────────
  if (!isCWPushEnabled()) {
    step('cardapioweb_push', false, {
      error: 'OD_CW_BASE_URL não configurado',
      fix:   'Defina OD_CW_BASE_URL nas variáveis de ambiente para ativar o push.',
    });
  } else if (dryRun) {
    step('cardapioweb_push', true, {
      note: 'dryRun=true — push pulado.',
      cwBaseUrl:        process.env.OD_CW_BASE_URL,
      appId_preview:    mask(process.env.OD_APP_ID),
      merchantId_preview: mask(process.env.OD_MERCHANT_ID),
    });
  } else {
    const testOrderId = 'self-test-' + Date.now();
    try {
      const pushResult = await pushEventToCardapioWeb(testOrderId, 'CREATED');
      // 404 = CardápioWeb recebeu mas não encontrou o pedido fictício → conectividade OK
      const pushOk = pushResult.ok || pushResult.status === 404;
      step('cardapioweb_push', pushOk, {
        testOrderId,
        httpStatus:         pushResult.status,
        response:           pushResult.error || 'ok',
        appId_sent:         mask(process.env.OD_APP_ID),
        merchantId_sent:    mask(process.env.OD_MERCHANT_ID),
        note: pushOk
          ? pushResult.ok
            ? 'CardápioWeb aceitou o push (200/204). Conectividade OK ✓'
            : 'CardápioWeb recebeu o push e retornou 404 (pedido fictício inexistente). Conectividade OK ✓'
          : 'CardápioWeb rejeitou o push — verifique OD_APP_ID e OD_MERCHANT_ID.',
        ...(!pushOk ? {
          fix: [
            'Se httpStatus=403: OD_APP_ID ou OD_MERCHANT_ID incorretos.',
            `OD_APP_ID atual começa com: ${mask(process.env.OD_APP_ID)}`,
            `OD_MERCHANT_ID atual começa com: ${mask(process.env.OD_MERCHANT_ID)}`,
            'Compare esses valores com o portal CardápioWeb.',
          ].join(' | '),
        } : {}),
      });
    } catch (e) {
      step('cardapioweb_push', false, {
        error: e.message,
        fix:   'Verifique se OD_CW_BASE_URL está correto e acessível.',
      });
    }
  }

  // ── Resultado final ───────────────────────────────────────────────────────
  const allOk = results.every(r => r.ok);
  const failedSteps = results.filter(r => !r.ok).map(r => r.step);

  logger.info('[OD Self-Test] Concluído', { allOk, failedSteps });

  return NextResponse.json({
    timestamp:   new Date().toISOString(),
    status:      allOk ? 'all_ok' : 'issues_found',
    allOk,
    failedSteps,
    dryRun,
    steps: results,
    nextAction: allOk
      ? 'Todos os testes passaram. Faça um pedido de teste e verifique o painel do CardápioWeb.'
      : `Problemas em: ${failedSteps.join(', ')}.`,
  });
}
