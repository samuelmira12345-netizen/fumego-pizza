import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { clearAuthCookie, revokeUserSession } from '../../../../lib/auth';

/** POST /api/auth/logout — invalida a sessão removendo o cookie httpOnly e revogando o jti. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // P8: delete the jti from user_sessions so the token is immediately rejected
  // even if someone still has it (e.g. copied from a cookie before logout).
  // We catch errors here so that a transient Supabase failure does not prevent
  // the cookie from being cleared — the cookie removal is always the priority.
  try {
    const supabase = getSupabaseAdmin();
    await revokeUserSession(supabase, request);
  } catch {
    // Log is best-effort; cookie is still cleared below
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookie(response);
  return response;
}
