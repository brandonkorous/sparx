import { NextResponse, type NextRequest } from 'next/server';
import { accountOrigin, consumeHandoffToken, sessionCookie } from '@piggles/auth-handoff';
import { safeInternalPath } from '@piggles/config';

// The console's only door.
//
// getpiggles.com mints a one-time, 60-second, audience-bound token and sends the
// browser here. This route trades it for a session cookie on THIS domain and
// then gets out of the way. It is the whole of authentication in the console:
// there is no sign-in form, no password field, no OAuth callback, and there must
// never be one — a second thing that can mint a session is exactly what the
// three-domain split exists to prevent.
//
// ── EVERY FAILURE LEADS SOMEWHERE, NONE LEADS BACK HERE ─────────────────────
//
// A token can be missing, spent, expired, malformed, or minted for a different
// audience. All five mean the same thing to the person holding the browser —
// "that link didn't work" — and all five are answered by sending them to the
// account app, which is the one place that can put it right. What none of them
// may do is retry this route: a redirect back here with the same spent token is
// an infinite loop, and a loop is how a broken link becomes a broken product.
//
// So the failure destination is `/handoff` on the account app, NOT a retry and
// NOT a bare sign-in form. A visitor whose session is still good there is handed
// a fresh token and arrives; one whose session is genuinely gone gets a sign-in
// form. Either way the next thing they see is progress.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const result = await consumeHandoffToken(request.nextUrl.searchParams.get('t'), 'console');

  if (!result.ok) {
    // `reason` is deliberately not shown to the person and deliberately not
    // logged as an error either: an expired token is the ordinary consequence of
    // a slow phone, not a fault. It rides the query string so the account app
    // could word its message, and so this is diagnosable from an access log.
    const back = new URL(`${accountOrigin()}/handoff`);
    back.searchParams.set('handoff', result.reason);
    return noStore(NextResponse.redirect(back, 303));
  }

  const cookie = sessionCookie(result.sessionToken);
  const destination = new URL(safeInternalPath(result.next), request.nextUrl.origin);

  // 303 so the browser makes a plain GET of the destination, and never repeats
  // this one. A cached redirect here would be actively dangerous: the token is
  // single-use, so replaying it lands the NEXT person on a dead end.
  const response = NextResponse.redirect(destination, 303);
  response.cookies.set({ name: cookie.name, value: cookie.value, ...cookie.options });
  return noStore(response);
}

/** Nothing on this route may be cached — by the browser, by Cloudflare, or by
 *  anything in between. The response carries a session. */
function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return response;
}
