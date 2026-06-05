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
import { notFound } from '@sparx/api-core/errors';

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
