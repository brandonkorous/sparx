import { describe, expect, it } from 'vitest';
import { buildDarkModeCss } from '../dark-mode';
import { emailBrandColorDefaults, emailBrandDarkColorDefaults } from '../brand-colors';
import { defaultBrand, type BrandTokens } from '../../index';

describe('buildDarkModeCss', () => {
  // This used to read the dark set off `defaultBrand` and assert sparx's own
  // `#0b1120` / `#e2e8f0` — which is to say it pinned one brand's night theme
  // into the shared platform as the answer for every tenant of every brand.
  // `defaultBrand` is brand-blind now and carries no dark set at all; a brand's
  // dark surfaces arrive with its palette. The BEHAVIOUR under test is unchanged
  // and is the point: neutrals remap, and a hue that does not shift is left
  // alone rather than given a rule that changes nothing.
  it('remaps the neutrals and leaves an unshifted hue alone', () => {
    const brand: BrandTokens = {
      ...defaultBrand,
      primary: '#e04631',
      background: '#ffffff',
      muted: '#eceef2',
      foreground: '#2b3242',
      dark: {
        background: '#0b1120',
        foreground: '#e2e8f0',
        muted: '#111827',
        border: '#1f2937',
      },
    };
    const light = emailBrandColorDefaults(brand);
    const dark = emailBrandDarkColorDefaults(brand);
    expect(dark).not.toBeNull();
    const css = buildDarkModeCss(light, dark!);

    expect(css).toMatch(/^@media \(prefers-color-scheme:dark\)\{/);
    // Surfaces flip to the dark theme.
    expect(css).toContain(`[bgcolor="${brand.background}"]{background-color:#0b1120!important}`);
    expect(css).toContain(`[bgcolor="${brand.muted}"]{background-color:#111827!important}`);
    // Text flips — both spacing spellings the projector + frame emit.
    expect(css).toContain(`[style*="color: ${brand.foreground}"]{color:#e2e8f0!important}`);
    expect(css).toContain(`[style*="color:${brand.foreground}"]{color:#e2e8f0!important}`);
    // The accent keeps its hue in dark (no dark override) → no remap rule.
    expect(css).not.toContain(`[bgcolor="${brand.primary}"]`);
  });

  // The new default, stated as its own case rather than left implicit: an
  // unbranded send is light-only. It used to inherit sparx's night theme, so a
  // Piggles shop with no branding got another product's dark surfaces in every
  // client that honours the media query.
  it('emits no dark block for a send that named no brand', () => {
    expect(defaultBrand.dark, 'the platform floor carries no brand’s night').toBeUndefined();
    expect(emailBrandDarkColorDefaults(defaultBrand)).toBeNull();
  });

  it('shifts the brand hue when the site dark theme does', () => {
    const brand: BrandTokens = {
      ...defaultBrand,
      primary: '#4f46e5',
      background: '#ffffff',
      muted: '#f1f5f9',
      foreground: '#0f172a',
      border: '#e2e8f0',
      dark: {
        background: '#0b1120',
        foreground: '#e2e8f0',
        muted: '#111827',
        border: '#1f2937',
        primary: '#6366f1',
      },
    };
    const css = buildDarkModeCss(
      emailBrandColorDefaults(brand),
      emailBrandDarkColorDefaults(brand)!
    );
    // The button/brand-bar surface AND the footer-link color both track the dark hue.
    expect(css).toContain('[bgcolor="#4f46e5"]{background-color:#6366f1!important}');
    expect(css).toContain('[style*="color: #4f46e5"]{color:#6366f1!important}');
  });

  it('emits nothing when the brand has no dark palette', () => {
    const { dark: _omit, ...lightOnly } = defaultBrand;
    expect(emailBrandDarkColorDefaults(lightOnly)).toBeNull();
    // A light map compared against itself yields no rules.
    const light = emailBrandColorDefaults(lightOnly);
    expect(buildDarkModeCss(light, light)).toBe('');
  });
});
