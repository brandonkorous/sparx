import { describe, expect, it } from 'vitest';
import { buildDarkModeCss } from '../dark-mode';
import { emailBrandColorDefaults, emailBrandDarkColorDefaults } from '../brand-colors';
import { defaultBrand, type BrandTokens } from '../../index';

describe('buildDarkModeCss', () => {
  it('remaps neutrals + preserves the sparx accent for the default brand', () => {
    const light = emailBrandColorDefaults(defaultBrand);
    const dark = emailBrandDarkColorDefaults(defaultBrand);
    expect(dark).not.toBeNull();
    const css = buildDarkModeCss(light, dark!);

    expect(css).toMatch(/^@media \(prefers-color-scheme:dark\)\{/);
    // Surfaces flip to the dark theme.
    expect(css).toContain(
      `[bgcolor="${defaultBrand.background}"]{background-color:#0b1120!important}`
    );
    expect(css).toContain(`[bgcolor="${defaultBrand.muted}"]{background-color:#111827!important}`);
    // Text flips — both spacing spellings the projector + frame emit.
    expect(css).toContain(`[style*="color: ${defaultBrand.foreground}"]{color:#e2e8f0!important}`);
    expect(css).toContain(`[style*="color:${defaultBrand.foreground}"]{color:#e2e8f0!important}`);
    // The sparx accent keeps its hue in dark (no dark override) → no remap rule.
    expect(css).not.toContain(`[bgcolor="${defaultBrand.primary}"]`);
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
    // The button/brand-bar surface AND the footer-link colour both track the dark hue.
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
