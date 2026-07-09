// The silica-native theme emitter (docs/118 §1.0) — locks that a compiled tenant
// theme lowers to silicaui's OWN `--color-*` vocabulary (so a generated
// `.btn-primary` / `.bg-base-200` resolves with no translation), that `danger`
// doubles as `error`, that the minimal residual vars survive, and that the old
// `--st-*` sprawl is GONE.

import { describe, expect, it } from 'vitest';
import { compileTokensV2 } from './compile';
import {
  buildSilicaThemeCss,
  compiledToSilicaTheme,
  silicaColorVars,
  silicaSharedVars,
} from './silica-css';
import type { ColorTokensV2, ThemePresetV2 } from './types';

const LIGHT: ColorTokensV2 = {
  base100: '#ffffff',
  base200: '#f7f7f9',
  base300: '#ececf1',
  baseContent: '#0b1120',
  primary: '#4f46e5',
  secondary: '#0ea5e9',
  accent: '#f97316',
  neutral: '#1f2430',
  info: '#0284c7',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  highlight: '#eab308',
  border: '#e4e4e7',
};

const DARK: ColorTokensV2 = {
  ...LIGHT,
  base100: '#0b1120',
  base200: '#111827',
  base300: '#1f2937',
  baseContent: '#e2e8f0',
  border: '#1f2937',
};

const PRESET: ThemePresetV2 = {
  shared: {
    fontHeading: 'Geist',
    fontBody: 'Inter',
    radiusSelector: '9999px',
    radiusField: '0.5rem',
    radiusBox: '0.875rem',
    borderWidth: '1px',
    spaceBase: '0.25rem',
    sizeField: '2.5rem',
    sizeSelector: '2rem',
    depth: 1,
    containerWidth: 'wide',
  },
  light: LIGHT,
  dark: DARK,
};

describe('silicaColorVars — silica-native color vocabulary', () => {
  const c = compileTokensV2(PRESET);
  const vars = silicaColorVars(c.light);

  it('emits the silica `--color-*` base ramp + semantic pairs', () => {
    expect(vars['--color-base-100']).toBe('#ffffff');
    expect(vars['--color-base-content']).toBe('#0b1120');
    expect(vars['--color-primary']).toBe('#4f46e5');
    expect(vars['--color-primary-content']).toBe(c.light.primaryContent);
    expect(vars['--color-warning-content']).toBe(c.light.warningContent);
  });

  it('doubles `danger` as `error` so statusTone AND silica built-ins resolve', () => {
    expect(vars['--color-danger']).toBe('#dc2626');
    expect(vars['--color-error']).toBe('#dc2626');
    expect(vars['--color-error-content']).toBe(vars['--color-danger-content']);
  });

  it('keeps only the residuals silica lacks (highlight, border color)', () => {
    expect(vars['--color-highlight']).toBe('#eab308');
    expect(vars['--color-border']).toBe('#e4e4e7');
  });

  it('emits NO legacy `--st-*` vocabulary', () => {
    expect(Object.keys(vars).some((k) => k.startsWith('--st-'))).toBe(false);
  });
});

describe('silicaSharedVars — shape/type/depth in silica tokens', () => {
  const c = compileTokensV2(PRESET);
  const vars = silicaSharedVars(c.shared);

  it('maps shape → silica radius/border/size/depth tokens', () => {
    expect(vars['--radius-box']).toBe('0.875rem');
    expect(vars['--radius-field']).toBe('0.5rem');
    expect(vars['--border']).toBe('1px');
    expect(vars['--size-field']).toBe('2.5rem');
    expect(vars['--depth']).toBe('1');
  });

  it('maps body font → --font-sans, keeps heading + container as residuals', () => {
    expect(vars['--font-sans']).toContain("'Inter'");
    expect(vars['--font-heading']).toContain("'Geist'");
    expect(vars['--container-max']).toBe('90rem'); // `wide`
  });

  it('drops v2 derived scales (no --st-space-*, no hand-rolled shadows)', () => {
    expect(Object.keys(vars).some((k) => k.startsWith('--st-'))).toBe(false);
  });
});

describe('buildSilicaThemeCss — the tenant theme file', () => {
  const css = buildSilicaThemeCss(compileTokensV2(PRESET));

  it('puts shared + light at :root and dark under both opt-in and system preference', () => {
    expect(css).toContain(':root{');
    expect(css).toContain(':root[data-theme="dark"]{');
    expect(css).toContain('@media (prefers-color-scheme:dark){:root:not([data-theme="light"])');
  });

  it('carries the dark base ramp only in the dark blocks', () => {
    // Dark base-100 (#0b1120) appears; the light block leads with #ffffff.
    expect(css).toContain('--color-base-100:#0b1120');
    expect(css.indexOf('--color-base-100:#ffffff')).toBeLessThan(
      css.indexOf(':root[data-theme="dark"]')
    );
  });

  it('is entirely free of the old --st-* vocabulary', () => {
    expect(css).not.toContain('--st-');
  });
});

describe('compiledToSilicaTheme — the silica Theme object for <Builder>', () => {
  const theme = compiledToSilicaTheme(compileTokensV2(PRESET), 'northwind');

  it('names the theme and marks it a light base', () => {
    expect(theme.name).toBe('northwind');
    expect(theme.mode).toBe('light');
  });

  it('seeds tokens with shared shape/type + light colors (-- prefixed)', () => {
    expect(theme.tokens['--color-primary']).toBe('#4f46e5');
    expect(theme.tokens['--color-base-100']).toBe('#ffffff');
    expect(theme.tokens['--radius-box']).toBe('0.875rem');
    expect(theme.tokens['--font-sans']).toContain("'Inter'");
    // custom sparx colors ride along so bg-danger / bg-highlight resolve
    expect(theme.tokens['--color-danger']).toBe('#dc2626');
    expect(theme.tokens['--color-error']).toBe('#dc2626');
  });

  it('carries the dark ramp as the `dark` delta, colors only', () => {
    expect(theme.dark?.['--color-base-100']).toBe('#0b1120');
    // shape/type tokens are shared, not repeated in the dark delta
    expect(theme.dark?.['--radius-box']).toBeUndefined();
    expect(theme.dark?.['--font-sans']).toBeUndefined();
  });

  it('emits NO legacy --st-* keys', () => {
    const keys = [...Object.keys(theme.tokens), ...Object.keys(theme.dark ?? {})];
    expect(keys.some((k) => k.startsWith('--st-'))).toBe(false);
  });
});
