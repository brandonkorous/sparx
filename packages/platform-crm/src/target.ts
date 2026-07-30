// Resolving WHERE the mirror writes: the platform tenant (WizeWorks) and the
// site its contacts belong to.
//
// sparx runs itself as a tenant-of-record (docs/80 §2) — the same dogfood tenant
// the /early waitlist and the careers form already write into. Two env vars name
// it, matching the rest of the platform:
//
//   SPARX_PLATFORM_TENANT_ID    — the immutable tenant UUID (ops-set, preferred)
//   SPARX_PLATFORM_TENANT_SLUG  — the slug, default 'wizeworks' (dev + fallback)
//
// Neither resolving → the mirror SKIPS rather than guessing. Writing a signup
// into an arbitrary tenant's CRM would be a cross-tenant data leak, so "no
// platform tenant configured" must never degrade into "pick one".

import { prisma, withTenant } from '@sparx/db';

/** Where a mirrored record lands: the platform tenant + the site that owns its
 *  CRM contacts (its primary site, so per-site CRM views actually show them). */
export interface PlatformTarget {
  tenantId: string;
  propertyId: string | null;
}

const DEFAULT_PLATFORM_SLUG = 'wizeworks';

// The target is stable (a tenant's primary site rarely moves), but a Cloud Run
// instance can live for hours — so memoize with a TTL rather than forever. A
// miss costs two indexed reads.
const CACHE_TTL_MS = 10 * 60 * 1000;
let cached: { at: number; target: PlatformTarget | null } | null = null;

/** Resolve the platform tenant + its primary site. Null when no platform tenant
 *  is configured or the configured one doesn't exist — callers skip the mirror. */
export async function resolvePlatformTarget(): Promise<PlatformTarget | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.target;

  const target = await loadTarget();
  cached = { at: Date.now(), target };
  return target;
}

async function loadTarget(): Promise<PlatformTarget | null> {
  const id = process.env.SPARX_PLATFORM_TENANT_ID?.trim();
  // A blank env var is the same as unset — fall back rather than looking up ''.
  const configuredSlug = (process.env.SPARX_PLATFORM_TENANT_SLUG ?? '').trim();
  const slug = configuredSlug.length > 0 ? configuredSlug : DEFAULT_PLATFORM_SLUG;

  // The id wins when set — it survives a rename, which the slug does not.
  const tenant = id
    ? await prisma.tenant.findUnique({ where: { id }, select: { id: true } })
    : await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return null;

  // `properties` is FORCE RLS — resolve under the tenant GUC.
  const property = await withTenant({ tenantId: tenant.id }, (tx) =>
    tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } })
  );

  return { tenantId: tenant.id, propertyId: property?.id ?? null };
}

/** Test/backfill hook — drop the memoized target so the next resolve re-reads. */
export function resetPlatformTargetCache(): void {
  cached = null;
}
