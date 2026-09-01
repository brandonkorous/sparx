import { describe, it, expect } from 'vitest';
import { compileTokens, compileTokensFromDefaults, toCommerceSiteThemeColumns } from './compile';
import { PLATFORM_TOKEN_DEFAULTS } from './presets';

describe('compileTokens', () => {
  // Read off the base rather than restated as literals. The point of the assertion
  // is that an un-overridden compile IS the base, and spelling the colors out here
  // made this a third place the base's values were written down — one that has to be
  // hand-edited every time the base moves, and that says nothing when it isn't.
  it('returns complete light + dark token maps from the platform base', () => {
    const { light, dark } = compileTokens();
    expect(light.colorPrimary).toBe(PLATFORM_TOKEN_DEFAULTS.light.colorPrimary);
    expect(dark.colorBackground).toBe(PLATFORM_TOKEN_DEFAULTS.dark.colorBackground);
    // Every token key is present (no holes) so the storefront always has a value.
    expect(Object.keys(light)).toContain('containerWidth');
  });

  it('overlays merchant overrides per mode and ignores unknown keys', () => {
    const { light, dark } = compileTokens({
      light: { colorPrimary: '#ff0000', bogus: 'nope' } as Record<string, string>,
      dark: { colorPrimary: '#00ff00' },
    });
    expect(light.colorPrimary).toBe('#ff0000');
    expect(dark.colorPrimary).toBe('#00ff00');
    // Untouched tokens fall back to the base default.
    expect(light.colorAccent).toBe(PLATFORM_TOKEN_DEFAULTS.light.colorAccent);
    expect((light as Record<string, string>).bogus).toBeUndefined();
  });

  // The seam a real theme goes through: it carries its OWN defaults, so nothing is
  // resolved by key. `compileTokens` took a themeKey and looked one of six presets
  // up; a slug that named any of the forty shipped themes missed and silently
  // compiled the default, which is why the key argument is gone rather than widened.
  it('compiles a theme that brings its own defaults, with no registry lookup', () => {
    const own = {
      light: { ...PLATFORM_TOKEN_DEFAULTS.light, colorPrimary: '#123456' },
      dark: { ...PLATFORM_TOKEN_DEFAULTS.dark, colorPrimary: '#654321' },
    };
    const { light, dark } = compileTokensFromDefaults(own);
    expect(light.colorPrimary).toBe('#123456');
    expect(dark.colorPrimary).toBe('#654321');
  });

  it('projects light PRESENTATION tokens onto CommerceSiteTheme columns for write-through', () => {
    const { light } = compileTokens();
    const cols = toCommerceSiteThemeColumns(light);
    // Presentation tokens are written through.
    expect(cols.colorBackground).toBe(light.colorBackground);
    expect(cols.colorMuted).toBe(light.colorMuted);
    expect(cols.radiusBase).toBe(light.radiusBase);
    // Identity tokens are brand-owned (docs/30 §6) — NOT written through.
    expect(cols.colorPrimary).toBeUndefined();
    expect(cols.fontHeading).toBeUndefined();
    // colorForeground/colorBorder/containerWidth have no column either.
    expect(cols.colorForeground).toBeUndefined();
    expect(cols.containerWidth).toBeUndefined();
  });
});

// `tokensToCssVars` was tested here — it projected each token key onto `--st-*`
// custom properties (dual-writing a `--color-*` twin for some). Both it and the
// vocabulary are deleted: tokens are a DATA contract now
// (`SiteVersion.compiledTokens`), and CSS is emitted only by the v2 engine's silica
// projection. See docs/implementation/st-token-retirement.md.
//
// The `theme catalog` block that followed asserted the six presets shipped light +
// dark defaults. There is no v1 catalog to assert: the shipped themes are the forty
// in @wizeworks/silica-catalog, guarded by first-party-themes.test.ts.
