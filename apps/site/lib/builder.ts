// Site reads for PUBLISHED Builder content (docs/44, docs/45). A published
// singleton Builder page serves at `/{slug}`; a published Builder LAYOUT is the
// chrome shell wrapping every page. Both fetch from api-rest's public endpoints
// and return null when nothing is published (or the read fails) so the site
// falls through to the legacy paths. With a site-preview token they serve the
// DRAFT instead — the editor's "Preview" tab (docs/45 §2.6).

import type { PublishedLayoutDto, PublishedPageDto } from '@sparx/builder-schemas';

import { resolveActivePropertySlug } from './site-context';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

// The `&property=<slug>` query that scopes a public Builder read to the active
// web property (docs/49). Resolved once per request from the host; '' for the
// tenant's primary site (api-rest defaults to it), so single-site reads are
// byte-for-byte unchanged.
async function propertyParam(): Promise<string> {
  const slug = await resolveActivePropertySlug();
  return slug ? `&property=${encodeURIComponent(slug)}` : '';
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}
interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

interface PublishedStylesheet {
  css: string;
  hash: string;
}

/** Forward a site-preview token to api-rest as `Authorization: Preview <jwt>`
 *  (the same convention the CMS preview path uses) so the public read serves the
 *  DRAFT instead of the published snapshot. No token → no header → published. */
function previewHeaders(previewToken?: string): HeadersInit | undefined {
  return previewToken ? { Authorization: `Preview ${previewToken}` } : undefined;
}

export async function getPublishedBuilderPage(
  tenantSlug: string,
  slug: string,
  opts: { previewToken?: string } = {}
): Promise<PublishedPageDto | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/page?tenant=${encodeURIComponent(tenantSlug)}&slug=${encodeURIComponent(slug)}${await propertyParam()}`,
      {
        // INTERIM: uncached so a publish reflects immediately. Builder content
        // changes on publish, and no tag-purge is wired yet (that's the deferred
        // Pub/Sub→cache-revalidation-worker slice) — a TTL here would just serve
        // stale pages. Restore `next: { revalidate, tags: ['builder:<slug>'] }`
        // once publish purges the tag.
        cache: 'no-store',
        headers: previewHeaders(opts.previewToken),
      }
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedPageDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return null;
    return json.data;
  } catch {
    return null;
  }
}

/** The property's PUBLISHED home page (docs/49 multi-site): the slugless singleton
 *  that serves at `/`. Null when this site has published no home, so the storefront
 *  root falls through to its legacy composition. Per-property — a secondary site
 *  resolves its OWN home, not the tenant-wide snapshot's. With a site-preview token
 *  the DRAFT home comes back instead (the editor's Preview tab). */
export async function getPublishedBuilderHome(
  tenantSlug: string,
  opts: { previewToken?: string } = {}
): Promise<PublishedPageDto | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/home?tenant=${encodeURIComponent(tenantSlug)}${await propertyParam()}`,
      // INTERIM: uncached so a publish reflects immediately (see getPublishedBuilderPage).
      { cache: 'no-store', headers: previewHeaders(opts.previewToken) }
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedPageDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return null;
    return json.data;
  } catch {
    return null;
  }
}

/** The PUBLISHED collection template for a record type (docs/44 §3 B — the
 *  generic per-record router): the tree that renders a record of `recordType`
 *  (`commerce.product`, `cms.page`, `cms.blog_post`, …). Null when the tenant has
 *  published none, so the caller keeps its legacy render path. The caller binds
 *  the in-scope record into the tree before rendering. Pass the record's id so a
 *  per-record template override wins over the type default (docs/51 §6). */
export async function getPublishedBuilderCollection(
  tenantSlug: string,
  recordType: string,
  recordId?: string
): Promise<PublishedPageDto | null> {
  try {
    const recordParam = recordId ? `&recordId=${encodeURIComponent(recordId)}` : '';
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/collection?tenant=${encodeURIComponent(tenantSlug)}&recordType=${encodeURIComponent(recordType)}${recordParam}${await propertyParam()}`,
      // INTERIM: uncached so a publish reflects immediately (see getPublishedBuilderPage).
      { cache: 'no-store' }
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
      `${BASE_URL}/v1/public/builder/layout?tenant=${encodeURIComponent(tenantSlug)}${await propertyParam()}`,
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

/** The compiled per-tenant Surface stylesheet (docs/47 §5) — the CSS for every
 *  class authored across the tenant's published Builder trees. The root layout
 *  inlines it after the `--st-*` theme block so authored utilities resolve. '' on
 *  failure or when no classes are authored, so the storefront degrades cleanly. */
export async function getPublishedBuilderStyles(
  tenantSlug: string,
  opts: { previewToken?: string } = {}
): Promise<string> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/styles?tenant=${encodeURIComponent(tenantSlug)}${await propertyParam()}`,
      // INTERIM: uncached so a publish reflects immediately (see the reads above).
      // With a preview token the DRAFT sheet (a superset) comes back instead.
      { cache: 'no-store', headers: previewHeaders(opts.previewToken) }
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedStylesheet> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return '';
    return json.data.css;
  } catch {
    return '';
  }
}
