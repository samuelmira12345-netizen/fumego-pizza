import { NextResponse } from 'next/server';
import { verifyODToken } from '../../../../../../../lib/open-delivery';
import { logger } from '../../../../../../../lib/logger';

/**
 * POST /api/open-delivery/v1/orders/{orderId}/denyCancellation
 *
 * Chamado pelo CardápioWeb negando um pedido de cancelamento que partiu de nós.
 * Logamos o evento; o pedido permanece no estado atual.
 *
 * Response 202: Accepted
 */
export async function POST(request, { params }) {
  const decoded = verifyODToken(request);
  if (!decoded) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  logger.info('[OD] Cancelamento negado pelo CardápioWeb', { orderId: params.orderId });
  return NextResponse.json({ message: 'accepted' }, { status: 202 });
}
