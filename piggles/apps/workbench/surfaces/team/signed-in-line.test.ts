// THE OWNER READ "HAS NOT SIGNED IN YET" ABOUT HERSELF, WHILE SIGNED IN.
//
// `users.last_login_at` has been in the schema since the very first migration
// (20260527000000_init). Nothing wrote it for four months: 0 of 76 users on the
// development database carried a value. Six screens across three apps read it, and
// every one of them rendered the empty column as a statement of fact.
//
// On the teammate pane the two lines sat one above the other:
//
//     Last signed in      Has not signed in yet
//     Last did something  3d ago · September 24, 2026
//
// The second is derived from the audit log and is correct. The first is a column
// nobody had ever written, said about the account owner, in her own record, in a
// session she was holding at that moment (issue 853).
//
// The sentence itself is worth keeping — it is how an owner sees that an invitation
// was never taken up — so the rule is that it is said only when it is true, and the
// evidence for that was already in the component's hand.

import { describe, expect, it } from 'vitest';
import { signedInLine, SIGN_IN_NEVER, SIGN_IN_UNKNOWN } from './signed-in-line';

/** Stands in for the pane's real date helper, so these assertions are about the
 *  DECISION and not about how a timestamp is spelled. */
const shown = (iso: string): string => `shown:${iso}`;

describe('signedInLine', () => {
  it('does not say somebody has never signed in when they have been doing things', () => {
    // The exact shape found: no sign-in recorded, plenty of activity.
    const line = signedInLine(
      { lastLoginAt: null, lastActiveAt: '2026-09-24T10:00:00.000Z' },
      shown
    );
    expect(line).toBe(SIGN_IN_UNKNOWN);
    expect(line).not.toBe(SIGN_IN_NEVER);
  });

  it('still says it about an invitation nobody took up', () => {
    // No sign-in and nothing done: the one case where the sentence is true, and
    // the reason it is kept rather than deleted.
    expect(signedInLine({ lastLoginAt: null, lastActiveAt: null }, shown)).toBe(SIGN_IN_NEVER);
  });

  it('says when, once the sign-in hook has recorded one', () => {
    const line = signedInLine(
      { lastLoginAt: '2026-09-27T09:00:00.000Z', lastActiveAt: '2026-09-24T10:00:00.000Z' },
      shown
    );
    expect(line).toBe('shown:2026-09-27T09:00:00.000Z');
  });

  it('answers from the sign-in even when the activity is newer', () => {
    // These answer different questions and the pane shows both. A sign-in three
    // weeks ago with work done yesterday is a real, readable state — not a
    // contradiction to be smoothed over by preferring whichever is later.
    const line = signedInLine(
      { lastLoginAt: '2026-09-01T09:00:00.000Z', lastActiveAt: '2026-09-27T10:00:00.000Z' },
      shown
    );
    expect(line).toBe('shown:2026-09-01T09:00:00.000Z');
  });

  it('never claims never, on any input carrying evidence of a sign-in', () => {
    // The property, stated once: activity is proof somebody got in, whatever the
    // column says. [[feedback_never_present_absence_as_measurement]]
    const evidence = [
      { lastLoginAt: null, lastActiveAt: '2026-09-24T10:00:00.000Z' },
      { lastLoginAt: null, lastActiveAt: '2026-01-01T00:00:00.000Z' },
      { lastLoginAt: '2026-09-27T09:00:00.000Z', lastActiveAt: null },
      { lastLoginAt: '2026-09-27T09:00:00.000Z', lastActiveAt: '2026-09-27T09:05:00.000Z' },
    ];
    for (const times of evidence) {
      expect(signedInLine(times, shown), JSON.stringify(times)).not.toBe(SIGN_IN_NEVER);
    }
  });
});
