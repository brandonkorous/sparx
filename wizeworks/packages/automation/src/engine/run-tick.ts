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

import { ADVISORY_LOCKS, withAdvisoryTickLock } from '@wizeworks/db';
import { ConditionGroup } from '@wizeworks/automation-schemas';
import type { PrismaClient } from '@prisma/client';
import { withTenant } from '@wizeworks/db';

import { evaluateConditions } from '../conditions/evaluate';
import { dispatch } from '../dispatch/dispatcher';
import type { EngineDeps, ResolvedFields, TenantCtx, TriggerEnvelope } from '../engine-types';
import {
  completeRun,
  convertRun,
  failRun,
  recordStepCompleted,
  recordStepControl,
  recordStepFailed,
  recordStepGated,
} from '../history/log';
import { resolveFields } from '../resolvers/registry';
import { compileStoredActions } from './compile';
import { installBuiltins } from './install';

const AUTOMATION_TICK_LOCK = ADVISORY_LOCKS.AUTOMATION_RUN;
const DEFAULT_BATCH = 100;

export interface TickResult {
  acquired: boolean;
  runs: number;
  completed: number;
  failed: number;
  parked: number;
  /** Runs that stopped because the automation's goal was met (docs/144 §9).
   *  Counted apart from `completed` for the same reason the status is: a rule
   *  that converts on step one and a rule that sent every email and achieved
   *  nothing are not the same outcome. */
  converted: number;
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
  const SKIPPED: TickResult = {
    acquired: false,
    runs: 0,
    completed: 0,
    failed: 0,
    parked: 0,
    converted: 0,
  };
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
        converted: 0,
      };

      for (const run of due) {
        const outcome = await driveRun(deps, db, run);
        if (outcome === 'completed') result.completed += 1;
        else if (outcome === 'failed') result.failed += 1;
        else if (outcome === 'parked') result.parked += 1;
        else if (outcome === 'converted') result.converted += 1;
      }
      return result;
    },
    { client: db }
  );
}

type RunOutcome = 'completed' | 'failed' | 'parked' | 'converted';
/** `advance` carries the NEXT index rather than implying `i + 1`: a branch sends
 *  the cursor to its else-arm and a jump sends it past one, so "the next step" is
 *  no longer always the one after this. */
type StepOutcome = { kind: 'advance'; next: number } | { kind: RunOutcome };

/** Drive one run to its next resting point: completion, failure, or a park. */
async function driveRun(deps: EngineDeps, db: PrismaClient, run: DueRun): Promise<RunOutcome> {
  let i = run.cursorIndex;
  // Bounded by the compiled program length: every branch jumps FORWARD (the
  // compiler emits no backward targets, so there are no loops to run away),
  // and each step either advances the cursor or stops the run.
  for (;;) {
    const step = await processStep(deps, db, run, i);
    if (step.kind === 'advance') {
      i = step.next;
      continue;
    }
    return step.kind;
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
        return { kind: 'failed' };
      }

      // The authored tree is lowered to a flat, numbered program EVERY step
      // (docs/144 §9) — a pure function of the stored actions, so the indices a
      // previous tick wrote still address the same instructions here.
      let program;
      try {
        program = compileStoredActions(a.actions);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'invalid stored actions';
        await failRun(tx, run.id, run.automationId, message);
        return { kind: 'failed' };
      }

      const ctx: TenantCtx = { tenantId: run.tenantId, tx, deps, causeDepth: run.causeDepth };
      const envelope = run.triggerEvent as TriggerEnvelope | null;
      // Re-resolved on EVERY step, not cached across the run: an action two steps
      // back may have changed the very record a branch is about to ask about, and
      // a branch that reads stale fields is a rule that visibly does the wrong
      // thing. Same reason the run row stores the envelope rather than the fields.
      const fields: ResolvedFields = envelope
        ? await resolveFields(ctx, envelope.type, (envelope.data ?? {}) as Record<string, unknown>)
        : {};

      // ── the goal, checked BEFORE the next step ──
      //
      // Before, so a run whose goal is already met does not fire one more action
      // on the way out. Checked at every boundary rather than once at enrollment,
      // because the interesting case is a goal met DURING the run — the customer
      // booked after the first email — which is exactly what a wait step exists
      // to give them time to do.
      const goal = parseGoal(a.goal);
      if (goal && evaluateConditions(goal, fields)) {
        await convertRun(tx, run.id, run.automationId);
        deps.logger.debug({ runId: run.id, automationId: a.id }, 'automation: goal met');
        return { kind: 'converted' };
      }

      if (index >= program.steps.length) {
        await completeRun(tx, run.id, run.automationId);
        return { kind: 'completed' };
      }

      const step = program.steps[index]!;

      // ── branching: a question, not an effect (docs/144 §9) ──
      //
      // Never reaches the dispatcher. A branch produces nothing, touches nothing
      // outside the run, and has no gate manifest to declare — putting it through
      // the gate chain would mean inventing a module owner for "asking".
      if (step.kind === 'branch') {
        const taken = evaluateConditions(step.condition, fields);
        const next = taken ? index + 1 : step.elseIndex;
        await recordStepControl(
          tx,
          { runId: run.id, tenantId: run.tenantId, index, actionType: 'platform.if_else' },
          { branched: true, taken: taken ? 'then' : 'otherwise', label: step.label ?? null },
          step.path
        );
        await tx.automationRun.update({ where: { id: run.id }, data: { cursorIndex: next } });
        return { kind: 'advance', next };
      }

      // ── the compiler's own bookkeeping: skip the else-arm ──
      //
      // Not logged. A jump is an artifact of how branching is implemented, and a
      // run history that showed it would be describing the compiler rather than
      // what the rule did.
      if (step.kind === 'jump') {
        await tx.automationRun.update({
          where: { id: run.id },
          data: { cursorIndex: step.targetIndex },
        });
        return { kind: 'advance', next: step.targetIndex };
      }

      const action = step.action;
      const key = {
        runId: run.id,
        tenantId: run.tenantId,
        index,
        actionType: action.type,
      };

      // ── control flow: intercepted before the gated dispatcher ──
      if (action.type === 'platform.wait') {
        const delaySeconds = numberOr(action.config.delaySeconds, 0);
        await recordStepControl(tx, key, { waited: true, delaySeconds }, step.path);
        await tx.automationRun.update({
          where: { id: run.id },
          data: {
            status: 'waiting',
            cursorIndex: index + 1,
            resumeAt: new Date(Date.now() + delaySeconds * 1000),
          },
        });
        return { kind: 'parked' };
      }
      if (action.type === 'platform.stop') {
        const reason = stringOr(action.config.reason, 'stopped');
        await recordStepControl(tx, key, { stopped: true, reason }, step.path);
        await completeRun(tx, run.id, run.automationId, reason);
        return { kind: 'completed' };
      }

      // ── gated effect ──
      try {
        const result = await dispatch(ctx, action.type, action.config, fields);
        if (result.kind === 'completed') {
          await recordStepCompleted(tx, key, result.output, result.gateLog, step.path);
          await tx.automationRun.update({
            where: { id: run.id },
            data: { cursorIndex: index + 1 },
          });
          return { kind: 'advance', next: index + 1 };
        }
        if (result.kind === 'gated') {
          // Policy block — NOT a failure. Record `gated` and move on.
          await recordStepGated(tx, key, result.reason, result.gateLog, step.path);
          await tx.automationRun.update({
            where: { id: run.id },
            data: { cursorIndex: index + 1 },
          });
          return { kind: 'advance', next: index + 1 };
        }
        // deferred (quiet hours, etc.) — park WITHOUT advancing the cursor so the
        // same action re-evaluates once `resume_at` passes.
        await tx.automationRun.update({
          where: { id: run.id },
          data: { status: 'waiting', resumeAt: result.resumeAt },
        });
        return { kind: 'parked' };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await recordStepFailed(tx, key, message, step.path);
        await failRun(tx, run.id, run.automationId, message);
        return { kind: 'failed' };
      }
    },
    db
  );
}

/** The automation's goal, or null. A stored value that no longer parses is
 *  treated as "no goal" rather than failing the run: a rule that still does its
 *  work is better than one stopped by an unreadable success criterion, and the
 *  authoring boundary already rejects an invalid goal on write. */
function parseGoal(stored: unknown): ConditionGroup | null {
  if (stored === null || stored === undefined) return null;
  const parsed = ConditionGroup.safeParse(stored);
  if (!parsed.success) return null;
  // An empty group passes for everything, which would convert every run at
  // enrollment. That is never what "no goal set yet" means.
  return parsed.data.conditions.length === 0 ? null : parsed.data;
}

function numberOr(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() !== '' ? v : fallback;
}
