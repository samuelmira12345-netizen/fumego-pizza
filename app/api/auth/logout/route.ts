import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { clearAuthCookie, revokeUserSession } from '../../../../lib/auth';

/** POST /api/auth/logout — invalida a sessão removendo o cookie httpOnly e revogando o jti. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // P8: delete the jti from user_sessions so the token is immediately rejected
  // even if someone still has it (e.g. copied from a cookie before logout).
  const supabase = getSupabaseAdmin();
  await revokeUserSession(supabase, request);

  const response = NextResponse.json({ success: true });
  clearAuthCookie(response);
  return response;
}
