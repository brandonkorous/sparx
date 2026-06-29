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

/** The catalog merged with the tenant's policy rows — each tool tagged with its
 *  effective exposure (default-on unless a row disables it) + whether it's explicit. */
export async function listToolPolicies(ctx: TenantContext): Promise<ToolPolicyDto[]> {
  const overrides = await withTenant(ctx, (tx) =>
    tx.aiToolPolicy.findMany({ select: { toolName: true, enabled: true } })
  );
  const byName = new Map(overrides.map((o) => [o.toolName, o.enabled]));
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
  toolName: string,
  enabled: boolean
): Promise<ToolPolicyDto> {
  if (!isKnownTool(toolName)) throw badRequest(`Unknown MCP tool "${toolName}"`);

  await withTenant(ctx, async (tx) => {
    await tx.aiToolPolicy.upsert({
      where: { tenantId_toolName: { tenantId: ctx.tenantId, toolName } },
      create: {
        tenantId: ctx.tenantId,
        toolName,
        enabled,
        updatedByUserId: ctx.userId ?? null,
      },
      update: { enabled, updatedByUserId: ctx.userId ?? null },
    });
    await writePolicyAudit(tx, ctx, 'ai.tool_policy.set', { tool: toolName, enabled });
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

/** Drop one tool's override (back to the default-on behavior). */
export async function resetToolPolicy(ctx: TenantContext, toolName: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx.aiToolPolicy.deleteMany({ where: { toolName } });
    await writePolicyAudit(tx, ctx, 'ai.tool_policy.reset', { tool: toolName });
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
