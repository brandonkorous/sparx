// The bar for sparx's theme shelves, driven through silica's OWN contrast engine
// rather than a reimplementation — the same `contrastWarnings` / `parseColor` the
// canvas, the theme editor and publishing use, so a theme that passes here cannot
// be flagged there.
//
// What this actually guards, in order of how badly it bit us:
//
//   1. A partial dark palette. silica's shipped presets carried this defect for
//      four versions: `ocean` restated no brand role in dark at all, so its
//      neutral fill kept a light-mode lightness on a dark surface. `defineTheme`
//      makes it a type error; this makes it a test failure too, because `Theme`
//      is a plain interface and nothing stops a hand-built one being added later.
//   2. Body text on the surface ramp. It is the pairing every visitor reads on
//      every page, and NO role check covers it — `base-content` isn't a role, so
//      `contrastWarnings` never measures it. A theme can pass every role check
//      and still be unreadable prose on an off-white card.
//   3. A name colliding with a silica preset. The builder resolves that by having
//      the host SHADOW the shipped one (`themeShelves`), silently dropping it —
//      so a collision doesn't error, it just deletes one of silica's twenty.

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

import { SPARX_THEMES, SPARX_THEME_GROUPS } from './themes';

const MODES = ['light', 'dark'] as const;
const SURFACES = ['base-100', 'base-200', 'base-300'] as const;

/** A theme's effective token bag for one mode — the light bag with the dark delta
 *  merged over it, which is exactly what the canvas paints. */
const bagFor = (theme: (typeof SPARX_THEMES)[number], mode: 'light' | 'dark') =>
  mode === 'dark' ? { ...theme.tokens, ...theme.dark } : theme.tokens;

describe('the shelves', () => {
  it('ships twenty themes across four business groups', () => {
    expect(SPARX_THEMES).toHaveLength(20);
    expect(SPARX_THEME_GROUPS).toHaveLength(4);
    expect(SPARX_THEME_GROUPS.every((g) => g.themes.length === 5)).toBe(true);
  });

  it('gives every theme a unique, URL-safe name', () => {
    const names = SPARX_THEMES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('gives every shelf a unique key', () => {
    const keys = SPARX_THEME_GROUPS.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // A host theme sharing a name with a shipped preset SHADOWS it — the shipped
  // one is dropped. That is a reasonable rule for a deliberate white-label
  // override and a terrible way to discover a typo, so: no overlap.
  it('never shadows one of silica shipped presets', () => {
    const shipped = new Set(THEME_PRESETS.map((t) => t.name));
    const collisions = SPARX_THEMES.map((t) => t.name).filter((n) => shipped.has(n));
    expect(collisions).toEqual([]);
  });
});

describe.each(SPARX_THEMES)('$name', (theme) => {
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

  // base-200/300 must step AWAY from the page in one direction. A ramp that
  // doubles back gives a card and the page behind it the same value, and the
  // layering silently stops existing.
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

  // `fonts` is what publishing self-hosts from; the token is what actually
  // renders. One without the other means the site loads a face it never uses, or
  // renders a face it never loads.
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
