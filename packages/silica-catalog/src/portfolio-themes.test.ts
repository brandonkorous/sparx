// The bar for the six bespoke PORTFOLIO-template themes, driven through silica's OWN
// contrast engine — the same `contrastWarnings` / `parseColor` the canvas, theme editor
// and publishing use, so a theme that passes here cannot be flagged there.
//
// The SAME per-theme assertions `themes.test.ts` / `template-themes.test.ts` /
// `content-themes.test.ts` run, pointed at `PORTFOLIO_THEMES`: a complete light AND dark
// palette, WCAG AA on every role and on body text over every surface, a one-directional
// surface ramp, a resolvable `-content` for every role, shape/type kept out of the dark
// delta, and the font-token↔self-hosting-record pairing. Plus: URL-safe unique names that
// never shadow a silica preset, one of the twenty `SPARX_THEMES`, one of the ten
// `TEMPLATE_THEMES`, OR one of the ten `CONTENT_THEMES`.

import { describe, expect, it } from 'vitest';
import {
  AA_NORMAL,
  SEMANTIC_ROLES,
  THEME_PRESETS,
  contrastRatio,
  contrastWarnings,
  parseColor,
  resolveThemeTokens,
} from '@wizeworks/silicaui-html';

import { SPARX_THEMES } from './themes';
import { TEMPLATE_THEMES } from './template-themes';
import { CONTENT_THEMES } from './content-themes';
import { PORTFOLIO_THEMES, PORTFOLIO_THEME_BY_SLUG } from './portfolio-themes';

const MODES = ['light', 'dark'] as const;
const SURFACES = ['base-100', 'base-200', 'base-300'] as const;

/** A theme's effective token bag for one mode — the light bag with the dark delta
 *  merged over it, which is exactly what the canvas paints. */
const bagFor = (theme: (typeof PORTFOLIO_THEMES)[number], mode: 'light' | 'dark') =>
  mode === 'dark' ? { ...theme.tokens, ...theme.dark } : theme.tokens;

describe('the portfolio-template themes', () => {
  it('gives every theme a unique, URL-safe name', () => {
    const names = PORTFOLIO_THEMES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('never shadows one of silica shipped presets', () => {
    const shipped = new Set(THEME_PRESETS.map((t) => t.name));
    const collisions = PORTFOLIO_THEMES.map((t) => t.name).filter((n) => shipped.has(n));
    expect(collisions).toEqual([]);
  });

  it('never collides with a SPARX_THEMES shelf name', () => {
    const shelf = new Set(SPARX_THEMES.map((t) => t.name));
    const collisions = PORTFOLIO_THEMES.map((t) => t.name).filter((n) => shelf.has(n));
    expect(collisions).toEqual([]);
  });

  it('never collides with a TEMPLATE_THEMES commerce name', () => {
    const commerce = new Set(TEMPLATE_THEMES.map((t) => t.name));
    const collisions = PORTFOLIO_THEMES.map((t) => t.name).filter((n) => commerce.has(n));
    expect(collisions).toEqual([]);
  });

  // All bespoke shelves flatten into the same `[data-theme]` namespace, so a portfolio
  // theme must not collide with one of the content ten either.
  it('never collides with a CONTENT_THEMES publisher name', () => {
    const content = new Set(CONTENT_THEMES.map((t) => t.name));
    const collisions = PORTFOLIO_THEMES.map((t) => t.name).filter((n) => content.has(n));
    expect(collisions).toEqual([]);
  });

  it('maps every portfolio blueprint slug to one of the six themes', () => {
    const themes = new Set(PORTFOLIO_THEMES);
    const mapped = Object.values(PORTFOLIO_THEME_BY_SLUG);
    expect(mapped).toHaveLength(PORTFOLIO_THEMES.length);
    for (const t of mapped) expect(themes.has(t)).toBe(true);
    expect(new Set(mapped).size).toBe(PORTFOLIO_THEMES.length);
    for (const slug of Object.keys(PORTFOLIO_THEME_BY_SLUG)) {
      expect(slug).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});

describe.each(PORTFOLIO_THEMES)('$name', (theme) => {
  it.each(MODES)('states a complete %s palette', (mode) => {
    const bag = bagFor(theme, mode);
    const missing = [...SURFACES, 'base-content', ...SEMANTIC_ROLES].filter(
      (key) => !bag[`--color-${key}`]
    );
    expect(missing).toEqual([]);
  });

  it.each(MODES)('clears WCAG AA on every role in %s mode', (mode) => {
    expect(contrastWarnings(theme, mode)).toEqual([]);
  });

  it.each(MODES)('clears WCAG AA for body text on every %s surface', (mode) => {
    const bag = bagFor(theme, mode);
    const ink = parseColor(bag['--color-base-content'] ?? '');
    expect(ink).toBeDefined();
    for (const surface of SURFACES) {
      const bg = parseColor(bag[`--color-${surface}`] ?? '');
      expect(bg, surface).toBeDefined();
      expect(contrastRatio(bg!, ink!), `${surface} in ${mode}`).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it.each(MODES)('steps its %s surface ramp in one direction', (mode) => {
    const bag = bagFor(theme, mode);
    const [l1, l2, l3] = SURFACES.map((s) => parseColor(bag[`--color-${s}`] ?? '')?.l ?? NaN);
    expect(l1).toBeGreaterThan(l2!);
    expect(l2).toBeGreaterThan(l3!);
  });

  it.each(MODES)('resolves a legible -content for every role in %s mode', (mode) => {
    const tokens = resolveThemeTokens(theme, mode);
    for (const role of SEMANTIC_ROLES) {
      expect(tokens[`--color-${role}-content`], `${role} in ${mode}`).toBeDefined();
    }
  });

  it('keeps shape and type out of the dark delta', () => {
    const strays = Object.keys(theme.dark ?? {}).filter((k) => !k.startsWith('--color-'));
    expect(strays).toEqual([]);
  });

  it('pairs each font token with its self-hosting record', () => {
    for (const [slot, cssVar] of [
      ['sans', '--font-sans'],
      ['head', '--font-head'],
    ] as const) {
      const pick = theme.fonts?.[slot];
      const stack = theme.tokens[cssVar];
      expect(Boolean(pick), `${slot} record`).toBe(Boolean(stack));
      if (pick && stack) {
        expect(pick.source).toBe('google');
        expect(stack).toContain(`"${pick.family}"`);
        expect(pick.weights?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
