// Storefront reads for PUBLISHED silica trees (docs/118 Stage 6 — the render
// cutover). The silica engine's native output: a shared FRAME (chrome) read once
// by the root layout, and per-route PAGE bodies. Both come from api-rest's public
// `/v1/public/builder/silica/*` endpoints and return null (frame → empty) when the
// property has published no silica site, so the storefront falls through to the
// legacy sparx-builder / section paths until the re-seed flip.
//
// Runs PARALLEL to `lib/builder.ts` (the sparx `--st-*` render path) — the silica
// path wins where a silica page/frame is published, else the legacy path renders,
// exactly the additive "builder owns it, else fall through" rule (docs/44 §2.5).

import type {
  PublishedSilicaFrameDto,
  PublishedSilicaPageDto,
  SilicaNode,
} from '@sparx/builder-schemas';
import {
  collectionDetailPage,
  productDetailPage,
  starterFrame,
  starterPages,
} from '@sparx/silica-catalog';

import { resolveActivePropertySlug } from './site-context';

// ── The silica starter as the universal fallback (docs/118 — coverage guarantee) ──
// A published silica tree ALWAYS wins; but when a tenant has published nothing yet,
// the storefront still renders silica by falling back to the code `starterSite`
// (frame + home/shop/about/contact) and the per-record composites (PDP / collection).
// This is what makes the legacy sparx-builder + section tiers unreachable — so they
// can be removed — while a fresh tenant's site is live from day one instead of blank.
// Publishing in the builder overrides the fallback with the tenant's own trees.

const STARTER_SLUG = (slug: string | null | undefined): string => (slug ?? '').replace(/^\/+/, '');

/** Synthesize a `PublishedSilicaPageDto` from a code-authored tree (no DB row). */
function starterPageDto(
  name: string,
  slug: string,
  root: SilicaNode,
  recordType: string | null = null
): PublishedSilicaPageDto {
  return {
    id: `starter:${slug || name.toLowerCase()}`,
    name,
    slug,
    kind: recordType ? 'collection' : 'singleton',
    recordType,
    root,
    symbols: {},
    seoTitle: null,
    seoDescription: null,
    canonical: null,
    ogImage: null,
    noindex: false,
    publishedAt: null,
  };
}

/** The starter home page (slug `/`) as a published DTO. */
function starterHomeDto(): PublishedSilicaPageDto | null {
  const home = starterPages().find((p) => STARTER_SLUG(p.slug) === '');
  return home ? starterPageDto(home.name, '', home.root) : null;
}

/** The starter page owning a slug (shop/about/contact), or null — so a non-starter
 *  slug (a CMS article) still falls through to the legacy content path. */
function starterPageDtoForSlug(slug: string): PublishedSilicaPageDto | null {
  const target = STARTER_SLUG(slug);
  const page = starterPages().find((p) => STARTER_SLUG(p.slug) === target && target !== '');
  return page ? starterPageDto(page.name, STARTER_SLUG(page.slug), page.root) : null;
}

/** The starter frame DTO (brand-derived theme → null). Built lazily, only on the
 *  fallback path, so a published tenant never pays to stamp the starter tree. */
function starterFrameDto(): PublishedSilicaFrameDto {
  return { frame: starterFrame(), symbols: {}, theme: null };
}

/** The default per-record composite for a record type (PDP / collection), or null. */
function starterCollectionDto(recordType: string): PublishedSilicaPageDto | null {
  if (recordType === 'commerce.product') {
    return starterPageDto('Product detail', '', productDetailPage(), recordType);
  }
  if (recordType === 'commerce.collection') {
    return starterPageDto('Collection', '', collectionDetailPage(), recordType);
  }
  return null;
}

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

// `&property=<slug>` scopes the read to the active web property (docs/49); '' for
// the tenant's primary site (api-rest defaults to it).
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

// INTERIM: uncached so a publish reflects immediately — no tag-purge is wired yet
// (the deferred Pub/Sub→revalidation-worker slice), matching lib/builder.ts.
const NO_STORE: RequestInit = { cache: 'no-store' };

/** The published site FRAME + site-global symbols + authored theme — one read for
 *  everything the root layout needs. It renders the chrome once, wrapping every page
 *  at its Outlet. Falls back to the code starter frame when the tenant has published
 *  no silica layout, so the storefront ALWAYS wears silica chrome (a fresh tenant is
 *  live, not blank); `theme` stays null so the brand-derived theme keeps rendering. */
export async function getPublishedSilicaFrame(
  tenantSlug: string
): Promise<PublishedSilicaFrameDto> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/silica/frame?tenant=${encodeURIComponent(tenantSlug)}${await propertyParam()}`,
      NO_STORE
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedSilicaFrameDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json || !json.data.frame) return starterFrameDto();
    return json.data;
  } catch {
    return starterFrameDto();
  }
}

/** The property's PUBLISHED silica home body (the page whose slug is `/`). Falls back
 *  to the code starter home when none is published, so a fresh tenant's homepage is
 *  the editable silica starter rather than a blank/legacy composition. */
export async function getPublishedSilicaHome(
  tenantSlug: string
): Promise<PublishedSilicaPageDto | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/silica/home?tenant=${encodeURIComponent(tenantSlug)}${await propertyParam()}`,
      NO_STORE
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedSilicaPageDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return starterHomeDto();
    return json.data;
  } catch {
    return starterHomeDto();
  }
}

/** The PUBLISHED silica page body owning a storefront slug. Falls back to a code
 *  starter page (shop/about/contact) when the tenant has published none — but only
 *  for those starter slugs; any OTHER slug (a CMS article) returns null so the caller
 *  keeps its legacy content path. The slug is the joined path segments (`shop`,
 *  `about/team`); api-rest matches it against the stored `/`-prefixed slug. */
export async function getPublishedSilicaPage(
  tenantSlug: string,
  slug: string
): Promise<PublishedSilicaPageDto | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/silica/page?tenant=${encodeURIComponent(tenantSlug)}&slug=${encodeURIComponent(slug)}${await propertyParam()}`,
      NO_STORE
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedSilicaPageDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return starterPageDtoForSlug(slug);
    return json.data;
  } catch {
    return starterPageDtoForSlug(slug);
  }
}

/** The PUBLISHED silica COLLECTION template for a record type (docs/118 Stage 6 —
 *  the generic per-record router). `recordType` is `commerce.product` / `commerce.collection`;
 *  the optional `recordId` lets a per-record template override win over the type
 *  default. Falls back to the code composite (`productDetailPage` / `collectionDetailPage`)
 *  when the tenant has published no template for a KNOWN record type, so every product
 *  and collection renders on silica out of the box; an unknown record type returns null. */
export async function getPublishedSilicaCollection(
  tenantSlug: string,
  recordType: string,
  recordId?: string
): Promise<PublishedSilicaPageDto | null> {
  try {
    const recordParam = recordId ? `&recordId=${encodeURIComponent(recordId)}` : '';
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/silica/collection?tenant=${encodeURIComponent(tenantSlug)}&recordType=${encodeURIComponent(recordType)}${recordParam}${await propertyParam()}`,
      NO_STORE
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedSilicaPageDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return starterCollectionDto(recordType);
    return json.data;
  } catch {
    return starterCollectionDto(recordType);
  }
}
