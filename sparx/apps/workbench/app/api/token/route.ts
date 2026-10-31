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
// browser cannot choose its own tenant, so tenant isolation survives intact.
//
// api-rest mints the token (`/auth/sparx/platform/api-token`, docs/154 §4)
// from the forwarded session cookie, so the signing secret never reaches this
// pod. This route adds the two values that are the console's own: the public
// API origin and the active site.

import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { fetchApiToken } from '@wizeworks/auth-client-server';
import { ACTIVE_PROPERTY_COOKIE, readActiveSite } from '../../../lib/active-site-cookie';

export const dynamic = 'force-dynamic';

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
  /** The signed-in address, and whether it is confirmed. Read by the
   *  confirm-your-email notice (sparx persona issue 157); `ev` in the token is
   *  what api-rest acts on. Not a control either. */
  email: string;
  emailVerified: boolean;
}

export async function GET(): Promise<NextResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    // Fail loudly rather than handing back a usable token aimed at an empty
    // origin.
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  // Ten minutes, minted by api-rest. The client refreshes at 80% of life — see
  // lib/api/token.ts.
  const minted = await fetchApiToken(await headers());
  if (!minted) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store, private' } }
    );
  }

  // api-rest fails closed to the tenant's primary property and resolves the
  // lookup under RLS, so a stale or spoofed value can only ever name one of this
  // same tenant's properties. Forwarding it is a convenience, not a control.
  const cookieStore = await cookies();
  // Bound to the tenant that set it, so a site left by another company's
  // operator on this computer is never forwarded (sparx persona issue 011).
  const propertyId = readActiveSite(
    cookieStore.get(ACTIVE_PROPERTY_COOKIE)?.value,
    minted.tenantId
  );

  const body: WorkbenchTokenResponse = {
    token: minted.token,
    expiresAt: minted.expiresAt,
    apiUrl,
    propertyId,
    userId: minted.userId,
    role: minted.role,
    email: minted.email,
    emailVerified: minted.emailVerified,
  };

  // Never cache a bearer token — not in the browser, not at Cloudflare.
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store, private' },
  });
}
