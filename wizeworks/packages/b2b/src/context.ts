// Bridge between an authenticated caller (REST request or MCP connection) and the
// B2B service layer. Every service function takes { tenantId, userId }; the REST
// routes derive it from the Fastify auth context (lib/b2b-context.ts), the MCP
// tools from the connection's auth context.

import { withTenant } from '@wizeworks/db';

export interface B2bContext {
  tenantId: string;
  userId: string;
}

/**
 * The tenant's PRIMARY site — the default "issuing site" for B2B writes that must
 * be attributed to one site (a purchase-approval rule's scope, a manually-created
 * net-terms AR invoice's numbering + letterhead — docs/131 §3.6).
 *
 * REST resolves the operator's active site from the `x-sparx-property-id` site-
 * switcher header (lib/property.ts `resolvePropertyId`). An MCP agent has no such
 * header, so it either names a site explicitly on the tool call or lands on the
 * primary — the same site a headerless REST call would.
 */
export async function resolvePrimaryPropertyId(ctx: { tenantId: string }): Promise<string> {
  const row = await withTenant(ctx, (tx) =>
    tx.property.findFirst({
      where: { tenantId: ctx.tenantId, isPrimary: true },
      select: { id: true },
    })
  );
  if (!row) throw new Error(`Tenant ${ctx.tenantId} has no primary site.`);
  return row.id;
}
