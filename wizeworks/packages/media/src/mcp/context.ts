// MCP tool ctx → media write context. Resolves the tenant's slug (needed to
// build the public /v1/public/media/<id>?tenant=<slug> resolver URL we hand
// back). The tenant table is global (non-RLS), so a direct lookup is correct.

import { prisma } from '@wizeworks/db';
import type { MediaWriteContext } from '../asset-service.js';

export interface McpCtx {
  tenantId: string;
  userId: string;
}

export async function toMediaContext(ctx: McpCtx): Promise<MediaWriteContext> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { slug: true },
  });
  if (!tenant) throw new Error(`Tenant ${ctx.tenantId} not found.`);
  return { tenantId: ctx.tenantId, actorId: ctx.userId, tenantSlug: tenant.slug };
}
