import { NextResponse, type NextRequest } from 'next/server';
import { auth, getSession } from '@wizeworks/auth';
import { getCookies } from 'better-auth/cookies';
import { mintHandoffUrl, readsAsRemembered } from '@piggles/auth-handoff';
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
// The cookie's NAME is asked for rather than written down. It is
// `<prefix>.session_token`, prefixed `__Secure-` over HTTPS — and the prefix is
// a deployment parameter now (Piggles ships `piggles-account`, so a customer
// never sees a library's name in their own browser). Both the plain and
// `__Secure-` forms are checked because dev is HTTP and production is not.
//
// `getCookies(auth.options)` is the library's own answer read from the library's
// own config, so a change to the prefix arrives here for free. The list used to
// be two hardcoded strings, which would have kept looking correct and silently
// stopped finding the session the moment the prefix moved.
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
// ── AND WHY IT IS ASKED ON FIRST REQUEST, NOT AT IMPORT ─────────────────────
//
// `auth` is a Proxy that constructs Better Auth on FIRST PROPERTY ACCESS, on
// purpose: `betterAuth()` reads deployment configuration and throws when it is
// absent, so building it at module-evaluation time crashes anything that merely
// imports this package. Reading `auth.options` into a module-level `const`
// defeats that — it moves construction back to import time, and `next build`
// imports every route module while collecting page data.
//
// It is not hypothetical. This line failed the 2026-08-24 release: the MCP
// resource identifier became per-brand and throws rather than guess an address a
// customer is told to paste into their assistant, and the build machine has no
// deployment to read one from. `next build` evaluated this module, the Proxy
// built Better Auth on a build agent, and piggles-account was the one image of
// seventeen that did not ship.
//
// So the name is resolved on first REQUEST and cached for the process. Same one
// lookup, on a machine that actually has the configuration.
let cookieNames: readonly string[] | undefined;

function sessionCookieNames(): readonly string[] {
  if (!cookieNames) {
    const name = getCookies(auth.options).sessionToken.name;
    cookieNames = [`__Secure-${name}`, name];
  }
  return cookieNames;
}

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
  const consent = await readConsent(session.user.id, session.user.tenantId);
  if (!consent) {
    return sameOriginRedirectWithNext('/cookie-choices', `/handoff${request.nextUrl.search}`);
  }

  const raw = sessionCookieNames()
    .map((n) => request.cookies.get(n)?.value)
    .find(Boolean);
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
    // "Keep me signed in", carried across the boundary. The console has no
    // sign-in form and so never saw the box; it used to invent an answer, and
    // the answer it invented was thirty days for everybody. THIS domain is the
    // only one that holds the person's real one.
    remember: readsAsRemembered((name) => request.cookies.get(name)?.value),
  });

  // 303, not 307: this is "go and look over there", and the browser must not
  // repeat any method or body against the new URL. A cached 301/302 here would
  // be actively dangerous — the token is single-use, so a cached redirect would
  // send the next person to an already-spent token and a dead end.
  const res = NextResponse.redirect(url, 303);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
