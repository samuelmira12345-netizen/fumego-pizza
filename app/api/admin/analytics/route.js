import { NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ── Admin auth ─────────────────────────────────────────────────────────────────

function verifyAdminToken(request) {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const decoded = jwt.verify(token, secret);
    return decoded.role === 'admin';
  } catch { return false; }
}

// ── Google Service Account JWT + OAuth2 token ──────────────────────────────────

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function makeServiceAccountJWT(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));
  const signInput = `${header}.${payload}`;
  const keyObject = crypto.createPrivateKey(privateKey);
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  sign.end();
  const sigBuf = sign.sign(keyObject);
  const sig = sigBuf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${signInput}.${sig}`;
}

async function getAccessToken(clientEmail, privateKey) {
  const assertion = makeServiceAccountJWT(clientEmail, privateKey);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || 'Failed to get GA token');
  return data.access_token;
}

// ── GA4 Data API helpers ───────────────────────────────────────────────────────

async function runBatchReports(propertyId, accessToken, requests) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Parse GA4 report rows into a keyed object ─────────────────────────────────

function parseRows(report) {
  if (!report?.rows) return [];
  const dimHeaders  = (report.dimensionHeaders || []).map(h => h.name);
  const metHeaders  = (report.metricHeaders   || []).map(h => h.name);
  return report.rows.map(row => {
    const obj = {};
    (row.dimensionValues || []).forEach((v, i) => { obj[dimHeaders[i]] = v.value; });
    (row.metricValues    || []).forEach((v, i) => { obj[metHeaders[i]] = parseFloat(v.value) || 0; });
    return obj;
  });
}

// Extract metric from a report that may have date ranges (indexed 0=current, 1=previous)
function extractMetricByRange(report, metricName, rangeIndex = 0) {
  if (!report?.rows) return 0;
  const metIdx = (report.metricHeaders || []).findIndex(h => h.name === metricName);
  if (metIdx === -1) return 0;
  let sum = 0;
  for (const row of report.rows) {
    const mv = row.metricValues?.[metIdx + rangeIndex * (report.metricHeaders?.length || 0)];
    sum += parseFloat(mv?.value || '0');
  }
  return sum;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientEmail  = process.env.GA_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GA_PRIVATE_KEY;
  const propertyId   = process.env.GA_PROPERTY_ID;

  if (!clientEmail || !privateKeyRaw || !propertyId) {
    return NextResponse.json({ notConfigured: true });
  }

  const privateKey = privateKeyRaw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || '7daysAgo';
  const endDate   = searchParams.get('endDate')   || 'today';

  // Compute previous period (same duration, shifted back)
  const prevStart = searchParams.get('prevStart') || '14daysAgo';
  const prevEnd   = searchParams.get('prevEnd')   || '8daysAgo';

  try {
    const accessToken = await getAccessToken(clientEmail, privateKey);

    const dateRanges = [
      { startDate, endDate,   name: 'current'  },
      { startDate: prevStart, endDate: prevEnd, name: 'previous' },
    ];

    // ── 4 batch reports (main) ───────────────────────────────────────────────

    const batchResult = await runBatchReports(propertyId, accessToken, [

      // Report 0 — Overall session + user metrics (with comparison)
      {
        dateRanges,
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'averageSessionDuration' },
        ],
      },

      // Report 1 — Funnel events by name (with comparison)
      {
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        metrics:    [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'],
            },
          },
        },
      },

      // Report 2 — Daily time series (sessions + new users)
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics:    [{ name: 'sessions' }, { name: 'newUsers' }, { name: 'totalUsers' }],
        orderBys:   [{ dimension: { dimensionName: 'date' } }],
      },

      // Report 3 — Traffic sources
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionSource' }],
        metrics:    [{ name: 'sessions' }, { name: 'newUsers' }, { name: 'totalUsers' }],
        orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      },
    ]);

    const reports = batchResult.reports || [];

    // ── Report 4 — Product performance (ecommerce, optional) ────────────────
    // Fetched separately because itemName requires Enhanced Ecommerce and
    // an incompatibility would otherwise break the entire batch.
    let productsReport = null;
    try {
      const productsBatch = await runBatchReports(propertyId, accessToken, [{
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'itemName' }],
        metrics:    [
          { name: 'itemViews' },
          { name: 'addToCarts' },
          { name: 'itemsPurchased' },
        ],
        orderBys: [{ metric: { metricName: 'itemViews' }, desc: true }],
        limit: 50,
      }]);
      productsReport = (productsBatch.reports || [])[0] || null;
    } catch {
      // ecommerce not configured — products will be empty
    }

    // ── Parse report 0: overall metrics ─────────────────────────────────────

    function getMetricVal(report, metricName, rangeLabel) {
      if (!report?.rows?.length) return 0;
      const metHeaders = report.metricHeaders || [];
      const dateRangeHeaders = report.dimensionHeaders?.find(h => h.name === 'dateRange');
      // If no dimension = single row, use metric values indexed by date range
      const metIdx = metHeaders.findIndex(h => h.name === metricName);
      if (metIdx === -1) return 0;

      // Single aggregate row (no dimensions)
      const row = report.rows[0];
      if (!row) return 0;
      const numMetrics = metHeaders.length;
      const rangeOffset = rangeLabel === 'previous' ? numMetrics : 0;
      return parseFloat(row.metricValues?.[metIdx + rangeOffset]?.value || '0');
    }

    const r0 = reports[0];
    const overallCurrent  = {
      sessions:               getMetricVal(r0, 'sessions',               'current'),
      totalUsers:             getMetricVal(r0, 'totalUsers',             'current'),
      newUsers:               getMetricVal(r0, 'newUsers',               'current'),
      avgSessionDuration:     getMetricVal(r0, 'averageSessionDuration', 'current'),
    };
    const overallPrevious = {
      sessions:               getMetricVal(r0, 'sessions',               'previous'),
      totalUsers:             getMetricVal(r0, 'totalUsers',             'previous'),
      newUsers:               getMetricVal(r0, 'newUsers',               'previous'),
      avgSessionDuration:     getMetricVal(r0, 'averageSessionDuration', 'previous'),
    };

    // ── Parse report 1: funnel events ────────────────────────────────────────

    const r1 = reports[1];
    const eventMap = { current: {}, previous: {} };
    if (r1?.rows) {
      const numMetrics = r1.metricHeaders?.length || 1;
      for (const row of r1.rows) {
        const evName = row.dimensionValues?.[0]?.value;
        if (!evName) continue;
        eventMap.current[evName]  = parseFloat(row.metricValues?.[0]?.value || '0');
        eventMap.previous[evName] = parseFloat(row.metricValues?.[numMetrics]?.value || '0');
      }
    }

    const funnel = {
      current: {
        sessions:       overallCurrent.sessions,
        view_item:      eventMap.current['view_item']      || 0,
        add_to_cart:    eventMap.current['add_to_cart']    || 0,
        begin_checkout: eventMap.current['begin_checkout'] || 0,
        purchase:       eventMap.current['purchase']       || 0,
      },
      previous: {
        sessions:       overallPrevious.sessions,
        view_item:      eventMap.previous['view_item']      || 0,
        add_to_cart:    eventMap.previous['add_to_cart']    || 0,
        begin_checkout: eventMap.previous['begin_checkout'] || 0,
        purchase:       eventMap.previous['purchase']       || 0,
      },
    };

    // ── Parse report 2: time series ──────────────────────────────────────────

    const r2 = reports[2];
    const timeSeries = parseRows(r2).map(row => ({
      date:           row.date,
      sessions:       row.sessions       || 0,
      newUsers:       row.newUsers       || 0,
      returningUsers: Math.max(0, (row.totalUsers || 0) - (row.newUsers || 0)),
    }));

    // ── Parse report 3: sources ──────────────────────────────────────────────

    function friendlySource(raw) {
      if (!raw || raw === '(direct)' || raw === 'direct') return 'Direto';
      const s = raw.toLowerCase();
      if (s === 'google' || s.includes('google'))       return 'Google';
      if (s.includes('instagram'))                       return 'Instagram';
      if (s.includes('facebook') || s === 'fb')         return 'Facebook';
      if (s.includes('whatsapp'))                        return 'WhatsApp';
      if (s.includes('tiktok'))                          return 'TikTok';
      if (s.includes('youtube'))                         return 'YouTube';
      if (s.includes('twitter') || s.includes('t.co'))  return 'Twitter / X';
      if (s.includes('bing'))                            return 'Bing';
      if (s.includes('yahoo'))                           return 'Yahoo';
      if (s === '(not set)' || s === 'not set')          return 'Outros';
      return raw;
    }

    const r3 = reports[3];
    const rawSources = parseRows(r3).map(row => ({
      source:         friendlySource(row.sessionSource),
      sessions:       row.sessions    || 0,
      newUsers:       row.newUsers    || 0,
      returningUsers: Math.max(0, (row.totalUsers || 0) - (row.newUsers || 0)),
    }));
    // Merge rows that map to the same friendly name
    const sourcesMap = new Map();
    for (const row of rawSources) {
      if (sourcesMap.has(row.source)) {
        const existing = sourcesMap.get(row.source);
        existing.sessions       += row.sessions;
        existing.newUsers       += row.newUsers;
        existing.returningUsers += row.returningUsers;
      } else {
        sourcesMap.set(row.source, { ...row });
      }
    }
    const sources = [...sourcesMap.values()].sort((a, b) => b.sessions - a.sessions);

    // ── Parse report 4: products ─────────────────────────────────────────────

    const r4 = productsReport;
    const products = parseRows(r4)
      .filter(row => row.itemName && row.itemName !== '(not set)')
      .map(row => ({
        name:         row.itemName     || '',
        views:        row.itemViews    || 0,
        addToCarts:   row.addToCarts   || 0,
        purchases:    row.itemsPurchased || 0,
      }));

    // ── Approx timing between steps (from avg session duration) ─────────────
    // These are estimates based on proportional engagement time
    const avgDur = overallCurrent.avgSessionDuration || 0;
    const prevDur = overallPrevious.avgSessionDuration || 0;
    const timing = {
      visitToView:      Math.round(avgDur * 0.15),
      viewToCart:       Math.round(avgDur * 0.45),
      cartToCheckout:   Math.round(avgDur * 0.25),
      checkoutToOrder:  Math.round(avgDur * 0.15),
      prevVisitToView:      Math.round(prevDur * 0.15),
      prevViewToCart:       Math.round(prevDur * 0.45),
      prevCartToCheckout:   Math.round(prevDur * 0.25),
      prevCheckoutToOrder:  Math.round(prevDur * 0.15),
    };

    return NextResponse.json({
      funnel,
      visitors: {
        current:  { total: overallCurrent.totalUsers,  newUsers: overallCurrent.newUsers,  returning: Math.max(0, overallCurrent.totalUsers  - overallCurrent.newUsers)  },
        previous: { total: overallPrevious.totalUsers, newUsers: overallPrevious.newUsers, returning: Math.max(0, overallPrevious.totalUsers - overallPrevious.newUsers) },
      },
      timeSeries,
      sources,
      products,
      timing,
    });

  } catch (err) {
    console.error('[analytics]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
