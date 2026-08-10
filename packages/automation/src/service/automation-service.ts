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

import type { Automation, AutomationVersion } from '@prisma/client';
import {
  type Action,
  type AutomationDraft,
  type CloneAutomationInput,
  type ConditionGroup,
  CreateAutomationInput as CreateSchema,
  type Trigger,
  UpdateAutomationInput as UpdateSchema,
  triggerToColumns,
} from '@sparx/automation-schemas';
import { Prisma, withTenant } from '@sparx/db';
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

/** A `propertyId` was supplied that is not one of this tenant's sites (docs/131
 *  §3.1). Deliberately indistinguishable from "no such site" — a caller must not
 *  be able to tell another tenant's real site id from a fabricated one. */
export class PropertyNotFoundError extends Error {
  readonly code = 'PROPERTY_NOT_FOUND' as const;
  constructor(public readonly propertyId: string) {
    super(`site ${propertyId} not found`);
    Object.setPrototypeOf(this, PropertyNotFoundError.prototype);
  }
}

/** Publish was requested but the automation has no staged draft. */
export class NoDraftError extends Error {
  readonly code = 'AUTOMATION_NO_DRAFT' as const;
  constructor(public readonly automationId: string) {
    super('this automation has no unpublished changes to publish');
    Object.setPrototypeOf(this, NoDraftError.prototype);
  }
}

/** Restore referenced a version that doesn't exist for this automation. */
export class AutomationVersionNotFoundError extends Error {
  readonly code = 'AUTOMATION_VERSION_NOT_FOUND' as const;
  constructor(
    public readonly automationId: string,
    public readonly version: number
  ) {
    super(`automation ${automationId} has no version ${version}`);
    Object.setPrototypeOf(this, AutomationVersionNotFoundError.prototype);
  }
}

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/** The live published document of an automation, in draft column-form (the shape
 *  publish copies between `draft` and the live columns, and snapshots freeze). */
function liveDocument(a: Automation): AutomationDraft {
  return {
    name: a.name,
    description: a.description,
    triggerType: a.triggerType,
    triggerConfig: a.triggerConfig,
    conditions: a.conditions,
    actions: a.actions,
    goal: a.goal,
    maxDepth: a.maxDepth,
  };
}

/** Append an immutable history snapshot for a just-published version. Runs inside
 *  the caller's `withTenant` tx so the snapshot + the live update commit as one. */
function snapshotVersion(
  tx: Prisma.TransactionClient,
  args: {
    automationId: string;
    tenantId: string;
    version: number;
    doc: AutomationDraft;
    note?: string | null;
    publishedBy?: string | null;
  }
) {
  return tx.automationVersion.create({
    data: {
      automationId: args.automationId,
      tenantId: args.tenantId,
      version: args.version,
      name: args.doc.name,
      description: args.doc.description ?? null,
      triggerType: args.doc.triggerType,
      triggerConfig: json(args.doc.triggerConfig),
      conditions: json(args.doc.conditions),
      actions: json(args.doc.actions),
      goal:
        args.doc.goal === undefined || args.doc.goal === null ? Prisma.DbNull : json(args.doc.goal),
      maxDepth: args.doc.maxDepth,
      note: args.note ?? null,
      publishedBy: args.publishedBy ?? null,
    },
  });
}

/**
 * Reject a `propertyId` that is not this tenant's site.
 *
 * The FK to `properties` proves the row EXISTS, not that it is yours — a foreign
 * key check is performed by Postgres internally and is not an authorization
 * boundary. Without this, a caller could scope a rule to another tenant's site
 * id and use the accept/reject response to probe which ids are real.
 *
 * The lookup runs on the caller's tenant-scoped `tx`, so RLS does the actual
 * work: someone else's property simply is not visible and resolves to null.
 * Passing `null` (explicitly tenant-wide) is always allowed.
 */
async function assertOwnProperty(
  tx: Prisma.TransactionClient,
  propertyId: string | null | undefined
): Promise<void> {
  if (!propertyId) return;
  const found = await tx.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!found) throw new PropertyNotFoundError(propertyId);
}

export async function createAutomation(
  ctx: ServiceCtx,
  input: CreateAutomationInput
): Promise<Automation> {
  const data = CreateSchema.parse(input);
  const { triggerType, triggerConfig } = triggerToColumns(data.trigger);
  // Create = first publish (version 1). The authored document lands in the live
  // columns AND a v1 snapshot, so the engine has a published def to run and the
  // history starts at v1; every SUBSEQUENT edit stages in `draft` and lands on
  // an explicit publish. The deployment `status` stays 'draft' (not firing) —
  // the tenant flips it active separately.
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
    await assertOwnProperty(tx, data.propertyId);
    const created = await tx.automation.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: data.propertyId ?? null,
        name: data.name,
        description: data.description ?? null,
        status: 'draft',
        triggerType,
        triggerConfig: json(triggerConfig),
        conditions: json(data.conditions),
        actions: json(data.actions),
        goal: data.goal ? json(data.goal) : Prisma.DbNull,
        maxDepth: data.maxDepth,
        origin: 'user',
        locked: false,
        version: 1,
        publishedAt: new Date(),
        publishedBy: ctx.userId ?? null,
      },
    });
    await snapshotVersion(tx, {
      automationId: created.id,
      tenantId: ctx.tenantId,
      version: 1,
      doc: liveDocument(created),
      note: 'Created',
      publishedBy: ctx.userId,
    });
    return created;
  });
}

/**
 * Edit an automation. Document edits (name / description / trigger / conditions /
 * actions / maxDepth) STAGE in the `draft` — the live published version keeps
 * running until `publishAutomation` promotes the draft (Builder-style draft →
 * publish). A `status` transition is a deployment state, NOT part of the
 * versioned document, so it applies to the live row immediately (and never, on
 * its own, fabricates a phantom draft). A locked rule rejects any edit.
 */
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

    const editsDocument =
      data.name !== undefined ||
      data.description !== undefined ||
      data.trigger !== undefined ||
      data.conditions !== undefined ||
      data.actions !== undefined ||
      data.goal !== undefined ||
      data.maxDepth !== undefined;

    const patch: Prisma.AutomationUpdateInput = {};

    if (editsDocument) {
      // Base = the current draft if one exists, else the live published doc, so
      // successive edits accumulate into one draft.
      const base = (existing.draft as AutomationDraft | null) ?? liveDocument(existing);
      const next: AutomationDraft = { ...base };
      if (data.name !== undefined) next.name = data.name;
      if (data.description !== undefined) next.description = data.description ?? null;
      if (data.trigger !== undefined) {
        const { triggerType, triggerConfig } = triggerToColumns(data.trigger);
        next.triggerType = triggerType;
        next.triggerConfig = triggerConfig;
      }
      if (data.conditions !== undefined) next.conditions = data.conditions;
      if (data.actions !== undefined) next.actions = data.actions;
      // `null` is meaningful here — "remove the goal" — so this tests against
      // undefined, not falsiness.
      if (data.goal !== undefined) next.goal = data.goal;
      if (data.maxDepth !== undefined) next.maxDepth = data.maxDepth;
      patch.draft = json(next);
    }

    if (data.status !== undefined) patch.status = data.status;

    // Re-scoping applies IMMEDIATELY, like `status` — it is deliberately not
    // part of the staged draft document (docs/131 §3.1).
    //
    // Two reasons. It is a SAFETY BOUNDARY, not authored content: on discovering
    // a rule is firing on the wrong business, the fix has to take effect now,
    // not sit in a draft waiting for someone to press Publish. And the version
    // snapshots in `automation_versions` are the rule DOCUMENT — trigger,
    // conditions, actions — so threading scope through them would make every
    // historical version claim a site it was never evaluated under.
    if (data.propertyId !== undefined) {
      await assertOwnProperty(tx, data.propertyId);
      patch.property =
        data.propertyId === null ? { disconnect: true } : { connect: { id: data.propertyId } };
    }

    return tx.automation.update({ where: { id }, data: patch });
  });
}

/**
 * Promote the staged draft to the next live version (docs/84 Slice G-versioning).
 * Copies the draft into the live columns, bumps `version`, appends an immutable
 * snapshot, and clears the draft. A locked rule rejects this; a rule with no
 * draft throws `NoDraftError`. The deployment `status` is untouched — publishing
 * makes the new DOCUMENT live, not the rule itself (the tenant activates
 * separately).
 */
export async function publishAutomation(
  ctx: ServiceCtx,
  id: string,
  opts: { note?: string } = {}
): Promise<Automation> {
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
    const existing = await tx.automation.findUnique({ where: { id } });
    if (!existing) throw new AutomationNotFoundError(id);
    if (existing.locked) throw new LockedAutomationError(id);
    const draft = existing.draft as AutomationDraft | null;
    if (!draft) throw new NoDraftError(id);

    const version = existing.version + 1;
    const updated = await tx.automation.update({
      where: { id },
      data: {
        name: draft.name,
        description: draft.description ?? null,
        triggerType: draft.triggerType,
        triggerConfig: json(draft.triggerConfig),
        conditions: json(draft.conditions),
        actions: json(draft.actions),
        // A draft written before goals existed has no `goal` key at all.
        // `undefined` would leave the live column alone, which is right; an
        // explicit null clears it, which is also right. Only the missing-key case
        // needs the distinction spelled out.
        goal: draft.goal === undefined || draft.goal === null ? Prisma.DbNull : json(draft.goal),
        maxDepth: draft.maxDepth,
        version,
        publishedAt: new Date(),
        publishedBy: ctx.userId ?? null,
        draft: Prisma.DbNull,
      },
    });
    await snapshotVersion(tx, {
      automationId: id,
      tenantId: ctx.tenantId,
      version,
      doc: liveDocument(updated),
      note: opts.note ?? null,
      publishedBy: ctx.userId,
    });
    return updated;
  });
}

/** Throw away the staged draft — the live published version is untouched. */
export async function discardDraft(ctx: ServiceCtx, id: string): Promise<Automation> {
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
    const existing = await tx.automation.findUnique({ where: { id } });
    if (!existing) throw new AutomationNotFoundError(id);
    if (existing.locked) throw new LockedAutomationError(id);
    return tx.automation.update({ where: { id }, data: { draft: Prisma.DbNull } });
  });
}

/** Restore a prior version: copy its snapshot into the `draft`. The tenant then
 *  reviews and publishes (appending a NEW version) — history stays append-only,
 *  never rewound. A locked rule rejects this. */
export async function restoreAutomationVersion(
  ctx: ServiceCtx,
  id: string,
  version: number
): Promise<Automation> {
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
    const existing = await tx.automation.findUnique({ where: { id } });
    if (!existing) throw new AutomationNotFoundError(id);
    if (existing.locked) throw new LockedAutomationError(id);
    const snap = await tx.automationVersion.findFirst({ where: { automationId: id, version } });
    if (!snap) throw new AutomationVersionNotFoundError(id, version);

    const draft: AutomationDraft = {
      name: snap.name,
      description: snap.description,
      triggerType: snap.triggerType,
      triggerConfig: snap.triggerConfig,
      conditions: snap.conditions,
      actions: snap.actions,
      goal: snap.goal,
      maxDepth: snap.maxDepth,
    };
    return tx.automation.update({ where: { id }, data: { draft: json(draft) } });
  });
}

/** Published-version history, newest first. */
export async function listAutomationVersions(
  ctx: ServiceCtx,
  id: string
): Promise<AutomationVersion[]> {
  return withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.automationVersion.findMany({ where: { automationId: id }, orderBy: { version: 'desc' } })
  );
}

/** One historical snapshot (for preview / restore confirmation). */
export async function getAutomationVersion(
  ctx: ServiceCtx,
  id: string,
  version: number
): Promise<AutomationVersion | null> {
  return withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.automationVersion.findFirst({ where: { automationId: id, version } })
  );
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
    // The copy starts its own version line at 1 from the source's LIVE published
    // document (not the source's draft) + a fresh v1 snapshot.
    const clone = await tx.automation.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name ?? `${source.name} (copy)`,
        description: source.description,
        status: 'draft',
        triggerType: source.triggerType,
        triggerConfig: json(source.triggerConfig),
        conditions: json(source.conditions),
        actions: json(source.actions),
        goal: source.goal === null ? Prisma.DbNull : json(source.goal),
        maxDepth: source.maxDepth,
        origin: 'user',
        locked: false,
        clonedFrom: source.id,
        version: 1,
        publishedAt: new Date(),
        publishedBy: ctx.userId ?? null,
      },
    });
    await snapshotVersion(tx, {
      automationId: clone.id,
      tenantId: ctx.tenantId,
      version: 1,
      doc: liveDocument(clone),
      note: `Duplicated from ${source.name}`,
      publishedBy: ctx.userId,
    });
    return clone;
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
  /** The member's reachable sites (docs/131 §3.3); undefined = unrestricted. A
   *  restricted member sees their businesses' automations PLUS tenant-wide
   *  (null-property) ones — an automation's null means "applies to every site"
   *  (shared), unlike an order's orphaned null. */
  propertyIds?: string[];
}

export async function listAutomations(
  ctx: ServiceCtx,
  filter: ListAutomationsFilter = {}
): Promise<Automation[]> {
  return withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.automation.findMany({
      where: {
        ...(filter.propertyIds
          ? { OR: [{ propertyId: { in: filter.propertyIds } }, { propertyId: null }] }
          : {}),
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
  /** The outcome the seeded rule is trying to cause (docs/144 §9). Most system
   *  rules have none — a receipt email is not trying to cause anything — but a
   *  seeded nurture sequence does, and it is what makes its history readable. */
  goal?: ConditionGroup | null;
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
      goal: spec.goal ? json(spec.goal) : Prisma.DbNull,
      maxDepth: spec.maxDepth ?? 3,
      origin: 'system',
      locked: spec.locked ?? false,
    } as const;

    if (existing) {
      // Idempotent re-seed: refresh the live document in place. Don't bump the
      // version on every reconcile tick — system rules are platform-managed, not
      // tenant-versioned (no History panel; `version` only feeds run-stamping).
      return tx.automation.update({ where: { id: existing.id }, data: common });
    }
    return tx.automation.create({
      data: {
        tenantId: ctx.tenantId,
        name: spec.name,
        ...common,
        version: 1,
        publishedAt: new Date(),
      },
    });
  });
}
