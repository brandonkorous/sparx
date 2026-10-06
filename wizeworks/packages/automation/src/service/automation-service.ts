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
} from '@wizeworks/automation-schemas';
import { Prisma, withTenant } from '@wizeworks/db';
import type { z } from 'zod';

import {
  decideSeedSync,
  type LegacySeedEvidence,
  PLATFORM_VERSION_REFUSAL_MESSAGE,
  pendingPlatformDocument,
  platformUpdatePendingSince,
  type PlatformVersionRefusal,
  platformVersionRefusal,
  readSeedDocument,
  type SeedDocument,
  seedDocumentFingerprint,
  syncedSeedName,
} from './system-seed-sync';

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
    super('this automation is platform-managed and cannot be edited: duplicate it to edit');
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

/** A switch to the platform's newer version of a seeded rule was asked for and
 *  cannot happen now. `reason` says which of the four cases it is; the message is
 *  the sentence for the person who asked (see `PLATFORM_VERSION_REFUSAL_MESSAGE`). */
export class PlatformVersionUnavailableError extends Error {
  readonly code = 'AUTOMATION_PLATFORM_VERSION_UNAVAILABLE' as const;
  constructor(
    public readonly automationId: string,
    public readonly reason: PlatformVersionRefusal
  ) {
    super(PLATFORM_VERSION_REFUSAL_MESSAGE[reason]);
    Object.setPrototypeOf(this, PlatformVersionUnavailableError.prototype);
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

export interface ActionUseCount {
  /** Automations carrying this action at all, whatever their status. */
  total: number;
  /** Of those, the ones switched on — the ones that could fire today. */
  live: number;
}

/**
 * For one action type, how many automations name each value of one config field.
 *
 * The question this answers is "is anything actually wired to do this?", asked
 * from the OTHER side. An email sequence, a funnel, a segment: each is a thing an
 * automation can point at, and each has a screen with an on switch that says what
 * will happen once it is on. None of them can send anything by itself — something
 * has to put a person in — so a screen that says "it is on" without knowing
 * whether anything feeds it is stating an intention as a fact.
 *
 * Measured 2026-09-18: 2,411 automations on this platform, and **not one** of them
 * carried `email.sequence_add`. All 15 sequences sat in draft with zero
 * enrollments ever. Turning any of them on would have reported success and then
 * sent nothing, for good. [[feedback_never_present_absence_as_measurement]]
 *
 * ONE query for the whole set rather than one per id, so a list screen can ask
 * about every row it draws without an N+1. The `@>` containment narrows to rows
 * carrying the action type at all (a partial object matches, nested config
 * included); the per-row walk then reads the config value, because containment
 * cannot report WHICH value matched.
 *
 * Only PUBLISHED actions count. A draft edit that wires one up is not running
 * yet, and saying otherwise would be the same lie one level down.
 */
export async function countAutomationsByActionConfig(
  ctx: ServiceCtx,
  type: string,
  configKey: string
): Promise<Map<string, ActionUseCount>> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const rows = await tx.automation.findMany({
      where: { actions: { array_contains: [{ type }] } },
      select: { status: true, actions: true },
    });

    const counts = new Map<string, ActionUseCount>();
    for (const row of rows) {
      if (!Array.isArray(row.actions)) continue;
      // One automation naming the same target twice is ONE automation pointed at
      // it, not two — the count is of rules, not of steps.
      const named = new Set<string>();
      for (const action of row.actions) {
        if (typeof action !== 'object' || action === null || Array.isArray(action)) continue;
        const shape = action as { type?: unknown; config?: unknown };
        if (shape.type !== type) continue;
        const config = shape.config;
        if (typeof config !== 'object' || config === null || Array.isArray(config)) continue;
        const value = (config as Record<string, unknown>)[configKey];
        if (typeof value === 'string' && value !== '') named.add(value);
      }
      for (const value of named) {
        const seen = counts.get(value) ?? { total: 0, live: 0 };
        seen.total += 1;
        if (row.status === 'active') seen.live += 1;
        counts.set(value, seen);
      }
    }
    return counts;
  });
}

// ─── system / seed path (§3.1 Locked + Managed) ──────────────────────────────

export interface SystemAutomationSpec {
  /**
   * The seed's permanent identity in every tenant, stored on the row as
   * `system_key`. Never change one that has shipped.
   *
   * The DISPLAY NAME used to be the identity, and that broke twice. A platform
   * reword of the name missed the old row and installed a second copy (which is
   * what `previousNames` patched). And a business that renamed its own copy made
   * the re-sync miss it the same way, so a second copy went in beside theirs and
   * both ran: two welcome emails to every new contact. A key the business never
   * sees cannot be renamed by either side.
   *
   * Lower case, dot-separated, module first: `crm.welcome-new-customers`.
   */
  key: string;
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
  /** Locked = the tenant cannot edit/disable it (the "Locked" tier). A locked
   *  rule is always re-synced to the platform's version, status included. */
  locked?: boolean;
  /**
   * The status a NEW install starts in (system automations are typically seeded
   * `active`). Never applied to a row that already exists, unless the rule is
   * locked: pausing a rule is the business's decision, and the re-sync used to
   * undo it every day.
   */
  status?: 'draft' | 'active' | 'paused';
  /**
   * Names this rule used to ship under.
   *
   * Rows installed before `system_key` existed carry no key, so the first re-sync
   * after it shipped finds them by name, then stamps the key on. A rename that
   * shipped before then still has to be found under the name the tenant's row
   * holds, so every name a seed has shipped under stays listed here. A name in
   * this list is also how a re-sync tells the platform's label (which a platform
   * rename may replace) from one the business chose (which it never touches).
   * Keep an entry forever once it has shipped: a tenant restored from an old
   * backup arrives with the old name, unkeyed.
   */
  previousNames?: readonly string[];
}

/** The seed's rule document in the shape a row stores it. */
function specDocument(spec: SystemAutomationSpec): SeedDocument {
  const { triggerType, triggerConfig } = triggerToColumns(spec.trigger);
  return {
    description: spec.description ?? null,
    triggerType,
    triggerConfig,
    conditions: spec.conditions,
    actions: spec.actions,
    goal: spec.goal ?? null,
    maxDepth: spec.maxDepth ?? 3,
  };
}

function rowDocument(a: Automation): SeedDocument {
  return {
    description: a.description,
    triggerType: a.triggerType,
    triggerConfig: a.triggerConfig,
    conditions: a.conditions,
    actions: a.actions,
    goal: a.goal,
    maxDepth: a.maxDepth,
  };
}

/** The columns a document occupies, for a write. */
function documentColumns(doc: SeedDocument) {
  return {
    description: doc.description,
    triggerType: doc.triggerType,
    triggerConfig: json(doc.triggerConfig),
    conditions: json(doc.conditions),
    actions: json(doc.actions),
    goal: doc.goal === null || doc.goal === undefined ? Prisma.DbNull : json(doc.goal),
    maxDepth: doc.maxDepth,
  };
}

/**
 * For a row seeded before fingerprints were stored: did the business publish the
 * document that is live? See `LegacySeedEvidence`.
 */
async function legacyEvidence(
  tx: Prisma.TransactionClient,
  row: Automation,
  liveFingerprint: string
): Promise<LegacySeedEvidence> {
  if (row.version <= 1) return 'never-published';
  const snap = await tx.automationVersion.findFirst({
    where: { automationId: row.id, version: row.version },
  });
  if (!snap) return 'no-snapshot';
  const published = seedDocumentFingerprint({
    description: snap.description,
    triggerType: snap.triggerType,
    triggerConfig: snap.triggerConfig,
    conditions: snap.conditions,
    actions: snap.actions,
    goal: snap.goal,
    maxDepth: snap.maxDepth,
  });
  return published === liveFingerprint ? 'tenant-version-live' : 'platform-overwrote';
}

/**
 * Bring one existing seeded row up to the spec, without overriding the business.
 * The rules are in `system-seed-sync.ts`. Writes nothing when nothing differs, so
 * a daily reconcile over an untouched estate does not bump every `updated_at`.
 */
async function resyncSeededRow(
  tx: Prisma.TransactionClient,
  row: Automation,
  spec: SystemAutomationSpec
): Promise<Automation> {
  const locked = spec.locked ?? false;
  const doc = specDocument(spec);
  const specFingerprint = seedDocumentFingerprint(doc);
  const liveFingerprint = seedDocumentFingerprint(rowDocument(row));
  const outcome = decideSeedSync({
    locked,
    specFingerprint,
    liveFingerprint,
    seededFingerprint: row.seededFingerprint,
    legacy:
      row.seededFingerprint === null && !locked && liveFingerprint !== specFingerprint
        ? await legacyEvidence(tx, row, liveFingerprint)
        : undefined,
  });

  const name = syncedSeedName({
    rowName: row.name,
    specName: spec.name,
    previousNames: spec.previousNames,
    locked,
  });
  const seededFingerprint = outcome === 'tenant-owned' ? row.seededFingerprint : specFingerprint;
  const platformUpdateAt = platformUpdatePendingSince({
    outcome,
    specFingerprint,
    seededFingerprint: row.seededFingerprint,
    current: row.platformUpdateAt,
    now: new Date(),
  });
  // A locked rule's status is the platform's, like the rest of it. Anyone else's
  // status is theirs.
  const status = locked ? (spec.status ?? 'active') : row.status;
  // The held-back version itself, kept beside the flag so the business can see it
  // and take it (`takePlatformVersion`). Compared by fingerprint, because jsonb
  // hands it back with its keys reordered.
  const platformDocument = pendingPlatformDocument({ platformUpdateAt, specDocument: doc });
  const storedPlatform = readSeedDocument(row.platformDocument);
  const platformDocumentChanged =
    (storedPlatform ? seedDocumentFingerprint(storedPlatform) : null) !==
    (platformDocument ? specFingerprint : null);

  const unchanged =
    outcome !== 'apply' &&
    row.systemKey === spec.key &&
    row.name === name &&
    row.locked === locked &&
    row.status === status &&
    row.seededFingerprint === seededFingerprint &&
    (row.platformUpdateAt?.getTime() ?? null) === (platformUpdateAt?.getTime() ?? null) &&
    !platformDocumentChanged;
  if (unchanged) return row;

  // Don't bump `version` on a re-sync: the platform's own refresh is not a
  // publish by the business, and `version` feeds run-stamping and History.
  return tx.automation.update({
    where: { id: row.id },
    data: {
      ...(outcome === 'apply' ? documentColumns(doc) : {}),
      systemKey: spec.key,
      name,
      locked,
      status,
      seededFingerprint,
      platformUpdateAt,
      // Only when it moves: a row with nothing waiting never names the column.
      ...(platformDocumentChanged
        ? { platformDocument: platformDocument ? json(platformDocument) : Prisma.DbNull }
        : {}),
    },
  });
}

/**
 * Find the tenant's copy of a seed: by `system_key` first, then (for a row
 * installed before keys existed) by its current name or any former one. A row that
 * already has a key is never adopted by name, so a business's rule that happens to
 * carry a seed's name is never mistaken for that seed.
 */
async function findSeededRow(
  tx: Prisma.TransactionClient,
  spec: SystemAutomationSpec
): Promise<Automation | null> {
  const keyed = await tx.automation.findFirst({
    where: { origin: 'system', systemKey: spec.key },
  });
  if (keyed) return keyed;
  // Current name first; a former name only if the current one finds nothing, so
  // a rule that has already been renamed is never matched twice.
  for (const name of [spec.name, ...(spec.previousNames ?? [])]) {
    const legacy = await tx.automation.findFirst({
      where: { origin: 'system', systemKey: null, name },
      orderBy: { createdAt: 'asc' },
    });
    if (legacy) return legacy;
  }
  return null;
}

/**
 * Idempotently install or re-sync a platform-managed (system) automation for a
 * tenant: the seed path for the Locked / Managed tiers (Slice F). Matched by
 * `system_key` (see `findSeededRow`). On a re-sync the business keeps every choice
 * it made: a rule it edited keeps its edit, a paused rule stays paused, a renamed
 * rule keeps its name and stays the one row. NEVER reachable from a tenant write:
 * origin/locked/system_key are set here, never accepted from `createAutomation`.
 */
export async function upsertSystemAutomation(
  ctx: ServiceCtx,
  spec: SystemAutomationSpec
): Promise<Automation> {
  if (!spec.key) throw new Error(`system automation "${spec.name}" has no key`);
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const existing = await findSeededRow(tx, spec);
    if (existing) return resyncSeededRow(tx, existing, spec);

    const doc = specDocument(spec);
    // A savepoint, because losing the race below makes Postgres abort the whole
    // transaction: without rolling back to here, the re-read in the catch fails
    // with "current transaction is aborted" and the seed run fails after all.
    await tx.$executeRawUnsafe('SAVEPOINT system_seed_insert');
    try {
      const created = await tx.automation.create({
        data: {
          tenantId: ctx.tenantId,
          name: spec.name,
          ...documentColumns(doc),
          status: spec.status ?? 'active',
          origin: 'system',
          locked: spec.locked ?? false,
          systemKey: spec.key,
          seededFingerprint: seedDocumentFingerprint(doc),
          version: 1,
          publishedAt: new Date(),
        },
      });
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT system_seed_insert');
      return created;
    } catch (err) {
      // Lost the race to another seed run.
      //
      // The lookup above is check-then-insert, so two overlapping seeds both
      // look, both find nothing, and both create. That is how one tenant came to
      // hold two "Handle form submissions" rows a millisecond apart, and two
      // ACTIVE copies of a rule that sends an email means the customer is sent
      // it twice. `automations_system_key_key` (a partial unique index over the
      // seeded rows' keys) refuses the second INSERT; losing it means the other
      // run has already written this seed's row, so re-read it and re-sync it
      // rather than failing a seed nobody is watching.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT system_seed_insert');
      const winner = await tx.automation.findFirst({
        where: { origin: 'system', systemKey: spec.key },
      });
      if (!winner) throw err;
      return resyncSeededRow(tx, winner, spec);
    }
  });
}

// ─── taking the platform's newer version of a seeded rule ───────────────────

/** History notes for a switch. Brand-neutral: both consoles show them as written. */
const KEPT_VERSION_NOTE = 'Your version, saved before switching to the newer one';
const TAKEN_VERSION_NOTE = 'Switched to the newer version of this automation';

/**
 * Switch a seeded rule the business changed to the platform's newer version of it.
 *
 * The re-sync never writes over a rule the business changed (`system-seed-sync.ts`).
 * When the platform has improved one of those, the row is flagged
 * (`platformUpdateAt`) and the newer document waits beside it
 * (`platformDocument`). This is the business saying "use that one instead".
 *
 * It is a publish, the same as any other: the newer document becomes the next
 * version, with a snapshot in the history. What the business had stays in the
 * history too, so it can be restored. A rule seeded before history existed may
 * have no snapshot of its live version, so one is written first.
 *
 * The NAME and the on/off status are the business's and are left exactly as they
 * are: switching the rule's document is not switching the rule on, and a paused
 * rule stays paused. The new fingerprint is recorded, so the next re-sync sees an
 * untouched copy and keeps it current from then on.
 *
 * Refused (`PlatformVersionUnavailableError`) for a rule the business made, a rule
 * with nothing waiting, and a rule with unpublished changes. A locked rule is the
 * platform's already and refuses like every other write.
 */
export async function takePlatformVersion(ctx: ServiceCtx, id: string): Promise<Automation> {
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
    // Hold the row, so two clicks (or a click and a re-sync) cannot both switch it
    // and race for the same version number.
    await tx.$queryRaw`SELECT id FROM automations WHERE id = ${id}::uuid FOR UPDATE`;
    const existing = await tx.automation.findUnique({ where: { id } });
    if (!existing) throw new AutomationNotFoundError(id);
    if (existing.locked) throw new LockedAutomationError(id);
    const refusal = platformVersionRefusal(existing);
    const platform = readSeedDocument(existing.platformDocument);
    if (refusal || !platform) {
      throw new PlatformVersionUnavailableError(id, refusal ?? 'not-ready');
    }

    // What runs now must be in the history before it is replaced.
    const keptAt = await keepLiveVersionInHistory(tx, existing, ctx);
    const version = keptAt + 1;
    const updated = await tx.automation.update({
      where: { id },
      data: {
        ...documentColumns(platform),
        version,
        publishedAt: new Date(),
        publishedBy: ctx.userId ?? null,
        seededFingerprint: seedDocumentFingerprint(platform),
        platformUpdateAt: null,
        platformDocument: Prisma.DbNull,
      },
    });
    await snapshotVersion(tx, {
      automationId: id,
      tenantId: ctx.tenantId,
      version,
      doc: liveDocument(updated),
      note: TAKEN_VERSION_NOTE,
      publishedBy: ctx.userId,
    });
    return updated;
  });
}

/**
 * Make sure the live document is a snapshot in the history; return its version.
 *
 * Usually it already is: the business published it. A rule the platform seeded
 * was never snapshotted (the seed path writes version 1 without one), and a
 * snapshot that no longer matches the live document means something else wrote
 * the live columns. In both cases the live document is written as a version of its
 * own, so the switch never loses what was running.
 */
async function keepLiveVersionInHistory(
  tx: Prisma.TransactionClient,
  row: Automation,
  ctx: ServiceCtx
): Promise<number> {
  const snap = await tx.automationVersion.findFirst({
    where: { automationId: row.id, version: row.version },
  });
  if (snap) {
    const snapFingerprint = seedDocumentFingerprint({
      description: snap.description,
      triggerType: snap.triggerType,
      triggerConfig: snap.triggerConfig,
      conditions: snap.conditions,
      actions: snap.actions,
      goal: snap.goal,
      maxDepth: snap.maxDepth,
    });
    if (snapFingerprint === seedDocumentFingerprint(rowDocument(row))) return row.version;
  }
  const keptAt = snap ? row.version + 1 : row.version;
  await snapshotVersion(tx, {
    automationId: row.id,
    tenantId: ctx.tenantId,
    version: keptAt,
    doc: liveDocument(row),
    note: KEPT_VERSION_NOTE,
    // The version it already was keeps its publisher; a new one is this person's.
    publishedBy: snap ? ctx.userId : row.publishedBy,
  });
  return keptAt;
}
