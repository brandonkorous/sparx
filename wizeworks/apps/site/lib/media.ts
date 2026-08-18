// Media asset URL resolution for the storefront.
//
// The public resolver lives at api-rest:
//   GET /v1/public/media/<id>?tenant=<slug>[&w=<px>]  → 302 to the best stored variant
// We point <img>/<Image> straight at it; the redirect is cacheable
// (immutable, 1-year) so the CDN collapses it after first hit.
//
// `w` is the CSS width the image will be painted at. It is optional — omitting it
// serves the widest variant — and it never has to match a width that exists: the
// resolver clamps to the widest available when the source was too small. `w` is part
// of the URL, so each rung of a srcset is its own cache key at the edge.

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

/** Resolve a media reference → a stable public URL. Accepts either a media
 *  asset id (UUID, resolved via the public redirect) or an absolute http(s)
 *  URL (passed straight through, so a tenant can reference a self-hosted /
 *  CDN asset without uploading it). Returns null for an empty ref so callers
 *  can fall back to a placeholder. */
export function mediaUrl(assetId: string | null | undefined, tenantSlug: string): string | null {
  if (!assetId) return null;
  if (/^https?:\/\//i.test(assetId)) return assetId;
  return `${BASE_URL}/v1/public/media/${encodeURIComponent(assetId)}?tenant=${encodeURIComponent(
    tenantSlug
  )}`;
}

/**
 * A `next/image` loader bound to the public resolver. `width` is honoured — the
 * resolver picks the narrowest stored variant that covers it. `quality` is not:
 * variants are pre-encoded at fixed quality, so it rides along only because it keeps
 * Next's cache keys distinct.
 */
export function siteImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}w=${width}&q=${quality ?? 75}`;
}
