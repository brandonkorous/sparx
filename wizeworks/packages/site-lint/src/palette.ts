// What a theme's token names actually PAINT.
//
// A silica `Theme` is a bag of CSS custom properties, and three things about it have
// to be reproduced faithfully or the contrast check judges colors nobody sees:
//
//   1. FORMAT. A shipped preset writes every token as `oklch(98% 0.003 250)`; a
//      sparx-compiled tenant theme writes hex; an authored theme keeps whatever the
//      Design inspector produced. `parseColor` handles all three and returns null for
//      anything else, which is the signal to decline rather than guess.
//   2. THE `-content` FALLBACK. A theme need not define `--color-primary-content`.
//      silicaui derives one in CSS with relative-color syntax: read the color's OKLCH
//      lightness and flip to white below `--silica-content-threshold`, black above.
//      Reproduced here via `inkForLightness`, threshold override included — a theme that
//      moves the threshold moves every derived foreground on the site with it.
//      The threshold itself is NOT duplicated here any more: this file carried its own
//      `0.68` for five silicaui releases after upstream moved to `0.57` in 0.36.0, so
//      every verdict about a color between the two was wrong — white measured against a
//      fill the site actually paints black ink on. That is a false alarm on a correct
//      theme, or a pass on an illegible one, and nothing pointed at it.
//   3. THE `soft` TINT. `color-mix(in oklab, <accent> 15%, var(--color-base-100))`,
//      mixed in OKLab because that is the space the browser mixes in.
//
// Dark mode is a first-class second answer, not an afterthought: `Theme.dark` is a
// set of per-token deltas, and a site carrying one genuinely renders both ways.

import { SILICA_CONTENT_THRESHOLD, inkForLightness } from '@wizeworks/silica-catalog';
import {
  contrastOf,
  cssLightness,
  mixOklab,
  parseColor,
  type Rgb,
} from '@wizeworks/site-themes/color';
import type { Theme } from '@wizeworks/silicaui-html';

/** The two inks silicaui's auto-derivation flips between — pure white and pure
 *  black, since `oklch(1 0 0)` and `oklch(0 0 0)` are what the CSS produces. */
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** The share of the accent color silica's `soft` treatment mixes into `base-100`. */
const SOFT_MIX = 0.15;

export interface Palette {
  mode: 'light' | 'dark';
  /** A `--color-<name>` token as a color, or null when the theme does not define it
   *  and it cannot be derived. */
  color(name: string): Rgb | null;
  /** The default page surface (`base-100`) and the ink that sits on it
   *  (`base-content`) — what a node inherits when nothing has painted anything. */
  surface: Rgb | null;
  ink: Rgb | null;
  /** silica's `soft` background for a given accent. */
  softBackground(accent: string): Rgb | null;
  /** Every semantic pair the theme carries, resolved. */
  pairs(): { name: string; color: Rgb; content: Rgb; derived: boolean }[];
}

/** The token names that are SURFACES rather than roles — they have one shared ink
 *  (`base-content`) instead of a `-content` of their own. */
const SURFACES = new Set(['base-100', 'base-200', 'base-300']);

/**
 * Resolve a theme for one mode.
 *
 * `mode` selects which set of values wins: silica's rule is that a `dark` delta
 * overrides the base token, and an absent delta falls through to it.
 */
export function paletteOf(theme: Theme, mode: 'light' | 'dark'): Palette {
  const raw = (token: string): string | undefined => {
    if (mode === 'dark') {
      const delta = theme.dark?.[token];
      if (delta !== undefined) return delta;
    }
    return theme.tokens[token];
  };

  const threshold = Number.parseFloat(raw('--silica-content-threshold') ?? '');
  const contentThreshold = Number.isFinite(threshold) ? threshold : SILICA_CONTENT_THRESHOLD;

  const cache = new Map<string, Rgb | null>();

  const color = (name: string): Rgb | null => {
    const hit = cache.get(name);
    if (hit !== undefined) return hit;
    cache.set(name, null); // guards a token that somehow references itself
    const resolved = resolve(name);
    cache.set(name, resolved);
    return resolved;
  };

  const resolve = (name: string): Rgb | null => {
    const direct = parseColor(raw(`--color-${name}`));
    if (direct) return direct;

    // An undefined `-content` is not missing — silicaui derives it. A surface
    // (`base-200-content`) has no derivation of its own: the base ink is what sits
    // on the whole neutral ramp.
    if (name.endsWith('-content')) {
      const base = name.slice(0, -'-content'.length);
      if (SURFACES.has(base)) return color('base-content');
      // Read the lightness off the TOKEN, not off a round-tripped sRGB value —
      // `cssLightness` explains why a threshold comparison cannot tolerate the drift.
      const lightness = cssLightness(raw(`--color-${base}`));
      if (lightness === null) return null;
      return inkForLightness(lightness, contentThreshold) === 'light' ? WHITE : BLACK;
    }
    return null;
  };

  const surface = color('base-100');

  return {
    mode,
    color,
    surface,
    ink: color('base-content'),
    softBackground(accent: string): Rgb | null {
      const tint = color(accent);
      if (!tint || !surface) return null;
      return mixOklab(tint, surface, SOFT_MIX);
    },
    pairs() {
      const out: { name: string; color: Rgb; content: Rgb; derived: boolean }[] = [];
      for (const token of Object.keys({
        ...theme.tokens,
        ...(mode === 'dark' ? theme.dark : {}),
      })) {
        const name = token.startsWith('--color-') ? token.slice('--color-'.length) : null;
        if (!name || name.endsWith('-content') || SURFACES.has(name)) continue;
        const base = color(name);
        const content = color(`${name}-content`);
        if (!base || !content) continue;
        out.push({
          name,
          color: base,
          content,
          derived: parseColor(raw(`--color-${name}-content`)) === null,
        });
      }
      return out;
    },
  };
}

export { contrastOf };
export type { Rgb };
