'use client';

// The ONE door to the automations API (rules, runs, reporting): every surface reads and writes here.
// Rules are draft-then-publish versioned (Save stages, Publish makes live); a LOCKED rule answers 409.
// Every write invalidates the ['automations'] root, so every open surface refreshes at once.

import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
export {
  useCloneAutomation,
  useCreateAutomation,
  useDeleteAutomation,
  useDiscardDraft,
  usePublishAutomation,
  useSetAutomationStatus,
  useUpdateAutomation,
  useRestoreVersion,
  useTakePlatformVersion,
} from './automations-data/mutations';
export {
  useAutomation,
  useAutomationRuns,
  useAutomations,
  useAutomationsSummary,
  useRunsTimeseries,
  useEnrollment,
  useAutomationVersions,
  useAutomationRun,
  automationKeys,
  useInvalidateAutomations,
} from './automations-data/queries';
export type {
  AutomationRunRow,
  AutomationOverviewRow,
  RunsTimeseriesPoint,
  EnrollmentAnalytics,
  StepDropOff,
  AutomationRunStepRow,
  AutomationRunWithSteps,
  RunsTimeseries,
  EnrollmentFunnel,
} from './automations-data/run-types';
export type {
  Automation,
  Tone,
  AutomationVersionRow,
  PlatformDocument,
  AutomationsFilter,
  RunsFilter,
  AutomationCreateInput,
  AutomationUpdateInput,
} from './automations-data/wire-types';

/* ── ISO date range presets (shared by the reporting surface) ────────────── */

export interface ReportRange {
  from: string;
  to: string;
  /** 'this' = the active site's activity; 'all' = the whole account. */
  scope: 'this' | 'all';
}

export type RangePreset = '7' | '30' | '90';

export const RANGE_LABEL: Record<RangePreset, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
};

export function presetRange(preset: RangePreset, scope: 'this' | 'all'): ReportRange {
  const days = Number(preset);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString(), scope };
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/** Surface the server's own sentence for a 4xx — it names the exact problem (a
 *  locked rule, a missing draft, an invalid action) — else a plain fallback. */
export function automationErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/** Whether a 4xx names a locked-rule rejection (used to nudge toward cloning). */
export function isLockedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}
