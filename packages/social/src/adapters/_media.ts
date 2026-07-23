// Shared media + link helpers for the concrete social adapters (docs/133 §8).
//
// The renderer resolves a post's media to a flat list of public URLs (kind is lost by
// the time it reaches an adapter), so an adapter that only accepts images detects them
// by extension. Centralized here so LinkedIn + the Meta family agree on exactly which
// URLs count as an image and how a canonical link is appended to a caption.

/** File extensions the platforms treat as an uploadable image. */
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)(?:$|[?#])/i;

/** Whether a resolved media URL points at an image (by extension). */
export function isImageUrl(url: string): boolean {
  return IMAGE_EXT_RE.test(url);
}

/** The first attached media URL that is an image, or null. Adapters that are image-only
 *  (or that need a lead image) use this; a video URL falls through to a link/text post
 *  rather than a hard failure. */
export function firstImageUrl(mediaUrls: readonly string[]): string | null {
  return mediaUrls.find((u) => isImageUrl(u)) ?? null;
}

/** Every attached image URL, in order — for platforms that take a gallery/carousel. */
export function imageUrls(mediaUrls: readonly string[]): string[] {
  return mediaUrls.filter((u) => isImageUrl(u));
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
