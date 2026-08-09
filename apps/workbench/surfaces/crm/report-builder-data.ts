'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE REPORT BUILDER'S DATA LAYER (docs/144 §8)
//
// Distinct from `reports-data.ts`, which fetches the seven metrics sparx wrote.
// This one is about definitions a tenant AUTHORS: the saved list, what can be
// reported on, and running one — saved or not.
//
// THE PREVIEW IS THE WHOLE PRODUCT. A builder that only shows you the answer
// after you commit is a form, not a builder; you learn what a choice does by
// seeing the numbers move. So `usePreview` runs an unsaved definition on every
// meaningful change, and the surface renders it beside the controls.
//
//   ['crm','report-builder']              root
//   ['crm','report-builder','list',{…}]   saved definitions
//   ['crm','report-builder','fields']     what can be reported on
//   ['crm','report-builder', id]          one definition
//   ['crm','report-builder', id, 'run']   its numbers
//   ['crm','report-preview', definition]  an unsaved definition's numbers
//   ['crm','dashboards', …]               boards
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type MeasureFn = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type DateBucket = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type Visualization = 'table' | 'bar' | 'line' | 'pie' | 'funnel' | 'number';

export interface Measure {
  fn: MeasureFn;
  field?: string;
  label?: string;
}

export interface GroupBy {
  field: string;
  bucket?: DateBucket;
}

export type DateRange =
  | { kind: 'all' }
  | { kind: 'last_n_days'; days: number }
  | { kind: 'between'; from: string; to: string };

export interface ConditionLeaf {
  field: string;
  operator: string;
  value?: unknown;
}

export interface ConditionGroup {
  logic: 'AND' | 'OR';
  conditions: (ConditionLeaf | ConditionGroup)[];
}

export interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  objectKey: string;
  filters: ConditionGroup;
  groupBy: GroupBy | null;
  measures: Measure[];
  visualization: Visualization;
  dateRange: DateRange;
  /** Set on the reports sparx ships — read-only in place, duplicate to change. */
  builtinSlug: string | null;
  shared: boolean;
  propertyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportField {
  path: string;
  label: string;
  kind: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'uuid';
}

export interface ReportableObject {
  objectKey: string;
  label: string;
  labelPlural: string;
  fields: ReportField[];
}

export interface ReportResult {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  grouped: boolean;
  /** The row cap was hit — the surface must say so rather than presenting a
   *  truncated answer as the whole one. */
  truncated: boolean;
}

export interface DashboardWidget {
  id: string;
  reportId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string | null;
  report: SavedReport;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  shared: boolean;
  propertyId: string | null;
  widgets?: DashboardWidget[];
}

/* ── Keys ───────────────────────────────────────────────────────────────── */

export const reportBuilderKeys = {
  all: ['crm', 'report-builder'] as const,
  list: (objectKey?: string) => [...reportBuilderKeys.all, 'list', objectKey ?? null] as const,
  fields: [...['crm', 'report-builder'], 'fields'] as const,
  detail: (id: string) => [...reportBuilderKeys.all, id] as const,
  run: (id: string) => [...reportBuilderKeys.all, id, 'run'] as const,
  preview: (definition: unknown) => ['crm', 'report-preview', definition] as const,
};

export const dashboardKeys = {
  all: ['crm', 'dashboards'] as const,
  list: ['crm', 'dashboards', 'list'] as const,
  landing: ['crm', 'dashboards', 'landing'] as const,
  detail: (id: string) => ['crm', 'dashboards', id] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

/** The words the builder uses. Never "aggregate", "measure" or "dimension" —
 *  a business owner has not used a BI tool and should not need to have. */
export const MEASURE_LABEL: Record<MeasureFn, string> = {
  count: 'How many there are',
  sum: 'Added up',
  avg: 'On average',
  min: 'The lowest',
  max: 'The highest',
};

export const BUCKET_LABEL: Record<DateBucket, string> = {
  day: 'By day',
  week: 'By week',
  month: 'By month',
  quarter: 'By quarter',
  year: 'By year',
};

export const VISUALIZATION_LABEL: Record<Visualization, string> = {
  number: 'A single number',
  table: 'A table',
  bar: 'Bar chart',
  line: 'Line chart',
  pie: 'Pie chart',
  funnel: 'Funnel',
};

/** Only the shapes a definition can honestly draw. Mirrors `allowedVisualizations`
 *  in @sparx/crm-schemas — a pie chart of an ungrouped count is one wedge
 *  covering 100% of itself, which looks like a working chart and says nothing. */
export function allowedVisualizations(hasGroupBy: boolean, measureCount: number): Visualization[] {
  if (!hasGroupBy) return ['number', 'table'];
  return measureCount > 1 ? ['table', 'bar', 'line'] : ['table', 'bar', 'line', 'pie', 'funnel'];
}

/** Which functions make sense for a field. Only numbers can be added up; asking
 *  for the total of a country name is a question with no answer, so the builder
 *  does not offer it rather than failing on run. */
export function allowedFunctions(kind: ReportField['kind'] | undefined): MeasureFn[] {
  if (kind === 'number' || kind === 'currency') return ['count', 'sum', 'avg', 'min', 'max'];
  if (kind === 'date') return ['count', 'min', 'max'];
  return ['count'];
}

export function describeDateRange(range: DateRange): string {
  if (range.kind === 'all') return 'All time';
  if (range.kind === 'last_n_days') return `Last ${String(range.days)} days`;
  return 'A set period';
}

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

/** What can be reported on. The compiler's own allowlist, so the builder offers
 *  exactly what will run — a person cannot assemble a definition that fails. */
export function useReportFields() {
  return useQuery({
    queryKey: reportBuilderKeys.fields,
    queryFn: () => api.get<{ objects: ReportableObject[] }>('/v1/crm/reports/fields'),
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

/**
 * Run an unsaved definition — the live preview.
 *
 * `enabled` guards on the definition being runnable at all, so the builder does
 * not fire a request (and flash an error) while somebody is halfway through
 * choosing what to count.
 */
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

/* ── Dashboards ─────────────────────────────────────────────────────────── */

export function useDashboards() {
  return useQuery({
    queryKey: dashboardKeys.list,
    queryFn: () => api.list<Dashboard>('/v1/crm/dashboards'),
  });
}

export function useLandingDashboard() {
  return useQuery({
    queryKey: dashboardKeys.landing,
    queryFn: () => api.get<Dashboard | null>('/v1/crm/dashboards/landing'),
  });
}

export function useDashboard(id: string) {
  return useQuery({
    queryKey: dashboardKeys.detail(id),
    queryFn: () => api.get<Dashboard>(`/v1/crm/dashboards/${id}`),
    enabled: id !== 'new',
  });
}

function useInvalidateDashboards() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };
}

export function useCreateDashboard() {
  const invalidate = useInvalidateDashboards();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<Dashboard>('/v1/crm/dashboards', input),
    onSuccess: invalidate,
  });
}

export function useUpdateDashboard(id: string) {
  const invalidate = useInvalidateDashboards();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch<Dashboard>(`/v1/crm/dashboards/${id}`, input),
    onSuccess: invalidate,
  });
}

/** The whole layout in one write — a board is only valid as a set. */
export function useSetWidgets(id: string) {
  const invalidate = useInvalidateDashboards();
  return useMutation({
    mutationFn: (widgets: Omit<DashboardWidget, 'id' | 'report'>[]) =>
      api.put<Dashboard>(`/v1/crm/dashboards/${id}/widgets`, { widgets }),
    onSuccess: invalidate,
  });
}

export function useArchiveDashboard() {
  const invalidate = useInvalidateDashboards();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ archived: boolean }>(`/v1/crm/dashboards/${id}`),
    onSuccess: invalidate,
  });
}
