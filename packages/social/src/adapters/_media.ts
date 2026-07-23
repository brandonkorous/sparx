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
