// Enrollment analytics (docs/144 §9) — what one automation is actually doing.
//
// ══════════════════════════════════════════════════════════════════════════
// THE QUESTION THIS ANSWERS
// ══════════════════════════════════════════════════════════════════════════
//
// A rule's run list says a lot of things happened. It does not say whether the
// rule works. The owner's real question has two halves — "how many people did
// this reach" and "how many of them did the thing" — and the second half is
// unanswerable without a goal, which is why goals and this read shipped together.
//
// The funnel:
//
//   entered    every run ever created for this rule
//   active     still going — running, or parked on a wait
//   converted  the goal was met (the run stopped early, on purpose)
//   completed  ran to the end without meeting a goal, or with no goal declared
//   exited     stopped by a `platform.stop` action
//   failed     an action threw
//
// `completed` and `exited` are separated deliberately. Both mean "finished
// without converting", but one ran out of actions and the other was deliberately
// halted by a rule the author wrote — and an author who wrote that rule is asking
// how often it fires.
//
// Everything here reads `automation_runs` + `automation_run_steps`, which are
// already the source of truth. Nothing is rolled up or cached: a single
// automation's run count is small, and a stale funnel would be worse than a slow
// one. (The tenant-wide daily volume series, which IS large, has its own rollup —
// see run-report-service.)

import { ConditionGroup } from '@wizeworks/automation-schemas';
import { withTenant, type TxClient } from '@wizeworks/db';

import type { ServiceCtx } from './automation-service';

export interface EnrollmentFunnel {
  entered: number;
  active: number;
  converted: number;
  completed: number;
  exited: number;
  failed: number;
  /** converted / entered, 0–100 with one decimal. The number the whole feature
   *  exists to produce. Null when the automation declares no goal — a rate of
   *  0% would read as "this never works" rather than "nothing was measured". */
  conversionRate: number | null;
  /** Median wall-clock seconds from enrollment to goal, over converted runs.
   *  Null when nothing has converted. Median rather than mean because one run
   *  parked over a weekend drags an average past usefulness. */
  medianSecondsToGoal: number | null;
}

export interface StepDropOff {
  /** Index into the compiled program. */
  index: number;
  /** Position in the authored rule (`2`, `2.then.0`) — what the editor shows. */
  path: string | null;
  actionType: string;
  reached: number;
  completed: number;
  gated: number;
  failed: number;
  /** Runs that reached this step but never reached the next one, as a
   *  percentage of those that reached it. The column an author scans for the
   *  place their rule quietly stops working. */
  dropOffRate: number;
}

export interface EnrollmentAnalytics {
  automationId: string;
  hasGoal: boolean;
  funnel: EnrollmentFunnel;
  steps: StepDropOff[];
}

interface StepAggRow {
  action_index: number;
  path: string | null;
  action_type: string;
  reached: bigint;
  completed: bigint;
  gated: bigint;
  failed: bigint;
}

const n = (v: bigint | number): number => Number(v);

/** One decimal, and never NaN when the denominator is zero. */
function rate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export async function enrollmentAnalytics(
  ctx: ServiceCtx,
  automationId: string
): Promise<EnrollmentAnalytics> {
  return withTenant(ctx, async (tx) => {
    const automation = await tx.automation.findFirst({
      where: { id: automationId },
      select: { id: true, goal: true },
    });
    if (!automation) {
      throw new Error(`automation ${automationId} not found`);
    }

    const byStatus = await tx.automationRun.groupBy({
      by: ['status'],
      where: { automationId },
      _count: { _all: true },
    });

    const count = (status: string): number =>
      n(byStatus.find((row) => row.status === status)?._count._all ?? 0);

    // `exited` is a completed run carrying a stop reason. It is not its own
    // status — a run halted by `platform.stop` genuinely did complete — so it is
    // counted here and SUBTRACTED from completed, rather than double-counted
    // into both.
    const exited = await tx.automationRun.count({
      where: { automationId, status: 'completed', exitReason: { not: null } },
    });

    const converted = count('converted');
    const completedAll = count('completed');
    const failed = count('failed');
    const active = count('running') + count('waiting');
    const skipped = count('skipped');
    const entered = converted + completedAll + failed + active + skipped;

    // An EMPTY condition group is how "no goal" arrives from an editor that
    // rendered the field and left it alone. It passes for everything, so treating
    // it as a goal would report a 100% conversion rate on a rule measuring
    // nothing — the most confidently wrong number this surface could show.
    const parsedGoal = ConditionGroup.safeParse(automation.goal ?? null);
    const goalDeclared = parsedGoal.success && parsedGoal.data.conditions.length > 0;

    const funnel: EnrollmentFunnel = {
      entered,
      active,
      converted,
      completed: Math.max(0, completedAll - exited),
      exited,
      failed,
      conversionRate: goalDeclared ? rate(converted, entered) : null,
      medianSecondsToGoal: await medianTimeToGoal(tx, automationId),
    };

    // Per-step drop-off. Grouped in SQL rather than pulled into memory because a
    // busy rule has tens of thousands of step rows and the aggregate is four
    // numbers per step.
    //
    // `path` is MAX(...) rather than a group key: it is a pure function of the
    // compiled index, so every row for an index carries the same value — but
    // rows written before this column existed carry null, and grouping on it
    // would split one step into two.
    const stepRows = await tx.$queryRaw<StepAggRow[]>`
      SELECT s.action_index,
             MAX(s.path)         AS path,
             MAX(s.action_type)  AS action_type,
             COUNT(*)                                        AS reached,
             COUNT(*) FILTER (WHERE s.status = 'completed')  AS completed,
             COUNT(*) FILTER (WHERE s.status = 'gated')      AS gated,
             COUNT(*) FILTER (WHERE s.status = 'failed')     AS failed
      FROM automation_run_steps s
      JOIN automation_runs r ON r.id = s.run_id
      WHERE r.automation_id = ${automationId}::uuid
      GROUP BY s.action_index
      ORDER BY s.action_index ASC
    `;

    const steps: StepDropOff[] = stepRows.map((row, i) => {
      const reached = n(row.reached);
      const nextReached = i + 1 < stepRows.length ? n(stepRows[i + 1]!.reached) : 0;
      return {
        index: row.action_index,
        path: row.path,
        actionType: row.action_type,
        reached,
        completed: n(row.completed),
        gated: n(row.gated),
        failed: n(row.failed),
        // The LAST step has no successor, so every run that reached it "dropped
        // off" by this arithmetic — which would be nonsense. A rule's final step
        // is where runs are supposed to end.
        dropOffRate: i + 1 < stepRows.length ? rate(reached - nextReached, reached) : 0,
      };
    });

    return { automationId, hasGoal: goalDeclared, funnel, steps };
  });
}

interface MedianRow {
  seconds: number | null;
}

/** Median seconds from enrollment to goal. Postgres does the percentile — it is
 *  one number, and pulling every converted run's timestamps back to compute it
 *  in JS would be moving a table to do arithmetic on it. */
async function medianTimeToGoal(tx: TxClient, automationId: string): Promise<number | null> {
  const rows = await tx.$queryRaw<MedianRow[]>`
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM (goal_met_at - started_at))
           )::double precision AS seconds
    FROM automation_runs
    WHERE automation_id = ${automationId}::uuid
      AND goal_met_at IS NOT NULL
  `;
  const seconds = rows[0]?.seconds;
  return seconds === null || seconds === undefined ? null : Math.round(seconds);
}
