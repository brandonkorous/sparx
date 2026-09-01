import { createHmac } from 'node:crypto';
import { auth } from '@wizeworks/auth';
import { getCookies } from 'better-auth/cookies';

// Writing the session cookies on the OTHER domain.
//
// The handoff carries a session TOKEN across the boundary (see ./index.ts). This
// file is what the receiving app does with it: turn it back into cookies that
// Better Auth will accept on the next request.
//
// ── WHY THIS IS NOT JUST `cookies().set('session_token', token)` ────────────
//
// Better Auth signs its session cookie. The wire value is
// `<token>.<base64 HMAC-SHA256 of the token>`, and `getSessionFromCtx` reads it
// with a SIGNED getter — an unsigned value fails verification and is treated as
// no session at all. Not as an error: as a signed-out visitor. So a console that
// wrote the bare token would bounce every arriving customer straight back to the
// account app, in a loop, with nothing in any log saying why.
//
// The signature is this domain's own proof and means nothing on the other one.
// Both cookies still address ONE session row, which is the property the whole
// handoff exists to preserve.
//
// ── WHY THE NAMES AND ATTRIBUTES ARE ASKED FOR, NOT WRITTEN DOWN ────────────
//
// The cookie names (`better-auth.session_token`, prefixed `__Secure-` over
// HTTPS), the Max-Age, SameSite, path and the secure flag are all DERIVED by
// Better Auth from the same options object this app already configures.
// Hardcoding them here would put a second copy of that derivation in the repo,
// and the two would agree right up until somebody changed `session.expiresIn` or
// the deployment moved to HTTPS.
//
// So they come from `getCookies(auth.options)` — the library's own answer, read
// from the library's own config. A change over there arrives here for free.

/** A cookie Better Auth expects, ready to hand to `cookies().set(...)`. */
export interface SessionCookie {
  name: string;
  /** The SIGNED value, unencoded. Do not encode it — every cookie setter in
   *  Next (`ResponseCookies`, `cookies()`) URI-encodes on serialize, and Better
   *  Auth's reader URI-decodes, so encoding here produces a double-encoded value
   *  that fails to verify. */
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    maxAge?: number;
    domain?: string;
  };
}

interface CookieShape {
  name: string;
  attributes: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: string;
    path: string;
    maxAge?: number;
    domain?: string;
  };
}

/**
 * The cookies to set when a handoff lands, in the order they should be written.
 *
 * ── `remember` IS THE POINT OF THIS FUNCTION ────────────────────────────────
 *
 * "Keep me signed in" was honoured on getpiggles.com and silently discarded
 * here. The console asked Better Auth for the session cookie's attributes, and
 * `getCookies` hands back `maxAge: session.expiresIn` unconditionally — so a
 * person who deliberately UNTICKED the box got a thirty-day cookie on the
 * domain that runs their business, on whatever computer they were borrowing.
 * The box worked; it just did not reach the screen that matters.
 *
 * Better Auth's own `setSessionCookie` is the specification being matched:
 * `maxAge = dontRememberMe ? undefined : expiresIn`, plus a `dont_remember`
 * marker cookie. No Max-Age means the browser drops it when it closes, which is
 * the whole of what the person asked for.
 *
 * The marker is not optional bookkeeping. Better Auth refreshes the session
 * cookie every `updateAge` and reads `dontRememberMe` back off that cookie when
 * it does. Without it on THIS domain, the first refresh would quietly restore
 * the thirty days — the fix would work once and then undo itself.
 */
export function handoffCookies(sessionToken: string, remember: boolean): SessionCookie[] {
  const secret = requireSecret();
  const { sessionToken: session, dontRememberToken: marker } = getCookies(auth.options);

  const cookies: SessionCookie[] = [
    build(session, `${sessionToken}.${signature(sessionToken, secret)}`, {
      // Omitted, not zero: a Max-Age of 0 deletes a cookie. Absent is what makes
      // it last exactly as long as the browser window.
      forgetMaxAge: !remember,
    }),
  ];

  if (!remember) {
    cookies.push(build(marker, `true.${signature('true', secret)}`));
  }
  return cookies;
}

/** The same cookies, emptied — for signing out on this domain.
 *
 *  Both of them. Clearing the session and leaving the marker behind would let a
 *  "keep me signed in" from one person survive into the next person's sign-in on
 *  the same browser, which is the shared-computer case this all exists for. */
export function signedOutCookies(): SessionCookie[] {
  const { sessionToken: session, dontRememberToken: marker } = getCookies(auth.options);
  return [session, marker].map((cookie) => build(cookie, '', { expire: true }));
}

/**
 * Did this browser ask to be remembered?
 *
 * Better Auth records the answer as its own `dont_remember` cookie at sign-in,
 * so the choice is readable on the authority domain long after the form that
 * made it. That matters: the handoff route runs on every crossing, which may be
 * days later and is never the request that ticked the box.
 *
 * Read with a lookup function so this package stays clear of any one framework's
 * cookie API — the account app passes Next's, and a test passes a map.
 */
export function readsAsRemembered(read: (name: string) => string | undefined): boolean {
  const { name } = getCookies(auth.options).dontRememberToken;
  // Both spellings, because dev is HTTP and production is not. `getCookies`
  // already applies the prefix when secure cookies are on, so one of these is
  // always junk and checking both costs nothing.
  return ![name, `__Secure-${name}`].map(read).some(Boolean);
}

function build(
  cookie: CookieShape,
  value: string,
  opts: { forgetMaxAge?: boolean; expire?: boolean } = {}
): SessionCookie {
  const a = cookie.attributes;
  const maxAge = opts.expire ? 0 : opts.forgetMaxAge ? undefined : a.maxAge;
  return {
    name: cookie.name,
    value,
    options: {
      httpOnly: a.httpOnly,
      secure: a.secure,
      sameSite: a.sameSite.toLowerCase() as 'lax' | 'strict' | 'none',
      path: a.path,
      ...(maxAge === undefined ? {} : { maxAge }),
      ...(a.domain === undefined ? {} : { domain: a.domain }),
    },
  };
}

function requireSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    // Fail loudly. A missing secret would otherwise produce a cookie signed with
    // `undefined` — perfectly well-formed, silently unverifiable, and a sign-in
    // loop nobody can diagnose from the outside.
    throw new Error('BETTER_AUTH_SECRET is not set; the session cookie cannot be signed.');
  }
  return secret;
}

/**
 * HMAC-SHA256, standard base64.
 *
 * This must match `better-call`'s `signCookieValue` byte for byte, because that
 * is what verifies it. It is reproduced rather than imported because better-call
 * does not export it — `signCookieValue` lives in `dist/crypto.mjs` with no
 * entry in the package's `exports` map, so reaching for it would mean a deep
 * path into a dependency's build output.
 *
 * Reproduced, and then CHECKED: `scripts/check-session-cookie.mjs` signs a value
 * here and verifies it with better-call's own verifier. Matching an
 * implementation you cannot import is exactly the kind of claim that should not
 * rest on having read the source carefully.
 */
function signature(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64');
}
