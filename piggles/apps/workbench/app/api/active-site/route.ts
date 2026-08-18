// Persists the operator's active site (property) as a SERVER-SET cookie.
//
// Why a route and not `document.cookie`: the switcher used to write the cookie
// straight from the browser, which a privacy-hardened browser (strict shields,
// a cookie-blocking extension, "block sites from setting data") silently drops
// — while still honoring server `Set-Cookie`, which is how the Better Auth
// session cookie keeps working in the very same browser. A dropped write left
// the switch half-applied: the page reloaded, found no cookie, and fell back to
// the primary site, so the switcher never moved. Setting it here, the same way
// the session is set, makes the switch work regardless of the browser's JS
// cookie policy.
//
// The value stays a PREFERENCE, not a control: api-rest re-resolves it under RLS
// and fails closed to the tenant's primary property (see wizeworks/services/api-rest
// lib/property.ts), so a stale or unknown id can only ever name one of this same
// tenant's sites. Authenticating here simply keeps the endpoint from being an
// open cookie-writer for anonymous callers.

import { NextResponse } from 'next/server';
import { getSession } from '@wizeworks/auth';

export const dynamic = 'force-dynamic';

const ACTIVE_PROPERTY_COOKIE = 'piggles_active_property';
/** One year — matches the layout/preference lifetime the client wrote before. */
const COOKIE_MAX_AGE_SECONDS = 31_536_000;

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { siteId?: unknown } | null;
  const siteId = typeof body?.siteId === 'string' ? body.siteId.trim() : '';
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACTIVE_PROPERTY_COOKIE,
    value: siteId,
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    // httpOnly because nothing client-side reads this cookie — only the server
    // (this app's page + /api/token) does — so there is no reason to expose it
    // to JS, and doing so is what made it blockable in the first place.
    httpOnly: true,
    sameSite: 'lax',
    // Dev is http://localhost, where a Secure cookie would be discarded; prod is
    // https, where it must be set. Mirrors how the session cookie is scoped.
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
