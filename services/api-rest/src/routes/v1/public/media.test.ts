// `pickVariant` is the whole reason a derived `srcset` is safe, so it is tested as a
// unit rather than through the route: the interesting cases are all about which widths
// EXIST for a given asset, and media-worker's "skip widths above the source" rule means
// that set differs per upload.

import { describe, expect, it } from 'vitest';

import { pickVariant } from './media.js';

/** The full ladder media-worker produces for a source at least 2000px wide. */
const FULL = [
  { format: 'webp', width: 400 },
  { format: 'webp', width: 800 },
  { format: 'webp', width: 1200 },
  { format: 'webp', width: 2000 },
];

/** A 900px upload: media-worker skips 1200 and 2000 entirely. */
const SMALL_SOURCE = [
  { format: 'webp', width: 400 },
  { format: 'webp', width: 800 },
];

describe('pickVariant', () => {
  it('serves the WIDEST when no width is asked for', () => {
    // The historical behaviour, kept so a bare resolver URL (no `w`) is unchanged.
    expect(pickVariant(FULL)?.width).toBe(2000);
  });

  it('serves the narrowest variant that still covers the requested width', () => {
    expect(pickVariant(FULL, 1)?.width).toBe(400);
    expect(pickVariant(FULL, 400)?.width).toBe(400);
    expect(pickVariant(FULL, 401)?.width).toBe(800);
    expect(pickVariant(FULL, 800)?.width).toBe(800);
    expect(pickVariant(FULL, 1000)?.width).toBe(1200);
    expect(pickVariant(FULL, 2000)?.width).toBe(2000);
  });

  it('CLAMPS to the widest rather than 404ing when the ladder tops out early', () => {
    // This is the case that makes derivation safe. A 900px upload has no 1200/2000
    // variant, but a page-wide `srcset` names them anyway — because the emitter has no
    // idea how big any individual source was. Asking for a width nobody generated must
    // return the best available image, never a miss.
    expect(pickVariant(SMALL_SOURCE, 1200)?.width).toBe(800);
    expect(pickVariant(SMALL_SOURCE, 2000)?.width).toBe(800);
    expect(pickVariant(SMALL_SOURCE, 5000)?.width).toBe(800);
  });

  it('prefers webp but falls back to whatever formats exist', () => {
    const noWebp = [
      { format: 'avif', width: 400 },
      { format: 'jpeg', width: 400 },
      { format: 'avif', width: 1200 },
    ];
    expect(pickVariant(noWebp, 1000)?.width).toBe(1200);
    // Mixed: the webp pool wins even when another format has a closer width.
    const mixed = [
      { format: 'webp', width: 1200 },
      { format: 'jpeg', width: 800 },
    ];
    expect(pickVariant(mixed, 800)).toEqual({ format: 'webp', width: 1200 });
  });

  it('returns null when the asset has no variants at all', () => {
    // Still transcoding, or a non-raster original (SVG) the worker never rasterises.
    // The caller pipes the original through instead of redirecting.
    expect(pickVariant([], 800)).toBeNull();
    expect(pickVariant([])).toBeNull();
  });

  it('never picks a variant NARROWER than asked when a wider one exists', () => {
    // The failure this guards is an off-by-one that serves 400 for a 401 request and
    // makes every image on the site subtly soft — the kind of regression a screenshot
    // review would pass.
    for (const want of [1, 399, 400, 401, 799, 800, 801, 1199, 1201, 1999]) {
      const got = pickVariant(FULL, want)!;
      expect(got.width).toBeGreaterThanOrEqual(want);
    }
  });
});
