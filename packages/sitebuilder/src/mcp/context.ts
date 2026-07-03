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

/** The identity of the site a call resolved to — echoed on write results so an
 *  agent (and the user watching) can confirm WHICH of the tenant's sites was
 *  edited. This is the multisite guardrail: omitting `propertyId` silently targets
 *  the primary, and without an echo a wrong target goes unnoticed. */
export interface ResolvedSite {
  id: string;
  name: string;
  slug: string | null;
  isPrimary: boolean;
}

/** A PropertyContext carrying the resolved site's identity for echoing. */
export type SitePropertyContext = PropertyContext & { site: ResolvedSite };

const SITE_SELECT = { id: true, name: true, slug: true, isPrimary: true } as const;

async function resolvePrimarySite(tenantId: string): Promise<ResolvedSite> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.property.findFirst({ where: { isPrimary: true }, select: SITE_SELECT })
  );
  if (!row) throw new SitebuilderNotFoundError('Property', `primary for tenant ${tenantId}`);
  return row;
}

/** Lift an MCP ServiceContext to the PropertyContext the per-property sitebuilder
 *  services need. `requested` (the optional `propertyId` tool arg) is honored only
 *  when it resolves to one of the tenant's own sites; otherwise the primary. The
 *  returned context also carries the resolved site (`.site`) for the write echo. */
export async function toPropertyContext(
  ctx: ServiceContext,
  requested?: string | null
): Promise<SitePropertyContext> {
  if (requested) {
    const row = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.property.findUnique({ where: { id: requested }, select: SITE_SELECT })
    );
    if (row) return { ...ctx, propertyId: row.id, site: row };
  }
  const site = await resolvePrimarySite(ctx.tenantId);
  return { ...ctx, propertyId: site.id, site };
}

/** Merge the resolved site into an object tool result so the caller sees which
 *  site a write hit (the multisite guardrail). Object results only. */
export function withSite<T extends object>(
  pctx: { site: ResolvedSite },
  result: T
): T & { site: ResolvedSite } {
  return { ...result, site: pctx.site };
}
