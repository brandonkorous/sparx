// WHEN THIS PERSON LAST SIGNED IN — AND THE DIFFERENCE BETWEEN "NEVER" AND
// "WE DO NOT KNOW", WHICH THE TEAMMATE PANE USED TO COLLAPSE INTO THE FIRST.
//
// `users.last_login_at` has been in the schema since the very first migration
// (20260527000000_init) and nothing wrote it for four months: 0 of 76 users on the
// development database carried a value. The pane read it as
// `formatSeen(member.lastLoginAt, 'Has not signed in yet')`, so it said that about
// every teammate on the platform — including the account owner, reading her own
// record, in a session she was holding at that moment (issue 853):
//
//     Last signed in      Has not signed in yet
//     Last did something  3d ago · September 24, 2026
//
// The second line is derived from the audit log and was right all along. The
// evidence needed to stop the first one lying was already beside it, and already in
// the component's hand. [[feedback_never_present_absence_as_measurement]]
//
// The sentence is KEPT rather than deleted: an owner genuinely needs to see that an
// invitation was never taken up. It is now said only when it is true.
//
// Pure, so the words can be tested without the query stack behind them — and in a
// `.ts` beside the pane rather than inside it, because this app's tsconfig keeps
// JSX unparsed for vitest.

/** The two timestamps this line reasons over, both ISO or null. */
export interface SeenTimes {
  lastLoginAt: string | null;
  lastActiveAt: string | null;
}

/** "Not recorded" in the plainest two words the console has. */
export const SIGN_IN_UNKNOWN = 'Not known';

/** The invitation nobody took up, which is the one case the old sentence fits. */
export const SIGN_IN_NEVER = 'Has not signed in yet';

/**
 * What to print beside "Last signed in".
 *
 * `format` renders a real timestamp — passed in so this stays free of the date
 * helpers and testable on its own.
 */
export function signedInLine(times: SeenTimes, format: (iso: string) => string): string {
  if (times.lastLoginAt) return format(times.lastLoginAt);
  // Signed in before the platform started recording it, or a write that was
  // swallowed rather than allowed to cost somebody their sign-in. Either way the
  // honest answer is that this is not known, not that it did not happen.
  if (times.lastActiveAt) return SIGN_IN_UNKNOWN;
  return SIGN_IN_NEVER;
}
