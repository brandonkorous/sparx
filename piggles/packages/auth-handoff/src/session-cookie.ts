import { createHmac } from 'node:crypto';
import { auth } from '@sparx/auth';
import { getCookies } from 'better-auth/cookies';

// Writing the session cookie on the OTHER domain.
//
// The handoff carries a session TOKEN across the boundary (see ./index.ts). This
// file is what the receiving app does with it: turn it back into a cookie that
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
// ── WHY THE NAME AND ATTRIBUTES ARE ASKED FOR, NOT WRITTEN DOWN ─────────────
//
// The cookie's name (`better-auth.session_token`, prefixed `__Secure-` over
// HTTPS), its Max-Age (the session's own lifetime), SameSite, path and the
// secure flag are all DERIVED by Better Auth from the same options object this
// app already configures. Hardcoding them here would put a second copy of that
// derivation in the repo, and the two would agree right up until somebody
// changed `session.expiresIn` or the deployment moved to HTTPS.
//
// So they come from `getCookies(auth.options)` — the library's own answer, read
// from the library's own config. A change over there arrives here for free.

/** The cookie Better Auth expects, ready to hand to `cookies().set(...)`. */
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

/**
 * Build the session cookie for `sessionToken`.
 *
 * Server-side only — it reads `BETTER_AUTH_SECRET`. Call it from the receiving
 * app's `/auth/callback` with the token `consumeHandoffToken` returned.
 */
export function sessionCookie(sessionToken: string): SessionCookie {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    // Fail loudly. A missing secret would otherwise produce a cookie signed with
    // `undefined` — perfectly well-formed, silently unverifiable, and a sign-in
    // loop nobody can diagnose from the outside.
    throw new Error('BETTER_AUTH_SECRET is not set; the session cookie cannot be signed.');
  }

  const { sessionToken: cookie } = getCookies(auth.options);
  const attributes = cookie.attributes;

  return {
    name: cookie.name,
    value: `${sessionToken}.${signature(sessionToken, secret)}`,
    options: {
      httpOnly: attributes.httpOnly,
      secure: attributes.secure,
      sameSite: attributes.sameSite.toLowerCase() as 'lax' | 'strict' | 'none',
      path: attributes.path,
      ...(attributes.maxAge === undefined ? {} : { maxAge: attributes.maxAge }),
      ...(attributes.domain === undefined ? {} : { domain: attributes.domain }),
    },
  };
}

/** The same cookie, emptied — for signing out on this domain. */
export function clearedSessionCookie(): SessionCookie {
  const { sessionToken: cookie } = getCookies(auth.options);
  const attributes = cookie.attributes;

  return {
    name: cookie.name,
    value: '',
    options: {
      httpOnly: attributes.httpOnly,
      secure: attributes.secure,
      sameSite: attributes.sameSite.toLowerCase() as 'lax' | 'strict' | 'none',
      path: attributes.path,
      maxAge: 0,
      ...(attributes.domain === undefined ? {} : { domain: attributes.domain }),
    },
  };
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
