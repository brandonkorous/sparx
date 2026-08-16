// The brand→origin contract.
//
// One test here is the whole reason the file was changed: a Piggles tenant's
// invitation must carry a Piggles URL. Everything else guards the ways that can
// silently stop being true — a legacy variable shadowing the scoped one, a
// production misconfiguration guessing instead of failing, a brand nobody
// configured resolving to whichever hostname happened to be hardcoded.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accountOrigin, appLink, appOrigin, DEFAULT_BRAND } from './server';

const TOUCHED = [
  'SPARX_APP_URL',
  'SPARX_DASHBOARD_URL',
  'NEXT_PUBLIC_APP_URL',
  'WORKBENCH_BASE_URL',
  'NEXT_PUBLIC_DASHBOARD_URL',
  'PIGGLES_APP_URL',
  'SPARX_ACCOUNT_URL',
  'PIGGLES_ACCOUNT_URL',
  'NODE_ENV',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(TOUCHED.map((k) => [k, process.env[k]]));
  for (const k of TOUCHED) delete process.env[k];
});

afterEach(() => {
  for (const k of TOUCHED) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('appOrigin', () => {
  it('answers each brand from its own scoped variable', () => {
    process.env.SPARX_APP_URL = 'https://app.sparx.works';
    process.env.PIGGLES_APP_URL = 'https://mypiggles.com';

    expect(appOrigin('sparx')).toBe('https://app.sparx.works');
    expect(appOrigin('piggles')).toBe('https://mypiggles.com');
  });

  it('never lets a legacy unscoped variable shadow the scoped one', () => {
    // The exact shape of the bug being fixed: one global origin, set for sparx,
    // answering for every brand that asked.
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.sparx.works';
    process.env.PIGGLES_APP_URL = 'https://mypiggles.com';

    expect(appOrigin('piggles')).toBe('https://mypiggles.com');
  });

  it('still reads the legacy names when no scoped variable is set', () => {
    // The migration window: config lands before every environment grows a
    // `<BRAND>_APP_URL`, and nothing may break in between.
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.sparx.works/';
    expect(appOrigin('sparx')).toBe('https://app.sparx.works');
  });

  it('defaults to the brand every pre-Piggles tenant carries', () => {
    process.env.SPARX_APP_URL = 'https://app.sparx.works';
    expect(appOrigin()).toBe(appOrigin(DEFAULT_BRAND));
    expect(DEFAULT_BRAND).toBe('sparx');
  });

  it('is case- and whitespace-insensitive about the brand key', () => {
    process.env.PIGGLES_APP_URL = 'https://mypiggles.com';
    expect(appOrigin('  Piggles  ')).toBe('https://mypiggles.com');
  });

  it('throws in production rather than guessing a hostname', () => {
    process.env.NODE_ENV = 'production';
    // Guessing is what mailed a Piggles customer a sparx link. A rollout must
    // fail on a missing origin, not paper over it.
    expect(() => appOrigin('piggles')).toThrow(/PIGGLES_APP_URL/);
  });

  it('falls back to a localhost port outside production', () => {
    expect(appOrigin('piggles')).toBe('http://localhost:3022');
    expect(appOrigin('sparx')).toBe('http://localhost:3011');
  });

  it('throws for an unknown brand with nothing configured', () => {
    expect(() => appOrigin('acme')).toThrow(/ACME_APP_URL/);
  });

  it('strips a trailing slash so callers can always concatenate', () => {
    process.env.PIGGLES_APP_URL = 'https://mypiggles.com/';
    expect(appOrigin('piggles')).toBe('https://mypiggles.com');
  });
});

describe('appLink', () => {
  it('resolves a surface against the brand that asked', () => {
    process.env.SPARX_APP_URL = 'https://app.sparx.works';
    process.env.PIGGLES_APP_URL = 'https://mypiggles.com';

    const sparx = appLink('platform.settings.domains');
    const piggles = appLink('platform.settings.domains', undefined, { brand: 'piggles' });

    expect(sparx).toMatch(/^https:\/\/app\.sparx\.works\//);
    expect(piggles).toMatch(/^https:\/\/mypiggles\.com\//);
    // Same address, different front door — the PATH must not vary by brand, or
    // a deep link copied between products would stop resolving.
    expect(new URL(sparx!).pathname).toBe(new URL(piggles!).pathname);
  });

  it('returns null for an unknown surface rather than a broken URL', () => {
    process.env.PIGGLES_APP_URL = 'https://mypiggles.com';
    expect(appLink('not.a.real.surface', undefined, { brand: 'piggles' })).toBeNull();
  });
});

describe('accountOrigin', () => {
  it('falls back to the console origin for a brand whose auth lives in-app', () => {
    // sparx mounts Better Auth in the workbench, so "where you work" and "where
    // you sign in" are the same host and nothing needs configuring.
    process.env.SPARX_APP_URL = 'https://app.sparx.works';
    expect(accountOrigin('sparx')).toBe('https://app.sparx.works');
  });

  it('answers a separate host for a brand that split auth onto its own domain', () => {
    // Piggles: mypiggles.com has no sign-in page and never will.
    process.env.PIGGLES_APP_URL = 'https://mypiggles.com';
    process.env.PIGGLES_ACCOUNT_URL = 'https://getpiggles.com';

    expect(appOrigin('piggles')).toBe('https://mypiggles.com');
    expect(accountOrigin('piggles')).toBe('https://getpiggles.com');
  });

  it('keeps the two brands independent', () => {
    process.env.SPARX_APP_URL = 'https://app.sparx.works';
    process.env.PIGGLES_APP_URL = 'https://mypiggles.com';
    process.env.PIGGLES_ACCOUNT_URL = 'https://getpiggles.com';

    expect(accountOrigin('sparx')).toBe('https://app.sparx.works');
    expect(accountOrigin('piggles')).toBe('https://getpiggles.com');
  });
});

describe('the invitation link this all exists for', () => {
  it('sends a Piggles teammate somewhere they can actually sign up', () => {
    process.env.SPARX_APP_URL = 'https://app.sparx.works';
    process.env.PIGGLES_APP_URL = 'https://mypiggles.com';
    process.env.PIGGLES_ACCOUNT_URL = 'https://getpiggles.com';

    // Mirrors acceptUrlFor() in services/api-rest/src/routes/v1/team.ts.
    const acceptUrl = `${accountOrigin('piggles')}/accept-invite?invitation=${encodeURIComponent('inv_123')}`;

    expect(acceptUrl).toBe('https://getpiggles.com/accept-invite?invitation=inv_123');
    // The two failures this replaces: another company's product, and a domain
    // with no sign-in page on it.
    expect(acceptUrl).not.toContain('sparx');
    expect(acceptUrl).not.toContain('mypiggles');
  });

  it('leaves the sparx invitation exactly where it was', () => {
    process.env.SPARX_APP_URL = 'https://app.sparx.works';
    const acceptUrl = `${accountOrigin('sparx')}/accept-invite?invitation=inv_123`;
    expect(acceptUrl).toBe('https://app.sparx.works/accept-invite?invitation=inv_123');
  });
});
