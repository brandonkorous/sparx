import {
  consumeHandoff,
  mintHandoff,
  type ConsumeHandoffResult,
} from '@wizeworks/auth-client-server';
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
// ── WHERE THE WORK HAPPENS ──────────────────────────────────────────────────
//
// In api-rest (docs/154). Minting writes a row, redeeming deletes it, and the
// cookie it hands back is signed with the brand's auth secret: none of the
// three may happen in an app that holds no database and no secret. So both
// halves are calls, and the three properties that make the token safe are kept
// there, beside the row:
//
//   1. **Single-use.** Redeeming is one `DELETE … RETURNING`, so two racing
//      requests cannot both hold the session.
//   2. **Short-lived.** 60 seconds: it exists only to survive one redirect.
//   3. **Audience-bound.** The token records who it was minted for and is
//      refused if presented anywhere else, so one leaked to a third party is
//      not a session anywhere.
//
// What stays HERE is everything that is Piggles' own: which domains exist, the
// name of each audience, and where a person lands. api-rest takes the audience
// as an opaque string and never reads it.

/**
 * Mint a one-time token for the session this request carries and return the
 * absolute URL to send the browser to. Null when the request carries no session.
 *
 * api-rest reads the session token and the person's "Keep me signed in" answer
 * from the forwarded cookies itself. Nothing here handles either.
 */
export async function mintHandoffUrl(
  requestHeaders: Headers,
  input: {
    audience: HandoffAudience;
    /** A path inside the destination app. Dropped unless it is a bare internal
     *  path, so a handoff link can never be turned into an open redirect. */
    next?: string | null;
  }
): Promise<string | null> {
  const next = internalPath(input.next);
  const minted = await mintHandoff(requestHeaders, {
    audience: input.audience,
    ...(next ? { next } : {}),
  });
  if (!minted) return null;
  return `${audienceOrigin(input.audience)}/auth/callback?t=${encodeURIComponent(minted.token)}`;
}

/**
 * Redeem a token. Call from the DESTINATION app's `/auth/callback`, server-side
 * only, then set every returned cookie exactly as given.
 */
export function consumeHandoffToken(
  token: string | null | undefined,
  expected: HandoffAudience
): Promise<ConsumeHandoffResult> {
  return consumeHandoff(token ?? null, expected);
}

export type { ConsumeHandoffResult };

// Where the three apps actually are. Re-exported so a caller imports one
// package rather than picking files out of it.
export {
  accountOrigin,
  audienceOrigin,
  handoffEntryUrl,
  internalPath,
  returnPath,
  type HandoffAudience,
} from './origins';
