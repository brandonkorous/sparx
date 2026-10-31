import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@wizeworks/auth-client-server';
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
// ── WHY THIS ROUTE NO LONGER READS THE SESSION COOKIE ───────────────────────
//
// The console's cookie has to hold the same opaque token as this domain's, so
// both address ONE session row. This route used to read that token out of the
// cookie, which meant knowing the cookie's name, and knowing the name meant
// building Better Auth here. api-rest mints the token now (docs/154): it gets
// the forwarded cookie, reads the token and the "Keep me signed in" answer
// itself, and hands back only the one-time token. Nothing here touches either.
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
//
export const dynamic = 'force-dynamic';

// ── THE DOOR REFUSES TO OPEN FOR A PREFETCH ─────────────────────────────────
//
// Next's client router does not navigate to a URL — it fetches the RSC payload
// for it first, and only then moves the browser. For an ordinary page that is
// the whole point. For THIS route it is a bug with teeth, because a request here
// MINTS A SINGLE-USE TOKEN: the fetch spends one, dies following the 303 to
// another origin (CORS), and the router then does the real navigation, which
// spends a second. The server log reads
//
//     GET /handoff?next=%2F 303      ← the prefetch, token minted and lost
//     GET /handoff?next=%2F 307      ← the real one, arriving at a spent door
//
// and the customer lands back on the sign-in page they just used.
//
// Every call site is now a plain document navigation, which is the actual fix.
// This is the guard that makes it STAY fixed: one `<Link href="/handoff">` added
// in a year's time reintroduces the whole thing, and nothing about it looks
// wrong in review. A single-use endpoint should not depend on every caller
// remembering that it is one.
//
// 204 with no body is what makes the router give up and navigate for real — it
// is a valid response that is not an RSC payload, so there is nothing to soft-
// navigate INTO. Critically, nothing above it has run: no session read, no
// consent read, and above all no mint.
function isRouterPrefetch(request: NextRequest): boolean {
  // `RSC` is set on every payload fetch the router makes; `Next-Router-Prefetch`
  // only on speculative ones. Both are refused — a payload fetch of this route is
  // never legitimate, prefetch or not.
  return request.headers.has('RSC') || request.headers.has('Next-Router-Prefetch');
}

export async function GET(request: NextRequest) {
  if (isRouterPrefetch(request)) {
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }

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
  const consent = await readConsent();
  if (!consent) {
    return sameOriginRedirectWithNext('/cookie-choices', `/handoff${request.nextUrl.search}`);
  }

  const url = await mintHandoffUrl(request.headers, {
    audience: 'console',
    next: safeInternalPath(request.nextUrl.searchParams.get('next')),
  });
  if (!url) {
    // getSession() above saw a session and api-rest did not, so the two disagree
    // about the cookie. Fail loudly: a redirect to sign-in would see the session
    // and send them back here, and a redirect to the console would bounce them
    // back here too, forever.
    return NextResponse.json(
      { error: 'The session could not be carried to the console. Sign out and sign in again.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  }

  // 303, not 307: this is "go and look over there", and the browser must not
  // repeat any method or body against the new URL. A cached 301/302 here would
  // be actively dangerous — the token is single-use, so a cached redirect would
  // send the next person to an already-spent token and a dead end.
  const res = NextResponse.redirect(url, 303);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
