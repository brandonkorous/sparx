'use client';

// The one door to /v1/funnels. Both surfaces read and write through here, so the
// cache keys live in one place.
//
// A write invalidates the ROOT, because editing a step changes both the campaign
// and the shape of its report.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import type { CreateFunnelBody, Funnel, FunnelStatus, Ladder, UpdateFunnelBody } from './types';

export const funnelKeys = {
  root: ['funnels'] as const,
  list: (status?: FunnelStatus) => ['funnels', 'list', status ?? 'all'] as const,
  detail: (id: string) => ['funnels', 'detail', id] as const,
  ladder: (id: string, days: number) => ['funnels', 'ladder', id, days] as const,
};

export function useFunnels(status?: FunnelStatus) {
  return useQuery({
    queryKey: funnelKeys.list(status),
    queryFn: () =>
      api.get<Funnel[]>('/v1/funnels', status ? { status } : undefined).then((r) => r ?? []),
  });
}

export function useFunnel(id: string) {
  return useQuery({
    queryKey: funnelKeys.detail(id),
    queryFn: () => api.get<Funnel>(`/v1/funnels/${id}`),
    enabled: id !== 'new',
    // A 404 is an answer, not a fault: the campaign was deleted elsewhere.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** The report over a trailing window. `days` is the whole range control — a
 *  campaign is judged over weeks, not between two exact timestamps. */
export function useLadder(id: string, days: number) {
  return useQuery({
    queryKey: funnelKeys.ladder(id, days),
    queryFn: () =>
      api.get<Ladder>(`/v1/funnels/${id}/ladder`, {
        from: new Date(Date.now() - days * 86_400_000).toISOString(),
        to: new Date().toISOString(),
      }),
    enabled: id !== 'new',
  });
}

export function useCreateFunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFunnelBody) => api.post<Funnel>('/v1/funnels', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: funnelKeys.root }),
  });
}

export function useUpdateFunnel(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateFunnelBody) => api.patch<Funnel>(`/v1/funnels/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: funnelKeys.root }),
  });
}

export function useDeleteFunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/v1/funnels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: funnelKeys.root }),
  });
}

export function funnelErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
