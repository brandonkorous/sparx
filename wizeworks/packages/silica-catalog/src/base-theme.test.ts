// BASE_SILICA_THEME must stay silicaui's own house baseline, plus the three roles
// silicaui does not model.
//
// The bag is written out as literals (see base-theme.ts for why), which makes it a
// copy of values whose source of truth lives upstream in `@wizeworks/silicaui-html`.
// This test is what makes the copy safe: it fails, naming the key, the moment the
// two disagree — either because someone hand-tuned a value here, or because a
// silicaui upgrade moved the baseline and this file was not carried along.
//
// It also guards the thing the bag exists to prevent: a value that belongs to a
// product rather than to the platform. Nothing here may be a color no upstream role
// resolves to.

import { describe, expect, it } from 'vitest';
import { presetByName, resolveThemeTokens, type Theme } from '@wizeworks/silicaui-html';

import { BASE_SILICA_THEME } from './base-theme';

/** The baseline the platform floor is taken from — silicaui's stated default, "the
 *  only preset that states no type or shape". Named once so a deliberate move to a
 *  different upstream baseline is a one-line change with a red test behind it. */
const UPSTREAM_BASELINE = 'quartz';

function upstream(mode: 'light' | 'dark'): Record<string, string> {
  const preset = presetByName(UPSTREAM_BASELINE) as Theme | undefined;
  if (!preset) throw new Error(`silicaui no longer ships a '${UPSTREAM_BASELINE}' preset`);
  return resolveThemeTokens(preset, mode);
}

/** `danger`←error, `highlight`←accent, `border`←base-300 — the roles silica's own
 *  set lacks, mapped exactly as `resolveSparxTheme` maps them for every shipped
 *  theme, so the floor and the forty themes agree about what those names mean. */
function residuals(bag: Record<string, string>): Record<string, string> {
  return {
    '--color-danger': bag['--color-error']!,
    '--color-danger-content': bag['--color-error-content']!,
    '--color-highlight': bag['--color-accent']!,
    '--color-highlight-content': bag['--color-accent-content']!,
    '--color-border': bag['--color-base-300']!,
  };
}

function colorsOf(bag: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(bag).filter(([k]) => k.startsWith('--color-')));
}

describe('BASE_SILICA_THEME', () => {
  it('is named for the upstream baseline, not for a product', () => {
    // The name reaches a page: the layout stamps the resolved theme, and it used to
    // read `sparx` on every un-themed tenant site of both brands.
    expect(BASE_SILICA_THEME.name).toBe(UPSTREAM_BASELINE);
  });

  for (const mode of ['light', 'dark'] as const) {
    describe(mode, () => {
      const expected = { ...upstream(mode), ...residuals(upstream(mode)) };
      const actual = colorsOf(
        mode === 'light' ? BASE_SILICA_THEME.tokens : (BASE_SILICA_THEME.dark ?? {})
      );

      it('declares exactly the upstream roles plus the three residuals', () => {
        expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
      });

      it('matches the upstream value for every role', () => {
        for (const [key, value] of Object.entries(expected)) {
          expect(actual[key], `BASE_SILICA_THEME ${mode} ${key} drifted from upstream`).toBe(value);
        }
      });
    });
  }

  it('names no webfont, so an un-themed site fetches none', () => {
    // A face here would be a type choice the platform made on a tenant's behalf, and
    // it would cost a Google Fonts round trip on a page nobody has themed.
    for (const token of ['--font-sans', '--font-heading'] as const) {
      expect(BASE_SILICA_THEME.tokens[token]).toMatch(/^ui-sans-serif,/);
    }
  });
});
