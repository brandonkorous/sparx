// WHICH better-auth ENDPOINT CREATED THIS SESSION — AND WHY ONLY ONE OF THEM
// NEEDS NAMING.
//
// `databaseHooks.session.create.after` is where `users.last_login_at` is written
// (issue 853). It fires on a genuine sign-in and not on the cookie refresh, which
// is why the new-device security email rides it too.
//
// MEASURED, not assumed. Signing in as a real 2FA account and stopping at the
// challenge screen:
//
//     POST /api/auth/sign-in/email          → 200
//     users.last_login_at                   → written, to the second
//     sessions                              → no surviving row
//     the screen                            → still asking for the second factor
//
// So the password step creates a session, the hook fires, and the person is not
// signed in yet. Writing there would put a date under "Last signed in" for somebody
// who had the password and never got past the second factor — a worse sentence than
// the empty one 853 set out to fix.
//
// ── THE LIST IS SMALL ON PURPOSE, AND FAILS THE SAFE WAY ─────────────────────
//
// This names the PASSWORD endpoints and nothing else, and the caller writes the
// timestamp for every path it does not match. An endpoint nobody listed here still
// records a sign-in, so a new way in — a social provider, a passkey, a magic link,
// the 2FA verification itself — is never silently dropped. The most an incomplete
// list can cost is the precision of one timestamp on a 2FA account.
//
// The opposite shape, an allow-list of "real" sign-ins, has to be exhaustive to be
// correct, and goes blind the day someone adds a provider.
// [[feedback_structural_checks_go_blind]]
//
// Pure, so the decision is testable without a server. It has to be: the auth
// instance is cached on `globalThis.__sparxAuth` to survive dev HMR, so a change to
// the hook itself is not exercised until the dev server is restarted.

/**
 * The endpoints where better-auth has checked a password and nothing else.
 *
 * Plugin-relative, which is what a database hook's `context.path` carries — the
 * browser posts to `/api/auth/sign-in/email` and the hook sees `/sign-in/email`.
 * Read off the wire, not out of a doc. [[feedback_verify_capability_in_code_not_docs]]
 */
export const PASSWORD_STEP_PATHS: readonly string[] = ['/sign-in/email', '/sign-in/username'];

/**
 * Did a password alone create this session?
 *
 * True means "do not call this a sign-in yet IF the account has a second factor" —
 * the caller pairs it with `twoFactorEnabled`, because on an account without one
 * the password step IS the whole sign-in.
 */
export function isPasswordStep(path: string | null | undefined): boolean {
  if (!path) return false;
  return PASSWORD_STEP_PATHS.includes(path);
}
