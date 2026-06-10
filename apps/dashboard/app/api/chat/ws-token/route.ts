// Mints a short-lived internal JWT for the dashboard browser to open the
// /ws/chat socket (docs/69 A-5). The dashboard's api-rest client signs the same
// token server-side per request; the socket can't carry the server-only token,
// so this route hands the authenticated staff session a 10-minute token plus
// the public API origin the browser connects to. A staff socket authenticates
// by JWT alone (tid is in the token) — no tenant slug needed.

import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { requireSession } from '@sparx/auth';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const session = await requireSession();
  const secret = process.env.SPARX_INTERNAL_JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ tid: session.user.tenantId, role: session.user.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(session.user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + 10 * 60)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({
    token,
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  });
}
