import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@sparx/auth';
import { mintHandoffUrl } from '@piggles/auth-handoff';
import { safeInternalPath } from '@piggles/config';

// The one door from getpiggles.com into mypiggles.com.
//
// Everything that sends somebody to the console goes through here rather than
// linking to `https://mypiggles.com` directly: the console has no sign-in UI, so
// a direct link from a signed-in page lands an unauthenticated visitor who gets
// bounced straight back. One route means one place that knows how a session
// crosses the boundary.
//
// ── WHY THE SESSION TOKEN IS READ FROM THE COOKIE ───────────────────────────
//
// `getSession()` proves there IS a valid session and tells us whose it is, but
// it returns the session's data — not the opaque token the cookie carries, which
// is the thing the console's cookie has to hold if both are to address ONE
// session row. So we verify with `getSession()` and carry the raw cookie value.
//
// Better Auth's cookie is `better-auth.session_token`, prefixed `__Secure-` when
// it is issued over HTTPS. Both names are checked because dev is plain HTTP and
// production is not, and hardcoding either one breaks the other environment in a
// way that only shows up after deploy.
const COOKIE_NAMES = ['__Secure-better-auth.session_token', 'better-auth.session_token'];

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();

  // Not signed in: send them to sign in, and remember that they were trying to
  // reach the console so they land there rather than on the account home.
  if (!session) {
    const back = new URL('/sign-in', request.url);
    back.searchParams.set('next', `/handoff${request.nextUrl.search}`);
    return NextResponse.redirect(back);
  }

  const raw = COOKIE_NAMES.map((n) => request.cookies.get(n)?.value).find(Boolean);
  if (!raw) {
    // A valid session with no readable cookie means the cookie name has moved
    // under us — a Better Auth upgrade, or a config change. Fail loudly rather
    // than redirecting to a console that will bounce them back here forever.
    return NextResponse.json(
      { error: 'Could not read the session cookie. The handoff cannot be minted.' },
      { status: 500 }
    );
  }

  // Better Auth signs the cookie as `<token>.<signature>`. The token is the part
  // before the dot — the signature is this domain's proof and means nothing on
  // the other one, which mints its own.
  const sessionToken = raw.split('.')[0] ?? raw;

  const url = await mintHandoffUrl({
    sessionToken,
    userId: session.user.id,
    audience: 'console',
    next: safeInternalPath(request.nextUrl.searchParams.get('next')),
  });

  // 303, not 307: this is "go and look over there", and the browser must not
  // repeat any method or body against the new URL. A cached 301/302 here would
  // be actively dangerous — the token is single-use, so a cached redirect would
  // send the next person to an already-spent token and a dead end.
  const res = NextResponse.redirect(url, 303);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
