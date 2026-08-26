/**
 * Whether a logo can go see-through, measured rather than assumed.
 *
 * This reports. It never rewrites a chosen color — the caller decides, and a
 * tool that improves on the color you typed is a tool you cannot use.
 */

import { drawSquare, type LoadedImage } from './canvas';
import { contrastRatio, parseHex, toHex, type Rgb } from './color';
import { describeInk, edgeColor, type Ink } from './ink';

/** The two extremes a 16-pixel icon actually lands on: a light browser's white
 *  and a dark browser's near-black. A see-through favicon sits on whichever the
 *  reader chose, so a logo has to survive both. */
export const TAB_LIGHT = '#FFFFFF';
export const TAB_DARK = '#202124';

/** The bar a shape clears to be made out against what it sits on — 3 to 1, the
 *  accessibility standard for non-text (WCAG 1.4.11). Icons are not held to the
 *  4.5 body text is, but below 3 a shape stops being a shape. */
export const LEGIBLE = 3;

const rgbOf = (hex: string): Rgb => parseHex(hex) ?? { r: 0, g: 0, b: 0 };

export interface BackdropReading {
  ink: Ink;
  /** False for an opaque picture: nothing shows through it, so the light-tab /
   *  dark-tab question does not arise. */
  seeThroughMatters: boolean;
  onLight: number;
  onDark: number;
  readsOnLight: boolean;
  readsOnDark: boolean;
  /** True only when it survives BOTH — the question the tool never used to ask. */
  seeThroughWorks: boolean;
  /** A starting point, offered once and never forced: the color giving the logo
   *  the most contrast, not its own average, which would hide it behind itself. */
  suggested: string;
  onSuggested: number;
}

export function readBackdrop(image: LoadedImage): BackdropReading {
  const square = drawSquare(image, { size: 64, fit: 'contain' });
  const ink = describeInk(square);

  const onLight = contrastRatio(ink.rgb, rgbOf(TAB_LIGHT));
  const onDark = contrastRatio(ink.rgb, rgbOf(TAB_DARK));
  const readsOnLight = onLight >= LEGIBLE;
  const readsOnDark = onDark >= LEGIBLE;

  const suggested = suggestFor(image, ink, square, onLight);

  return {
    ink,
    seeThroughMatters: image.hasTransparency,
    onLight,
    onDark,
    readsOnLight,
    readsOnDark,
    seeThroughWorks: !image.hasTransparency || (readsOnLight && readsOnDark),
    suggested,
    onSuggested: contrastRatio(ink.rgb, rgbOf(suggested)),
  };
}

/** An opaque picture brought its own background, so the color belonging in the
 *  leftover strip is the one already running along its edge. A see-through one
 *  gets whichever of white or near-black its ink stands out against. */
function suggestFor(
  image: LoadedImage,
  ink: Ink,
  square: HTMLCanvasElement,
  onLight: number
): string {
  if (!image.hasTransparency) return toHex(edgeColor(square));
  const DARK = '#141414';
  return onLight >= contrastRatio(ink.rgb, rgbOf(DARK)) ? TAB_LIGHT : DARK;
}

/** For copy: "1.1 to 1". */
export const sayRatio = (ratio: number) => `${ratio.toFixed(1)} to 1`;
