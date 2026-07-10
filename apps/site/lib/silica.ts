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

import type { PublishedSilicaFrameDto, PublishedSilicaPageDto } from '@sparx/builder-schemas';

import { resolveActivePropertySlug } from './site-context';

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
 *  at its Outlet. Always resolves (never throws): `frame` is null until a silica
 *  layout is published, so the layout decides chrome cleanly; `theme` is null until
 *  an author saves one, so the brand-derived theme keeps rendering. */
export async function getPublishedSilicaFrame(
  tenantSlug: string
): Promise<PublishedSilicaFrameDto> {
  const empty: PublishedSilicaFrameDto = { frame: null, symbols: {}, theme: null };
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/silica/frame?tenant=${encodeURIComponent(tenantSlug)}${await propertyParam()}`,
      NO_STORE
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedSilicaFrameDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return empty;
    return json.data;
  } catch {
    return empty;
  }
}

/** The property's PUBLISHED silica home body (the page whose slug is `/`), or null
 *  so the storefront root falls through to its legacy composition. */
export async function getPublishedSilicaHome(
  tenantSlug: string
): Promise<PublishedSilicaPageDto | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/public/builder/silica/home?tenant=${encodeURIComponent(tenantSlug)}${await propertyParam()}`,
      NO_STORE
    );
    const json = (await res.json()) as SuccessEnvelope<PublishedSilicaPageDto> | ErrorEnvelope;
    if (!res.ok || 'error' in json) return null;
    return json.data;
  } catch {
    return null;
  }
}

/** The PUBLISHED silica page body owning a storefront slug, or null when none does
 *  (the caller keeps its legacy render path). The slug is the joined path segments
 *  (`shop`, `about/team`); api-rest matches it against the stored `/`-prefixed slug. */
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
    if (!res.ok || 'error' in json) return null;
    return json.data;
  } catch {
    return null;
  }
}
