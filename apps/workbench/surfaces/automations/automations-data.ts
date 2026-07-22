'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE AUTOMATIONS DATA LAYER
//
// Automations are the platform's cross-module rule engine — "when X happens, if
// Y is true, do Z". One rule can watch an order come in, check the customer is a
// wholesale account, and email the team, all without anyone lifting a finger.
//
// This file is the ONE door to the automations API in api-rest. Every automation
// surface reads and writes through here, so the cache keys and the typed shapes
// live in one place and can never drift between the list, the editor and the
// activity views.
//
// ── What lives under automations ──────────────────────────────────────────
//   • RULES        — the automations themselves, each a trigger + conditions +
//                    ordered actions, with a draft→publish version history.
//   • RUNS         — every time a rule fired, and what each of its steps did.
//   • REPORTING    — run activity over time, and a per-rule success-rate roll-up.
//
// ── Versioning (Builder-style draft → publish) ────────────────────────────
// The live columns are the PUBLISHED rule the engine runs. Editing a rule stages
// the change into a `draft`; Publish promotes the draft to the next version and
// snapshots it into history; Discard throws the draft away. So "Save" here means
// "stage", and "Publish" means "make it live" — exactly like the site builder.
//
// ── The tier model ────────────────────────────────────────────────────────
// `origin` (user | system) + `locked`. A LOCKED rule is platform-managed and
// rejects edit/status/delete (the API answers 409 AUTOMATION_LOCKED). The only
// way to change one is "Duplicate to edit" — clone it into an editable copy.
//
// ── The key contract ──────────────────────────────────────────────────────
//   ['automations']                              the root every read nests under
//   ['automations','list',{…}]                   the rules list window
//   ['automations','detail', id]                 one rule, in full
//   ['automations','versions', id]               one rule's published history
//   ['automations','runs', id, {…}]              one rule's run history
//   ['automations','run', id, runId]             one run + its steps + gate log
//   ['automations','reports','summary']          every rule + trailing run stats
//   ['automations','reports','runs',{…}]         run-activity timeseries
//
// Every write invalidates the ['automations'] ROOT, so a create, edit, publish,
// status change, clone or delete is reflected across every open surface at once.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import type {
  Action,
  AutomationDraft,
  AutomationOrigin,
  AutomationStatus,
  ConditionGroup,
  RunStatus,
  StepStatus,
  Trigger,
} from '@sparx/automation-schemas';
import { api } from '../../lib/api/client';

/* ── Semantic tone (shared with the Badge/Button colour axis) ────────────── */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/* ── The automation rule (the raw wire row, dates as ISO strings) ────────── */

/** One automation rule, as `GET /v1/automations/:id` returns it — the live
 *  PUBLISHED document in the top-level columns, plus a staged `draft` when there
 *  are unpublished edits. The JSON sub-parts (`triggerConfig` / `conditions` /
 *  `actions`) are `unknown` on the wire and parsed with the canonical
 *  `@sparx/automation-schemas` parsers in presentation.tsx — never trusted raw. */
export interface Automation {
  id: string;
  tenantId: string;
  /** The site this rule acts on. Null = tenant-wide (runs on every site). */
  propertyId: string | null;
  name: string;
  description: string | null;
  status: AutomationStatus;
  triggerType: string;
  triggerConfig: unknown;
  conditions: unknown;
  actions: unknown;
  /** The live published version number (1 on create). */
  version: number;
  publishedAt: string | null;
  publishedBy: string | null;
  /** The staged, unpublished edit — null when there is nothing to publish. */
  draft: AutomationDraft | null;
  aiGenerated: boolean;
  aiPrompt: string | null;
  /** user = the tenant made it; system = platform-seeded. */
  origin: AutomationOrigin;
  /** Locked = platform-managed; rejects edit/status/delete. */
  locked: boolean;
  clonedFrom: string | null;
  maxDepth: number;
  runCount: number;
  errorCount: number;
  lastRunAt: string | null;
  lastErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One immutable published-version snapshot, as `/versions` returns it. */
export interface AutomationVersionRow {
  id: string;
  automationId: string;
  tenantId: string;
  version: number;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: unknown;
  conditions: unknown;
  actions: unknown;
  maxDepth: number;
  note: string | null;
  publishedAt: string;
  publishedBy: string | null;
}

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

/** One row of the per-rule overview (`/reports/summary`). `successRate` is a
 *  0–1 fraction over the trailing window, or null when the rule never ran. */
export interface AutomationOverviewRow {
  id: string;
  name: string;
  triggerType: string;
  status: AutomationStatus;
  runs: number;
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

/* ── Filters ────────────────────────────────────────────────────────────── */

export interface AutomationsFilter {
  /** draft | active | paused | error, or 'all'. */
  status?: string;
  /** 'user' | 'system', or 'all'. */
  origin?: string;
}

export interface RunsFilter {
  status?: string;
  limit?: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const automationKeys = {
  all: ['automations'] as const,
  list: (filter: AutomationsFilter) => ['automations', 'list', filter] as const,
  detail: (id: string) => ['automations', 'detail', id] as const,
  versions: (id: string) => ['automations', 'versions', id] as const,
  runs: (id: string, filter: RunsFilter) => ['automations', 'runs', id, filter] as const,
  run: (id: string, runId: string) => ['automations', 'run', id, runId] as const,
  summary: ['automations', 'reports', 'summary'] as const,
  reportRuns: (range: ReportRange) => ['automations', 'reports', 'runs', range] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useAutomations(filter: AutomationsFilter) {
  return useQuery({
    queryKey: automationKeys.list(filter),
    queryFn: () =>
      api.get<Automation[]>('/v1/automations', {
        ...(filter.status && filter.status !== 'all' ? { status: filter.status } : {}),
        ...(filter.origin && filter.origin !== 'all' ? { origin: filter.origin } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

export function useAutomation(id: string) {
  return useQuery({
    queryKey: automationKeys.detail(id),
    queryFn: () => api.get<Automation>(`/v1/automations/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export function useAutomationVersions(id: string) {
  return useQuery({
    queryKey: automationKeys.versions(id),
    queryFn: () => api.get<AutomationVersionRow[]>(`/v1/automations/${id}/versions`),
    enabled: id !== 'new',
  });
}

export function useAutomationRuns(id: string, filter: RunsFilter) {
  return useQuery({
    queryKey: automationKeys.runs(id, filter),
    queryFn: () =>
      api.get<AutomationRunRow[]>(`/v1/automations/${id}/runs`, {
        ...(filter.status && filter.status !== 'all' ? { status: filter.status } : {}),
        ...(filter.limit ? { limit: filter.limit } : {}),
      }),
    enabled: id !== 'new' && id !== '',
    placeholderData: (previous) => previous,
  });
}

export function useAutomationRun(id: string, runId: string) {
  return useQuery({
    queryKey: automationKeys.run(id, runId),
    queryFn: () => api.get<AutomationRunWithSteps>(`/v1/automations/${id}/runs/${runId}`),
    enabled: Boolean(id) && Boolean(runId),
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export function useAutomationsSummary() {
  return useQuery({
    queryKey: automationKeys.summary,
    queryFn: () => api.get<AutomationOverviewRow[]>('/v1/automations/reports/summary'),
    placeholderData: (previous) => previous,
  });
}

export interface ReportRange {
  from: string;
  to: string;
  /** 'this' = the active site's activity; 'all' = the whole account. */
  scope: 'this' | 'all';
}

export function useRunsTimeseries(range: ReportRange) {
  return useQuery({
    queryKey: automationKeys.reportRuns(range),
    queryFn: () =>
      api.get<RunsTimeseries>('/v1/automations/reports/runs', {
        from: range.from,
        to: range.to,
        grain: 'day',
        // 'all' asks for the tenant-wide total; omitting it lets the API resolve
        // the active site from the x-sparx-property-id header the client sends.
        ...(range.scope === 'all' ? { property: 'all' } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateAutomations() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: automationKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: automationKeys.detail(id) });
  };
}

/* ── Write inputs ───────────────────────────────────────────────────────── */

export interface AutomationCreateInput {
  name: string;
  description?: string | null;
  propertyId?: string | null;
  trigger: Trigger;
  conditions: ConditionGroup;
  actions: Action[];
  maxDepth: number;
}

export interface AutomationUpdateInput {
  name?: string;
  description?: string | null;
  propertyId?: string | null;
  trigger?: Trigger;
  conditions?: ConditionGroup;
  actions?: Action[];
  maxDepth?: number;
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export function useCreateAutomation() {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (input: AutomationCreateInput) => api.post<Automation>('/v1/automations', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateAutomation(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (patch: AutomationUpdateInput) =>
      api.patch<Automation>(`/v1/automations/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteAutomation(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: () => api.delete(`/v1/automations/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** "Duplicate to edit" — fork an editable copy (the only way to adapt a locked
 *  or system rule). Optionally names the copy. */
export function useCloneAutomation(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (name?: string) =>
      api.post<Automation>(`/v1/automations/${id}/clone`, name ? { name } : {}),
    onSuccess: (clone) => {
      invalidate(clone.id);
    },
  });
}

export function useSetAutomationStatus(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (status: 'draft' | 'active' | 'paused') =>
      api.post<Automation>(`/v1/automations/${id}/status`, { status }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function usePublishAutomation(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (note?: string) =>
      api.post<Automation>(`/v1/automations/${id}/publish`, note ? { note } : {}),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDiscardDraft(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: () => api.post<Automation>(`/v1/automations/${id}/discard-draft`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useRestoreVersion(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (version: number) =>
      api.post<Automation>(`/v1/automations/${id}/restore`, { version }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/* ── ISO date range presets (shared by the reporting surface) ────────────── */

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
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/** Whether a 4xx names a locked-rule rejection (used to nudge toward cloning). */
export function isLockedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}
