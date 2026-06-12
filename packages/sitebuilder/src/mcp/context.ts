// Resolve the web PROPERTY (site) an MCP Site Builder call targets.
//
// The MCP transport authenticates a tenant + user but carries no property; the
// applied-theme services (config / publish / schedule) are per-property (docs/49
// Phase 6). This mirrors api-rest's lib/property.ts + the Builder MCP so every
// transport resolves a site identically: an explicit `propertyId` wins WHEN it
// names one of the tenant's OWN properties (RLS scopes the lookup, so a forged id
// fails closed to the primary), otherwise the tenant's primary site. Single-site
// tenants never pass one and behave exactly as before.
//
// `properties` is FORCE RLS — every lookup goes through withTenant. propertyId is
// application-tier scoping, not the security boundary (tenant_id + RLS is).

import { withTenant } from '@sparx/db';
import type { PropertyContext, ServiceContext } from '../errors';
import { SitebuilderNotFoundError } from '../errors';

async function resolvePrimaryPropertyId(tenantId: string): Promise<string> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } })
  );
  if (!row) throw new SitebuilderNotFoundError('Property', `primary for tenant ${tenantId}`);
  return row.id;
}

/** Lift an MCP ServiceContext to the PropertyContext the per-property sitebuilder
 *  services need. `requested` (the optional `propertyId` tool arg) is honored only
 *  when it resolves to one of the tenant's own sites; otherwise the primary. */
export async function toPropertyContext(
  ctx: ServiceContext,
  requested?: string | null
): Promise<PropertyContext> {
  if (requested) {
    const row = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.property.findUnique({ where: { id: requested }, select: { id: true } })
    );
    if (row) return { ...ctx, propertyId: row.id };
  }
  return { ...ctx, propertyId: await resolvePrimaryPropertyId(ctx.tenantId) };
}
