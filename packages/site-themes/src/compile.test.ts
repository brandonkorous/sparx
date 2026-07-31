import { describe, it, expect } from 'vitest';
import { compileTokens, getTheme, toCommerceSiteThemeColumns } from './compile';
import { THEME_LIST } from './presets';

describe('compileTokens', () => {
  it('returns complete light + dark token maps from preset defaults', () => {
    const { light, dark } = compileTokens('apex');
    expect(light.colorPrimary).toBe('#4f46e5');
    expect(dark.colorBackground).toBe('#0b1120');
    // Every token key is present (no holes) so the storefront always has a value.
    expect(Object.keys(light)).toContain('containerWidth');
  });

  it('overlays merchant overrides per mode and ignores unknown keys', () => {
    const { light, dark } = compileTokens('apex', {
      light: { colorPrimary: '#ff0000', bogus: 'nope' } as Record<string, string>,
      dark: { colorPrimary: '#00ff00' },
    });
    expect(light.colorPrimary).toBe('#ff0000');
    expect(dark.colorPrimary).toBe('#00ff00');
    // Untouched tokens fall back to the preset default.
    expect(light.colorAccent).toBe('#0ea5e9');
    expect((light as Record<string, string>).bogus).toBeUndefined();
  });

  it('falls back to apex for an unknown theme key', () => {
    expect(getTheme('does-not-exist').key).toBe('apex');
  });

  it('projects light PRESENTATION tokens onto CommerceSiteTheme columns for write-through', () => {
    const { light } = compileTokens('industrial');
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

describe('theme catalog', () => {
  it('ships all six themes with light + dark defaults', () => {
    expect(THEME_LIST.map((t) => t.key)).toEqual([
      'apex',
      'industrial',
      'drift',
      'market',
      'fleet',
      'drop',
    ]);
    for (const theme of THEME_LIST) {
      expect(Object.keys(theme.tokenDefaults.light).length).toBeGreaterThan(0);
      expect(Object.keys(theme.tokenDefaults.dark).length).toBeGreaterThan(0);
    }
  });
});
