'use client';

import { useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../../lib/api/client';
import type { Automation, AutomationVersionRow, AutomationsFilter, RunsFilter } from './wire-types';
import type {
  AutomationRunRow,
  AutomationRunWithSteps,
  AutomationOverviewRow,
  RunsTimeseries,
  EnrollmentAnalytics,
} from './run-types';
import type { ReportRange } from '../automations-data';

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
  // Under `['automations']` deliberately, so the shared invalidator reaches it:
  // publishing a rule changes what its funnel means, and a stale funnel beside a
  // freshly-edited rule is the kind of wrong that looks right.
  enrollment: (id: string) => ['automations', 'enrollment', id] as const,
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

/** How this rule is actually doing (docs/144 §9) — the funnel plus per-step
 *  drop-off. Not `placeholderData`: an unchanged funnel from another rule would
 *  be the wrong numbers under the right heading. */
export function useEnrollment(id: string) {
  return useQuery({
    queryKey: automationKeys.enrollment(id),
    queryFn: () => api.get<EnrollmentAnalytics>(`/v1/automations/${id}/enrollment`),
    enabled: id !== 'new' && id !== '',
  });
}

export function useAutomationsSummary() {
  return useQuery({
    queryKey: automationKeys.summary,
    queryFn: () => api.get<AutomationOverviewRow[]>('/v1/automations/reports/summary'),
    placeholderData: (previous) => previous,
  });
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
