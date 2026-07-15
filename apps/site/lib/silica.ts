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

import { cache } from 'react';
import type {
  PublishedSilicaFrameDto,
  PublishedSilicaPageDto,
  SilicaNode,
} from '@sparx/builder-schemas';
import {
  categoryDetailPage,
  collectionDetailPage,
  productDetailPage,
  serviceDetailPage,
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

/** The starter home page (slug `/`) as a published DTO. `commerceEnabled` decides
 *  whether Home includes the product grid/featured rail — see `starterPages`. */
function starterHomeDto(commerceEnabled: boolean): PublishedSilicaPageDto | null {
  const home = starterPages({ commerceEnabled }).find((p) => STARTER_SLUG(p.slug) === '');
  return home ? starterPageDto(home.name, '', home.root) : null;
}

/** The starter page owning a slug (shop/book/about/contact), or null — so a non-starter
 *  slug (a CMS article) still falls through to the legacy content path. There is no Shop
 *  page when Commerce is off, nor a Book page when Scheduling is off (see `starterPages`). */
function starterPageDtoForSlug(slug: string, flags: ModuleFlags): PublishedSilicaPageDto | null {
  const target = STARTER_SLUG(slug);
  const page = starterPages(flags).find((p) => STARTER_SLUG(p.slug) === target && target !== '');
  return page ? starterPageDto(page.name, STARTER_SLUG(page.slug), page.root) : null;
}

/** The starter frame DTO (brand-derived theme → null). Built lazily, only on the
 *  fallback path, so a published tenant never pays to stamp the starter tree. Carries
 *  the module flags so the fallback chrome + published-state signals match the tenant. */
function starterFrameDto(flags: ModuleFlags): PublishedSilicaFrameDto {
  return { frame: starterFrame(flags), symbols: {}, theme: null, ...flags };
}

/** The default per-record composite for a record type (PDP / collection / category /
 *  booking service), or null. Each is the code-authored template that renders a record of
 *  that type out of the box until the tenant publishes their own template for it. */
function starterCollectionDto(recordType: string): PublishedSilicaPageDto | null {
  if (recordType === 'commerce.product') {
    return starterPageDto('Product detail', '', productDetailPage(), recordType);
  }
  if (recordType === 'commerce.collection') {
    return starterPageDto('Collection', '', collectionDetailPage(), recordType);
  }
  if (recordType === 'commerce.category') {
    return starterPageDto('Category detail', '', categoryDetailPage(), recordType);
  }
  if (recordType === 'scheduling.service') {
    return starterPageDto('Service detail', '', serviceDetailPage(), recordType);
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

/** The raw frame envelope fetch, `cache()`-memoized per request/tenantSlug so the
 *  home/page fallbacks below (each needing `commerceEnabled`) never re-fetch it —
 *  `getPublishedSilicaFrame` is guaranteed to hit the network at most once. */
const fetchFrameEnvelope = cache(
  async (tenantSlug: string): Promise<PublishedSilicaFrameDto | null> => {
    try {
      const res = await fetch(
        `${BASE_URL}/v1/public/builder/silica/frame?tenant=${encodeURIComponent(tenantSlug)}${await propertyParam()}`,
        NO_STORE
      );
      const json = (await res.json()) as SuccessEnvelope<PublishedSilicaFrameDto> | ErrorEnvelope;
      if (!res.ok || 'error' in json) return null;
      return json.data;
    } catch {
      return null;
    }
  }
);

/** The module flags the code-authored starter fallback needs to match the tenant.
 *  Commerce fails open to `true` (today's unconditional-Shop behavior) on any lookup
 *  failure, never hiding real Commerce chrome over a transient error; Scheduling fails
 *  closed to `false` (opt-in, no legacy behavior to preserve). */
interface ModuleFlags {
  commerceEnabled: boolean;
  schedulingEnabled: boolean;
}

async function resolveModuleFlags(tenantSlug: string): Promise<ModuleFlags> {
  const data = await fetchFrameEnvelope(tenantSlug);
  return {
    commerceEnabled: data?.commerceEnabled ?? true,
    schedulingEnabled: data?.schedulingEnabled ?? false,
  };
}

/** Whether the tenant's Commerce module is active — see `resolveModuleFlags`. */
async function resolveCommerceEnabled(tenantSlug: string): Promise<boolean> {
  return (await resolveModuleFlags(tenantSlug)).commerceEnabled;
}

/** Whether the tenant's Scheduling module is active — the /book route's module gate
 *  (404s when off). Reads the same `cache()`-memoized frame envelope the layout already
 *  fetched, so it's free on the request. */
export async function resolveSchedulingEnabled(tenantSlug: string): Promise<boolean> {
  return (await resolveModuleFlags(tenantSlug)).schedulingEnabled;
}

/** The published site FRAME + site-global symbols + authored theme — one read for
 *  everything the root layout needs. It renders the chrome once, wrapping every page
 *  at its Outlet. Falls back to the code starter frame when the tenant has published
 *  no silica layout, so the storefront ALWAYS wears silica chrome (a fresh tenant is
 *  live, not blank); `theme` stays null so the brand-derived theme keeps rendering. */
export async function getPublishedSilicaFrame(
  tenantSlug: string
): Promise<PublishedSilicaFrameDto> {
  const data = await fetchFrameEnvelope(tenantSlug);
  if (!data?.frame) return starterFrameDto(await resolveModuleFlags(tenantSlug));
  return data;
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
    if (!res.ok || 'error' in json) return starterHomeDto(await resolveCommerceEnabled(tenantSlug));
    return json.data;
  } catch {
    return starterHomeDto(await resolveCommerceEnabled(tenantSlug));
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
    if (!res.ok || 'error' in json) {
      return starterPageDtoForSlug(slug, await resolveModuleFlags(tenantSlug));
    }
    return json.data;
  } catch {
    return starterPageDtoForSlug(slug, await resolveModuleFlags(tenantSlug));
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
