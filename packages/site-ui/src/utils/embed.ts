// Embed URL helpers (docs/46 §5.2). Harvested verbatim from the storefront
// renderer's `youtubeEmbed` / `mapEmbed` so the typed Video/Map components and
// the renderer derive the same src; the renderer can dedupe onto these at
// migration time. Server-safe (pure string functions).

/** A YouTube watch/share/embed/shorts URL (or a bare id) → a privacy-friendly
 *  nocookie embed URL, or null when nothing usable is found. */
export function youtubeEmbed(url: string): string | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{6,})/.exec(u);
  const id = m?.[1] ?? (/^[\w-]{6,}$/.test(u) ? u : null);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}

/** An explicit embed URL wins; otherwise a place query → a keyless Google Maps
 *  embed. Null when neither is provided. */
export function mapEmbed(query: string, embedUrl: string): string | null {
  if (embedUrl?.trim()) return embedUrl.trim();
  const q = (query ?? '').trim();
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : null;
}
