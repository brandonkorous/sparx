import type { AutomationStatus, RunStatus, StepStatus } from '@wizeworks/automation-schemas';

/* ── Runs ───────────────────────────────────────────────────────────────── */

/** One run of a rule — one time it fired. */
export interface AutomationRunRow {
  id: string;
  automationId: string;
  tenantId: string;
  propertyId: string | null;
  /** The event (or scanned row) that started the run. */
  triggerEvent: unknown;
  dedupeKey: string;
  causeDepth: number;
  status: RunStatus;
  cursorIndex: number;
  resumeAt: string | null;
  actionsTotal: number;
  errorMessage: string | null;
  /** Which published version was live when this run started. */
  automationVersion: number | null;
  startedAt: string;
  completedAt: string | null;
}

/** One step within a run — one action that was attempted. `gated` is NOT a
 *  failure: a policy gate blocked the effect and said why in `gateLog`. */
export interface AutomationRunStepRow {
  id: string;
  runId: string;
  tenantId: string;
  actionIndex: number;
  actionType: string;
  status: StepStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  /** [{ gate, decision, reason }] — the policy-decision audit trail. */
  gateLog: unknown;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AutomationRunWithSteps extends AutomationRunRow {
  steps: AutomationRunStepRow[];
}

/* ── Reporting ──────────────────────────────────────────────────────────── */

/** One row of `/reports/summary`. `successRate` is a 0–1 fraction over the trailing window (null
 *  = never ran); the completed/failed split lets the row badge say whether the rule is WORKING,
 *  not only switched on. See `automation-health`. */
export interface AutomationOverviewRow {
  id: string;
  name: string;
  triggerType: string;
  status: AutomationStatus;
  runs: number;
  completedCount: number;
  failedCount: number;
  successRate: number | null;
}

export interface RunsTimeseriesPoint {
  bucket: string;
  runsCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface RunsTimeseries {
  range: { from: string; to: string; grain: 'day' | 'week' | 'month' };
  points: RunsTimeseriesPoint[];
  totals: {
    runsCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    /** completed / (completed + failed), 0–100 to 1dp. Skipped is excluded. */
    successRate: number;
  };
}

/* ── Enrollment analytics (docs/144 §9) ─────────────────────────────────── */

export interface EnrollmentFunnel {
  entered: number;
  active: number;
  converted: number;
  completed: number;
  exited: number;
  failed: number;
  /** Null when the rule declares no goal — 0% would read as "this never works"
   *  rather than "nothing was measured". */
  conversionRate: number | null;
  medianSecondsToGoal: number | null;
}

export interface StepDropOff {
  index: number;
  /** Where the step sits in the authored rule (`2`, `2.then.0`). */
  path: string | null;
  actionType: string;
  reached: number;
  completed: number;
  gated: number;
  failed: number;
  dropOffRate: number;
}

export interface EnrollmentAnalytics {
  automationId: string;
  hasGoal: boolean;
  funnel: EnrollmentFunnel;
  steps: StepDropOff[];
}
