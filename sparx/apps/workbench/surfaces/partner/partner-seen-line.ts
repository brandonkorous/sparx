// WHAT AN OUTSIDER HAS DONE WITH THE KEY YOU GAVE THEM.
//
// The Partner access pane asks an owner to decide whether an agency or a
// consultant should keep working inside her business, and offers her a
// "Withdraw access" button to do it with. It showed her the person's name, their
// email, their role and how much of the account they can reach — and NOTHING
// about whether they have ever used it.
//
// Both facts that answer the question were already fetched. `/v1/team` returns
// `createdAt` (when the key was handed over) and `lastLoginAt` and `lastActiveAt`
// for every member, and this surface reads that endpoint. `createdAt` was
// declared and drawn nowhere; `lastActiveAt` was not even declared, so it was
// dropped off the wire. [[feedback_fetched_but_never_rendered]]
//
// Measured 2026-09-28: 2 consultant grants exist on the platform, both `admin`
// with EVERY module and EVERY site, both handed over on 2026-07-21, and neither
// has ever signed in. That is a live key to two businesses, dormant for two
// months, and the screen for reviewing it said nothing.
//
// Issue 853 looked at this pane and left it alone, correctly at the time: nothing
// on the platform wrote `users.last_login_at`, so rendering it would have said
// "has not signed in yet" about everybody. 853 made the write real, which is what
// retired that reason (issue 860).
//
// Pure, and in a `.ts` beside the pane rather than inside the `.tsx`, because
// this app's tsconfig keeps JSX unparsed for vitest — the same arrangement
// `signed-in-line.ts` and `uncounted-words.ts` already use.

import {
  signedInLine,
  SIGN_IN_NEVER,
  SIGN_IN_UNKNOWN,
  type SeenTimes,
} from '../team/signed-in-line';

/** The two timestamps plus the day access was granted. */
export interface PartnerSeen extends SeenTimes {
  createdAt: string;
}

/**
 * One line under a partner's name: when they were given access, and what they
 * have done with it.
 *
 * `signedInLine` decides the second half, so this pane and the Team pane cannot
 * come to different conclusions about the same person from the same two columns.
 * Its three answers are a real date, "not known" (they have activity behind them,
 * so they plainly signed in before the platform recorded it) and "has not signed
 * in yet" — which is the one that matters here, because it is the sentence that
 * makes a dormant key obvious.
 */
export function partnerSeenLine(
  seen: PartnerSeen,
  format: (iso: string) => string,
  describe: (iso: string) => string
): string {
  const given = `Given access ${format(seen.createdAt)}`;
  const line = signedInLine(seen, (iso) => `${describe(iso)} · ${format(iso)}`);
  if (line === SIGN_IN_NEVER) return `${given} · has never signed in`;
  if (line === SIGN_IN_UNKNOWN) return `${given} · last signed in not known`;
  return `${given} · last signed in ${line}`;
}

/**
 * Whether this partner holds a key they have not used.
 *
 * Deliberately NOT "how long since they last signed in": the alarming case is
 * the one where the answer is never, and a threshold in days would be a rule
 * nobody agreed to. An owner who can see "has never signed in" beside "every
 * module, every site" does not need the platform to have an opinion about it.
 */
export function neverUsedTheirAccess(seen: PartnerSeen): boolean {
  return signedInLine(seen, () => '') === SIGN_IN_NEVER;
}
