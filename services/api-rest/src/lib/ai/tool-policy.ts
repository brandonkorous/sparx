// MCP tool-policy overlay — service layer (docs/07 §9).
//
// A per-tenant allow/deny overlay on the code-defined MCP tool catalog. Default is
// "exposed" (no row); a row with enabled=false hides the tool from tools/list AND
// makes the MCP server refuse it at dispatch (services/api-mcp/src/tool-policy.ts
// enforces the same table). This service backs the dashboard surface: list the
// catalog with each tool's effective exposure, flip one tool, or reset to defaults.

import type { Prisma } from '@sparx/db';
import { withTenant, type TenantContext } from '@sparx/db';
import { badRequest } from '@sparx/api-core/errors';

import { TOOL_CATALOG, isKnownTool } from './tool-catalog.js';
import type { ToolPolicyDto } from './types.js';

/** The catalog merged with this SITE's effective policy — each tool tagged with
 *  its exposure (default-on unless a row disables it) + whether it's explicit.
 *
 *  Most-specific-wins, matching the MCP server's resolver exactly (docs/131
 *  §3.5): a site row overrides a tenant-wide row in either direction, so a site
 *  can re-enable something disabled broadly. The two implementations MUST agree
 *  — a management screen that shows a different verdict than the server enforces
 *  is worse than no screen. */
export async function listToolPolicies(
  ctx: TenantContext,
  propertyId: string
): Promise<ToolPolicyDto[]> {
  const overrides = await withTenant(ctx, (tx) =>
    tx.aiToolPolicy.findMany({
      // `OR`, not `in: [id, null]` — Prisma's `in` rejects null on a nullable
      // column.
      where: { OR: [{ propertyId }, { propertyId: null }] },
      select: { toolName: true, enabled: true, propertyId: true },
    })
  );
  const byName = new Map<string, boolean>();
  for (const o of overrides.filter((o) => !o.propertyId)) byName.set(o.toolName, o.enabled);
  for (const o of overrides.filter((o) => o.propertyId)) byName.set(o.toolName, o.enabled);
  return TOOL_CATALOG.map((t) => {
    const explicit = byName.has(t.name);
    return {
      name: t.name,
      description: t.description,
      scope: t.scope,
      module: t.module,
      write: t.write,
      enabled: explicit ? byName.get(t.name)! : true,
      explicit,
    };
  });
}

/** Set one tool's exposure (upsert the policy row). Rejects unknown tool names so
 *  a typo can't silently create a dead policy. */
export async function setToolPolicy(
  ctx: TenantContext,
  propertyId: string | null,
  toolName: string,
  enabled: boolean
): Promise<ToolPolicyDto> {
  if (!isKnownTool(toolName)) throw badRequest(`Unknown MCP tool "${toolName}"`);

  await withTenant(ctx, async (tx) => {
    // findFirst + branch rather than upsert, because `propertyId` is NULLABLE and
    // Prisma's compound-unique input requires every component to be non-null —
    // there is no way to express "the row whose property_id IS NULL" as a unique
    // where. The DB still guarantees at most one match: the unique index is
    // NULLS NOT DISTINCT (migration 20261217000000), so the tenant-wide row
    // cannot be duplicated even though this read is a findFirst.
    const existing = await tx.aiToolPolicy.findFirst({
      where: { propertyId, toolName },
      select: { id: true },
    });
    if (existing) {
      await tx.aiToolPolicy.update({
        where: { id: existing.id },
        data: { enabled, updatedByUserId: ctx.userId ?? null },
      });
    } else {
      await tx.aiToolPolicy.create({
        data: {
          tenantId: ctx.tenantId,
          propertyId,
          toolName,
          enabled,
          updatedByUserId: ctx.userId ?? null,
        },
      });
    }
    await writePolicyAudit(tx, ctx, 'ai.tool_policy.set', { tool: toolName, enabled, propertyId });
  });

  const entry = TOOL_CATALOG.find((t) => t.name === toolName)!;
  return {
    name: entry.name,
    description: entry.description,
    scope: entry.scope,
    module: entry.module,
    write: entry.write,
    enabled,
    explicit: true,
  };
}

/** Drop one tool's override FOR THIS SITE (back to the tenant-wide row, or to
 *  default-on if there isn't one). Scoped rather than sweeping: "undo what I just
 *  did here" must not also clear a sibling business's deliberate restriction. */
export async function resetToolPolicy(
  ctx: TenantContext,
  propertyId: string | null,
  toolName: string
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx.aiToolPolicy.deleteMany({ where: { propertyId, toolName } });
    await writePolicyAudit(tx, ctx, 'ai.tool_policy.reset', { tool: toolName, propertyId });
  });
}

/** Clear every override — all tools back to default-on. */
export async function resetAllToolPolicies(ctx: TenantContext): Promise<number> {
  return withTenant(ctx, async (tx) => {
    const { count } = await tx.aiToolPolicy.deleteMany({});
    await writePolicyAudit(tx, ctx, 'ai.tool_policy.reset_all', { count });
    return count;
  });
}

async function writePolicyAudit(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
  action: string,
  after: Record<string, unknown>
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action,
      entityType: 'AiToolPolicy',
      // entityType-only event (no single uuid entity) — entity_id stays null
      // (the column is @db.Uuid; the tool name lives in diff, not entity_id).
      diff: { after } as Prisma.InputJsonValue,
    },
  });
}
