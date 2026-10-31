// Carrying a signed-in session to another of the same brand's domains.
//
// A brand can sign people in on one domain and run its console on another
// (Piggles signs in at its account domain and works at its console domain).
// Cookies do not cross domains, so the session crosses as a one-time token:
//
//   1. mint     the signing-in domain, holding the session, asks for a token.
//               The token names the SESSION ROW, not a new session, so both
//               domains end up addressing the same row.
//   2. consume  the console domain redeems the token, once, and gets back the
//               session cookies to set on its own domain, signed with the
//               brand's secret, exactly as Better Auth would have set them.
//
// This moved here from the brand that first needed it, because api-rest now
// holds every brand's auth instance and the brand's apps hold no secret and no
// database. Which domains exist, and which audience is which, stays with the
// brand: this file takes an `audience` string and never interprets it.
//
// Called inside the request's brand scope (`runAsBrand`).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getCookies } from 'better-auth/cookies';
import { auth, brandCookieContext } from './server';
import { authPrisma } from './prisma';

/** One minute: long enough for a redirect, short enough that a token leaked
 *  from a log or a screenshot is dead before anybody could use it. */
const TTL_MS = 60_000;

/** The `verifications.identifier` prefix. Keyed by brand, so `piggles` keeps
 *  the `piggles-handoff:` rows it always wrote. */
function prefix(brand: string): string {
  return `${brand}-handoff:`;
}

/** A cookie Better Auth expects, ready to hand to a cookie setter. */
export interface SessionCookie {
  name: string;
  /** The SIGNED value, unencoded. Do not encode it: every cookie setter in Next
   *  URI-encodes on serialize and Better Auth's reader URI-decodes, so encoding
   *  here produces a double-encoded value that fails to verify. */
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
 * HMAC-SHA256, standard base64. Must match `better-call`'s `signCookieValue`
 * byte for byte, because that is what verifies it; it is reproduced because
 * better-call does not export it. ./session-handoff.test.ts verifies a value
 * signed here with better-call's own verifier.
 */
export function signCookieValue(value: string, secret: string): string {
  return `${value}.${createHmac('sha256', secret).update(value).digest('base64')}`;
}

function build(
  cookie: CookieShape,
  value: string,
  opts: { forgetMaxAge?: boolean; expire?: boolean } = {}
): SessionCookie {
  const a = cookie.attributes;
  // No Max-Age means the browser drops it on close. A Max-Age of 0 deletes it.
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

/**
 * The cookies that make `sessionToken` a signed-in session on another domain.
 *
 * `remember` matches Better Auth's own `setSessionCookie`: unticked "Keep me
 * signed in" means no Max-Age (gone when the browser closes) plus the
 * `dont_remember` marker. The marker is not bookkeeping: Better Auth reads it
 * back on every session refresh, and without it the first refresh would
 * quietly restore the thirty days.
 */
export function sessionCookiesFor(
  brand: string,
  sessionToken: string,
  remember: boolean
): SessionCookie[] {
  const { secret, options } = brandCookieContext(brand);
  const { sessionToken: session, dontRememberToken: marker } = getCookies(options);
  const cookies = [
    build(session, signCookieValue(sessionToken, secret), { forgetMaxAge: !remember }),
  ];
  if (!remember) cookies.push(build(marker, signCookieValue('true', secret)));
  return cookies;
}

/** The same cookies, emptied, for signing out on a domain. Both of them: a
 *  marker left behind would carry one person's choice into the next person's
 *  sign-in on a shared computer. */
export function clearedSessionCookies(brand: string): SessionCookie[] {
  const { options } = brandCookieContext(brand);
  const { sessionToken: session, dontRememberToken: marker } = getCookies(options);
  return [session, marker].map((cookie) => build(cookie, '', { expire: true }));
}

/** Did this browser ask to be remembered? Better Auth records "no" as its own
 *  `dont_remember` cookie at sign-in, readable long after the form. Both
 *  spellings, because development is HTTP and production is not. */
export function readsAsRemembered(brand: string, cookieHeader: string | null): boolean {
  const { options } = brandCookieContext(brand);
  const { name } = getCookies(options).dontRememberToken;
  const present = new Set(
    (cookieHeader ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.includes('=') && part.slice(part.indexOf('=') + 1) !== '')
      .map((part) => part.slice(0, part.indexOf('=')))
  );
  return !present.has(name) && !present.has(`__Secure-${name}`);
}

/** A path inside the destination, or nothing: a handoff link must never be
 *  turnable into an open redirect. The destination checks again. */
function internalPath(next: unknown): string | undefined {
  if (typeof next !== 'string') return undefined;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return undefined;
  return next;
}

interface HandoffPayload {
  sessionToken: string;
  audience: string;
  userId: string;
  next?: string;
  remember?: boolean;
}

/**
 * Mint a one-time token for the session these headers carry. Null when there
 * is no session.
 */
export async function mintSessionHandoff(
  brand: string,
  headers: Headers,
  input: { audience: string; next?: unknown }
): Promise<{ token: string } | null> {
  const current = await auth.api.getSession({ headers });
  const sessionToken = (current as { session?: { token?: string } } | null)?.session?.token;
  const userId = current?.user.id;
  if (!sessionToken || !userId) return null;

  const token = randomBytes(32).toString('base64url');
  const next = internalPath(input.next);
  const payload: HandoffPayload = {
    sessionToken,
    audience: input.audience,
    userId,
    ...(next ? { next } : {}),
    remember: readsAsRemembered(brand, headers.get('cookie')),
  };
  await authPrisma.verification.create({
    data: {
      identifier: prefix(brand) + token,
      value: JSON.stringify(payload),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  return { token };
}

export type ConsumeHandoffResult =
  | { ok: true; userId: string; next: string; cookies: SessionCookie[] }
  | { ok: false; reason: 'missing' | 'expired' | 'wrong-audience' | 'malformed' };

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Redeem a token, once, for the session cookies to set on `audience`'s domain.
 *
 * Deleting IS the read: `DELETE … RETURNING` removes the row in the statement
 * that decides whether it was valid, so two requests racing with one token
 * cannot both hold the session. `identifier` is indexed but not unique, which
 * is why this is raw SQL and not a Prisma unique lookup.
 */
export async function consumeSessionHandoff(
  brand: string,
  token: unknown,
  audience: string
): Promise<ConsumeHandoffResult> {
  if (typeof token !== 'string' || token === '') return { ok: false, reason: 'missing' };
  const identifier = prefix(brand) + token;
  const rows = await authPrisma.$queryRaw<{ value: string; expires_at: Date }[]>`
    DELETE FROM verifications WHERE identifier = ${identifier} RETURNING value, expires_at
  `;
  const row = rows[0];
  if (!row) return { ok: false, reason: 'missing' };
  if (row.expires_at.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  let payload: HandoffPayload;
  try {
    payload = JSON.parse(row.value) as HandoffPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!payload.sessionToken || !payload.userId) return { ok: false, reason: 'malformed' };
  if (!constantTimeEquals(payload.audience, audience)) {
    return { ok: false, reason: 'wrong-audience' };
  }
  return {
    ok: true,
    userId: payload.userId,
    next: internalPath(payload.next) ?? '/',
    // Absent only on a token minted before the field existed; the checkbox's
    // own default.
    cookies: sessionCookiesFor(brand, payload.sessionToken, payload.remember ?? true),
  };
}

/** Sign the session these headers carry out, and return the cookies that clear
 *  it on the caller's domain. Signing out an already-dead session is fine. */
export async function signOutSession(brand: string, headers: Headers): Promise<SessionCookie[]> {
  await auth.api.signOut({ headers }).catch(() => undefined);
  return clearedSessionCookies(brand);
}
