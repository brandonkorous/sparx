// The identity contract. The first test is the bug this package exists for.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PLATFORM_BRAND, normalizeBrandKey, platformBrandIdentity } from './index';

const TOUCHED = [
  'SPARX_BRAND_NAME',
  'SPARX_SUPPORT_NAME',
  'SPARX_SUPPORT_EMAIL',
  'PIGGLES_BRAND_NAME',
  'PIGGLES_SUPPORT_NAME',
  'PIGGLES_SUPPORT_EMAIL',
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

describe('platformBrandIdentity', () => {
  it('never signs a reply to one brand’s customer with the other brand’s name', () => {
    process.env.PIGGLES_BRAND_NAME = 'Piggles';
    process.env.SPARX_BRAND_NAME = 'sparx';

    expect(platformBrandIdentity('piggles').supportName).toBe('Piggles Support');
    expect(platformBrandIdentity('sparx').supportName).toBe('sparx Support');
    expect(platformBrandIdentity('piggles').supportName).not.toContain('sparx');
  });

  it('takes an explicit support name over the derived one', () => {
    process.env.PIGGLES_BRAND_NAME = 'Piggles';
    process.env.PIGGLES_SUPPORT_NAME = 'The Piggles team';
    expect(platformBrandIdentity('piggles').supportName).toBe('The Piggles team');
  });

  it('carries a support address only when one is configured', () => {
    expect(platformBrandIdentity('piggles').supportEmail).toBeNull();
    process.env.PIGGLES_SUPPORT_EMAIL = 'support@meetpiggles.com';
    expect(platformBrandIdentity('piggles').supportEmail).toBe('support@meetpiggles.com');
  });

  it('preserves the case each brand actually uses', () => {
    // Not derivable: sparx is lowercase on purpose, Piggles is capitalised on
    // purpose. A `capitalize(key)` helper would get exactly one of them wrong.
    process.env.SPARX_BRAND_NAME = 'sparx';
    process.env.PIGGLES_BRAND_NAME = 'Piggles';
    expect(platformBrandIdentity('sparx').name).toBe('sparx');
    expect(platformBrandIdentity('piggles').name).toBe('Piggles');
  });

  it('falls back to the key rather than to a brand', () => {
    // The fallback must never be another product's name — that is the failure
    // being fixed. "piggles" unstyled is a cosmetic miss; "sparx" is wrong.
    expect(platformBrandIdentity('piggles').name).toBe('piggles');
    expect(platformBrandIdentity('acme').supportName).toBe('acme Support');
  });

  it('defaults to the brand every pre-Piggles tenant carries', () => {
    expect(platformBrandIdentity().key).toBe(DEFAULT_PLATFORM_BRAND);
    expect(platformBrandIdentity(null).key).toBe('sparx');
    expect(platformBrandIdentity('   ').key).toBe('sparx');
  });

  it('is case- and whitespace-insensitive about the key', () => {
    process.env.PIGGLES_BRAND_NAME = 'Piggles';
    expect(platformBrandIdentity('  Piggles  ').name).toBe('Piggles');
    expect(normalizeBrandKey('  PIGGLES ')).toBe('piggles');
  });

  it('never throws — an email worker must not stop over a display name', () => {
    expect(() => platformBrandIdentity(undefined)).not.toThrow();
    expect(() => platformBrandIdentity('a brand nobody configured')).not.toThrow();
  });
});
