'use client';

// The CRM dashboards' reads and writes (docs/144 §8): boards of saved reports.
// `report-builder-data.ts` re-exports all of these.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { Dashboard, DashboardWidget } from './report-builder-types';

export const dashboardKeys = {
  all: ['crm', 'dashboards'] as const,
  list: ['crm', 'dashboards', 'list'] as const,
  landing: ['crm', 'dashboards', 'landing'] as const,
  detail: (id: string) => ['crm', 'dashboards', id] as const,
};

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
