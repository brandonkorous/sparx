import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@sparx/auth';
import { mintHandoffUrl } from '@piggles/auth-handoff';
import { safeInternalPath } from '@piggles/config';
import { readConsent } from '@/lib/consent';
import { sameOriginRedirectWithNext } from '@/lib/same-origin-redirect';

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
//
// ── WHY THE CONSENT GATE IS HERE AND NOT IN THE CONSOLE ─────────────────────
//
// This route is the ONE door from getpiggles.com into mypiggles.com, which makes
// it the only place a check can be complete. Every way in passes through it:
// finishing onboarding, the account home's button, the console bouncing an
// unauthenticated visitor back and forward again, a bookmark. A check anywhere
// else is a check with a way round it.
//
// The console used to ask for itself, with a banner, AFTER somebody had already
// arrived — so the answer was a cookie on the wrong domain, and the first thing
// a new customer saw of their business was a consent bar over the top of it.
// Asking at the door means the console only ever loads for somebody whose answer
// is already on record, and it means the console needs no ask of its own at all.
//
// A missing answer is not a failure and is not treated as one: it is a question
// nobody has put yet, so the door sends them to put it, carrying where they were
// headed so the trip costs them nothing but the answer.
const COOKIE_NAMES = ['__Secure-better-auth.session_token', 'better-auth.session_token'];

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();

  // Not signed in: send them to sign in, and remember that they were trying to
  // reach the console so they land there rather than on the account home.
  if (!session) {
    return sameOriginRedirectWithNext('/sign-in', `/handoff${request.nextUrl.search}`);
  }

  // Signed in, but never asked whether we may measure them. Ask before opening
  // the door, and come back here afterwards so the destination they wanted is
  // still the destination they get.
  //
  // Deliberately NOT wrapped in a try/catch that lets them through. If this read
  // fails we do not know whether an answer exists, and "we could not tell" must
  // never resolve to "carry on and start the tracker" — the ask is cheap and
  // idempotent, so an unreadable record costs one screen rather than one
  // unconsented session.
  const consent = await readConsent(session.user.id, session.user.tenantId);
  if (!consent) {
    return sameOriginRedirectWithNext('/cookie-choices', `/handoff${request.nextUrl.search}`);
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
