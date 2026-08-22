// The identity contract. The first test is the bug this package exists for.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PLATFORM_BRAND,
  normalizeBrandKey,
  platformBrandIdentity,
  platformFrom,
} from './index';

const TOUCHED = [
  'SPARX_BRAND_NAME',
  'SPARX_SUPPORT_NAME',
  'SPARX_SUPPORT_EMAIL',
  'SPARX_BRAND_URL',
  'SPARX_EMAIL_FROM',
  'PIGGLES_BRAND_NAME',
  'PIGGLES_SUPPORT_NAME',
  'PIGGLES_SUPPORT_EMAIL',
  'PIGGLES_BRAND_URL',
  'PIGGLES_EMAIL_FROM',
  'PIGGLES_BRAND_WORDMARK',
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

  it('carries a public home only when one is configured', () => {
    // The legal line at the foot of every platform email. Absent renders
    // nothing, which is right — a guessed URL is a link to a 404.
    expect(platformBrandIdentity('piggles').siteUrl).toBeNull();
    process.env.PIGGLES_BRAND_URL = 'https://meetpiggles.com';
    expect(platformBrandIdentity('piggles').siteUrl).toBe('https://meetpiggles.com');
  });
});

describe('platformFrom', () => {
  const FALLBACK = 'sparx <noreply@sparx.email>';

  it('keeps the deliverable address and corrects only the name', () => {
    // Both brands send through one Mailgun domain. The address has to stay;
    // "sparx" in front of it does not.
    process.env.PIGGLES_BRAND_NAME = 'Piggles';
    const from = platformFrom(platformBrandIdentity('piggles'), FALLBACK);
    expect(from).toBe('Piggles <noreply@sparx.email>');
    expect(from).not.toMatch(/^sparx /);
  });

  it('takes the brand’s own sending identity whole when it has one', () => {
    process.env.PIGGLES_EMAIL_FROM = 'Piggles <hello@meetpiggles.com>';
    expect(platformFrom(platformBrandIdentity('piggles'), FALLBACK)).toBe(
      'Piggles <hello@meetpiggles.com>'
    );
  });

  it('accepts a bare address with no angle brackets', () => {
    process.env.PIGGLES_BRAND_NAME = 'Piggles';
    expect(platformFrom(platformBrandIdentity('piggles'), 'noreply@sparx.email')).toBe(
      'Piggles <noreply@sparx.email>'
    );
  });

  it('leaves the default brand’s own From untouched', () => {
    process.env.SPARX_BRAND_NAME = 'sparx';
    expect(platformFrom(platformBrandIdentity('sparx'), FALLBACK)).toBe(FALLBACK);
  });
});

// ─── The drawn wordmark ─────────────────────────────────────────────────────
//
// The badge these feed is on the most public surface the platform has: the foot
// of every tenant's own website. So every case below is about the same thing —
// a bad value must degrade to a READABLE credit, never to an empty badge or a
// thrown render.

describe('platformBrandIdentity().wordmark', () => {
  const ART = JSON.stringify({
    viewBox: '0 0 531.08 188.86',
    paths: ['M47.36,127.6', 'M140.95,124.07'],
    accentPath: 'M120.67,27.21',
  });

  it('reads the geometry a brand has published', () => {
    process.env.PIGGLES_BRAND_WORDMARK = ART;
    const wordmark = platformBrandIdentity('piggles').wordmark;
    expect(wordmark?.viewBox).toBe('0 0 531.08 188.86');
    expect(wordmark?.paths).toHaveLength(2);
    expect(wordmark?.accentPath).toBe('M120.67,27.21');
  });

  it('is null for a brand whose mark IS its letterforms', () => {
    expect(platformBrandIdentity('sparx').wordmark).toBeNull();
  });

  it('does not leak one brand’s logo onto the other’s tenants', () => {
    process.env.PIGGLES_BRAND_WORDMARK = ART;
    expect(platformBrandIdentity('sparx').wordmark).toBeNull();
  });

  it('returns null rather than throwing on a value that is not JSON', () => {
    process.env.PIGGLES_BRAND_WORDMARK = '{not json';
    expect(platformBrandIdentity('piggles').wordmark).toBeNull();
  });

  it('rejects a mark with no paths — an empty <svg> is a blank badge', () => {
    process.env.PIGGLES_BRAND_WORDMARK = JSON.stringify({ viewBox: '0 0 10 10', paths: [] });
    expect(platformBrandIdentity('piggles').wordmark).toBeNull();
  });

  it('rejects a mark with no viewBox — without one the art has no scale', () => {
    process.env.PIGGLES_BRAND_WORDMARK = JSON.stringify({ viewBox: '  ', paths: ['M0,0'] });
    expect(platformBrandIdentity('piggles').wordmark).toBeNull();
  });

  it('rejects a paths array holding anything that is not a path', () => {
    process.env.PIGGLES_BRAND_WORDMARK = JSON.stringify({
      viewBox: '0 0 10 10',
      paths: ['M0,0', 42],
    });
    expect(platformBrandIdentity('piggles').wordmark).toBeNull();
  });

  it('accepts a mark with no accent shape — not every logo has one', () => {
    process.env.PIGGLES_BRAND_WORDMARK = JSON.stringify({ viewBox: '0 0 10 10', paths: ['M0,0'] });
    expect(platformBrandIdentity('piggles').wordmark?.accentPath).toBeNull();
  });

  it('leaves the type treatment intact, so a null wordmark still credits by name', () => {
    process.env.PIGGLES_BRAND_NAME = 'Piggles';
    process.env.PIGGLES_BRAND_WORDMARK = 'rubbish';
    const brand = platformBrandIdentity('piggles');
    expect(brand.wordmark).toBeNull();
    expect(brand.name).toBe('Piggles');
  });
});
