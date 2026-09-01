import { PRODUCT, safeInternalPath } from '@piggles/config';

// Where the three Piggles apps actually are, at runtime.
//
// Split out of ./index.ts because it is a different question from the one that
// file answers. That one owns the one-time token; this one owns "which machine
// is `getpiggles.com` today" — and on a laptop the answer is not getpiggles.com.

/** Who a token may be redeemed by. A bare string would let a typo silently
 *  widen the audience. */
export type HandoffAudience = 'console';

const AUDIENCE_HOST: Record<HandoffAudience, string> = {
  console: PRODUCT.hosts.console,
};

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
export function audienceOrigin(audience: HandoffAudience): string {
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
  const path = internalPath(next);
  const query = path ? `?next=${encodeURIComponent(path)}` : '';
  return `${accountOrigin()}/handoff${query}`;
}

/**
 * The shared `?next=` guard, in the shape this package wants: a safe internal
 * path, or nothing at all.
 *
 * This used to be a second, private copy of the rule — and a WEAKER one: it
 * rejected `//evil.com` but not `/\evil.com`, which some parsers normalise to
 * the same thing. Both ends of the chain re-guard with the strict version, so
 * nothing escaped through it, but `safe-path.ts` says exactly why that is not
 * good enough: "a guard that is stricter on one end than the other is a guard
 * with a hole in the middle." One copy of the rule, one adapter to this shape.
 */
export function internalPath(next: string | null | undefined): string | undefined {
  return safeInternalPath(next, '') || undefined;
}
