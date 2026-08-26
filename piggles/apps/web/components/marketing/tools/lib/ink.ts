/**
 * What color a picture is actually drawn in — the pixel side of the color
 * question. The maths itself lives in `./color`; this only reads canvases.
 */

import { canvasToRgba } from './canvas';
import { relativeLuminance, toHex, type Rgb } from './color';

export interface Ink {
  /** The average color of the pixels the logo actually draws. */
  color: string;
  rgb: Rgb;
  luminance: number;
  /** How much of the square the logo covers, 0 to 1. Below ~0.02 there is too
   *  little drawn to say anything useful about it. */
  coverage: number;
}

/**
 * The color of the marks, not of the picture: see-through pixels are skipped.
 * Averaging the empty space in drags every reading towards black, which makes a
 * pale logo — the one that vanishes on a light tab — look like a safe one.
 */
export function describeInk(canvas: HTMLCanvasElement): Ink {
  const data = canvasToRgba(canvas);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    n++;
  }
  if (n === 0) {
    const white = { r: 255, g: 255, b: 255 };
    return { color: '#FFFFFF', rgb: white, luminance: 1, coverage: 0 };
  }
  const rgb = { r: r / n, g: g / n, b: b / n };
  return {
    color: toHex(rgb),
    rgb,
    luminance: relativeLuminance(rgb),
    coverage: n / (data.length / 4),
  };
}

/**
 * The color running around the OUTSIDE of a picture — its own background, for
 * one that is already opaque. That is the right fill for the strip left when a
 * rectangle is fitted into a square; anything else draws a band down two edges.
 */
export function edgeColor(canvas: HTMLCanvasElement): Rgb {
  const data = canvasToRgba(canvas);
  const w = canvas.width;
  const h = canvas.height;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3]! < 128) return;
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    n++;
  };
  for (let x = 0; x < w; x++) {
    take(x, 0);
    take(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    take(0, y);
    take(w - 1, y);
  }
  return n === 0 ? { r: 255, g: 255, b: 255 } : { r: r / n, g: g / n, b: b / n };
}
