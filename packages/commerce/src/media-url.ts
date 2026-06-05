// Public CDN URL for a stored media key. The media-worker writes processed
// variants into the public bucket fronted by cdn.sparx.works, and image keys are
// stable — so any commerce read (product list thumbnails, the search projection,
// email product blocks) can stamp the URL directly from a MediaAsset.key without
// a round-trip to the media service.
//
// Shared by product-service (list imageUrl) and search-projection (index
// image_url) so the resolution lives in one place.
export function mediaPublicUrl(key: string): string {
  // Hot-linked / external assets store an absolute URL as their key (blueprint
  // installs, docs/54 §6) — return it verbatim rather than prefixing the CDN or
  // bucket. A future "copy into tenant media" pass replaces these with real keys.
  if (/^https?:\/\//i.test(key)) return key;
  const cdn = process.env.SPARX_MEDIA_CDN_URL;
  if (cdn) return `${cdn.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
  const bucket = process.env.GCS_MEDIA_PUBLIC_BUCKET ?? process.env.GCS_MEDIA_BUCKET;
  if (bucket) return `https://storage.googleapis.com/${bucket}/${key.replace(/^\//, '')}`;
  return key;
}
