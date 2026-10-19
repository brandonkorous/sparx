'use client';

// The report builder's data layer (docs/144 §8): definitions a business AUTHORS,
// what can be reported on, and running one, saved or not. The seven fixed
// metrics are `reports-data.ts`; shapes, choices and boards live beside this.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { fieldWord } from './report-field-words';
import { dashboardKeys } from './dashboards-data';
import type {
  ConditionGroup,
  DateRange,
  GroupBy,
  Measure,
  ReportResult,
  ReportableObject,
  SavedReport,
  Visualization,
} from './report-builder-types';

export * from './report-builder-types';
export * from './report-builder-choices';
export * from './dashboards-data';

/* ── Keys ───────────────────────────────────────────────────────────────── */

export const reportBuilderKeys = {
  all: ['crm', 'report-builder'] as const,
  list: (objectKey?: string) => [...reportBuilderKeys.all, 'list', objectKey ?? null] as const,
  fields: [...['crm', 'report-builder'], 'fields'] as const,
  detail: (id: string) => [...reportBuilderKeys.all, id] as const,
  run: (id: string) => [...reportBuilderKeys.all, id, 'run'] as const,
  preview: (definition: unknown) => ['crm', 'report-preview', definition] as const,
};

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useReports(objectKey?: string) {
  return useQuery({
    queryKey: reportBuilderKeys.list(objectKey),
    queryFn: () =>
      api.list<SavedReport>('/v1/crm/reports', objectKey ? { object_key: objectKey } : {}),
    placeholderData: (previous) => previous,
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: reportBuilderKeys.detail(id),
    queryFn: () => api.get<SavedReport>(`/v1/crm/reports/${id}`),
    enabled: id !== 'new',
  });
}

/** What can be reported on: the compiler's own allowlist, so nothing offered fails.
 *  Field names get this console's words HERE, where the catalog enters, not at each
 *  place that draws one (`report-field-words.ts`); `path` is never touched. */
export function useReportFields() {
  return useQuery({
    queryKey: reportBuilderKeys.fields,
    queryFn: async () => {
      const data = await api.get<{ objects: ReportableObject[] }>('/v1/crm/reports/fields');
      return {
        objects: data.objects.map((object) => ({
          ...object,
          fields: object.fields.map((field) => ({
            ...field,
            label: fieldWord(object.objectKey, field.path, field.label),
          })),
        })),
      };
    },
    staleTime: 30 * 60_000,
  });
}

export function useRunReport(id: string, dateRange?: DateRange) {
  return useQuery({
    queryKey: [...reportBuilderKeys.run(id), dateRange ?? null],
    queryFn: () =>
      api.post<ReportResult>(`/v1/crm/reports/${id}/run`, dateRange ? { dateRange } : {}),
    enabled: id !== 'new',
  });
}

/** Run an unsaved definition, the live preview. `enabled` waits until it is
 *  runnable, so a half-chosen definition does not flash an error. */
export function usePreview(definition: {
  objectKey: string;
  filters: ConditionGroup;
  groupBy: GroupBy | null;
  measures: Measure[];
  dateRange: DateRange;
  visualization: Visualization;
  name: string;
}) {
  const runnable =
    definition.objectKey !== '' &&
    definition.measures.length > 0 &&
    definition.measures.every((m) => m.fn === 'count' || Boolean(m.field));

  return useQuery({
    queryKey: reportBuilderKeys.preview(definition),
    queryFn: () => api.post<ReportResult>('/v1/crm/reports/preview', definition),
    enabled: runnable,
    // Keep the last good numbers on screen while the next run is in flight —
    // a preview that blanks on every keystroke is unreadable.
    placeholderData: (previous) => previous,
    retry: false,
  });
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

function useInvalidateReports() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: reportBuilderKeys.all });
    // A dashboard renders its widgets' reports, so an edited definition changes
    // every board it appears on.
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };
}

export function useCreateReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<SavedReport>('/v1/crm/reports', input),
    onSuccess: invalidate,
  });
}

export function useUpdateReport(id: string) {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch<SavedReport>(`/v1/crm/reports/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDuplicateReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (args: { id: string; name?: string }) =>
      api.post<SavedReport>(`/v1/crm/reports/${args.id}/duplicate`, { name: args.name }),
    onSuccess: invalidate,
  });
}

export function useArchiveReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ archived: boolean }>(`/v1/crm/reports/${id}`),
    onSuccess: invalidate,
  });
}

/** Whether the business holds any record of this kind at all, over all time and
 *  with no filter. Asked only when a narrowed answer comes back empty, so the
 *  empty sentence can tell "nothing matches" from "there is nothing yet"
 *  (sparx persona issue 255). */
export function useHoldsAny(objectKey: string, enabled: boolean) {
  return useQuery({
    queryKey: [...reportBuilderKeys.all, 'holds-any', objectKey] as const,
    queryFn: () =>
      api
        .post<ReportResult>('/v1/crm/reports/preview', {
          objectKey,
          filters: { logic: 'AND', conditions: [] },
          groupBy: null,
          measures: [{ fn: 'count' }],
          dateRange: { kind: 'all' },
          visualization: 'number',
          name: 'Everything of this kind',
        })
        .then((result) => result.rows.some((row) => Object.values(row).some((v) => Number(v) > 0))),
    enabled: enabled && objectKey !== '',
    retry: false,
  });
}
