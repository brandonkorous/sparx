// ADVANCE (docs/81 §7) — the advisory-lock tick that drives runs forward.
//
// Mirrors `runWebhookDeliveryTick`: a cross-pod singleton (pg advisory lock)
// that picks up due runs and executes their actions from `cursor_index` forward,
// PERSISTING progress after each step. Key property: each step commits in its
// OWN transaction, so step N is durable before step N+1 starts — a crash,
// redeploy, or scale-to-zero resumes exactly where it left off, never replays a
// committed step.
//
// The due-run DISCOVERY is cross-tenant, but the worker runs as the FORCE
// RLS-bound `sparx_app` role — prod grants NO ambient RLS bypass (docs/16 §4,
// Decision F3; even `sparx_owner` is non-superuser there). So the scan goes
// through the `find_due_automation_runs` SECURITY DEFINER function (migration
// 20260731000000) — exactly like `find_pending_webhook_deliveries` — which
// crosses only the column subset in its RETURNS clause. Every subsequent
// read/write then re-enters `withTenant` so it is FORCE-RLS scoped. `db` is the
// app-role client.

import { ADVISORY_LOCKS, withAdvisoryTickLock } from '@sparx/db';
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

const AUTOMATION_TICK_LOCK = ADVISORY_LOCKS.AUTOMATION_RUN;
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

/** Raw shape returned by `find_due_automation_runs` (snake_case columns). */
interface DueRunRow {
  id: string;
  tenant_id: string;
  automation_id: string;
  cause_depth: number;
  cursor_index: number;
  trigger_event: unknown;
}

export async function runAutomationTick(
  deps: EngineDeps,
  db: PrismaClient,
  batch = DEFAULT_BATCH
): Promise<TickResult> {
  installBuiltins();

  // Pass THIS tick's injected `db` as the lock client (not the shared global) so
  // the lock and the work sit on the same client — see withAdvisoryTickLock.
  const SKIPPED: TickResult = { acquired: false, runs: 0, completed: 0, failed: 0, parked: 0 };
  return withAdvisoryTickLock(
    AUTOMATION_TICK_LOCK,
    SKIPPED,
    async () => {
      // Cross-tenant discovery via the SECURITY DEFINER helper (NOW() inside the
      // function gates waiting runs by resume_at) — see the header note.
      const rows = await db.$queryRaw<DueRunRow[]>`
      SELECT id, tenant_id, automation_id, cause_depth, cursor_index, trigger_event
      FROM find_due_automation_runs(${batch}::int)
    `;
      const due: DueRun[] = rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        automationId: r.automation_id,
        causeDepth: r.cause_depth,
        cursorIndex: r.cursor_index,
        triggerEvent: r.trigger_event,
      }));

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
    },
    { client: db }
  );
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
