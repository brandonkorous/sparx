// Storefront reads for PUBLISHED Builder content (docs/44, docs/45). A published
// singleton Builder page serves at `/{slug}`; a published Builder LAYOUT is the
// chrome shell wrapping every page. Both fetch from api-rest's public endpoints
// and return null when nothing is published (or the read fails) so the
// storefront falls through to the legacy paths.

import type { PublishedLayoutDto, PublishedPageDto } from '@sparx/builder-schemas';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}
interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

export async function getPublishedBuilderPage(
  tenantSlug: string,
  slug: string
): Promise<PublishedPageDto | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/page?tenant=${encodeURIComponent(tenantSlug)}&slug=${encodeURIComponent(slug)}`,
      {
        // INTERIM: uncached so a publish reflects immediately. Builder content
        // changes on publish, and no tag-purge is wired yet (that's the deferred
        // Pub/Sub→cache-revalidation-worker slice) — a TTL here would just serve
        // stale pages. Restore `next: { revalidate, tags: ['builder:<slug>'] }`
        // once publish purges the tag.
        cache: 'no-store',
      }
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedPageDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return null;
    return json.data;
  } catch {
    return null;
  }
}

/** The tenant's PUBLISHED site layout — the chrome shell wrapping every page
 *  (docs/45 §2.6). Null when the tenant has never published a layout (or the
 *  read fails), so the storefront renders its legacy header/footer instead. */
export async function getPublishedBuilderLayout(
  tenantSlug: string
): Promise<PublishedLayoutDto | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/layout?tenant=${encodeURIComponent(tenantSlug)}`,
      {
        // INTERIM: uncached so a layout publish reflects immediately (see the
        // page reader above) — no tag-purge is wired yet. Restore revalidate+tags
        // once publish purges `builder-layout:<tenant>`.
        cache: 'no-store',
      }
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedLayoutDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return null;
    return json.data;
  } catch {
    return null;
  }
}
