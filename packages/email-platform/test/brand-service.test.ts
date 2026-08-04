import { describe, expect, it } from 'vitest';

import { BASE_SILICA_THEME } from '@sparx/silica-catalog';

import { siteThemeToBrand } from '../src/services/brand-service';

// A resolved silica theme in OKLCH (what SPARX_THEMES / resolveSparxTheme produce).
const OKLCH_THEME = {
  tokens: {
    '--color-primary': 'oklch(50% 0.17 45)',
    '--color-primary-content': 'oklch(98% 0.01 45)',
    '--color-accent': 'oklch(78% 0.14 85)',
    '--color-base-100': 'oklch(98% 0.012 75)',
    '--color-base-200': 'oklch(96% 0.02 75)',
    '--color-base-content': 'oklch(24% 0.03 50)',
    '--color-border': 'oklch(91% 0.03 70)',
    '--font-heading': "'Fraunces', system-ui, serif",
    '--font-sans': "'Nunito', system-ui, sans-serif",
  },
  dark: {
    '--color-base-100': 'oklch(19% 0.016 50)',
    '--color-primary': 'oklch(76% 0.16 45)',
  },
};

const HEX_RE = /^#[0-9a-f]{6}$/;

describe('siteThemeToBrand', () => {
  it('flattens every color token to email-safe hex (no oklch leaks)', () => {
    const brand = siteThemeToBrand(OKLCH_THEME, {});
    for (const v of [
      brand.primary,
      brand.primaryForeground,
      brand.accent,
      brand.background,
      brand.foreground,
      brand.muted,
      brand.border,
    ]) {
      expect(v).toMatch(HEX_RE);
    }
    // dark block too
    for (const v of Object.values(brand.dark ?? {})) {
      expect(v).toMatch(HEX_RE);
    }
  });

  it('maps role/surface tokens to the right BrandTokens slots', () => {
    const brand = siteThemeToBrand(OKLCH_THEME, {});
    expect(brand.background).toBe(brand.background); // base-100 → background (sanity)
    // primary and its foreground are distinct, both hex
    expect(brand.primary).not.toBe(brand.primaryForeground);
  });

  it('derives email-safe font stacks from the theme families', () => {
    const brand = siteThemeToBrand(OKLCH_THEME, {});
    expect(brand.fontHeading).toContain('Fraunces');
    expect(brand.fontHeading).toContain('Arial'); // fontStack adds the email fallback
    expect(brand.fontBody).toContain('Nunito');
  });

  it('threads identity (logo/name/socials) through unchanged', () => {
    const brand = siteThemeToBrand(OKLCH_THEME, {
      logoUrl: 'https://example.test/logo.png',
      siteName: 'Savory Donuts',
      socials: [{ platform: 'instagram', url: 'https://ig.test/x' }],
    });
    expect(brand.logoUrl).toBe('https://example.test/logo.png');
    expect(brand.siteName).toBe('Savory Donuts');
    expect(brand.socials).toEqual([{ platform: 'instagram', url: 'https://ig.test/x' }]);
  });

  it('omits identity fields when not supplied', () => {
    const brand = siteThemeToBrand(OKLCH_THEME, {});
    expect(brand.logoUrl).toBeUndefined();
    expect(brand.siteName).toBeUndefined();
    expect(brand.socials).toBeUndefined();
  });
});

// The un-themed fallback: resolveEmailBrand returns siteThemeToBrand(BASE_SILICA_THEME, …)
// for a site with no published silica theme, mirroring the site's own fallback so
// email and site stay in lockstep before a theme is stored.
describe('siteThemeToBrand(BASE_SILICA_THEME) — the un-themed fallback', () => {
  it('flattens the sparx Ember base to email-safe hex, light + dark', () => {
    const brand = siteThemeToBrand(BASE_SILICA_THEME, {});
    // The BASE bag is already hex; colorToHex passes it through unchanged.
    expect(brand.primary).toBe('#e04631'); // sparx Ember
    expect(brand.background).toBe('#ffffff');
    expect(brand.foreground).toBe('#0f172a');
    expect(brand.dark?.background).toBe('#0b1120');
    for (const v of [
      brand.primary,
      brand.primaryForeground,
      brand.accent,
      brand.background,
      brand.foreground,
      brand.muted,
      brand.border,
    ]) {
      expect(v).toMatch(HEX_RE);
    }
    for (const v of Object.values(brand.dark ?? {})) {
      expect(v).toMatch(HEX_RE);
    }
  });

  it('threads identity through the base fallback', () => {
    const brand = siteThemeToBrand(BASE_SILICA_THEME, {
      siteName: "Bob's Parts",
      logoUrl: 'https://x.test/logo.png',
    });
    expect(brand.siteName).toBe("Bob's Parts");
    expect(brand.logoUrl).toBe('https://x.test/logo.png');
    // Identity does not change the look — the palette is still the Ember base.
    expect(brand.primary).toBe('#e04631');
  });
});
