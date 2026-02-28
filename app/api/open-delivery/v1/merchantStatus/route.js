import { NextResponse } from 'next/server';
import { verifyODToken, getODConfig } from '../../../../../lib/open-delivery';
import { logger } from '../../../../../lib/logger';

/**
 * GET /api/open-delivery/v1/merchantStatus
 *
 * Retorna o resultado do processamento de atualizações do cardápio/merchant.
 * Como não temos fila de processamento assíncrono, retornamos ACCEPTED imediatamente.
 *
 * Response 200: { id, status: "ACCEPTED" | "PROCESSING" | "REJECTED" }
 */
export async function GET(request) {
  const decoded = verifyODToken(request);
  const apiKey  = request.headers.get('x-polling-key') || request.headers.get('x-api-key');
  const expectedApiKey = process.env.OD_API_KEY;

  if (!decoded && !(apiKey && expectedApiKey && apiKey === expectedApiKey)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const cfg = getODConfig();
  const merchantId = cfg.merchantId || 'fumego-pizza';

  logger.info('[OD MerchantStatus] Consultado', { merchantId });

  return NextResponse.json({
    id:     merchantId,
    status: 'ACCEPTED',
  });
}
