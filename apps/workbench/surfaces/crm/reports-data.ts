'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CRM REPORTS DATA LAYER
//
// Read-only metrics for the reporting dashboard. Each endpoint answers one
// question; the surface lays them out as tiles and charts. Shapes mirror the
// CRM reporting service exactly (`@sparx/crm` reporting-service), named locally
// because that package is not a dependency of this app.
//
//   /v1/crm/reports/snapshot         KPI headline
//   /v1/crm/reports/acquisition      new customers per month
//   /v1/crm/reports/pipeline-funnel  deals per stage for one pipeline
//   /v1/crm/reports/win-loss         won/lost by rep
//   /v1/crm/reports/leads-by-source  where new customers first came from
//   /v1/crm/reports/tasks            task health
//   /v1/crm/reports/segments         active segments by size
// ══════════════════════════════════════════════════════════════════════════

import { useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';

/* ── Shapes (mirrored from the reporting service) ───────────────────────── */

export interface CrmSnapshot {
  customers: number;
  companies: number;
  openDeals: number;
  pipelineValue: number;
  openTasks: number;
  overdueTasks: number;
  activeSegments: number;
}

export interface AcquisitionPoint {
  month: string; // yyyy-mm
  newCustomers: number;
}

export interface FunnelBucket {
  stageId: string;
  stageName: string;
  stageType: string;
  count: number;
  totalValue: number;
}

export interface WinLossRow {
  repId: string | null;
  won: number;
  lost: number;
  open: number;
  winRate: number; // 0–1
  totalWonValue: number;
}

export interface LeadSourceRow {
  source: string;
  label: string;
  count: number;
  sharePct: number;
}
export interface LeadsBySource {
  rangeLabel: string;
  totalLeads: number;
  bySource: LeadSourceRow[];
}

export interface TaskMetrics {
  open: number;
  overdue: number;
  dueToday: number;
  completedLast30d: number;
  byPriority: { low: number; medium: number; high: number; urgent: number };
}

export interface SegmentSummaryRow {
  id: string;
  name: string;
  memberCount: number;
}
export interface SegmentSummary {
  totalSegments: number;
  totalMembers: number;
  segments: SegmentSummaryRow[];
}

export const reportKeys = {
  all: ['crm', 'reports'] as const,
};

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useSnapshot() {
  return useQuery({
    queryKey: [...reportKeys.all, 'snapshot'],
    queryFn: () => api.get<CrmSnapshot>('/v1/crm/reports/snapshot'),
    staleTime: 60_000,
  });
}

export function useAcquisition(months = 12) {
  return useQuery({
    queryKey: [...reportKeys.all, 'acquisition', months],
    queryFn: () => api.get<AcquisitionPoint[]>('/v1/crm/reports/acquisition', { months }),
    staleTime: 60_000,
  });
}

export function usePipelineFunnel(pipelineId: string | undefined) {
  return useQuery({
    queryKey: [...reportKeys.all, 'funnel', pipelineId],
    queryFn: () =>
      api.get<FunnelBucket[]>('/v1/crm/reports/pipeline-funnel', { pipeline_id: pipelineId! }),
    enabled: Boolean(pipelineId),
    staleTime: 60_000,
  });
}

export function useWinLoss() {
  return useQuery({
    queryKey: [...reportKeys.all, 'win-loss'],
    queryFn: () => api.get<WinLossRow[]>('/v1/crm/reports/win-loss'),
    staleTime: 60_000,
  });
}

export function useLeadsBySource() {
  return useQuery({
    queryKey: [...reportKeys.all, 'leads'],
    queryFn: () => api.get<LeadsBySource>('/v1/crm/reports/leads-by-source'),
    staleTime: 60_000,
  });
}

export function useTaskMetrics() {
  return useQuery({
    queryKey: [...reportKeys.all, 'tasks'],
    queryFn: () => api.get<TaskMetrics>('/v1/crm/reports/tasks'),
    staleTime: 60_000,
  });
}

export function useSegmentSummary() {
  return useQuery({
    queryKey: [...reportKeys.all, 'segments'],
    queryFn: () => api.get<SegmentSummary>('/v1/crm/reports/segments'),
    staleTime: 60_000,
  });
}

/** Refetch the whole dashboard. */
export function useRefreshReports() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: reportKeys.all });
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

export function formatMoney(value: number, currency = 'USD'): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** "2026-03" → "Mar" (short month, for a compact axis). */
export function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
}
