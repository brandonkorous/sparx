// Social aspect crops (docs/133 §8, docs/134 Slice 6).
//
// The base transcode pass (transcode.ts) scales an image to a set of widths with
// `fit: 'inside'` — it never crops, so the whole picture always shows. Social feeds
// want the opposite: a picture framed to the platform's aspect ratio. This module
// derives the four core crops a post needs — 1:1 (feed square), 4:5 (feed portrait),
// 9:16 (story/reel), 16:9 (landscape) — as focal-point-aware COVER crops.
//
// Framing rule (the "attention/subject-aware crop with a draggable focal point" of
// §8): when the asset's focal point is the untouched centre (0.5, 0.5) we let libvips
// pick the crop window by its attention heuristic (keeps faces/subjects in frame);
// once the tenant has NUDGED the focal point we honour it exactly with a manual
// extract. One upload → correctly-framed renditions everywhere; the composer exposes
// the focal point and the social-worker picks the crop nearest each platform's ratio.
//
// Output is JPEG only (universal for both the composer preview and every platform's
// upload endpoint) at a canonical longest edge — a deliberately lean +4 variants per
// image rather than the full format matrix, since these are crop SOURCES, not the
// responsive-delivery ladder the base variants already cover.

import sharp from 'sharp';

export interface SocialAspect {
  /** The ratio label persisted on media_variants.aspect + matched by the worker. */
  name: '1:1' | '4:5' | '9:16' | '16:9';
  w: number;
  h: number;
}

/** The four core crops docs/133 §8 names. The social-worker maps each platform's
 *  declared ratio to the nearest of these (e.g. Pinterest 2:3 → 9:16, GBP 4:3 → 1:1). */
export const SOCIAL_ASPECTS: readonly SocialAspect[] = [
  { name: '1:1', w: 1, h: 1 },
  { name: '4:5', w: 4, h: 5 },
  { name: '9:16', w: 9, h: 16 },
  { name: '16:9', w: 16, h: 9 },
];

/** Canonical longest edge for a crop. Big enough to publish + preview crisply, never
 *  upscaled past the source (a smaller source yields a smaller crop). */
const CROP_LONGEST_EDGE = 1080;

const JPEG_QUALITY = 82;

export interface CropOutput {
  aspect: SocialAspect['name'];
  width: number;
  height: number;
  ext: 'jpg';
  contentType: 'image/jpeg';
  body: Buffer;
}

const RASTER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const isDefaultFocal = (x: number, y: number): boolean =>
  Math.abs(x - 0.5) < 0.001 && Math.abs(y - 0.5) < 0.001;

/** Derive the four social crops from the source bytes. Non-raster inputs (SVG, video)
 *  yield none — a text/link post publishes without a crop, and the base pass already
 *  skips them too. `focal` is the asset's stored focal point in [0,1]². */
export async function cropSocialAspects(
  input: Buffer,
  mimeType: string,
  focal: { x: number; y: number }
): Promise<CropOutput[]> {
  if (!RASTER_MIME.has(mimeType)) return [];

  const source = sharp(input, { animated: false }).rotate(); // EXIF auto-orient
  const meta = await source.metadata();
  const sw = meta.width ?? 0;
  const sh = meta.height ?? 0;
  if (sw <= 0 || sh <= 0) return [];

  const fx = clamp(focal.x, 0, 1);
  const fy = clamp(focal.y, 0, 1);
  const useAttention = isDefaultFocal(fx, fy);

  const out: CropOutput[] = [];
  for (const aspect of SOCIAL_ASPECTS) {
    // Target box at the canonical longest edge, oriented by the aspect.
    const portrait = aspect.h > aspect.w;
    let outW = portrait ? Math.round((CROP_LONGEST_EDGE * aspect.w) / aspect.h) : CROP_LONGEST_EDGE;
    let outH = portrait ? CROP_LONGEST_EDGE : Math.round((CROP_LONGEST_EDGE * aspect.h) / aspect.w);

    // Never upscale: if covering the box would enlarge the source, shrink the box so
    // the cover scale is ≤ 1 (a small logo simply produces a small crop).
    const coverScale = Math.max(outW / sw, outH / sh);
    if (coverScale > 1) {
      outW = Math.max(1, Math.round(outW / coverScale));
      outH = Math.max(1, Math.round(outH / coverScale));
    }

    let body: Buffer;
    if (useAttention) {
      // Subject-aware crop — libvips keeps the salient region in frame.
      body = await source
        .clone()
        .resize(outW, outH, {
          fit: 'cover',
          position: sharp.strategy.attention,
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
    } else {
      // Honour the tenant's focal point: cover-scale the whole image, then extract the
      // output window positioned so the focal point sits where the tenant placed it.
      const rScale = Math.max(outW / sw, outH / sh);
      const rw = Math.max(outW, Math.round(sw * rScale));
      const rh = Math.max(outH, Math.round(sh * rScale));
      const left = clamp(Math.round((rw - outW) * fx), 0, rw - outW);
      const top = clamp(Math.round((rh - outH) * fy), 0, rh - outH);
      body = await source
        .clone()
        .resize(rw, rh, { withoutEnlargement: false })
        .extract({ left, top, width: outW, height: outH })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
    }

    out.push({
      aspect: aspect.name,
      width: outW,
      height: outH,
      ext: 'jpg',
      contentType: 'image/jpeg',
      body,
    });
  }
  return out;
}
