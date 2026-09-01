import { describe, expect, it, vi, beforeEach } from 'vitest';

// `auth` is a Proxy that builds Better Auth on first property access, and
// building it reads deployment configuration this test has none of. So it is
// mocked down to the one thing this file uses — the options object — and the
// REAL `getCookies` derives the cookie names and attributes from it, exactly as
// the routes do. Mocking `getCookies` instead would test nothing: the whole
// defect was in what that function returns and what we did with it.
vi.mock('@wizeworks/auth', () => ({
  auth: {
    options: {
      advanced: { cookiePrefix: 'piggles-account' },
      session: { expiresIn: 60 * 60 * 24 * 30 },
    },
  },
}));

const { handoffCookies, signedOutCookies, readsAsRemembered } = await import('./session-cookie');

const SESSION = 'Oj0qQjSZjgZJ1lwYyZ5ReKTts1PVdqXN';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = 'a-test-secret-that-is-not-any-real-one';
});

const named = <T extends { name: string }>(cookies: T[], name: string) =>
  cookies.find((c) => c.name === name);

describe('handoffCookies', () => {
  it('keeps somebody signed in for the session lifetime when they asked to be', () => {
    const session = named(handoffCookies(SESSION, true), 'piggles-account.session_token');
    expect(session?.options.maxAge).toBe(THIRTY_DAYS);
  });

  it('lasts only as long as the browser when they unticked the box', () => {
    // The defect, stated as a test. This asserted 2592000 before the fix,
    // because the attributes `getCookies` hands back carry `expiresIn`
    // unconditionally and the old code spread them unconditionally too.
    const session = named(handoffCookies(SESSION, false), 'piggles-account.session_token');
    expect(session?.options.maxAge).toBeUndefined();
  });

  it('never writes maxAge 0 for a browser-session cookie', () => {
    // Zero DELETES a cookie. Absent is what makes it last for the window, and
    // the two are one keystroke apart.
    const session = named(handoffCookies(SESSION, false), 'piggles-account.session_token');
    expect(session?.options).not.toHaveProperty('maxAge');
  });

  it('carries the dont_remember marker so a later refresh cannot undo the choice', () => {
    // Better Auth re-reads this cookie every time it refreshes the session and
    // restores the full maxAge when it is absent. Without it the fix would work
    // once and then quietly revert.
    const marker = named(handoffCookies(SESSION, false), 'piggles-account.dont_remember');
    expect(marker?.value.startsWith('true.')).toBe(true);
    expect(marker?.options.maxAge).toBeUndefined();
  });

  it('writes no marker at all when the person is being remembered', () => {
    expect(handoffCookies(SESSION, true)).toHaveLength(1);
  });

  it('signs the session cookie rather than writing the bare token', () => {
    // An unsigned value fails Better Auth's verification and reads as SIGNED
    // OUT, not as an error — so the console would bounce every arrival back to
    // the account app forever, with nothing in any log.
    const session = named(handoffCookies(SESSION, true), 'piggles-account.session_token');
    expect(session?.value).toMatch(new RegExp(`^${SESSION}\\.[A-Za-z0-9+/=]+$`));
  });

  it('refuses to sign with a missing secret instead of writing an unverifiable cookie', () => {
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => handoffCookies(SESSION, true)).toThrow(/BETTER_AUTH_SECRET/);
  });
});

describe('signedOutCookies', () => {
  it('clears the marker as well as the session', () => {
    // Leaving the marker behind would carry one person's "keep me signed in"
    // into the next person's sign-in on the same browser, which is the
    // shared-computer case the checkbox exists for.
    const names = signedOutCookies().map((c) => c.name);
    expect(names).toEqual(['piggles-account.session_token', 'piggles-account.dont_remember']);
  });

  it('expires both rather than merely emptying them', () => {
    for (const cookie of signedOutCookies()) {
      expect(cookie.value).toBe('');
      expect(cookie.options.maxAge).toBe(0);
    }
  });
});

describe('readsAsRemembered', () => {
  it('is true when no marker was ever written', () => {
    expect(readsAsRemembered(() => undefined)).toBe(true);
  });

  it('is false when the marker is present', () => {
    const jar = { 'piggles-account.dont_remember': 'true.sig' };
    expect(readsAsRemembered((n) => jar[n as keyof typeof jar])).toBe(false);
  });

  it('finds the marker under the __Secure- spelling too', () => {
    // Dev is HTTP and production is not, so both spellings have to be looked
    // for. Checking only one is a fix that works on a laptop and nowhere else.
    const jar = { '__Secure-piggles-account.dont_remember': 'true.sig' };
    expect(readsAsRemembered((n) => jar[n as keyof typeof jar])).toBe(false);
  });
});
