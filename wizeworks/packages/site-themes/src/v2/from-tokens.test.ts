// The seam that made the forty shipped themes reachable by the compiler. The bug it
// closes was invisible rather than loud: with no conversion, a site on a catalog
// theme found no preset and compiled the platform base, so picking a theme and
// picking nothing produced the same colors while every surface reported success.

import { describe, expect, it } from 'vitest';
import { themePresetV2FromTokens } from './from-tokens';

const LIGHT: Record<string, string> = {
  '--font-sans': "'Inter', system-ui, sans-serif",
  '--font-heading': "'Space Grotesk', system-ui",
  '--radius-box': '0.875rem',
  '--radius-field': '0.5rem',
  '--radius-selector': '9999px',
  '--border': '2px',
  '--size-field': '0.3rem',
  '--depth': '2',
  '--container-max': '72rem',
  '--color-base-100': '#ffffff',
  '--color-base-200': '#f8fafc',
  '--color-base-300': '#eef2f7',
  '--color-base-content': '#0f172a',
  '--color-primary': 'oklch(46% 0.11 200)',
  '--color-primary-content': '#ffffff',
  '--color-secondary': '#4c9a8e',
  '--color-secondary-content': '#ffffff',
  '--color-accent': '#c1652e',
  '--color-accent-content': '#fff7ef',
  '--color-neutral': '#0f172a',
  '--color-neutral-content': '#ffffff',
  '--color-info': '#0284c7',
  '--color-success': '#16a34a',
  '--color-warning': '#d97706',
  '--color-error': '#dc2626',
  '--color-border': '#e2e8f0',
};

describe('themePresetV2FromTokens', () => {
  it('carries the theme’s own colors, not a default', () => {
    const p = themePresetV2FromTokens(LIGHT);
    expect(p.light.primary).toBe('oklch(46% 0.11 200)');
    expect(p.light.base100).toBe('#ffffff');
    expect(p.light.border).toBe('#e2e8f0');
  });

  it('carries shape, rhythm and effect', () => {
    const p = themePresetV2FromTokens(LIGHT);
    expect(p.shared.radiusBox).toBe('0.875rem');
    expect(p.shared.borderWidth).toBe('2px');
    expect(p.shared.sizeField).toBe('0.3rem');
    expect(p.shared.depth).toBe(2);
    expect(p.shared.containerWidth).toBe('72rem');
  });

  // The storefront feeds `shared.fontHeading` to the webfont loader, so a full CSS
  // stack there asks it to fetch a font literally called
  // `'Inter', system-ui, sans-serif`.
  it('reduces a font stack to its first family, unquoted', () => {
    const p = themePresetV2FromTokens(LIGHT);
    expect(p.shared.fontBody).toBe('Inter');
    expect(p.shared.fontHeading).toBe('Space Grotesk');
  });

  it('heads in the body face when the theme names no heading font', () => {
    const { '--font-heading': _h, ...rest } = LIGHT;
    expect(themePresetV2FromTokens(rest).shared.fontHeading).toBe('Inter');
  });

  // sparx emits `danger`; silicaui's own role is `error`. Both spellings reach the
  // same slot, so a theme authored against either compiles.
  it('accepts danger under either spelling, preferring the sparx residual', () => {
    expect(themePresetV2FromTokens(LIGHT).light.danger).toBe('#dc2626');
    expect(themePresetV2FromTokens({ ...LIGHT, '--color-danger': '#b91c1c' }).light.danger).toBe(
      '#b91c1c'
    );
  });

  it('reads dark as a DELTA over light, so unstated slots inherit', () => {
    const p = themePresetV2FromTokens(LIGHT, {
      '--color-base-100': '#0b1120',
      '--color-primary': 'oklch(80% 0.1 200)',
    });
    expect(p.dark.base100).toBe('#0b1120');
    expect(p.dark.primary).toBe('oklch(80% 0.1 200)');
    // Not restated in the delta → the light value, NOT a hardcoded dark default.
    expect(p.dark.secondary).toBe('#4c9a8e');
    expect(p.dark.border).toBe('#e2e8f0');
  });

  it('compiles the same in both modes when the theme states no dark', () => {
    const p = themePresetV2FromTokens(LIGHT);
    expect(p.dark).toEqual(p.light);
  });

  // NaN would reach the shadow multiplier and blank every elevation on the site.
  it('flattens a non-numeric depth rather than propagating NaN', () => {
    expect(themePresetV2FromTokens({ ...LIGHT, '--depth': 'thick' }).shared.depth).toBe(1);
  });
});
