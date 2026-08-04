// Shared media + link helpers for the concrete social adapters (docs/133 §8).
//
// The renderer resolves a post's media to a flat list of public URLs (kind is lost by
// the time it reaches an adapter), so an adapter that only accepts images detects them
// by extension. Centralized here so LinkedIn + the Meta family agree on exactly which
// URLs count as an image and how a canonical link is appended to a caption.

import type { MediaRef } from '../types.js';
import { fetchT, HttpError } from './_http.js';

/** File extensions the platforms treat as an uploadable image. `avif` is included so a
 *  base variant in that format is still recognized (the social CROPS are jpeg, but the
 *  scale-to-width base can be avif/webp — see the worker's media resolver). */
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif)(?:$|[?#])/i;

/** The bytes of an image URL, for adapters that UPLOAD the file rather than hand the
 *  platform a public URL to fetch. Facebook's `/photos?url=` fetch is served a `206
 *  Partial Content` by our CDN (Cloudflare slices every range request) and rejected as
 *  `(#324) Missing or invalid image file`; a plain GET (no Range) returns a clean 200, so
 *  the worker downloads the bytes here and posts them as multipart `source`. 30s timeout
 *  — comfortably above a small social variant's transfer. */
export async function fetchImageBinary(
  url: string
): Promise<{ bytes: ArrayBuffer; contentType: string; filename: string }> {
  const res = await fetchT(url, {}, 30_000);
  if (!res.ok)
    throw new HttpError(`image fetch failed: ${res.status} ${url.slice(0, 160)}`, res.status);
  const bytes = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('gif')
        ? 'gif'
        : 'jpg';
  return { bytes, contentType, filename: `image.${ext}` };
}

/** Whether a URL LOOKS like an image by its file extension.
 *
 *  NOT a way to decide what an attachment is — use `MediaRef.kind`, which the renderer
 *  carries through from the resolved asset's MIME type. An extension is absent from
 *  every stock/CDN URL (`images.unsplash.com/photo-1588850561407-…`, which is a jpeg),
 *  so this returns false for images all day. It survives only for the media RESOLVER,
 *  which picks a variant by filename and has no MIME to consult. */
export function isImageUrl(url: string): boolean {
  return IMAGE_EXT_RE.test(url);
}

/** The first attached IMAGE's URL, or null. Adapters that are image-only (or that need
 *  a lead image) use this; a video-only post falls through to a link/text post rather
 *  than a hard failure. */
export function firstImageUrl(media: readonly MediaRef[]): string | null {
  return media.find((m) => m.kind === 'image')?.url ?? null;
}

/** Every attached IMAGE url, in order — for platforms that take a gallery/carousel. */
export function imageUrls(media: readonly MediaRef[]): string[] {
  return media.filter((m) => m.kind === 'image').map((m) => m.url);
}

/** The first attached VIDEO's URL, or null. The counterpart to `firstImageUrl`, and the
 *  replacement for `mediaUrls.find((u) => !isImageUrl(u))` — that predicate called
 *  anything it could not recognize a video, so an extensionless PHOTO was handed to a
 *  video-upload path. */
export function firstVideoUrl(media: readonly MediaRef[]): string | null {
  return media.find((m) => m.kind === 'video')?.url ?? null;
}

/** Append a link to caption text on its own paragraph, unless it's already present.
 *  Used by platforms whose caption has no separate link field (LinkedIn image posts,
 *  Instagram, Threads) — the link is not clickable but is preserved for the reader. */
export function appendLink(text: string, link: string): string {
  if (!text) return link;
  return text.includes(link) ? text : `${text}\n\n${link}`;
}

/** Derive a short title from the post body — the first non-empty line, whitespace-
 *  collapsed and truncated (with an ellipsis) to `maxLength`. Platforms that require a
 *  title field (Pinterest Pins, YouTube videos) but where the tenant only wrote a body
 *  use this; an empty body yields `fallback`. */
export function deriveTitle(text: string, maxLength: number, fallback = 'New post'): string {
  const firstLine = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  const clean = (firstLine ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
