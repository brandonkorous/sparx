// Server-side CMS reads for the storefront. Mirror of apps/web/lib/sparx-content
// but tenant-aware — the tenant slug is resolved per-request from the Host.
//
// Preview tokens: when the request carries `?sparxPreview=<jwt>` we forward it
// to api-rest via the `Authorization: Preview <jwt>` header. api-rest validates
// the token and, if it grants this entry, returns the draft body. Failing
// validation just falls back to the published-only path.

import { resolveActivePropertySlug } from './site-context';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

export interface ApiEntry<TBody = Record<string, unknown>> {
  id: string;
  type_key: string;
  slug: string | null;
  status: string;
  body: TBody;
  seo: Record<string, unknown>;
  published_at: string | null;
  updated_at: string;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: unknown;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; request_id?: string };
}

export async function publicGet<T>(
  path: string,
  query: Record<string, string | number>,
  options: { previewToken?: string; tag?: string } = {}
): Promise<T> {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)]))
  );
  // Model B (docs/49 §3): scope every public content read to the active site.
  // Null for the primary (api-rest defaults), so single-site is unchanged.
  const propertySlug = await resolveActivePropertySlug();
  if (propertySlug && !qs.has('property')) qs.set('property', propertySlug);
  const headers: Record<string, string> = {};
  if (options.previewToken) {
    headers.Authorization = `Preview ${options.previewToken}`;
  }
  // Coarse per-tenant tag (`content:<slug>`) so revalidateTag('content:<slug>')
  // clears all of a tenant's content reads in one purge.
  const coarse = query.tenant ? [`content:${String(query.tenant)}`] : [];
  const res = await fetch(`${BASE_URL}${path}?${qs.toString()}`, {
    headers,
    next: options.previewToken
      ? { revalidate: 0 }
      : {
          revalidate: 300,
          tags: ['sparx-storefront', ...coarse, ...(options.tag ? [options.tag] : [])],
        },
    cache: options.previewToken ? 'no-store' : undefined,
  });
  const json = (await res.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  if (!res.ok || 'error' in json) {
    const code = 'error' in json ? json.error.code : 'UNKNOWN';
    const message = 'error' in json ? json.error.message : `HTTP ${res.status}`;
    throw Object.assign(new Error(`api-rest ${path}: ${code}: ${message}`), { code });
  }
  return json.data;
}

/** Fetch ONE content entry by id (docs/98 Pillar 7 record-display) — a node pinned
 *  to a specific CMS entry. Published-only (the public surface); any miss/failure
 *  degrades to null so a stale pin renders empty rather than crashing the page. */
export async function getEntryById(tenantSlug: string, id: string): Promise<ApiEntry | null> {
  try {
    return await publicGet<ApiEntry>(
      `/v1/public/content/entries/${encodeURIComponent(id)}`,
      { tenant: tenantSlug },
      { tag: `entry:${tenantSlug}:id:${id}` }
    );
  } catch {
    return null;
  }
}

export interface PageBody {
  title?: string;
  // `body` is the rich-text field the `page` content type defines (shape
  // `{type:'doc',content:[...]}`); `content` is a legacy fallback. PageView
  // prefers `body`. Anything else shows up under body[key] and the renderer
  // ignores unrecognized fields.
  body?: { type: string; content?: unknown[] };
  content?: { type: string; content?: unknown[] };
  [key: string]: unknown;
}

export async function getPageBySlug(
  tenantSlug: string,
  slug: string,
  options: { previewToken?: string } = {}
): Promise<ApiEntry<PageBody> | null> {
  const fetchOnce = (withPreview: boolean) =>
    publicGet<ApiEntry<PageBody>>(
      '/v1/public/content/entries/by-slug',
      { tenant: tenantSlug, type: 'page', slug },
      {
        ...(withPreview && options.previewToken ? { previewToken: options.previewToken } : {}),
        tag: `entry:${tenantSlug}:page:${slug}`,
      }
    );

  try {
    return await fetchOnce(true);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'NOT_FOUND') return null;
    // Expired / revoked / wrong-tenant preview tokens — fall back to the
    // published-only path so the user still sees the live page rather than
    // an opaque server error.
    if (code === 'UNAUTHORIZED' && options.previewToken) {
      try {
        return await fetchOnce(false);
      } catch (innerErr) {
        const innerCode = (innerErr as { code?: string }).code;
        if (innerCode === 'NOT_FOUND') return null;
        throw innerErr;
      }
    }
    throw err;
  }
}

// A blog_post entry's body field map — the `blog_post` content type's fields
// (title/excerpt/body/featuredImage). `body` is the rich-text TipTap doc; the
// Prose leaf serializes it. `featuredImage` is a media-asset id (or absolute URL).
export interface BlogPostBody {
  title?: string;
  excerpt?: string;
  body?: { type: string; content?: unknown[] };
  featuredImage?: string | null;
  [key: string]: unknown;
}

/** A published blog post by slug — the per-record CMS read for the `/blog/[slug]`
 *  route. Mirrors getPageBySlug but for the `blog_post` content type (its own
 *  urlPattern `/blog/{slug}`). Returns null when no published post owns the slug;
 *  honors a preview token for draft access. */
export async function getBlogPostBySlug(
  tenantSlug: string,
  slug: string,
  options: { previewToken?: string } = {}
): Promise<ApiEntry<BlogPostBody> | null> {
  const fetchOnce = (withPreview: boolean) =>
    publicGet<ApiEntry<BlogPostBody>>(
      '/v1/public/content/entries/by-slug',
      { tenant: tenantSlug, type: 'blog_post', slug },
      {
        ...(withPreview && options.previewToken ? { previewToken: options.previewToken } : {}),
        tag: `entry:${tenantSlug}:blog_post:${slug}`,
      }
    );

  try {
    return await fetchOnce(true);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'NOT_FOUND') return null;
    if (code === 'UNAUTHORIZED' && options.previewToken) {
      try {
        return await fetchOnce(false);
      } catch (innerErr) {
        const innerCode = (innerErr as { code?: string }).code;
        if (innerCode === 'NOT_FOUND') return null;
        throw innerErr;
      }
    }
    throw err;
  }
}
