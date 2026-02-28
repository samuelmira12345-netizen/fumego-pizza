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
} from '../../../../../lib/open-delivery';
import { logger } from '../../../../../lib/logger';

/**
 * POST /api/open-delivery/debug/self-test
 *
 * Executa um smoke-test completo da integração Open Delivery sem precisar
 * fazer um pedido real. Testa cada passo da cadeia:
 *
 *  1. Variáveis de ambiente essenciais
 *  2. Conexão com Supabase (tabela od_events)
 *  3. Geração e verificação do token OAuth
 *  4. Pedido mais recente formatado como OD (preview do que o CardápioWeb recebe)
 *  5. Eventos pendentes em od_events
 *  6. Push de teste ao CardápioWeb (opcional — passa ?dryRun=true para pular)
 *
 * Endpoint PÚBLICO para facilitar o diagnóstico em produção.
 * NÃO expõe segredos — apenas indica se estão definidos.
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

  // ── 1. Variáveis de ambiente ──────────────────────────────────────────────
  const envChecks = {
    OD_CLIENT_ID:       Boolean(process.env.OD_CLIENT_ID),
    OD_CLIENT_SECRET:   Boolean(process.env.OD_CLIENT_SECRET),
    OD_APP_ID:          Boolean(process.env.OD_APP_ID),
    OD_MERCHANT_ID:     Boolean(process.env.OD_MERCHANT_ID),
    OD_CW_BASE_URL:     Boolean(process.env.OD_CW_BASE_URL),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  };
  const appUrlValid = (process.env.NEXT_PUBLIC_APP_URL || '').startsWith('http');
  const envOk = Object.values(envChecks).every(Boolean) && appUrlValid;

  step('env_vars', envOk, {
    vars:   envChecks,
    sampleOrderUrl:  orderURL('ORDER-UUID-EXAMPLE'),
    orderUrlValid:   appUrlValid,
    ...(appUrlValid ? {} : {
      fix: 'NEXT_PUBLIC_APP_URL deve começar com https://. CardápioWeb recebe URL relativa e não consegue buscar detalhes do pedido!',
    }),
  });

  // ── 2. Tabela od_events ───────────────────────────────────────────────────
  let odEventsOk = false;
  let pendingCount = 0;
  let recentEvents = [];
  try {
    const supabase = getSupabaseAdmin();
    const { data, error, count } = await supabase
      .from('od_events')
      .select('id, order_id, event_type, created_at, acknowledged_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      step('od_events_table', false, {
        error: error.message,
        fix: 'Execute o arquivo open-delivery-schema.sql no Supabase SQL Editor',
      });
    } else {
      odEventsOk = true;
      recentEvents = data || [];
      pendingCount = (data || []).filter(e => !e.acknowledged_at).length;
      step('od_events_table', true, {
        totalRows: count,
        pendingEvents: pendingCount,
        recentEvents,
        note: pendingCount === 0
          ? 'Nenhum evento pendente. CardápioWeb já reconheceu tudo OU nenhum pedido foi feito ainda.'
          : `${pendingCount} evento(s) pendente(s) — CardápioWeb ainda não reconheceu.`,
      });
    }
  } catch (e) {
    step('od_events_table', false, { error: e.message });
  }

  // ── 3. OAuth token (geração + verificação) ────────────────────────────────
  let generatedToken = null;
  try {
    generatedToken = issueAccessToken(cfg.merchantId || 'test');

    // Simula a verificação que o CardápioWeb faria ao chamar nossos endpoints
    const mockRequest = {
      headers: {
        get: (h) => h === 'authorization' ? `Bearer ${generatedToken}` : null,
      },
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
        note: 'CardápioWeb conseguirá autenticar nos endpoints de polling e order details.',
      });
    }
  } catch (e) {
    step('oauth_token', false, {
      error: e.message,
      fix: 'Verifique se OD_CLIENT_SECRET está definido corretamente.',
    });
  }

  // ── 4. Pedido mais recente formatado como OD ──────────────────────────────
  try {
    const supabase = getSupabaseAdmin();
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!orders || orders.length === 0) {
      step('order_format', true, { note: 'Nenhum pedido encontrado no banco ainda. Faça um pedido de teste.' });
    } else {
      const order = orders[0];
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      const formatted = formatOrderAsOD(order, items || []);

      // Validações críticas do formato
      const formatIssues = [];
      if (!formatted.id)                  formatIssues.push('id ausente');
      if (!formatted.merchant?.id)        formatIssues.push('merchant.id ausente');
      if (!formatted.items?.length)       formatIssues.push('items[] vazio — verifique se os itens foram inseridos em order_items');
      if (!formatted.customer?.name)      formatIssues.push('customer.name ausente');
      if (!formatted.total?.orderAmount)  formatIssues.push('total.orderAmount ausente');
      if (formatted.delivery?.deliveryAddress) {
        const addr = formatted.delivery.deliveryAddress;
        if (!addr.formattedAddress)       formatIssues.push('delivery.deliveryAddress.formattedAddress ausente');
      }

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

  // ── 5. Push ao CardápioWeb ────────────────────────────────────────────────
  if (!isCWPushEnabled()) {
    step('cardapioweb_push', false, {
      error: 'OD_CW_BASE_URL não configurado',
      fix:   'Defina OD_CW_BASE_URL nas variáveis de ambiente para ativar o push.',
    });
  } else if (dryRun) {
    step('cardapioweb_push', true, {
      note: 'dryRun=true — push pulado. Remova o parâmetro para executar o teste real.',
      cwBaseUrl: process.env.OD_CW_BASE_URL,
    });
  } else {
    // Usa um orderId fictício para testar a conectividade
    const testOrderId = 'self-test-' + Date.now();
    try {
      const pushResult = await pushEventToCardapioWeb(testOrderId, 'CREATED');
      // 404 é aceitável: significa que o CardápioWeb recebeu mas não encontrou o pedido
      // (pedido fictício). O importante é que a comunicação funcionou.
      const pushOk = pushResult.ok || pushResult.status === 404;
      step('cardapioweb_push', pushOk, {
        testOrderId,
        httpStatus:  pushResult.status,
        response:    pushResult.error || 'ok',
        note: pushOk
          ? pushResult.ok
            ? 'CardápioWeb aceitou o push (200/204). Conectividade OK.'
            : 'CardápioWeb recebeu o push e retornou 404 (pedido fictício não existe). Conectividade OK.'
          : 'CardápioWeb rejeitou o push. Verifique OD_MERCHANT_ID, OD_APP_ID e OD_CLIENT_SECRET.',
      });
    } catch (e) {
      step('cardapioweb_push', false, {
        error: e.message,
        fix:   'Verifique se OD_CW_BASE_URL está correto e se o servidor está acessível.',
      });
    }
  }

  // ── Resultado final ───────────────────────────────────────────────────────
  const allOk = results.every(r => r.ok);
  const failedSteps = results.filter(r => !r.ok).map(r => r.step);

  logger.info('[OD Self-Test] Concluído', {
    allOk,
    failedSteps,
    stepsTotal: results.length,
  });

  return NextResponse.json({
    timestamp:   new Date().toISOString(),
    status:      allOk ? 'all_ok' : 'issues_found',
    allOk,
    failedSteps,
    dryRun,
    steps: results,
    nextAction: allOk
      ? 'Integração OK. Faça um pedido de teste e verifique o painel do CardápioWeb.'
      : `Problemas encontrados em: ${failedSteps.join(', ')}. Consulte o campo "fix" de cada passo.`,
  });
}
