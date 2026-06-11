// ADVANCE (docs/81 §7) — the advisory-lock tick that drives runs forward.
//
// Mirrors `runWebhookDeliveryTick`: a cross-pod singleton (pg advisory lock)
// that picks up due runs and executes their actions from `cursor_index` forward,
// PERSISTING progress after each step. Key property: each step commits in its
// OWN transaction, so step N is durable before step N+1 starts — a crash,
// redeploy, or scale-to-zero resumes exactly where it left off, never replays a
// committed step.
//
// The due-run scan is cross-tenant, so it runs on the OWNER connection
// (BYPASSRLS) — the `db` argument MUST be the owner client (the worker connects
// as `sparx_owner`, exactly like the b2b-overdue / webhook ticks). Per-run work
// then re-enters `withTenant` so every read/write is FORCE-RLS scoped.

import { Action } from '@sparx/automation-schemas';
import type { PrismaClient } from '@prisma/client';
import { withTenant } from '@sparx/db';

import { dispatch } from '../dispatch/dispatcher';
import type { EngineDeps, TenantCtx, TriggerEnvelope } from '../engine-types';
import {
  completeRun,
  failRun,
  recordStepCompleted,
  recordStepControl,
  recordStepFailed,
  recordStepGated,
} from '../history/log';
import { resolveFields } from '../resolvers/registry';
import { installBuiltins } from './install';

const AUTOMATION_TICK_LOCK = 4242_4250;
const DEFAULT_BATCH = 100;

export interface TickResult {
  acquired: boolean;
  runs: number;
  completed: number;
  failed: number;
  parked: number;
}

interface DueRun {
  id: string;
  tenantId: string;
  automationId: string;
  causeDepth: number;
  cursorIndex: number;
  triggerEvent: unknown;
}

export async function runAutomationTick(
  deps: EngineDeps,
  db: PrismaClient,
  batch = DEFAULT_BATCH
): Promise<TickResult> {
  installBuiltins();

  const lock = await db.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${AUTOMATION_TICK_LOCK}::int) AS acquired
  `;
  if (!lock[0]?.acquired) {
    deps.logger.debug({}, 'automation-tick: lock held by another pod, skipping');
    return { acquired: false, runs: 0, completed: 0, failed: 0, parked: 0 };
  }

  try {
    const now = new Date();
    const due = (await db.automationRun.findMany({
      where: {
        OR: [{ status: 'running' }, { status: 'waiting', resumeAt: { lte: now } }],
      },
      select: {
        id: true,
        tenantId: true,
        automationId: true,
        causeDepth: true,
        cursorIndex: true,
        triggerEvent: true,
      },
      orderBy: { startedAt: 'asc' },
      take: batch,
    })) as DueRun[];

    const result: TickResult = {
      acquired: true,
      runs: due.length,
      completed: 0,
      failed: 0,
      parked: 0,
    };

    for (const run of due) {
      const outcome = await driveRun(deps, db, run);
      if (outcome === 'completed') result.completed += 1;
      else if (outcome === 'failed') result.failed += 1;
      else if (outcome === 'parked') result.parked += 1;
    }
    return result;
  } finally {
    await db.$queryRaw`SELECT pg_advisory_unlock(${AUTOMATION_TICK_LOCK}::int)`;
  }
}

type RunOutcome = 'completed' | 'failed' | 'parked';
type StepOutcome = 'advance' | 'completed' | 'failed' | 'parked';

/** Drive one run to its next resting point: completion, failure, or a park. */
async function driveRun(deps: EngineDeps, db: PrismaClient, run: DueRun): Promise<RunOutcome> {
  let i = run.cursorIndex;
  // Bounded: actions ≤ 50, each step either advances `i` or stops the run.
  for (;;) {
    const step = await processStep(deps, db, run, i);
    if (step === 'advance') {
      i += 1;
      continue;
    }
    return step; // 'completed' | 'failed' | 'parked'
  }
}

async function processStep(
  deps: EngineDeps,
  db: PrismaClient,
  run: DueRun,
  index: number
): Promise<StepOutcome> {
  return withTenant(
    { tenantId: run.tenantId },
    async (tx): Promise<StepOutcome> => {
      const a = await tx.automation.findUnique({ where: { id: run.automationId } });
      if (!a) {
        await failRun(tx, run.id, run.automationId, 'automation deleted mid-run');
        return 'failed';
      }

      const actions = Action.array().safeParse(a.actions);
      if (!actions.success) {
        await failRun(tx, run.id, run.automationId, 'invalid stored actions');
        return 'failed';
      }
      if (index >= actions.data.length) {
        await completeRun(tx, run.id, run.automationId);
        return 'completed';
      }

      const action = actions.data[index]!;
      const key = {
        runId: run.id,
        tenantId: run.tenantId,
        index,
        actionType: action.type,
      };

      // ── control flow: intercepted before the gated dispatcher ──
      if (action.type === 'platform.wait') {
        const delaySeconds = numberOr(action.config.delaySeconds, 0);
        await recordStepControl(tx, key, { waited: true, delaySeconds });
        await tx.automationRun.update({
          where: { id: run.id },
          data: {
            status: 'waiting',
            cursorIndex: index + 1,
            resumeAt: new Date(Date.now() + delaySeconds * 1000),
          },
        });
        return 'parked';
      }
      if (action.type === 'platform.stop') {
        const reason = stringOr(action.config.reason, 'stopped');
        await recordStepControl(tx, key, { stopped: true, reason });
        await completeRun(tx, run.id, run.automationId);
        return 'completed';
      }

      // ── gated effect ──
      const ctx: TenantCtx = { tenantId: run.tenantId, tx, deps, causeDepth: run.causeDepth };
      const envelope = run.triggerEvent as TriggerEnvelope | null;
      const fields = envelope
        ? await resolveFields(ctx, envelope.type, (envelope.data ?? {}) as Record<string, unknown>)
        : {};

      try {
        const result = await dispatch(ctx, action.type, action.config, fields);
        if (result.kind === 'completed') {
          await recordStepCompleted(tx, key, result.output, result.gateLog);
          await tx.automationRun.update({
            where: { id: run.id },
            data: { cursorIndex: index + 1 },
          });
          return 'advance';
        }
        if (result.kind === 'gated') {
          // Policy block — NOT a failure. Record `gated` and move on.
          await recordStepGated(tx, key, result.reason, result.gateLog);
          await tx.automationRun.update({
            where: { id: run.id },
            data: { cursorIndex: index + 1 },
          });
          return 'advance';
        }
        // deferred (quiet hours, etc.) — park WITHOUT advancing the cursor so the
        // same action re-evaluates once `resume_at` passes.
        await tx.automationRun.update({
          where: { id: run.id },
          data: { status: 'waiting', resumeAt: result.resumeAt },
        });
        return 'parked';
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await recordStepFailed(tx, key, message);
        await failRun(tx, run.id, run.automationId, message);
        return 'failed';
      }
    },
    db
  );
}

function numberOr(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() !== '' ? v : fallback;
}
