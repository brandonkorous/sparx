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
//
// ── THIS FILE WAS RED FOR FIVE RELEASES, AND THE THEMES WERE NEVER WRONG ────────────
// It carried its own `CSS_THRESHOLD = 0.68` while silicaui moved the default to 0.57 in
// 0.36.0 — the same release whose other eleven answers we adopted. Every one of the 10
// failures was the stale constant accusing a correctly-authored theme: measured against
// the REAL threshold, all 320 role slots across 20 themes agree, none sits in the
// crossover band, and every derived ink clears AA. The threshold now comes from
// `content-ink.ts`, which both this audit and site-lint's live contrast check read, so
// the next drift cannot hit only one of them.
//
// The boundary was wrong too, and in the opposite direction from site-lint's copy: `l >
// t ? dark : light` versus `l < t ? light : dark` differ at exactly `l === t`. That is
// `inkForLightness`'s job now, and its doc comment states which one the CSS agrees with.

import { describe, expect, it } from 'vitest';
import { SEMANTIC_ROLES, deriveContent, parseColor } from '@wizeworks/silicaui-html';

import { SILICA_CONTENT_THRESHOLD, inkForLightness } from './content-ink';
import { SPARX_THEMES } from './themes';

const cssInkFor = (color: string): 'light' | 'dark' | null => {
  const parsed = parseColor(color);
  if (!parsed) return null;
  return inkForLightness(parsed.l);
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

  // The band itself. Staying out of it is what makes the agreement above robust rather
  // than lucky — a later nudge of two points can't flip an ink.
  //
  // The band is the REAL crossover (l ≈ 0.54–0.59), where which ink wins depends on
  // chroma and hue so no constant threshold can be right. It is NOT "0.54 up to the
  // threshold": the threshold now sits INSIDE the crossover rather than above it, which
  // is the whole point of 0.57, and asserting up to it would flag colors that agree.
  const BAND_LO = 0.54;
  const BAND_HI = 0.59;

  it.each(MODES)('%s mode: no role sits in the ambiguous lightness band', (mode) => {
    const bag = mode === 'dark' ? { ...theme.tokens, ...theme.dark } : theme.tokens;
    const inBand: string[] = [];
    for (const role of SEMANTIC_ROLES) {
      const color = bag[`--color-${role}`];
      if (!color || bag[`--color-${role}-content`]) continue;
      const l = parseColor(color)?.l;
      if (l !== undefined && l > BAND_LO && l < BAND_HI) {
        inBand.push(`${role} (${color}, l=${l.toFixed(3)})`);
      }
    }
    expect(
      inBand,
      `roles in the ${BAND_LO}–${BAND_HI} ink-ambiguity band (threshold ${SILICA_CONTENT_THRESHOLD}):\n${inBand.join('\n')}`
    ).toEqual([]);
  });

  // Agreement is not legibility. A mid-tone, high-chroma color can have NO legible ink —
  // both candidates land under 4.5:1 — and both checks above would still pass it, because
  // the two paths agree perfectly on which of two bad inks to use. `passesAA` is silica's
  // own verdict on the winner, so this asserts the thing an author actually cares about:
  // that the label on this button can be read at all.
  it.each(MODES)('%s mode: the winning ink clears AA on every role', (mode) => {
    const bag = mode === 'dark' ? { ...theme.tokens, ...theme.dark } : theme.tokens;
    const illegible: string[] = [];
    for (const role of SEMANTIC_ROLES) {
      const color = bag[`--color-${role}`];
      if (!color || bag[`--color-${role}-content`]) continue;
      const derived = deriveContent(color);
      if (derived && !derived.passesAA) {
        illegible.push(`${role} (${color}): best ink is ${derived.ink} at only ${derived.ratio}:1`);
      }
    }
    expect(illegible, `no legible ink exists for:\n${illegible.join('\n')}`).toEqual([]);
  });
});
