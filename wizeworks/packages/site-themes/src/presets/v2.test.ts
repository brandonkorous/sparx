// The platform base preset. This file used to iterate six themes; the six are
// retired (see presets/index.ts) and what it guards now is the ONE fallback — which
// matters more, not less, because every unthemed site in the platform wears it.

import { describe, expect, it } from 'vitest';
import { compileTokensV2 } from '../v2/compile';
import { colorToHex, contrastRatio } from '../v2/color';
import type { CompiledColorTokensV2 } from '../v2/types';
import { PLATFORM_PRESET_V2, PLATFORM_TOKEN_DEFAULTS } from './index';

/**
 * silicaui's `quartz` baseline, verbatim — the OKLCH these hexes are converted FROM.
 *
 * Written out rather than imported because @wizeworks/site-themes is dependency-free
 * by design and cannot reach `@wizeworks/silicaui-html`. `colorToHex` is this
 * package's own converter (the one transactional email flattens a theme with), so
 * the check below is a real derivation rather than a restatement of the values.
 *
 * The silica-catalog side pins the same baseline against the upstream package
 * itself, in `base-theme.test.ts`.
 */
const UPSTREAM_QUARTZ = {
  light: {
    base100: 'oklch(98% 0.003 250)',
    base200: 'oklch(95% 0.004 250)',
    base300: 'oklch(90% 0.006 250)',
    baseContent: 'oklch(21% 0.012 255)',
    primary: 'oklch(42% 0.055 252)',
    primaryContent: 'oklch(98% 0.01 252)',
    secondary: 'oklch(55% 0.035 255)',
    secondaryContent: 'oklch(98% 0.01 255)',
    accent: 'oklch(64% 0.13 211)',
    accentContent: 'oklch(15% 0.02 211)',
    neutral: 'oklch(26% 0.014 255)',
    neutralContent: 'oklch(98% 0.01 255)',
    info: 'oklch(68% 0.1 232)',
    success: 'oklch(70% 0.12 150)',
    warning: 'oklch(80% 0.11 85)',
    // danger←error, highlight←accent, border←base-300: the three roles silica does
    // not model, mapped the way every shipped theme maps them.
    danger: 'oklch(58% 0.17 25)',
    highlight: 'oklch(64% 0.13 211)',
    highlightContent: 'oklch(15% 0.02 211)',
    border: 'oklch(90% 0.006 250)',
  },
  dark: {
    base100: 'oklch(16% 0.01 255)',
    base200: 'oklch(13.5% 0.01 255)',
    base300: 'oklch(11% 0.01 255)',
    baseContent: 'oklch(93% 0.006 250)',
    primary: 'oklch(72% 0.06 252)',
    primaryContent: 'oklch(15% 0.02 252)',
    secondary: 'oklch(78% 0.035 255)',
    secondaryContent: 'oklch(15% 0.02 255)',
    accent: 'oklch(72% 0.13 211)',
    accentContent: 'oklch(15% 0.02 211)',
    neutral: 'oklch(32% 0.016 255)',
    neutralContent: 'oklch(98% 0.01 255)',
    info: 'oklch(74% 0.09 232)',
    success: 'oklch(75% 0.11 150)',
    warning: 'oklch(83% 0.1 85)',
    danger: 'oklch(66% 0.18 25)',
    highlight: 'oklch(72% 0.13 211)',
    highlightContent: 'oklch(15% 0.02 211)',
    border: 'oklch(11% 0.01 255)',
  },
} as const;

describe('platform base preset', () => {
  it('states every color slot as a hex, in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const slot of [
        'base100',
        'base200',
        'base300',
        'baseContent',
        'primary',
        'secondary',
        'accent',
        'neutral',
        'info',
        'success',
        'warning',
        'danger',
        'border',
      ] as const) {
        expect(PLATFORM_PRESET_V2[mode][slot], `${mode}.${slot}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('states the shared shape, rhythm and effect', () => {
    expect(PLATFORM_PRESET_V2.shared.radiusBox).toBeTruthy();
    expect(PLATFORM_PRESET_V2.shared.spaceBase).toBeTruthy();
    expect(typeof PLATFORM_PRESET_V2.shared.depth).toBe('number');
  });

  // The reason this assertion exists: the v2 fallback used to be apex's INDIGO while
  // the storefront's no-theme fallback was a different look again, so an unthemed
  // site rendered one color live and compiled another. One baseline on both sides is
  // the fix; deriving it from the upstream OKLCH is what holds it.
  it("is silicaui's quartz baseline, slot for slot", () => {
    for (const mode of ['light', 'dark'] as const) {
      const expected = UPSTREAM_QUARTZ[mode];
      for (const slot of Object.keys(expected) as (keyof typeof expected)[]) {
        expect(PLATFORM_PRESET_V2[mode][slot], `${mode}.${slot}`).toBe(colorToHex(expected[slot]));
      }
    }
  });

  // The defect this preset was carrying: the fallback every un-themed site of EVERY
  // brand reaches was one product's flagship look, so a shop signed up under one
  // brand served the other brand's primary to its own shoppers
  // (piggles/docs/personas/issues/343). The values above make that impossible by
  // construction; this states it as the rule rather than leaving it implied, and
  // names the two hexes that were actually on the screen.
  it('wears no product brand color', () => {
    const painted = [
      ...Object.values(PLATFORM_PRESET_V2.light),
      ...Object.values(PLATFORM_PRESET_V2.dark),
      ...Object.values(PLATFORM_TOKEN_DEFAULTS.light),
      ...Object.values(PLATFORM_TOKEN_DEFAULTS.dark),
    ];
    for (const brandHex of ['#e04631', '#f2604b', '#ff6f86']) {
      expect(painted, brandHex).not.toContain(brandHex);
    }
  });

  // The v1 bag is legacy and renders nothing, but transactional email still derives
  // its fallback palette from these keys — so a base change that skipped it would
  // leave un-themed tenants' MAIL on the old look while their site moved.
  it('agrees with the v1 defaults transactional email still reads', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(PLATFORM_TOKEN_DEFAULTS[mode].colorPrimary).toBe(PLATFORM_PRESET_V2[mode].primary);
      expect(PLATFORM_TOKEN_DEFAULTS[mode].colorAccent).toBe(PLATFORM_PRESET_V2[mode].accent);
      expect(PLATFORM_TOKEN_DEFAULTS[mode].colorBackground).toBe(PLATFORM_PRESET_V2[mode].base100);
      expect(PLATFORM_TOKEN_DEFAULTS[mode].colorForeground).toBe(
        PLATFORM_PRESET_V2[mode].baseContent
      );
      expect(PLATFORM_TOKEN_DEFAULTS[mode].colorMuted).toBe(PLATFORM_PRESET_V2[mode].base200);
      expect(PLATFORM_TOKEN_DEFAULTS[mode].colorBorder).toBe(PLATFORM_PRESET_V2[mode].border);
    }
  });

  it('compiles to a stable token set', () => {
    expect(compileTokensV2(PLATFORM_PRESET_V2)).toMatchSnapshot();
  });

  // STATUS text must clear AA for normal text (4.5) on its own fill. These colors
  // are the platform's, not the brand's, so there is no reason for them not to.
  it('clears AA for status content', () => {
    const c = compileTokensV2(PLATFORM_PRESET_V2);
    for (const mode of ['light', 'dark'] as const) {
      const t: CompiledColorTokensV2 = c[mode];
      for (const [label, base, content] of [
        ['danger', t.danger, t.dangerContent],
        ['success', t.success, t.successContent],
        ['info', t.info, t.infoContent],
        ['warning', t.warning, t.warningContent],
      ] as const) {
        expect(contrastRatio(base, content), `${mode}.${label}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // THE IDENTITY PAIRS CLEAR AA TOO, and that is new. This floor used to be AA-Large
  // (3.0) because the base was a product's brand and two of its pairs sat under AA
  // for normal text — white on that primary at 4.13:1, near-white on its accent at
  // 3.83:1 — carried as a documented exception because they were the shipped brand
  // and the base had to match what sites actually rendered.
  //
  // The base belongs to no product now, so nothing is owed to a brand board and the
  // floor is the real one. The tightest pair here is light `secondary` at 4.57:1.
  // Dropping back to 3.0 to admit a color would be reintroducing the exception.
  it('keeps every identity pair above AA for normal text', () => {
    const c = compileTokensV2(PLATFORM_PRESET_V2);
    for (const mode of ['light', 'dark'] as const) {
      const t: CompiledColorTokensV2 = c[mode];
      for (const [label, base, content] of [
        ['primary', t.primary, t.primaryContent],
        ['secondary', t.secondary, t.secondaryContent],
        ['accent', t.accent, t.accentContent],
      ] as const) {
        expect(contrastRatio(base, content), `${mode}.${label}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
