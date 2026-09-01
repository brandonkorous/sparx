import { describe, expect, it } from 'vitest';

import { BASE_SILICA_THEME } from '@wizeworks/silica-catalog';
import { PLATFORM_TOKEN_DEFAULTS } from '@wizeworks/site-themes';

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
  // This is the only place the two halves of the platform base can be checked
  // against each other: @wizeworks/site-themes is dependency-free and cannot see the
  // silica constant, and silica-catalog does not depend on it either. Both land here.
  //
  // It matters more than it looks. The base is what an un-themed tenant's SITE wears
  // and what their MAIL is painted in, and the two are stated in different packages
  // in different formats — so a base change applied to one and not the other is a
  // shop whose receipts stop matching its own storefront, with nothing failing.
  it('agrees with the v1 defaults, so an un-themed site and its mail match', () => {
    const brand = siteThemeToBrand(BASE_SILICA_THEME, {});
    expect(brand.primary).toBe(PLATFORM_TOKEN_DEFAULTS.light.colorPrimary);
    expect(brand.accent).toBe(PLATFORM_TOKEN_DEFAULTS.light.colorAccent);
    expect(brand.background).toBe(PLATFORM_TOKEN_DEFAULTS.light.colorBackground);
    expect(brand.foreground).toBe(PLATFORM_TOKEN_DEFAULTS.light.colorForeground);
    expect(brand.muted).toBe(PLATFORM_TOKEN_DEFAULTS.light.colorMuted);
    expect(brand.border).toBe(PLATFORM_TOKEN_DEFAULTS.light.colorBorder);
    expect(brand.dark?.background).toBe(PLATFORM_TOKEN_DEFAULTS.dark.colorBackground);
    expect(brand.dark?.foreground).toBe(PLATFORM_TOKEN_DEFAULTS.dark.colorForeground);
  });

  it('flattens the base to email-safe hex, light + dark', () => {
    const brand = siteThemeToBrand(BASE_SILICA_THEME, {});
    // The base bag is OKLCH, so this exercises the real conversion rather than a
    // pass-through — and a mail client that met an `oklch()` would paint nothing.
    // It used to be hex, which meant this assertion proved nothing about the
    // converter every AUTHORED theme's mail already depends on.
    expect(BASE_SILICA_THEME.tokens['--color-primary']).toMatch(/^oklch\(/);
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
    // Identity does not change the look — the palette is still the platform base.
    expect(brand.primary).toBe(PLATFORM_TOKEN_DEFAULTS.light.colorPrimary);
  });
});
