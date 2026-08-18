'use client';

import { BRAND } from '@piggles/brand';
import { parseHex, readableInk, toHex } from '../lib/color';
import { downloadDataUrl } from '../lib/download';
import { encode, type Palette } from './model';

/** A palette is a thing people send to somebody else. Two ways out, because the
 *  two recipients are different: a link for the person who will keep editing it,
 *  a picture for the person who just has to approve it. */
export function shareLink(palette: Palette): string {
  const url = new URL(window.location.href);
  url.searchParams.set('c', encode(palette));
  return url.toString();
}

const WIDTH = 1200;
const HEIGHT = 630;
const FOOT = 84;

/**
 * The palette as a picture, at social-card proportions.
 *
 * Drawn at 2× and scaled down by the `width`/`height` attributes' relationship
 * to the CSS size — text rendered at 1× on a canvas destined for a retina screen
 * is visibly soft, and this is an image whose whole job is to be looked at.
 */
export function downloadCard(palette: Palette): void {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * 2;
  canvas.height = HEIGHT * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(2, 2);

  const band = HEIGHT - FOOT;
  const column = WIDTH / palette.length;

  palette.forEach((swatch, i) => {
    const rgb = parseHex(swatch.hex);
    if (!rgb) return;
    ctx.fillStyle = swatch.hex;
    ctx.fillRect(i * column, 0, Math.ceil(column) + 1, band);

    ctx.fillStyle = toHex(readableInk(rgb));
    ctx.font = 'bold 30px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(swatch.hex, i * column + column / 2, band - 40);
  });

  // Canvas cannot resolve a CSS custom property, so the footer reads its colors
  // from `@piggles/brand` — the same escape the edge OG routes take, and the
  // same reason.
  ctx.fillStyle = BRAND.ink;
  ctx.fillRect(0, band, WIDTH, FOOT);
  ctx.fillStyle = BRAND.inkContent;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Made with the free color palette maker', 40, band + 53);
  ctx.textAlign = 'right';
  ctx.fillStyle = BRAND.primary;
  ctx.fillText('meetpiggles.com', WIDTH - 40, band + 53);

  downloadDataUrl(canvas.toDataURL('image/png'), 'palette.png');
}
