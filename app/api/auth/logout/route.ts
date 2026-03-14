import { NextResponse } from 'next/server';
import { clearAuthCookie } from '../../../../lib/auth';

/** POST /api/auth/logout — invalida a sessão removendo o cookie httpOnly. */
export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true });
  clearAuthCookie(response);
  return response;
}
