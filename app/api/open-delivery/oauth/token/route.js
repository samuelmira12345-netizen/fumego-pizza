import { NextResponse } from 'next/server';
import { issueAccessToken } from '../../../../../lib/open-delivery';

/**
 * POST /api/open-delivery/oauth/token
 *
 * Endpoint de autenticação OAuth2 Client Credentials.
 * O CardápioWeb chama este endpoint com clientId + clientSecret para obter um token
 * que usará como Bearer nas demais chamadas à nossa API.
 *
 * Request body (application/json ou application/x-www-form-urlencoded):
 *   { client_id, client_secret, grant_type: "client_credentials" }
 *
 * Response:
 *   { access_token, token_type: "Bearer", expires_in: 3600 }
 */
export async function POST(request) {
  try {
    let body = {};

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      body = Object.fromEntries(new URLSearchParams(text));
    } else {
      body = await request.json().catch(() => ({}));
    }

    const { client_id, client_secret, grant_type } = body;

    if (grant_type !== 'client_credentials') {
      return NextResponse.json(
        { error: 'unsupported_grant_type' },
        { status: 400 }
      );
    }

    const expected_id     = process.env.OD_CLIENT_ID;
    const expected_secret = process.env.OD_CLIENT_SECRET;

    if (
      !expected_id ||
      !expected_secret ||
      client_id     !== expected_id ||
      client_secret !== expected_secret
    ) {
      return NextResponse.json(
        { error: 'invalid_client' },
        { status: 401 }
      );
    }

    const access_token = issueAccessToken(process.env.OD_MERCHANT_ID || '');

    return NextResponse.json({
      access_token,
      token_type: 'Bearer',
      expires_in: 3600,
    });
  } catch (e) {
    return NextResponse.json({ error: 'server_error', message: e.message }, { status: 500 });
  }
}
