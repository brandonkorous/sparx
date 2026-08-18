// The platform base preset. This file used to iterate six themes; the six are
// retired (see presets/index.ts) and what it guards now is the ONE fallback — which
// matters more, not less, because every unthemed site in the platform wears it.

import { describe, expect, it } from 'vitest';
import { compileTokensV2 } from '../v2/compile';
import { contrastRatio } from '../v2/color';
import type { CompiledColorTokensV2 } from '../v2/types';
import { PLATFORM_PRESET_V2 } from './v2';

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
  // the storefront's no-theme fallback was Ember, so an unthemed site rendered one
  // color live and compiled another. Ember on both sides is the fix; this holds it.
  it('is the sparx Ember base, agreeing with BASE_SILICA_THEME', () => {
    expect(PLATFORM_PRESET_V2.light.primary).toBe('#e04631');
    expect(PLATFORM_PRESET_V2.dark.primary).toBe('#f2604b');
    expect(PLATFORM_PRESET_V2.light.base100).toBe('#ffffff');
    expect(PLATFORM_PRESET_V2.dark.base100).toBe('#0b1120');
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

  // IDENTITY IS A KNOWN EXCEPTION, ASSERTED RATHER THAN HIDDEN. The sparx brand pairs
  // white with Ember (#e04631 → 4.13:1) and near-white with its accent (#c1652e →
  // 3.83:1): both over AA-Large (3.0) and under AA for normal text (4.5). Those pairs
  // are the shipped brand, stated verbatim in `BASE_SILICA_THEME`, and this base
  // carries them rather than quietly deriving different foregrounds — which would put
  // the platform default out of step with the look every site actually renders.
  //
  // Bounded here so it cannot silently get worse: the floor is AA-Large, and a change
  // that drops an identity pair below 3.0 fails. Raising it to 4.5 is a BRAND
  // decision (a darker Ember, or dark text on the fill), not one to make in a preset.
  it('keeps brand identity above AA-Large, the known Ember exception', () => {
    const c = compileTokensV2(PLATFORM_PRESET_V2);
    for (const mode of ['light', 'dark'] as const) {
      const t: CompiledColorTokensV2 = c[mode];
      for (const [label, base, content] of [
        ['primary', t.primary, t.primaryContent],
        ['secondary', t.secondary, t.secondaryContent],
        ['accent', t.accent, t.accentContent],
      ] as const) {
        expect(contrastRatio(base, content), `${mode}.${label}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
