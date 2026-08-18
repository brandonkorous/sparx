// governanceService — tenant-wide builder governance (docs/61 §8, Phase 6b).
//
// The brand-designer's safety/governance policy over the builder. Currently the
// UTILITY ALLOWLIST: the tenant's ADDITIONAL block rules layered on the PLATFORM
// base denylist (clickjacking / exfiltration / injection guards, hardcoded in
// @wizeworks/surface-compile and NEVER relaxable). A tenant can only TIGHTEN — there
// is no "unblock". One BuilderGovernance row per tenant, upserted lazily on first
// write. Tenant-scoped via withTenant() (FORCE RLS). One service, many transports.

// @wizeworks/db re-exports the Prisma namespace as a VALUE (its DbNull runtime
// sentinel + the input types), so the builder package needs no @prisma/client dep.
import { withTenant, Prisma } from '@wizeworks/db';
import {
  BASE_RULES_DESCRIPTION,
  parseAllowlistConfig,
  type AllowlistRule,
  type BaseRuleDescription,
} from '@wizeworks/surface-compile';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';

export interface AllowlistView {
  /** The platform base rules — read-only, never editable (the security guards). */
  base: BaseRuleDescription[];
  /** The tenant's ADDITIONAL block rules (tighten-only). */
  tenant: AllowlistRule[];
}

/** Read the tenant's utility-allowlist governance — the immutable platform base
 *  rules (for display) plus the tenant's own additions. */
export async function getAllowlist(ctx: ServiceContext): Promise<AllowlistView> {
  const tenant = await withTenant(ctx, async (tx) => {
    const row = await tx.builderGovernance.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { utilityAllowlist: true },
    });
    return parseAllowlistConfig(row?.utilityAllowlist)?.blocks ?? [];
  });
  return { base: BASE_RULES_DESCRIPTION, tenant };
}

/** Replace the tenant's ADDITIONAL allowlist block rules (full replace). An empty
 *  list clears the column to DB NULL → the tenant inherits the platform base only.
 *  Upserts the singleton BuilderGovernance row and audits the change. */
export async function setAllowlist(
  ctx: ServiceContext,
  blocks: AllowlistRule[]
): Promise<AllowlistView> {
  // Json column: store the versioned envelope, or clear to SQL NULL when empty.
  const value =
    blocks.length > 0 ? ({ v: 1, blocks } as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  await withTenant(ctx, async (tx) => {
    await tx.builderGovernance.upsert({
      where: { tenantId: ctx.tenantId },
      create: { tenantId: ctx.tenantId, utilityAllowlist: value },
      update: { utilityAllowlist: value },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.governance.allowlist_updated',
      entityType: 'builder_governance',
      entityId: null,
      diff: { after: { blocks } },
    });
  });
  return getAllowlist(ctx);
}
