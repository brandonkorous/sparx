// @wizeworks/funnels — the binding and measurement entity for a campaign
// (docs/151, docs/152 B2).
//
// A funnel says THESE parts belong to one campaign, and here is whether it
// worked. It owns nothing it can borrow: goals evaluate through
// @wizeworks/automation-schemas' evaluator, so a business that has written one
// automation condition already knows how to write a funnel goal; follow-up runs
// through Automation and EmailSequence exactly as they already do.
//
// Backend-safe (@wizeworks/db + the schema packages, no render/React) so the
// event-worker can run the nightly reconcile without dragging React in. The
// client-safe shapes live in ./schemas.

// `Prisma` as a VALUE, not a type-only import: `Prisma.DbNull` is a runtime
// sentinel, and it is the only way to clear a nullable JSON column — writing
// plain `null` sets the JSON value `null`, which is a different thing.
import { Prisma, withTenant, type TenantContext, type TxClient } from '@wizeworks/db';
import {
  ConditionGroup,
  evaluateConditions,
  type ResolvedFields,
} from '@wizeworks/automation-schemas';
import type { Funnel, FunnelStageEvent } from '@prisma/client';

import {
  CreateFunnelInput,
  DEFAULT_STAGES,
  FunnelStages,
  RecordStageInput,
  UpdateFunnelInput,
  pathForSlug,
  stagePath,
  type FunnelStage,
} from './schemas.js';

export * from './schemas.js';
export { buildLadder, type Ladder, type LadderRung } from './ladder.js';
export { reconcileFunnelDaily, type ReconcileResult } from './reconcile.js';
export { findAbandoned, type AbandonedSubject, type SweepResult } from './abandon.js';
export { FUNNEL_LIBRARY, recipesForModules, type FunnelRecipe } from './library.js';
export { installFunnelLibrary, type InstallResult } from './install.js';

/** Thrown for a rule this layer owns, so a route can map it to a 400 rather
 *  than letting a Postgres constraint surface as a 500. The constraints are
 *  still there and still the backstop — this is the readable half. */
export class FunnelRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FunnelRuleError';
  }
}

/** The ladder off a row, parsed. Stored as JSON, so every read validates rather
 *  than trusts — a row written before a schema change must fail loudly here
 *  instead of half-working three layers up. */
export function stagesOf(funnel: Pick<Funnel, 'stages'>): FunnelStages {
  return FunnelStages.parse(funnel.stages);
}

// ─── writes ───────────────────────────────────────────────────────────────────

export async function createFunnel(
  ctx: TenantContext,
  rawInput: CreateFunnelInput
): Promise<Funnel> {
  const input = CreateFunnelInput.parse(rawInput);
  // Stamped, not referenced. The ladder belongs to the tenant from here, so a
  // later change to the shipped defaults reaches new funnels only.
  const stages = input.stages ?? DEFAULT_STAGES[input.kind];

  return withTenant(ctx, (tx) =>
    tx.funnel.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId,
        name: input.name,
        description: input.description ?? null,
        kind: input.kind,
        stages: stages as unknown as Prisma.InputJsonValue,
        goal: (input.goal ?? undefined) as Prisma.InputJsonValue | undefined,
        goalValueCents: input.goalValueCents ?? null,
        automationId: input.automationId ?? null,
        sequenceId: input.sequenceId ?? null,
        entryPageId: input.entryPageId ?? null,
        entryFormNodeId: input.entryFormNodeId ?? null,
        stallAfterHours: input.stallAfterHours ?? null,
        recipeKey: input.recipeKey ?? null,
        origin: 'user',
        // Always a draft. A campaign that starts measuring the moment it is
        // created would record the author clicking around their own landing page
        // as its first visitors.
        status: 'draft',
      },
    })
  );
}

export async function updateFunnel(
  ctx: TenantContext,
  id: string,
  rawInput: UpdateFunnelInput
): Promise<Funnel> {
  const input = UpdateFunnelInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const current = await tx.funnel.findUnique({ where: { id } });
    if (!current) throw new FunnelRuleError('That funnel does not exist.');

    // A GOAL IS REQUIRED TO GO ACTIVE, and this is the one place it can be
    // enforced. The column is nullable because a draft is allowed to be
    // half-written; a funnel measuring against no goal is the exact artifact
    // this module exists to replace, so the transition is what checks.
    const nextStatus = input.status ?? current.status;
    const nextGoal = input.goal === undefined ? current.goal : input.goal;
    if (nextStatus === 'active' && !hasGoal(nextGoal)) {
      throw new FunnelRuleError(
        'Say what this funnel is trying to achieve before turning it on — without a goal it can only report what happened, not whether it worked.'
      );
    }

    // Changing the ladder on a LIVE funnel would leave history under keys the
    // ladder no longer has, and the reports would quietly lose rungs. Renaming a
    // stage is fine (the key is the identity); restructuring is not.
    if (input.stages && current.status === 'active') {
      assertKeysPreserved(stagesOf(current), input.stages);
    }

    // Every view rung has to know which page it counts, for the same reason the
    // goal is required: a rung that counts nothing reports zero visitors, and
    // zero is a measurement. Checked on the transition rather than the column so
    // a draft can be half-written.
    if (nextStatus === 'active' && current.status !== 'active') {
      const nextStages = input.stages ?? stagesOf(current);
      const nextEntryPageId =
        input.entryPageId === undefined ? current.entryPageId : input.entryPageId;
      const entryPath = await entryPathOf(tx, nextEntryPageId);
      const unresolved = nextStages.filter((s) => s.kind === 'view' && !stagePath(s, entryPath));
      if (unresolved.length > 0) {
        throw new FunnelRuleError(
          `Say which page counts as ${unresolved.map((s) => `"${s.name}"`).join(' and ')}: give the funnel a landing page, or give that stage its own address.`
        );
      }
    }

    return tx.funnel.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.stages !== undefined
          ? { stages: input.stages as unknown as Prisma.InputJsonValue }
          : {}),
        ...(input.goal !== undefined
          ? { goal: (input.goal ?? Prisma.DbNull) as Prisma.InputJsonValue }
          : {}),
        ...(input.goalValueCents !== undefined ? { goalValueCents: input.goalValueCents } : {}),
        ...(input.automationId !== undefined ? { automationId: input.automationId } : {}),
        ...(input.sequenceId !== undefined ? { sequenceId: input.sequenceId } : {}),
        ...(input.entryPageId !== undefined ? { entryPageId: input.entryPageId } : {}),
        ...(input.entryFormNodeId !== undefined ? { entryFormNodeId: input.entryFormNodeId } : {}),
        ...(input.stallAfterHours !== undefined ? { stallAfterHours: input.stallAfterHours } : {}),
      },
    });
  });
}

/** A goal is present when it exists AND actually says something. An empty
 *  ConditionGroup passes for everything, which as a GOAL means "converted the
 *  moment they arrived" — configured-looking and meaningless. */
function hasGoal(goal: unknown): boolean {
  if (goal === null || goal === undefined) return false;
  const parsed = parseGoal(goal);
  return parsed !== null && parsed.conditions.length > 0;
}

/** A stored goal, parsed, or null when the column holds something that is not a
 *  condition group. Parsed rather than cast on every read: the column is JSON,
 *  and a row written before a shape change must fail visibly here rather than
 *  evaluate to a confident wrong answer. */
function parseGoal(value: unknown): ConditionGroup | null {
  const result = ConditionGroup.safeParse(value);
  return result.success ? result.data : null;
}

/** Renaming a stage keeps its history because the KEY is the identity. Dropping
 *  or re-keying one on a live funnel strands every row already recorded under
 *  it, and the ladder then reports fewer rungs than actually happened. */
function assertKeysPreserved(before: FunnelStages, after: FunnelStages): void {
  const kept = new Set(after.map((s) => s.key));
  const lost = before.filter((s) => !kept.has(s.key)).map((s) => s.key);
  if (lost.length > 0) {
    throw new FunnelRuleError(
      `Pause the funnel before removing ${lost.length === 1 ? 'a stage' : 'stages'} — ${lost.join(', ')} already ${lost.length === 1 ? 'has' : 'have'} history recorded against ${lost.length === 1 ? 'it' : 'them'}. Renaming is fine.`
    );
  }
}

/** The path a funnel's landing page serves at, or null when it has none (or the
 *  page was deleted — `entry_page_id` is SetNull, so that is reachable). */
async function entryPathOf(tx: TxClient, entryPageId: string | null): Promise<string | null> {
  if (!entryPageId) return null;
  const page = await tx.builderPage.findUnique({
    where: { id: entryPageId },
    select: { slug: true },
  });
  return page ? pathForSlug(page.slug) : null;
}

export async function deleteFunnel(ctx: TenantContext, id: string): Promise<void> {
  await withTenant(ctx, (tx) => tx.funnel.delete({ where: { id } }));
}

// ─── reads ────────────────────────────────────────────────────────────────────

export async function listFunnels(
  ctx: TenantContext,
  opts: { propertyId?: string; status?: string } = {}
): Promise<Funnel[]> {
  return withTenant(ctx, (tx) =>
    tx.funnel.findMany({
      where: {
        ...(opts.propertyId ? { propertyId: opts.propertyId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    })
  );
}

export async function getFunnel(ctx: TenantContext, id: string): Promise<Funnel | null> {
  return withTenant(ctx, (tx) => tx.funnel.findUnique({ where: { id } }));
}

// ─── recording ────────────────────────────────────────────────────────────────

/**
 * One known person reached one rung.
 *
 * Anonymous traffic does NOT come through here — it is counted in
 * `rollup_funnel_daily` and identified nowhere, which is what keeps the
 * cookieless promise true. This function cannot write an anonymous row: the
 * input requires exactly one subject and the table's CHECK constraint says the
 * same thing underneath it.
 */
export async function recordStage(
  ctx: TenantContext,
  rawInput: RecordStageInput
): Promise<FunnelStageEvent> {
  const input = RecordStageInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const funnel = await tx.funnel.findUnique({ where: { id: input.funnelId } });
    if (!funnel) throw new FunnelRuleError('That funnel does not exist.');

    // A stage key that is not on the ladder would record history nothing can
    // ever read back — the report groups by the ladder, so an unknown key is
    // written, stored, and invisible. Refuse it at the door.
    const stages = stagesOf(funnel);
    const stage = stages.find((s) => s.key === input.stageKey);
    if (!stage) {
      throw new FunnelRuleError(
        `"${input.stageKey}" is not a stage on this funnel. It has: ${stages.map((s) => s.key).join(', ')}.`
      );
    }
    // NOBODY ANONYMOUS IS WRITTEN HERE, and a view rung is the anonymous half by
    // definition — it is counted from site traffic, where the rotating visitor
    // hash legitimately lives, and never rowed. Writing one would also collide
    // with the derived rollup row for the same (funnel, stage, day).
    if (stage.kind === 'view') {
      throw new FunnelRuleError(
        `"${stage.key}" counts page visits, which are never tied to a person. Record the stage where somebody first tells you who they are.`
      );
    }
    assertValueBelongsHere(stage, input.valueCents);

    // Paused and archived funnels keep their history and stop gaining it. That
    // is the whole difference between pausing and deleting.
    if (funnel.status !== 'active') {
      throw new FunnelRuleError(`This funnel is ${funnel.status}, so it is not recording.`);
    }

    return tx.funnelStageEvent.create({
      data: {
        tenantId: ctx.tenantId,
        funnelId: funnel.id,
        // Denormalized from the funnel, never from the caller: a caller that
        // could name the property could file a person under the wrong business.
        propertyId: funnel.propertyId,
        stageKey: input.stageKey,
        customerId: input.customerId ?? null,
        subjectEmail: input.subjectEmail ?? null,
        entrySource: input.entrySource ?? null,
        entryLandingPath: input.entryLandingPath ?? null,
        entryCampaign: input.entryCampaign ?? null,
        valueCents: input.valueCents ?? null,
        refs: input.refs ?? {},
        ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      },
    });
  });
}

/** Value belongs on the conversion and nowhere else. A number on an `engage`
 *  rung would be summed into attributed revenue and quietly inflate it, which
 *  is the kind of wrong that is only found when somebody reconciles by hand. */
function assertValueBelongsHere(stage: FunnelStage, valueCents: number | undefined): void {
  if (valueCents !== undefined && stage.kind !== 'convert') {
    throw new FunnelRuleError(
      `Only the converting stage carries a value, and "${stage.key}" is a ${stage.kind} stage.`
    );
  }
}

// ─── goals ────────────────────────────────────────────────────────────────────

/**
 * Did this funnel's goal happen, for these resolved fields?
 *
 * One line of real logic, and that is the point: the condition language, its
 * operators and their comparison semantics all live in
 * @wizeworks/automation-schemas, so a funnel goal, an automation condition, a
 * report filter and a scoring rule cannot drift apart. Writing a second
 * evaluator here is how `contains` comes to mean two different things.
 *
 * A funnel with NO goal returns false rather than true. The evaluator treats an
 * empty group as "no filter, everything passes", which is right for a filter and
 * exactly wrong for a goal — it would report every funnel as converting
 * everybody. `updateFunnel` refuses to activate without one; this is the second
 * line of that same defence, for rows that predate it or arrive another way.
 */
export function evaluateFunnelGoal(funnel: Pick<Funnel, 'goal'>, fields: ResolvedFields): boolean {
  const goal = parseGoal(funnel.goal);
  if (goal === null || goal.conditions.length === 0) return false;
  return evaluateConditions(goal, fields);
}
