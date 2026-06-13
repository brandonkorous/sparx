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

/** The tenant's PRIMARY property id. Every tenant has exactly one (guaranteed by
 *  migration 20260626000000_properties + the partial-unique index). */
export async function resolvePrimaryPropertyId(tenantId: string): Promise<string> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } })
  );
  if (!row) throw notFound('Property', `primary for tenant ${tenantId}`);
  return row.id;
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
    const row = await withTenant({ tenantId }, (tx) =>
      tx.property.findUnique({ where: { id: requested }, select: { id: true } })
    );
    if (row) return row.id;
  }
  return resolvePrimaryPropertyId(tenantId);
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
    const row = await withTenant({ tenantId }, (tx) =>
      tx.property.findFirst({ where: { slug }, select: { id: true } })
    );
    if (row) return row.id;
  }
  return resolvePrimaryPropertyId(tenantId);
}
