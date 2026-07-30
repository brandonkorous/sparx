// Does each theme still paint a legible foreground on the REAL render path?
//
// This is a different question from `themes.test.ts`, and the difference is the
// whole reason this file exists.
//
// `themes.test.ts` asks silica's `resolveThemeTokens` — which MEASURES contrast in
// JS — whether every role gets a legible ink. But nothing in sparx calls that at
// runtime: `buildSilicaThemeCssFromTheme` (@sparx/site-themes) emits `theme.tokens`
// and `theme.dark` verbatim into a `:root` block, so the storefront never sees a
// precomputed `--color-<role>-content`. silicaui's CSS `autoContent` fallback
// resolves it instead, and CSS cannot measure contrast — it compares OKLCH
// LIGHTNESS against `--silica-content-threshold` (0.68) and takes dark ink above,
// light ink below.
//
// Those two rules disagree across a band (silica's own contrast.ts puts the real
// crossover anywhere from l≈0.54 to l≈0.59 depending on chroma and hue). A role
// sitting in the gap is measured as needing dark ink and PAINTED with white — a
// button label that passes every test we had and fails on the live site. That is
// exactly the defect that made silica compute ink in JS in the first place; it hit
// seven role colors across its original four presets.
//
// So: for every role, in every mode, the threshold's choice must AGREE with the
// measured one. Themes are authored to sit clear of the band rather than to sit in
// it and hope the host resolves — which keeps them correct under either path.

import { describe, expect, it } from 'vitest';
import { SEMANTIC_ROLES, deriveContent, parseColor } from '@wizeworks/silicaui-html';

import { SPARX_THEMES } from './themes';

/** silica's CSS-only rule, reproduced exactly: dark ink above the threshold, light
 *  ink below. `--silica-content-threshold` defaults to 0.68. */
const CSS_THRESHOLD = 0.68;
const cssInkFor = (color: string): 'light' | 'dark' | null => {
  const parsed = parseColor(color);
  if (!parsed) return null;
  return parsed.l > CSS_THRESHOLD ? 'dark' : 'light';
};

const MODES = ['light', 'dark'] as const;

describe.each(SPARX_THEMES)('$name — ink survives the CSS fallback', (theme) => {
  it.each(MODES)('%s mode: every role agrees with the measured ink', (mode) => {
    const bag = mode === 'dark' ? { ...theme.tokens, ...theme.dark } : theme.tokens;
    const disagreements: string[] = [];

    for (const role of SEMANTIC_ROLES) {
      const color = bag[`--color-${role}`];
      if (!color) continue;
      // An explicitly authored `-content` wins in both paths, so it can't disagree.
      if (bag[`--color-${role}-content`]) continue;

      const measured = deriveContent(color);
      const css = cssInkFor(color);
      if (!measured || !css) continue;

      if (measured.ink !== css) {
        const l = parseColor(color)!.l.toFixed(3);
        disagreements.push(
          `${role} (${color}, l=${l}): measured wants ${measured.ink} ink at ` +
            `${measured.ratio}:1, CSS threshold paints ${css}`
        );
      }
    }

    expect(disagreements, disagreements.join('\n')).toEqual([]);
  });

  // The band itself. Staying out of l 0.54–0.68 is what makes the agreement above
  // robust rather than lucky — a later nudge of two points can't flip an ink.
  it.each(MODES)('%s mode: no role sits in the ambiguous lightness band', (mode) => {
    const bag = mode === 'dark' ? { ...theme.tokens, ...theme.dark } : theme.tokens;
    const inBand: string[] = [];
    for (const role of SEMANTIC_ROLES) {
      const color = bag[`--color-${role}`];
      if (!color || bag[`--color-${role}-content`]) continue;
      const l = parseColor(color)?.l;
      if (l !== undefined && l > 0.54 && l <= CSS_THRESHOLD) {
        inBand.push(`${role} (${color}, l=${l.toFixed(3)})`);
      }
    }
    expect(inBand, `roles in the 0.54–0.68 ink-ambiguity band:\n${inBand.join('\n')}`).toEqual([]);
  });
});
