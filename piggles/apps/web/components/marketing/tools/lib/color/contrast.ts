import type { Rgb } from './convert';

/**
 * Relative luminance, per WCAG 2.
 *
 * The gamma expansion is the part that gets dropped by anybody reimplementing
 * this from memory — the channel values have to be linearised before they are
 * weighted, and skipping it produces numbers that look plausible and are wrong
 * by enough to pass a failing pair. The 0.2126 / 0.7152 / 0.0722 weights are how
 * much each channel contributes to perceived brightness: green does most of the
 * work, blue almost none, which is why blue text on black is so hard to read
 * even though the two colours are "obviously" different.
 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastVerdict {
  ratio: number;
  /** WCAG AA, normal text (< 24px, or < 19px bold). */
  aaNormal: boolean;
  /** WCAG AA, large text (>= 24px, or >= 19px bold). */
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  /** Interface elements: icons, chart lines, input borders. */
  uiComponents: boolean;
  /** The smallest size this pair is usable at, in plain words. Null when it
   *  fails everything — and the UI must say so rather than printing a size. */
  smallestUsable: string | null;
}

export function gradeContrast(fg: Rgb, bg: Rgb): ContrastVerdict {
  const ratio = contrastRatio(fg, bg);
  const aaNormal = ratio >= 4.5;
  const aaLarge = ratio >= 3;

  return {
    ratio,
    aaNormal,
    aaLarge,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    uiComponents: ratio >= 3,
    smallestUsable: aaNormal
      ? 'Any size, including small print'
      : aaLarge
        ? 'Large text only — 24px, or 19px if bold'
        : null,
  };
}

/** Black or white, whichever is more readable on the given colour. The naive
 *  test is "is lightness above 50%", which puts white on mid-yellow and fails
 *  badly; measuring both ratios is barely more work and is simply correct. */
export function readableInk(bg: Rgb): Rgb {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  return contrastRatio(black, bg) >= contrastRatio(white, bg) ? black : white;
}
