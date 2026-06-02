// Storefront read for PUBLISHED Builder pages (docs/44). A published singleton
// Builder page serves at `/{slug}`; this fetches its node tree from api-rest's
// public endpoint. Returns null when no published page has that slug (or the
// read fails) so the catch-all route falls through to the legacy paths.

import type { PublishedPageDto } from '@sparx/builder-schemas';

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
        // Builder pages change on publish; the publish flow can purge this tag
        // (builder:<slug>) later. Falls back to TTL until then.
        next: {
          revalidate: 300,
          tags: ['sparx-storefront', `tenant:${tenantSlug}`, `builder:${tenantSlug}`],
        },
      }
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedPageDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return null;
    return json.data;
  } catch {
    return null;
  }
}
