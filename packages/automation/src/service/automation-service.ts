// Automation service layer (docs/81 §5, §6, §3.1).
//
// The single write path for automations, shared by REST routes, MCP write-tools,
// and the seed/system path. It enforces the tier invariants that the schema
// alone can't (§3.1):
//   • `origin` / `locked` / `cloned_from` are system-managed — a tenant create
//     can never declare its own rule "system" or "locked".
//   • a LOCKED automation rejects edits, status changes, and deletes — it is the
//     platform's, not the tenant's. The tenant path is "Duplicate to edit"
//     (`cloneAutomation`), which forks a user-origin, editable copy.
//
// All reads/writes are tenant-scoped via `withTenant` (FORCE RLS).

import type { Automation } from '@prisma/client';
import {
  type Action,
  type CloneAutomationInput,
  type ConditionGroup,
  CreateAutomationInput as CreateSchema,
  type Trigger,
  UpdateAutomationInput as UpdateSchema,
  triggerToColumns,
} from '@sparx/automation-schemas';
import type { Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';
import type { z } from 'zod';

/** The pre-parse (input) shapes — zod fills `conditions` / `maxDepth` defaults at
 *  `.parse()`, so callers needn't supply them. */
type CreateAutomationInput = z.input<typeof CreateSchema>;
type UpdateAutomationInput = z.input<typeof UpdateSchema>;

export interface ServiceCtx {
  tenantId: string;
  userId?: string;
}

export class LockedAutomationError extends Error {
  readonly code = 'AUTOMATION_LOCKED' as const;
  constructor(public readonly automationId: string) {
    super('this automation is platform-managed and cannot be edited — duplicate it to edit');
    Object.setPrototypeOf(this, LockedAutomationError.prototype);
  }
}

export class AutomationNotFoundError extends Error {
  readonly code = 'AUTOMATION_NOT_FOUND' as const;
  constructor(public readonly automationId: string) {
    super(`automation ${automationId} not found`);
    Object.setPrototypeOf(this, AutomationNotFoundError.prototype);
  }
}

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export async function createAutomation(
  ctx: ServiceCtx,
  input: CreateAutomationInput
): Promise<Automation> {
  const data = CreateSchema.parse(input);
  const { triggerType, triggerConfig } = triggerToColumns(data.trigger);
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, (tx) =>
    tx.automation.create({
      data: {
        tenantId: ctx.tenantId,
        name: data.name,
        description: data.description ?? null,
        status: 'draft',
        triggerType,
        triggerConfig: json(triggerConfig),
        conditions: json(data.conditions),
        actions: json(data.actions),
        maxDepth: data.maxDepth,
        origin: 'user',
        locked: false,
      },
    })
  );
}

export async function updateAutomation(
  ctx: ServiceCtx,
  id: string,
  input: UpdateAutomationInput
): Promise<Automation> {
  const data = UpdateSchema.parse(input);
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
    const existing = await tx.automation.findUnique({ where: { id } });
    if (!existing) throw new AutomationNotFoundError(id);
    if (existing.locked) throw new LockedAutomationError(id);

    const patch: Prisma.AutomationUpdateInput = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description ?? null;
    if (data.trigger !== undefined) {
      const { triggerType, triggerConfig } = triggerToColumns(data.trigger);
      patch.triggerType = triggerType;
      patch.triggerConfig = json(triggerConfig);
    }
    if (data.conditions !== undefined) patch.conditions = json(data.conditions);
    if (data.actions !== undefined) patch.actions = json(data.actions);
    if (data.maxDepth !== undefined) patch.maxDepth = data.maxDepth;
    if (data.status !== undefined) patch.status = data.status;

    return tx.automation.update({ where: { id }, data: patch });
  });
}

/** Tenant-facing status transition (active / paused / draft). A locked
 *  automation is non-disable-able — it rejects any status change. `error` is
 *  engine-set, not exposed here. */
export async function setAutomationStatus(
  ctx: ServiceCtx,
  id: string,
  status: 'draft' | 'active' | 'paused'
): Promise<Automation> {
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
    const existing = await tx.automation.findUnique({ where: { id } });
    if (!existing) throw new AutomationNotFoundError(id);
    if (existing.locked) throw new LockedAutomationError(id);
    return tx.automation.update({ where: { id }, data: { status } });
  });
}

/** "Duplicate to edit" (§3.1) — fork any automation into a new user-origin,
 *  editable, draft copy. The copy records `cloned_from` lineage and is never
 *  locked, so a tenant can adapt a system/Managed rule without touching it. */
export async function cloneAutomation(
  ctx: ServiceCtx,
  id: string,
  input: CloneAutomationInput = {}
): Promise<Automation> {
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
    const source = await tx.automation.findUnique({ where: { id } });
    if (!source) throw new AutomationNotFoundError(id);
    return tx.automation.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name ?? `${source.name} (copy)`,
        description: source.description,
        status: 'draft',
        triggerType: source.triggerType,
        triggerConfig: json(source.triggerConfig),
        conditions: json(source.conditions),
        actions: json(source.actions),
        maxDepth: source.maxDepth,
        origin: 'user',
        locked: false,
        clonedFrom: source.id,
      },
    });
  });
}

export async function deleteAutomation(ctx: ServiceCtx, id: string): Promise<void> {
  await withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
    const existing = await tx.automation.findUnique({ where: { id } });
    if (!existing) throw new AutomationNotFoundError(id);
    if (existing.locked) throw new LockedAutomationError(id);
    await tx.automation.delete({ where: { id } });
  });
}

export async function getAutomation(ctx: ServiceCtx, id: string): Promise<Automation | null> {
  return withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.automation.findUnique({ where: { id } })
  );
}

export interface ListAutomationsFilter {
  status?: string;
  triggerType?: string;
  origin?: 'user' | 'system';
}

export async function listAutomations(
  ctx: ServiceCtx,
  filter: ListAutomationsFilter = {}
): Promise<Automation[]> {
  return withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.automation.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.triggerType ? { triggerType: filter.triggerType } : {}),
        ...(filter.origin ? { origin: filter.origin } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    })
  );
}

// ─── system / seed path (§3.1 Locked + Managed) ──────────────────────────────

export interface SystemAutomationSpec {
  name: string;
  description?: string | null;
  trigger: Trigger;
  conditions: ConditionGroup;
  actions: Action[];
  maxDepth?: number;
  /** Locked = the tenant cannot edit/disable it (the "Locked" tier). */
  locked?: boolean;
  /** System automations are typically seeded `active`. */
  status?: 'draft' | 'active' | 'paused';
}

/**
 * Idempotently install a platform-managed (system) automation for a tenant —
 * the seed path for the Locked / Managed tiers (Slice F). Matched by
 * (origin='system', name); re-running updates the existing row in place rather
 * than duplicating. NEVER reachable from a tenant write — origin/locked are set
 * here, never accepted from `createAutomation`.
 */
export async function upsertSystemAutomation(
  ctx: ServiceCtx,
  spec: SystemAutomationSpec
): Promise<Automation> {
  const { triggerType, triggerConfig } = triggerToColumns(spec.trigger);
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const existing = await tx.automation.findFirst({
      where: { origin: 'system', name: spec.name },
    });
    const common = {
      description: spec.description ?? null,
      status: spec.status ?? 'active',
      triggerType,
      triggerConfig: json(triggerConfig),
      conditions: json(spec.conditions),
      actions: json(spec.actions),
      maxDepth: spec.maxDepth ?? 3,
      origin: 'system',
      locked: spec.locked ?? false,
    } as const;

    if (existing) {
      return tx.automation.update({ where: { id: existing.id }, data: common });
    }
    return tx.automation.create({ data: { tenantId: ctx.tenantId, name: spec.name, ...common } });
  });
}
