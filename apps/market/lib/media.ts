// Media asset URL resolution for the marketplace.
//
// Marketplace product + merchant images resolve through api-rest's public media
// endpoint:
//   GET /v1/public/media/<id>?tenant=<slug>  → 302 to the stored GCS object
// We point <img>/<Image> straight at it; the redirect is cacheable (immutable,
// 1-year) so the CDN collapses it after first hit. A listing's media id carries
// the SELLER tenant slug (the cross-tenant catalog resolves it per-listing), so
// callers pass that slug — not a single site tenant — through here.

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

/** Resolve a media reference → a stable public URL. Accepts either a media
 *  asset id (UUID, resolved via the public redirect) or an absolute http(s)
 *  URL (passed straight through, so a seller can reference a self-hosted / CDN
 *  asset without uploading it). Returns null for an empty ref so callers can
 *  fall back to a placeholder. */
export function mediaUrl(
  assetId: string | null | undefined,
  tenantSlug: string | null | undefined
): string | null {
  if (!assetId) return null;
  if (/^https?:\/\//i.test(assetId)) return assetId;
  const tenantParam = tenantSlug ? `?tenant=${encodeURIComponent(tenantSlug)}` : '';
  return `${BASE_URL}/v1/public/media/${encodeURIComponent(assetId)}${tenantParam}`;
}

/**
 * A `next/image` loader bound to the public resolver. The endpoint redirects to
 * the origin object; width/quality are advisory (the CDN/origin may ignore them)
 * but kept in the URL so Next treats variants as distinct cache keys.
 */
export function marketImageLoader({
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
