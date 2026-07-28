import { describe, expect, it } from 'vitest';
import {
  contrastOf,
  contrastRatio,
  cssLightness,
  deriveContent,
  mixOklab,
  normalizeHex,
  oklchToRgb,
  parseColor,
  relativeLuminance,
} from './color';

describe('normalizeHex', () => {
  it('expands shorthand and lowercases', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('4F46E5')).toBe('#4f46e5');
    expect(normalizeHex('  #FFFFFF ')).toBe('#ffffff');
  });

  it('returns null for non-hex input', () => {
    expect(normalizeHex('rebeccapurple')).toBeNull();
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex(null)).toBeNull();
    expect(normalizeHex('#12')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white and symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('is 1:1 for identical colors', () => {
    expect(contrastRatio('#4f46e5', '#4f46e5')).toBeCloseTo(1, 5);
  });
});

describe('relativeLuminance', () => {
  it('bounds at black and white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('parseColor', () => {
  it('reads the three formats the platform actually stores', () => {
    expect(parseColor('#4f46e5')).toEqual({ r: 0x4f, g: 0x46, b: 0xe5 });
    expect(parseColor('rgb(20, 30, 40)')).toEqual({ r: 20, g: 30, b: 40 });
    // silicaui's own presets are written like this.
    expect(parseColor('oklch(100% 0 0)')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('oklch(0% 0 0)')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('returns null rather than black for a color it cannot read', () => {
    // The distinction is the whole contract: a caller must be able to tell
    // "unresolvable" from "resolved to black", because the only safe thing to do with
    // the first is decline to judge it.
    expect(parseColor('color-mix(in oklab, red 15%, white)')).toBeNull();
    expect(parseColor('var(--color-primary)')).toBeNull();
    expect(parseColor('rebeccapurple')).toBeNull();
    expect(parseColor('')).toBeNull();
  });

  it('round-trips a mid-tone OKLCH close enough to judge contrast on', () => {
    const rgb = oklchToRgb(0.68, 0.1, 232);
    expect(rgb.b).toBeGreaterThan(rgb.r); // it is a blue
    expect(contrastOf(rgb, { r: 0, g: 0, b: 0 })).toBeGreaterThan(6);
  });
});

describe('cssLightness', () => {
  it('reads OKLCH lightness off the value, exactly', () => {
    // Not "close to": silicaui's auto-foreground rule is a THRESHOLD comparison at
    // 0.68, so a token written as `oklch(68% …)` has to read back as exactly 0.68 or
    // it flips to the opposite ink. Going through sRGB reads 0.6798 and picks white,
    // turning a 7.4:1 pairing into a reported 2.8:1 failure.
    expect(cssLightness('oklch(68% 0.1 232)')).toBe(0.68);
    expect(cssLightness('oklch(0.42 0.055 252)')).toBe(0.42);
  });

  it('falls back to deriving it for a non-OKLCH color', () => {
    expect(cssLightness('#ffffff')).toBeCloseTo(1, 2);
    expect(cssLightness('#000000')).toBeCloseTo(0, 2);
  });

  it('is null for a color it cannot read', () => {
    expect(cssLightness('var(--x)')).toBeNull();
  });
});

describe('mixOklab', () => {
  it('is the identity at the ends', () => {
    const a = { r: 29, g: 78, b: 216 };
    const b = { r: 255, g: 255, b: 255 };
    expect(mixOklab(a, b, 1)).toEqual(a);
    expect(mixOklab(a, b, 0)).toEqual(b);
  });

  it("produces silica's soft tint — much closer to the surface than to the accent", () => {
    // `color-mix(in oklab, <accent> 15%, var(--color-base-100))`. The result has to be
    // pale enough that white text fails on it, which is the finding the soft rule
    // exists for.
    const tint = mixOklab({ r: 29, g: 78, b: 216 }, { r: 255, g: 255, b: 255 }, 0.15);
    expect(contrastOf(tint, { r: 255, g: 255, b: 255 })).toBeLessThan(2);
    expect(contrastOf(tint, { r: 29, g: 78, b: 216 })).toBeGreaterThan(3);
  });
});

describe('deriveContent', () => {
  it('picks white on a dark/saturated brand color', () => {
    expect(deriveContent('#4f46e5')).toBe('#ffffff'); // indigo
    expect(deriveContent('#0b1120')).toBe('#ffffff'); // near-black surface
  });

  it('picks near-black on a light surface', () => {
    expect(deriveContent('#ffffff')).toBe('#0a0a0a');
    expect(deriveContent('#f1f5f9')).toBe('#0a0a0a');
    expect(deriveContent('#fbbf24')).toBe('#0a0a0a'); // amber warning
  });

  it('always returns the higher-contrast of the two inks', () => {
    const base = '#777777';
    const chosen = deriveContent(base);
    const other = chosen === '#ffffff' ? '#0a0a0a' : '#ffffff';
    expect(contrastRatio(base, chosen)).toBeGreaterThanOrEqual(contrastRatio(base, other));
  });
});
