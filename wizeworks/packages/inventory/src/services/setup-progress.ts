// The guided inventory setup, and the clock against it (docs/146 Phase 11.1).
//
// ── Why the wizard reads the world as well as its own record ─────────────────
//
// A checklist that only knows what it was told is a checklist that lies. A
// tenant who created their locations from the locations screen, imported their
// stock from the import screen and then opened the wizard should not be asked to
// do all three again — and a tenant who ticked a step and then deleted
// everything it produced should not be told they are done.
//
// So every read reports two things per step: what the RECORD says (somebody
// marked this done, or skipped it, at this time) and what is TRUE right now
// (there are four locations, there are 812 items, an opening count is posted).
// Where they disagree, the screen shows both rather than picking a winner —
// "you marked this done, and there are no locations" is the useful sentence.
//
// ── The thirty minutes ───────────────────────────────────────────────────────
//
// docs/146 §6 promises setup inside half an hour. The timing arithmetic is pure
// and lives in @wizeworks/commerce-schemas (`summarizeSetup`); this file's only job
// is to stamp each step honestly as it happens. Two numbers come out — hands-on
// time and how many sittings it took — because one number would have to either
// count somebody's lunch break or silently discard it.

import {
  CompleteSetupStepInput,
  SETUP_STEPS,
  summarizeSetup,
  type SetupProgress,
  type SetupStepKey,
  type SetupStepState,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma, TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';

/** What is actually true, independent of what anybody ticked. */
export interface SetupReadiness {
  locations: number;
  items: number;
  /** Stock positions with a quantity on them. Zero with items present means a
   *  catalogue exists and nothing has been counted into it yet. */
  stockedPositions: number;
  /** Posted opening counts. The evidence that day one started from a number
   *  somebody stood in front of. */
  openingCounts: number;
  /** Levels with a reorder point set — the alert step's real outcome. */
  levelsWithAlerts: number;
  /** Import batches applied. */
  importsApplied: number;
}

export interface SetupStepView {
  key: SetupStepKey;
  title: string;
  summary: string;
  why: string;
  skippable: boolean;
  skipCost: string | null;
  completedAt: string | null;
  skippedAt: string | null;
  result: Record<string, unknown>;
  /** Whether the world shows this step's effect. Null when the step has no
   *  observable effect to check — never `false`, which would read as "we looked
   *  and it isn't there". */
  satisfied: boolean | null;
  /** Set when the record and the world disagree, in the operator's words. */
  discrepancy: string | null;
}

export interface SetupProgressView extends SetupProgress {
  startedAt: string | null;
  completedAt: string | null;
  dismissedAt: string | null;
  stepViews: SetupStepView[];
  readiness: SetupReadiness;
}

interface ProgressRow {
  steps: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  dismissedAt: Date | null;
}

function parseSteps(raw: unknown): Partial<Record<SetupStepKey, SetupStepState>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Partial<Record<SetupStepKey, SetupStepState>> = {};
  for (const step of SETUP_STEPS) {
    const value = (raw as Record<string, unknown>)[step.key];
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    out[step.key] = {
      completedAt: typeof entry.completedAt === 'string' ? entry.completedAt : null,
      skippedAt: typeof entry.skippedAt === 'string' ? entry.skippedAt : null,
      result:
        entry.result && typeof entry.result === 'object' && !Array.isArray(entry.result)
          ? (entry.result as Record<string, unknown>)
          : {},
    };
  }
  return out;
}

export async function getSetupProgress(ctx: ServiceContext): Promise<SetupProgressView> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.inventorySetupProgress.findFirst({ where: { tenantId: ctx.tenantId } });
    const readiness = await readWorld(tx, ctx.tenantId);
    return buildView(row, readiness);
  });
}

function buildView(row: ProgressRow | null, readiness: SetupReadiness): SetupProgressView {
  const steps = parseSteps(row?.steps ?? {});
  const progress = summarizeSetup({
    startedAt: row?.startedAt ?? null,
    completedAt: row?.completedAt ?? null,
    steps,
  });

  const satisfaction: Record<SetupStepKey, boolean | null> = {
    locations: readiness.locations > 0,
    import: readiness.items > 0,
    // Mapping leaves no trace of its own beyond the import it produced — a
    // person who typed their stock in by hand mapped nothing and is not behind.
    mapping: null,
    opening_balance: readiness.openingCounts > 0,
    alerts: readiness.levelsWithAlerts > 0,
  };

  const stepViews: SetupStepView[] = SETUP_STEPS.map((definition) => {
    const state = steps[definition.key];
    const satisfied = satisfaction[definition.key];
    const marked = Boolean(state?.completedAt);
    let discrepancy: string | null = null;
    if (marked && satisfied === false) {
      discrepancy = 'This was marked done, but nothing in your account shows it.';
    } else if (!marked && !state?.skippedAt && satisfied === true) {
      discrepancy = 'You have already done this somewhere else — tick it off.';
    }
    return {
      key: definition.key,
      title: definition.title,
      summary: definition.summary,
      why: definition.why,
      skippable: definition.skippable,
      skipCost: definition.skipCost,
      completedAt: state?.completedAt ?? null,
      skippedAt: state?.skippedAt ?? null,
      result: state?.result ?? {},
      satisfied,
      discrepancy,
    };
  });

  return {
    ...progress,
    startedAt: row?.startedAt?.toISOString() ?? null,
    completedAt: row?.completedAt?.toISOString() ?? null,
    dismissedAt: row?.dismissedAt?.toISOString() ?? null,
    stepViews,
    readiness,
  };
}

async function readWorld(tx: TxClient, tenantId: string): Promise<SetupReadiness> {
  const [locations, items, stockedPositions, openingCounts, levelsWithAlerts, importsApplied] =
    await Promise.all([
      tx.warehouse.count({ where: { tenantId, deletedAt: null, isSystem: false } }),
      tx.productVariant.count({ where: { tenantId, deletedAt: null } }),
      tx.inventoryLevel.count({ where: { tenantId, onHand: { not: 0 } } }),
      tx.inventoryCount.count({ where: { tenantId, type: 'opening', status: 'posted' } }),
      tx.inventoryLevel.count({ where: { tenantId, reorderPoint: { not: null } } }),
      tx.inventoryImportBatch.count({ where: { tenantId, status: 'applied' } }),
    ]);
  return { locations, items, stockedPositions, openingCounts, levelsWithAlerts, importsApplied };
}

/**
 * Record what just happened in the wizard.
 *
 * `startedAt` is stamped by the FIRST call rather than by opening the screen:
 * a clock that starts when a page loads measures how long a tab was open, and
 * the tab people leave open is the one they were not using.
 */
export async function completeSetupStep(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<SetupProgressView> {
  const input = CompleteSetupStepInput.parse(rawInput);
  const now = new Date();

  return withTenant(ctx, async (tx) => {
    const existing = await tx.inventorySetupProgress.findFirst({
      where: { tenantId: ctx.tenantId },
    });
    const steps = parseSteps(existing?.steps ?? {});

    steps[input.step] =
      input.action === 'reopen'
        ? { completedAt: null, skippedAt: null, result: {} }
        : {
            completedAt: input.action === 'complete' ? now.toISOString() : null,
            skippedAt: input.action === 'skip' ? now.toISOString() : null,
            result: input.result ?? steps[input.step]?.result ?? {},
          };

    // Complete when nothing is left outstanding. A setup finished by skipping
    // the last two steps IS finished — the skips are on the record, and treating
    // them as unfinished would leave a checklist nagging forever about a
    // decision that was already made.
    const outstanding = SETUP_STEPS.filter(
      (step) => !steps[step.key]?.completedAt && !steps[step.key]?.skippedAt
    );
    const startedAt = existing?.startedAt ?? now;
    const completedAt = outstanding.length === 0 ? (existing?.completedAt ?? now) : null;

    const data = {
      steps: steps as unknown as Prisma.InputJsonValue,
      startedAt,
      completedAt,
    };

    const row = existing
      ? await tx.inventorySetupProgress.update({ where: { id: existing.id }, data })
      : await tx.inventorySetupProgress.create({ data: { tenantId: ctx.tenantId, ...data } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: `inventory.setup.${input.action}`,
      entityType: 'InventorySetupProgress',
      entityId: row.id,
      diff: { after: { step: input.step, remaining: outstanding.length } },
    });

    return buildView(row, await readWorld(tx, ctx.tenantId));
  });
}

/** They have decided they are done with the wizard, finished or not. Recorded
 *  rather than acted on: the surface stays reachable, it simply stops asking. */
export async function dismissSetup(
  ctx: ServiceContext,
  dismissed = true
): Promise<SetupProgressView> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.inventorySetupProgress.findFirst({
      where: { tenantId: ctx.tenantId },
    });
    const data = { dismissedAt: dismissed ? new Date() : null };
    const row = existing
      ? await tx.inventorySetupProgress.update({ where: { id: existing.id }, data })
      : await tx.inventorySetupProgress.create({ data: { tenantId: ctx.tenantId, ...data } });
    return buildView(row, await readWorld(tx, ctx.tenantId));
  });
}

/** Mark a step done from somewhere OTHER than the wizard — the importer when a
 *  batch applies, the count when an opening balance posts. Best-effort: a setup
 *  record that failed to update must never fail the work it was recording. */
export async function noteSetupStep(
  tx: TxClient,
  tenantId: string,
  step: SetupStepKey,
  result: Record<string, unknown>
): Promise<void> {
  try {
    const existing = await tx.inventorySetupProgress.findFirst({ where: { tenantId } });
    // Only the wizard STARTS a setup. A tenant who never opened it and imports a
    // spreadsheet has not begun a guided setup, and inventing one would report a
    // duration for a thing that never happened.
    if (!existing) return;
    const steps = parseSteps(existing.steps);
    if (steps[step]?.completedAt) return;
    steps[step] = { completedAt: new Date().toISOString(), skippedAt: null, result };
    await tx.inventorySetupProgress.update({
      where: { id: existing.id },
      data: { steps: steps as unknown as Prisma.InputJsonValue },
    });
  } catch {
    // Deliberately swallowed. See above.
  }
}
