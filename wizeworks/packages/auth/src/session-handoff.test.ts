// The cookies a handoff writes on the other domain. No database is reached:
// minting and redeeming are covered where api-rest serves them; this proves the
// part nobody can see go wrong, which is whether Better Auth will accept the
// cookie at all, and whether "Keep me signed in" survives the crossing.

import { createRequire } from 'node:module';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { runAsBrand } from '@wizeworks/brand-core/request-scope';

import { registerAuthBrands } from './server';
import {
  clearedSessionCookies,
  readsAsRemembered,
  sessionCookiesFor,
  signCookieValue,
} from './session-handoff';

const SECRET = 'a-test-secret-that-is-not-any-real-one-at-all';
const SESSION = 'Oj0qQjSZjgZJ1lwYyZ5ReKTts1PVdqXN';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

beforeAll(() => {
  registerAuthBrands([
    {
      brand: 'piggles',
      appName: 'Piggles',
      baseURL: 'http://getpiggles.test',
      secret: SECRET,
      cookiePrefix: 'piggles-account',
      googleClientId: undefined,
      googleClientSecret: undefined,
      passkeyRpId: undefined,
    },
  ]);
});

const inPiggles = <T>(fn: () => T): T => runAsBrand('piggles', fn);
const named = <T extends { name: string }>(cookies: T[], name: string) =>
  cookies.find((c) => c.name === name);

describe('signCookieValue', () => {
  it("verifies with better-call's own verifier, and fails with another secret", async () => {
    // better-call does not export its crypto, so it is reached by path from
    // better-auth's own install. That is the copy that verifies real cookies.
    const require = createRequire(import.meta.url);
    const entry = require.resolve('better-auth');
    const nodeModules = entry.slice(0, entry.lastIndexOf(`node_modules${sep}`) + 13);
    const { getCryptoKey, verifySignature } = (await import(
      pathToFileURL(join(nodeModules, 'better-call', 'dist', 'crypto.mjs')).href
    )) as {
      getCryptoKey: (s: string) => Promise<CryptoKey>;
      verifySignature: (sig: string, value: string, key: CryptoKey) => Promise<boolean>;
    };
    const key = await getCryptoKey(SECRET);
    for (const value of [SESSION, 'true', 'a.value.with.dots', 'unicode-é-中']) {
      const signed = signCookieValue(value, SECRET);
      const signature = signed.slice(value.length + 1);
      expect(await verifySignature(signature, value, key)).toBe(true);
    }
    const forged = signCookieValue(SESSION, 'a-different-secret').slice(SESSION.length + 1);
    expect(await verifySignature(forged, SESSION, key)).toBe(false);
  });
});

describe('sessionCookiesFor', () => {
  it('keeps somebody signed in for the session lifetime when they asked to be', () => {
    const cookies = inPiggles(() => sessionCookiesFor('piggles', SESSION, true));
    expect(cookies).toHaveLength(1);
    const session = named(cookies, 'piggles-account.session_token');
    expect(session?.value.startsWith(`${SESSION}.`)).toBe(true);
    expect(session?.options.maxAge).toBe(THIRTY_DAYS);
    expect(session?.options.httpOnly).toBe(true);
  });

  it('lasts only as long as the browser, and says so, when they unticked the box', () => {
    const cookies = inPiggles(() => sessionCookiesFor('piggles', SESSION, false));
    expect(named(cookies, 'piggles-account.session_token')?.options.maxAge).toBeUndefined();
    expect(named(cookies, 'piggles-account.dont_remember')?.value.startsWith('true.')).toBe(true);
  });
});

describe('clearedSessionCookies', () => {
  it('empties both the session and the marker', () => {
    const cookies = inPiggles(() => clearedSessionCookies('piggles'));
    expect(cookies.map((c) => c.name).sort()).toEqual([
      'piggles-account.dont_remember',
      'piggles-account.session_token',
    ]);
    for (const c of cookies) {
      expect(c.value).toBe('');
      expect(c.options.maxAge).toBe(0);
    }
  });
});

describe('readsAsRemembered', () => {
  it('is true with no marker, false with either spelling of it', () => {
    expect(inPiggles(() => readsAsRemembered('piggles', 'piggles-account.session_token=a'))).toBe(
      true
    );
    expect(inPiggles(() => readsAsRemembered('piggles', null))).toBe(true);
    expect(
      inPiggles(() => readsAsRemembered('piggles', 'x=1; piggles-account.dont_remember=true.s'))
    ).toBe(false);
    expect(
      inPiggles(() => readsAsRemembered('piggles', '__Secure-piggles-account.dont_remember=true.s'))
    ).toBe(false);
  });
});
