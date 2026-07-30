import { describe, expect, it } from 'vitest';
import { SEMANTIC_ROLES } from '@wizeworks/silicaui-html';

import { SPARX_THEMES } from './themes';
import { resolveSparxTheme } from './resolve-sparx-theme';

// The residuals silica's role set doesn't model but sparx pages/emails read.
const REQUIRED_LIGHT_RESIDUALS = [
  '--color-danger',
  '--color-danger-content',
  '--color-highlight',
  '--color-highlight-content',
  '--color-border',
  '--border',
  '--container-max',
  '--font-heading',
] as const;

describe('resolveSparxTheme', () => {
  it.each(SPARX_THEMES)('$name resolves a full, ship-ready light bag', (theme) => {
    const out = resolveSparxTheme(theme);
    expect(out.name).toBe(theme.name);
    expect(out.mode).toBe('light');

    // Every semantic role has a resolved base AND a -content pair.
    for (const role of SEMANTIC_ROLES) {
      expect(out.tokens[`--color-${role}`], `${role} base`).toBeTruthy();
      expect(out.tokens[`--color-${role}-content`], `${role} content`).toBeTruthy();
    }
    // The sparx residuals are all present.
    for (const key of REQUIRED_LIGHT_RESIDUALS) {
      expect(out.tokens[key], key).toBeTruthy();
    }
  });

  it('mirrors danger←error and highlight←accent', () => {
    const t = resolveSparxTheme(SPARX_THEMES[0]!);
    expect(t.tokens['--color-danger']).toBe(t.tokens['--color-error']);
    expect(t.tokens['--color-danger-content']).toBe(t.tokens['--color-error-content']);
    expect(t.tokens['--color-highlight']).toBe(t.tokens['--color-accent']);
    expect(t.tokens['--color-border']).toBe(t.tokens['--color-base-300']);
  });

  it('keeps the dark delta color-only (no shape/type strays)', () => {
    const t = resolveSparxTheme(SPARX_THEMES[0]!);
    const strays = Object.keys(t.dark ?? {}).filter((k) => !k.startsWith('--color-'));
    expect(strays).toEqual([]);
    // and it carries the color residuals into dark too
    expect(t.dark?.['--color-danger']).toBeTruthy();
    expect(t.dark?.['--color-highlight']).toBeTruthy();
    expect(t.dark?.['--color-border']).toBeTruthy();
  });

  it('sets --font-heading to the theme head face', () => {
    const boutique = SPARX_THEMES.find((x) => x.name === 'boutique')!;
    const out = resolveSparxTheme(boutique);
    // boutique heads in Playfair Display
    expect(out.tokens['--font-heading']).toContain('Playfair Display');
  });
});
