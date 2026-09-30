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

/**
 * Where to send somebody once they are signed in, read from a link that may
 * spell that destination either of two ways.
 *
 * ── WHY TWO SPELLINGS ───────────────────────────────────────────────────────
 *
 * The ACCOUNT APP writes `next` — `handoffEntryUrl` above writes it, and so
 * does its `same-origin-redirect.ts`. Better Auth writes `callbackURL`, the
 * console writes `callbackURL`, and so do all four links that send an invited
 * person to sign in: the two buttons on the invitation page, the "sign in as
 * someone else" button beside them, and the OAuth consent screen.
 *
 * The sign-in page read only `next`. So "Sign in to join" signed the person in
 * and did not join them: the destination it needed was sitting in the URL under
 * the other name, the fallback took over, and they landed on the account home
 * with the invitation still outstanding and nothing on screen saying so. The
 * signup page read NEITHER, so somebody invited who did not yet have an account
 * was put through setting up a business of their own instead (issue 881).
 *
 * Reading both is not untidiness. It is the only honest reading available: the
 * parameter is already out in the world on invitation emails sent before today,
 * and no rename reaches a link somebody was emailed last week. So writers use
 * the house spelling and readers accept either.
 *
 * `next` wins when both are present: it is what this product writes itself, so
 * a URL carrying both was built by us around one built by somebody else.
 *
 * Guarded by the same `safeInternalPath` as everything else here, because the
 * value arrives in a URL anybody can edit and it becomes a redirect. An
 * absolute one would make the account app an open redirector: a link that looks
 * like getpiggles.com and lands somewhere else. Refusing means FALLING BACK
 * rather than failing, because a tampered link should still sign the person in.
 */
export function returnPath(
  params: Record<string, string | string[] | undefined>,
  fallback = '/'
): string {
  const first = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
  return safeInternalPath(first(params.next) || first(params.callbackURL), fallback);
}
