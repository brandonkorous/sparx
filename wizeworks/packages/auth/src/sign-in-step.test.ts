// A PASSWORD IS NOT A SIGN-IN WHEN THERE IS A SECOND FACTOR.
//
// Measured on a real 2FA account, stopping at the challenge screen: the browser
// posts `/api/auth/sign-in/email`, the session-create hook fires, and the person is
// still looking at "One more step". Writing `users.last_login_at` there would put a
// date under "Last signed in" for somebody who had the password and got no further
// (issue 853).
//
// Tested here rather than through the hook because the auth instance is cached on
// `globalThis.__sparxAuth` to survive dev HMR — so the hook itself cannot be
// exercised without restarting the dev server, and a decision that can only be
// checked by restarting a server is a decision nobody checks.

import { describe, expect, it } from 'vitest';
import { isPasswordStep, PASSWORD_STEP_PATHS } from './sign-in-step';

describe('isPasswordStep', () => {
  it('knows the endpoint the sign-in form actually posts to', () => {
    // Read off the wire: POST http://localhost:3021/api/auth/sign-in/email → 200,
    // which reaches a database hook as the plugin-relative `/sign-in/email`.
    expect(isPasswordStep('/sign-in/email')).toBe(true);
  });

  it('covers signing in by username as well', () => {
    expect(isPasswordStep('/sign-in/username')).toBe(true);
  });

  it('does not claim the second factor is a password step', () => {
    // This one matters in the other direction: the 2FA verification is where a 2FA
    // account's sign-in genuinely completes, so it must record.
    expect(isPasswordStep('/two-factor/verify-totp')).toBe(false);
    expect(isPasswordStep('/two-factor/verify-backup-code')).toBe(false);
  });

  it('lets every other way in through', () => {
    // The list is deliberately small and the caller writes for anything it does not
    // match, so a provider nobody listed still records a sign-in rather than being
    // silently dropped. [[feedback_structural_checks_go_blind]]
    const otherWaysIn = [
      '/sign-in/social',
      '/callback/google',
      '/magic-link/verify',
      '/sign-in/passkey',
      '/one-tap/callback',
      '/email-otp/verify-email',
    ];
    for (const path of otherWaysIn) {
      expect(isPasswordStep(path), path).toBe(false);
    }
  });

  it('treats a missing path as not-a-password-step, so the timestamp is still written', () => {
    // A hook that cannot see its context must not become a hook that records
    // nothing. Absent is not evidence. [[feedback_never_present_absence_as_measurement]]
    expect(isPasswordStep(null)).toBe(false);
    expect(isPasswordStep(undefined)).toBe(false);
    expect(isPasswordStep('')).toBe(false);
  });

  it('matches whole paths, not fragments of them', () => {
    // `/sign-in/email-otp` is a different endpoint and must not be swallowed by a
    // prefix test.
    expect(isPasswordStep('/sign-in/email-otp')).toBe(false);
    expect(isPasswordStep('sign-in/email')).toBe(false);
    expect(isPasswordStep('/api/auth/sign-in/email')).toBe(false);
  });

  it('is exactly the two paths it documents', () => {
    expect([...PASSWORD_STEP_PATHS].sort()).toEqual(['/sign-in/email', '/sign-in/username']);
  });
});
