// The bar for the ten bespoke template themes, driven through silica's OWN contrast
// engine — the same `contrastWarnings` / `parseColor` the canvas, theme editor and
// publishing use, so a theme that passes here cannot be flagged there.
//
// These are the SAME per-theme assertions `themes.test.ts` runs against the trade
// shelves, pointed at `TEMPLATE_THEMES`: a complete light AND dark palette, WCAG AA
// on every role and on body text over every surface, a one-directional surface ramp,
// a resolvable `-content` for every role, shape/type kept out of the dark delta, and
// the font-token↔self-hosting-record pairing. Plus: URL-safe unique names that never
// shadow a silica preset OR one of the twenty `SPARX_THEMES`.

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
import { TEMPLATE_THEMES, TEMPLATE_THEME_BY_SLUG } from './template-themes';

const MODES = ['light', 'dark'] as const;
const SURFACES = ['base-100', 'base-200', 'base-300'] as const;

/** A theme's effective token bag for one mode — the light bag with the dark delta
 *  merged over it, which is exactly what the canvas paints. */
const bagFor = (theme: (typeof TEMPLATE_THEMES)[number], mode: 'light' | 'dark') =>
  mode === 'dark' ? { ...theme.tokens, ...theme.dark } : theme.tokens;

describe('the template themes', () => {
  it('gives every theme a unique, URL-safe name', () => {
    const names = TEMPLATE_THEMES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  // A host theme sharing a name with a shipped preset SHADOWS it — the shipped one
  // is silently dropped. Reasonable for a deliberate white-label override, a terrible
  // way to discover a typo, so: no overlap with silica's presets.
  it('never shadows one of silica shipped presets', () => {
    const shipped = new Set(THEME_PRESETS.map((t) => t.name));
    const collisions = TEMPLATE_THEMES.map((t) => t.name).filter((n) => shipped.has(n));
    expect(collisions).toEqual([]);
  });

  // The same rule against the trade shelves: a template theme must not collide with
  // one of the twenty `SPARX_THEMES` either — both libraries flatten into the same
  // `[data-theme]` namespace.
  it('never collides with a SPARX_THEMES shelf name', () => {
    const shelf = new Set(SPARX_THEMES.map((t) => t.name));
    const collisions = TEMPLATE_THEMES.map((t) => t.name).filter((n) => shelf.has(n));
    expect(collisions).toEqual([]);
  });

  it('maps every blueprint slug to one of the ten themes', () => {
    const themes = new Set(TEMPLATE_THEMES);
    const mapped = Object.values(TEMPLATE_THEME_BY_SLUG);
    expect(mapped).toHaveLength(TEMPLATE_THEMES.length);
    for (const t of mapped) expect(themes.has(t)).toBe(true);
    expect(new Set(mapped).size).toBe(TEMPLATE_THEMES.length);
    for (const slug of Object.keys(TEMPLATE_THEME_BY_SLUG)) {
      expect(slug).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});

describe.each(TEMPLATE_THEMES)('$name', (theme) => {
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

  // base-200/300 must step AWAY from the page in one direction. A ramp that doubles
  // back gives a card and the page behind it the same value, and the layering
  // silently stops existing.
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

  // Shape and type don't vary by mode. Repeating them in the dark delta is dead
  // weight the next editor has to keep in sync by hand.
  it('keeps shape and type out of the dark delta', () => {
    const strays = Object.keys(theme.dark ?? {}).filter((k) => !k.startsWith('--color-'));
    expect(strays).toEqual([]);
  });

  // `fonts` is what publishing self-hosts from; the token is what actually renders.
  // One without the other means the site loads a face it never uses, or renders a
  // face it never loads.
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
