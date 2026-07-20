// Mints a short-lived internal JWT for the dashboard browser to open the
// /ws/builder collaboration socket (docs/126 Phase 4). Identical to the chat
// ws-token route: the server-only internal token can't reach the browser, so the
// authenticated staff session gets a 10-minute token plus the public API origin.
// The socket authenticates by JWT alone (tid is in the token) and the client also
// hands it the propertyId it wants to edit, which the socket verifies against the
// tenant before joining that site's room.

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
  const token = await new SignJWT({
    tid: session.user.tenantId,
    role: session.user.role,
    ev: session.user.emailVerified,
  })
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
