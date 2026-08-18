// Mints the short-lived internal JWT the browser uses to call api-rest directly.
//
// This is the hinge of the whole client-rendered architecture, so it is worth
// stating why it exists. api-rest authenticates a staff caller by exactly one
// credential: a `Bearer` HS256 JWT carrying `{sub, tid, role, ev}`, signed with
// SPARX_INTERNAL_JWT_SECRET. It has no code path that reads a session cookie for
// staff, and it runs `cors: { origin: true, credentials: false }` — so a browser
// cookie would be stripped even if one existed. The dashboard sidesteps this by
// only ever calling api-rest from the server. The workbench renders its panes in
// the browser and cannot.
//
// So: this route is the trust boundary. It authenticates the caller by their
// same-origin session cookie, then hands the browser a narrowly-scoped, short-
// lived token. Crucially `tid` is stamped SERVER-SIDE from the session — the
// browser cannot choose its own tenant, so tenant isolation survives intact and
// api-rest needs no change at all.
//
// This mirrors apps/dashboard/app/api/chat/ws-token/route.ts, which has been
// doing exactly this in production for the chat socket.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import { requireSession } from '@wizeworks/auth';

export const dynamic = 'force-dynamic';

/**
 * Ten minutes. Long enough that a normal working session refreshes rarely, short
 * enough that a leaked token from a shared screen or a stale devtools copy dies
 * quickly. The client refreshes at 80% of life — see lib/api/token.ts.
 */
const TOKEN_TTL_SECONDS = 10 * 60;

export interface WorkbenchTokenResponse {
  token: string;
  /** Absolute epoch-ms expiry, so the client schedules refresh without clock-skew maths. */
  expiresAt: number;
  /** Origin of api-rest the browser should call, e.g. https://api.sparx.works. */
  apiUrl: string;
  /** Active property, forwarded by the client as `x-sparx-property-id`. */
  propertyId: string | null;
  /**
   * Who the browser is signed in AS. Both values are already inside the token
   * (`sub` and the `role` claim) — they are repeated in plain form purely so a
   * pane can read them without decoding a JWT, which is a thing no surface
   * should ever be doing.
   *
   * This is the workbench's ONLY client-side channel for session facts: panes
   * render in the browser, and detached windows render in a different document
   * entirely, so a prop threaded down from the server component cannot reach
   * them. That is why this route — the existing trust boundary — carries it,
   * rather than a second "who am I" endpoint being invented beside it.
   *
   * NEITHER VALUE IS A CONTROL. api-rest re-derives both from the signed token
   * on every request and refuses anything the role cannot do. What they buy is
   * an interface that never offers an action it knows will be refused — the UI
   * mirroring the server's rules, not enforcing them.
   */
  userId: string;
  role: string;
}

export async function GET(): Promise<NextResponse> {
  const session = await requireSession();

  const secret = process.env.SPARX_INTERNAL_JWT_SECRET;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!secret || !apiUrl) {
    // Fail loudly rather than handing back a token the browser can't use, or a
    // usable token aimed at an empty origin.
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
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(secret));

  // api-rest fails closed to the tenant's primary property and resolves the
  // lookup under RLS, so a stale or spoofed value can only ever name one of this
  // same tenant's properties. Forwarding it is a convenience, not a control.
  const cookieStore = await cookies();
  const propertyId = cookieStore.get('sparx_active_property')?.value ?? null;

  const body: WorkbenchTokenResponse = {
    token,
    expiresAt: (now + TOKEN_TTL_SECONDS) * 1000,
    apiUrl,
    propertyId,
    userId: session.user.id,
    role: session.user.role,
  };

  // Never cache a bearer token — not in the browser, not at Cloudflare.
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store, private' },
  });
}
