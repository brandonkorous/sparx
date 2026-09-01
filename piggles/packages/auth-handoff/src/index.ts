import { randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@wizeworks/db';
import { audienceOrigin, internalPath, type HandoffAudience } from './origins';

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
  /** Whether "Keep me signed in" was ticked. Carried because the console mints
   *  its OWN cookie and would otherwise have no way of knowing — which is
   *  exactly what went wrong; see ./session-cookie.ts. */
  remember?: boolean;
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
  /** The person's own answer to "Keep me signed in". Read it with
   *  `readsAsRemembered` rather than guessing — the caller is a route, not the
   *  sign-in form, and may be running days after the choice was made. */
  remember?: boolean;
}): Promise<string> {
  const jti = randomBytes(32).toString('base64url');
  const next = internalPath(input.next);
  const payload: HandoffPayload = {
    sessionToken: input.sessionToken,
    audience: input.audience,
    userId: input.userId,
    ...(next ? { next } : {}),
    ...(input.remember === undefined ? {} : { remember: input.remember }),
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
  | { ok: true; sessionToken: string; userId: string; next: string; remember: boolean }
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
    next: internalPath(payload.next) ?? '/',
    // Absent only on a token minted by a build that predates the field, which
    // can outlive a deploy by at most 60 seconds. Default to the behaviour that
    // build had, and to what the checkbox itself defaults to.
    remember: payload.remember ?? true,
  };
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Where the three apps actually are. Re-exported so a caller imports one
// package rather than picking files out of it.
export {
  accountOrigin,
  audienceOrigin,
  handoffEntryUrl,
  internalPath,
  type HandoffAudience,
} from './origins';

// The receiving side's other half: turning the redeemed token back into cookies
// Better Auth will accept. Kept in this package so BOTH halves of the handoff
// stay in one place — a minting side and a consuming side that live in
// different repositories' worth of code is how the two drift.
export {
  handoffCookies,
  signedOutCookies,
  readsAsRemembered,
  type SessionCookie,
} from './session-cookie';
