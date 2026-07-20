// Property (multi-site) resolution helpers (docs/49).
//
// A tenant has one-or-more web PROPERTIES (sites). Authoring + storefront reads
// scope to ONE property. Until host→property routing (Phase 2) and the dashboard
// site switcher (Phase 3) are everywhere, the default is always the tenant's
// PRIMARY property — so single-site tenants behave exactly as before.
//
// `properties` is FORCE RLS, so these lookups go through withTenant. property_id
// is application-tier scoping, not a security boundary (docs/49 §2).

import { withTenant } from '@sparx/db';
import type { Prisma } from '@prisma/client';
import { notFound } from '@sparx/api-core/errors';
import { createTtlCache } from './ttl-cache.js';

// Property-id resolution runs on EVERY public storefront read (host→propertyId) and
// each miss opens a withTenant interactive transaction — a scarce PgBouncer server
// slot — for a single-row lookup. The (tenant, slug|id)→propertyId mapping is stable,
// so a short per-pod TTL collapses that per-request transaction to ~one per key per
// window (the same P2028 relief as lib/domain.ts's host cache). Keys embed tenantId,
// so this is never a cross-tenant path — a stale id only ever names one of the SAME
// tenant's properties, and RLS still scopes the underlying reads regardless.
const propertyIdCache = createTtlCache<string>({ hitTtlMs: 60_000 });

// ── Model B per-site scoping (docs/49 §3) ──────────────────────────────────
// A product / content entry is visible on a site if it has NO scope rows
// (global — the default) OR a scope row for that site. Returned as an `AND`
// fragment so it composes with any existing top-level `OR` (e.g. text search)
// without key-colliding; spread into the storefront read's `where`. The
// storefront resolves `propertyId` for EVERY public read (primary included), so
// the primary site shows only global + primary-scoped items, never another
// site's exclusive items. Single-site tenants have no scope rows → matches all.

/** Product visibility `where` fragment for the active site. */
export function productSiteVisibilityWhere(propertyId: string): Prisma.ProductWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}

/** Content-entry visibility `where` fragment for the active site. */
export function contentSiteVisibilityWhere(propertyId: string): Prisma.ContentEntryWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}

/** Collection visibility `where` fragment for the active site (docs/49 Model B) —
 *  the same "empty = all, pinned = only those" rule products use, so a collection
 *  scoped to specific sites never surfaces on the others. */
export function collectionSiteVisibilityWhere(
  propertyId: string
): Prisma.ProductCollectionWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}

/** Category visibility `where` fragment for the active site (docs/49 Model B). */
export function categorySiteVisibilityWhere(propertyId: string): Prisma.ProductCategoryWhereInput {
  return {
    AND: [{ OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId } } }] }],
  };
}

/** Model B (docs/49 §3): default a NEW catalog item (product / collection / category)
 *  to the ACTIVE site, so "different catalogs per site" is the default the moment a
 *  tenant runs more than one. Mutates `body.propertyIds` in place ONLY when the caller
 *  left it undefined AND the tenant has >1 site; an explicit value (including `[]` =
 *  all sites) is honored verbatim, and single-site tenants stay unscoped. Shared by
 *  every create route so the default can't drift between products and collections/
 *  categories. `countSites` + `resolveActiveSite` are injected so this stays free of
 *  the Fastify request type AND unit-testable without a database. */
export async function defaultPropertyIdsToActiveSite(
  body: Record<string, unknown>,
  countSites: () => Promise<number>,
  resolveActiveSite: () => Promise<string>
): Promise<void> {
  if (body.propertyIds !== undefined) return;
  const siteCount = await countSites();
  if (siteCount <= 1) return;
  body.propertyIds = [await resolveActiveSite()];
}

/** The tenant's PRIMARY property id. Every tenant has exactly one (guaranteed by
 *  migration 20260626000000_properties + the partial-unique index). */
export async function resolvePrimaryPropertyId(tenantId: string): Promise<string> {
  return propertyIdCache.get(`primary:${tenantId}`, async () => {
    const row = await withTenant({ tenantId }, (tx) =>
      tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } })
    );
    if (!row) throw notFound('Property', `primary for tenant ${tenantId}`);
    return row.id;
  });
}

/** Resolve the property a request is scoped to. `requested` (e.g. the
 *  `x-sparx-property-id` header the dashboard site switcher sets, docs/49 Phase 3)
 *  wins when it names one of the tenant's OWN properties; otherwise the primary.
 *  RLS already scopes the lookup to the tenant, and an unknown id fails closed to
 *  the primary — a header can never reach another tenant's property. */
export async function resolvePropertyId(
  tenantId: string,
  requested?: string | null
): Promise<string> {
  if (requested) {
    return propertyIdCache.get(`id:${tenantId}:${requested}`, async () => {
      const row = await withTenant({ tenantId }, (tx) =>
        tx.property.findUnique({ where: { id: requested }, select: { id: true } })
      );
      return row ? row.id : resolvePrimaryPropertyId(tenantId);
    });
  }
  return resolvePrimaryPropertyId(tenantId);
}

/** The explicit "every site" opt-out on a list's `?property=`. A word rather than
 *  an absent parameter because ABSENCE now means "the site I am working in" —
 *  see `resolveListScope`. */
export const ALL_SITES = 'all';

/**
 * Which site an ADMIN list is scoped to. Returns `undefined` for "every site".
 *
 * The rule, in one place because it must not drift between products, content and
 * customers:
 *
 *   ?property=<id>  → that site (falling back to primary if the id is not ours)
 *   ?property=all   → every site, unscoped
 *   (absent)        → `x-sparx-property-id`, else the tenant's primary
 *
 * ABSENCE MEANING "MY ACTIVE SITE" IS THE POINT. It used to mean "every site",
 * which put the burden on each caller to remember a parameter: the dashboard did,
 * the workbench and MCP did not, so switching sites changed the chrome while every
 * list kept showing the whole tenant. A default that depends on every present and
 * future caller remembering something is not a default. Cross-site reads are still
 * available — they are now just asked for out loud.
 *
 * `header` is passed in rather than read from a request so this stays free of the
 * Fastify types and unit-testable without a server.
 */
export async function resolveListScope(
  tenantId: string,
  requested: string | undefined,
  header: string | string[] | undefined
): Promise<string | undefined> {
  if (requested === ALL_SITES) return undefined;
  if (requested) return resolvePropertyId(tenantId, requested);
  const active = Array.isArray(header) ? header[0] : header;
  return resolvePropertyId(tenantId, active ?? null);
}

/** Validate that `propertyId` names one of the tenant's OWN properties, returning
 *  it; 404 otherwise. For an EXPLICIT target — e.g. the `property_id` in a
 *  blueprint-install body (docs/49 Phase 8) where the caller named a specific site
 *  — a silent fall-back to the primary (as `resolvePropertyId` does for a header)
 *  would quietly install into the wrong site and hide the mistake. RLS scopes the
 *  lookup, so a foreign-tenant id is indistinguishable from a non-existent one. */
export async function requireTenantProperty(tenantId: string, propertyId: string): Promise<string> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.property.findUnique({ where: { id: propertyId }, select: { id: true } })
  );
  if (!row) throw notFound('Property', propertyId);
  return row.id;
}

/** Storefront-side resolution: by stable property SLUG (the host→property mapping
 *  in Phase 2 passes it as `?property=`), else the tenant's primary. Keeps the
 *  public Builder reads single-site today (no `property` param → primary) while
 *  being forward-compatible with per-site hostnames. */
export async function resolvePublicPropertyId(
  tenantId: string,
  slug?: string | null
): Promise<string> {
  if (slug) {
    return propertyIdCache.get(`slug:${tenantId}:${slug}`, async () => {
      const row = await withTenant({ tenantId }, (tx) =>
        tx.property.findFirst({ where: { slug }, select: { id: true } })
      );
      return row ? row.id : resolvePrimaryPropertyId(tenantId);
    });
  }
  return resolvePrimaryPropertyId(tenantId);
}

/** The customer-facing SITE name (`Property.name`) a public/email read is scoped
 *  to: the active property (by id) when given, else the tenant's PRIMARY property.
 *  This is the ONLY name shown to customers (storefront chrome, email wordmark/
 *  footer, `{{site.name}}` copy) — NEVER the tenant's legal/org name (`Tenant.name`
 *  is billing/ownership only). The default site's name is seeded from the tenant
 *  name at provisioning, so a single-site tenant still reads a sensible name here.
 *  Returns '' only if the resolved property somehow has a blank name (NOT NULL in
 *  the schema, so effectively unreachable). */
export async function resolveActivePropertyName(
  tenantId: string,
  propertyId?: string | null
): Promise<string> {
  const row = await withTenant({ tenantId }, (tx) =>
    propertyId
      ? tx.property.findUnique({ where: { id: propertyId }, select: { name: true } })
      : tx.property.findFirst({ where: { isPrimary: true }, select: { name: true } })
  );
  return row?.name?.trim() ?? '';
}
