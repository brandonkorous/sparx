import { randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@sparx/db';
import { PRODUCT } from '@piggles/config';

// The getpiggles.com → mypiggles.com session handoff.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// Piggles runs on three registrable domains. A cookie cannot be shared across
// registrable domains — that is the entire point of the public-suffix list —
// so `getpiggles.com` being the auth authority means `mypiggles.com` has to be
// handed a session by some mechanism other than "we both read the same cookie".
//
// The mechanism is a one-time exchange token: getpiggles mints one, redirects,
// and mypiggles trades it server-side for the right to set its OWN cookie on its
// OWN domain. No third-party cookies are involved anywhere, so nothing here
// breaks under Safari's ITP or Chrome's third-party cookie removal.
//
// **Both cookies address ONE Better Auth session row.** That is the property
// worth protecting: sign-out, expiry, revocation and the 5-minute cookie cache
// all keep working on both domains for free, because there is only ever one
// session. Minting a SECOND session for the console would double every one of
// those concerns and guarantee the two drift.
//
// ── WHY THE `verification` TABLE ────────────────────────────────────────────
//
// A one-time token needs somewhere to be exactly once. Better Auth's own
// `verification` table is already a short-lived, single-use, opaque key/value
// store with an `expiresAt`, and the MCP OAuth provider already reuses it to
// stash authorization-code payloads (docs/07 §5, and the widen_verification_value
// migration exists because of it). Reusing it here needs no new model, no
// migration, and no second expiry sweep.
//
// The alternative — a stateless signed token — cannot be single-use without
// state, which would leave a replay window for the whole of its TTL. A row that
// is DELETED as it is read cannot be replayed at all.
//
// ── THE THREE PROPERTIES THAT MAKE IT SAFE ──────────────────────────────────
//
//   1. **Single-use.** Consumption is a `deleteMany` whose count decides the
//      outcome. Two racing requests cannot both see a count of 1, so the loser
//      is rejected even under concurrency — this is why it is not a SELECT
//      followed by a DELETE.
//   2. **Short-lived.** 60 seconds: it exists only to survive one redirect.
//   3. **Audience-bound.** The token records who it was minted for and is
//      refused if presented anywhere else, so one leaked to a third party is
//      not a session anywhere.

/** How long a minted token stays valid. It has to outlive one HTTP redirect and
 *  nothing else — a slow phone on a bad connection, not a coffee break. */
const TTL_MS = 60_000;

/** Namespace inside the shared `verification` table. Anything else using that
 *  table (email verification, password reset, MCP authorization codes) uses its
 *  own prefix; overlapping would let one flow consume another's row. */
const PREFIX = 'piggles-handoff:';

/** Who a token may be redeemed by. A bare string would let a typo silently
 *  widen the audience. */
export type HandoffAudience = 'console';

/**
 * Where a redeemed token is sent, as a full origin.
 *
 * ── THIS MUST BE OVERRIDABLE, AND IT IS A SECURITY CONTROL ──────────────────
 *
 * The first version built the URL straight from `PRODUCT.hosts.console`, which
 * is the PRODUCTION hostname. On a developer's machine that meant a real,
 * live handoff token was appended to a link to `https://mypiggles.com` and the
 * browser followed it — to a domain that is currently parked and returns 403,
 * i.e. to somebody else's server, complete with a `?t=` that grants a session.
 * Observed, not theorised, the first time onboarding completed locally.
 *
 * The token is single-use and lives 60 seconds, which bounds the damage but does
 * not excuse it: the whole point of an origin-bound token is that it only ever
 * travels to an origin we control.
 *
 * So the origin comes from the environment, with production as the default —
 * a deployment that forgets to set it still works, and a laptop that forgets to
 * set it points at localhost rather than at the internet.
 */
function audienceOrigin(audience: HandoffAudience): string {
  const configured = process.env.PIGGLES_CONSOLE_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, '');

  // No override: production if this is a production build, otherwise the local
  // console port. NEVER fall through to the production host in development —
  // that is precisely the leak above.
  if (process.env.NODE_ENV === 'production') {
    return `https://${AUDIENCE_HOST[audience]}`;
  }
  return 'http://localhost:3022';
}

const AUDIENCE_HOST: Record<HandoffAudience, string> = {
  console: PRODUCT.hosts.console,
};

/**
 * Where the account app lives, as a full origin — the mirror of
 * {@link audienceOrigin}, and environment-aware for the same reason.
 *
 * The console sends people HERE whenever it has no session: to sign in, to sign
 * out, to reach billing. Built from the production hostname on a developer's
 * machine, every one of those is a link off the laptop and onto the internet —
 * at best a dead end, at worst a real sign-in form on a domain that is not yet
 * ours. So: the override wins, production is the default only in a production
 * build, and a laptop that configures nothing points at the local account app.
 */
export function accountOrigin(): string {
  const configured = process.env.PIGGLES_ACCOUNT_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return `https://${PRODUCT.hosts.account}`;
  return 'http://localhost:3021';
}

/**
 * The account app's door into the console, with a destination attached.
 *
 * The console never links to `getpiggles.com/sign-in` directly. It links HERE,
 * because `/handoff` is the one route that knows how a session crosses the
 * boundary: a signed-in visitor is bounced straight back with a fresh token, and
 * only a genuinely signed-out one ever sees a sign-in form. Sending someone to
 * `/sign-in` instead would show a sign-in page to somebody who is already signed
 * in — the classic "why is it asking me again" of a multi-domain product.
 */
export function handoffEntryUrl(next?: string): string {
  const path = safeNext(next);
  const query = path ? `?next=${encodeURIComponent(path)}` : '';
  return `${accountOrigin()}/handoff${query}`;
}

interface HandoffPayload {
  /** The Better Auth session token — the SAME value the getpiggles cookie
   *  holds, so the console's cookie points at the identical session row. */
  sessionToken: string;
  audience: HandoffAudience;
  /** Recorded for the audit trail and so a consumer can sanity-check that the
   *  session it just adopted belongs to who it expected. */
  userId: string;
  /** Where the console should land the user once the cookie is set. Carried
   *  through the handoff because a deep link that survives sign-in is the
   *  difference between "log in and find your way back" and arriving. */
  next?: string;
}

/**
 * Mint a one-time token for `audience` and return the absolute URL to send the
 * browser to.
 *
 * Call this from a server action or route handler on getpiggles that has
 * already established the user IS signed in — this function trusts the session
 * token it is given and does not re-authenticate it.
 */
export async function mintHandoffUrl(input: {
  sessionToken: string;
  userId: string;
  audience: HandoffAudience;
  /** A path inside the destination app. Rejected unless it is a bare internal
   *  path, so a handoff link can never be turned into an open redirect. */
  next?: string;
}): Promise<string> {
  const jti = randomBytes(32).toString('base64url');
  const payload: HandoffPayload = {
    sessionToken: input.sessionToken,
    audience: input.audience,
    userId: input.userId,
    ...(safeNext(input.next) ? { next: safeNext(input.next) } : {}),
  };

  await prisma.verification.create({
    data: {
      identifier: PREFIX + jti,
      value: JSON.stringify(payload),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  return `${audienceOrigin(input.audience)}/auth/callback?t=${encodeURIComponent(jti)}`;
}

export type ConsumeResult =
  | { ok: true; sessionToken: string; userId: string; next: string }
  | { ok: false; reason: 'missing' | 'expired' | 'wrong-audience' | 'malformed' };

/**
 * Redeem a token. Call from the DESTINATION app's `/auth/callback`, server-side
 * only, then set your own session cookie to the returned `sessionToken`.
 *
 * Deleting is the read: the row is removed by the same statement that decides
 * whether the token was valid, so a replay finds nothing. Never split this into
 * a lookup followed by a delete — two requests arriving together would both
 * pass the lookup.
 */
export async function consumeHandoffToken(
  token: string | null | undefined,
  expected: HandoffAudience
): Promise<ConsumeResult> {
  if (!token) return { ok: false, reason: 'missing' };

  const identifier = PREFIX + token;

  // ONE STATEMENT: delete and return what was deleted.
  //
  // Single-use has to be atomic, and neither Prisma path gets there on this
  // table. `findUnique` cannot even be written — `verifications.identifier` is
  // INDEXED but not UNIQUE (only `id` is), so it is not a valid unique input.
  // And `findFirst` followed by `deleteMany` is two statements: both racers read
  // the payload, and only the delete count separates them. That works, but it
  // means a losing request has already held a valid session token in memory.
  //
  // `DELETE … RETURNING` closes it properly — the row is gone by the time
  // anybody has seen it, so exactly one caller ever holds the token at all.
  const rows = await prisma.$queryRaw<{ value: string; expires_at: Date }[]>`
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

  // Constant-time so the audience check cannot be probed by timing. Cheap, and
  // the habit is worth more than the microseconds.
  if (!constantTimeEquals(payload.audience, expected)) {
    return { ok: false, reason: 'wrong-audience' };
  }

  return {
    ok: true,
    sessionToken: payload.sessionToken,
    userId: payload.userId,
    next: safeNext(payload.next) ?? '/',
  };
}

/** Only a bare internal path survives — no scheme, no host, no protocol-relative
 *  `//evil.com`. This is the guard that stops `?next=` becoming an open redirect
 *  that launders a real session onto somebody else's domain. */
function safeNext(next: string | null | undefined): string | undefined {
  if (!next) return undefined;
  if (!next.startsWith('/')) return undefined;
  if (next.startsWith('//')) return undefined;
  return next;
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// The receiving side's other half: turning the redeemed token back into a
// cookie Better Auth will accept. Kept in this package so BOTH halves of the
// handoff stay in one place — a minting side and a consuming side that live in
// different repositories' worth of code is how the two drift.
export { sessionCookie, clearedSessionCookie, type SessionCookie } from './session-cookie';
