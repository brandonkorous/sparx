'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE DEAL DATA LAYER
//
// A deal is a sale you are working on — a title, an amount, a customer, and a
// position on a pipeline. Moving it between stages has its own endpoint (it emits
// a "stage changed" event the email automations key off), so that is its own
// mutation, separate from a plain edit.
//
// Local wire types mirror the CRM's `CreateDealInput` / `UpdateDealInput` (Zod in
// `@sparx/crm-schemas`), named here because that package is not a dependency; the
// server validates authoritatively.
//
//   ['crm','deals']              root
//   ['crm','deals','list',{…}]   one list window
//   ['crm','deals', id]          one deal, in full
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import type { StageType } from './pipelines-data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface DealCustomerLink {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

export interface Deal {
  id: string;
  pipelineId: string;
  stageId: string;
  customerId: string | null;
  b2bAccountId: string | null;
  assignedRepId: string | null;
  title: string;
  /** Serialized Prisma Decimal (dollars) — a string. */
  value: string;
  currency: string;
  probability: string;
  expectedCloseDate: string | null;
  closedAt: string | null;
  closedReason: string | null;
  source: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** Present on list + detail via the service include. */
  stage: { name: string; stageType: StageType } | null;
  customer: DealCustomerLink | null;
}

export interface DealListParams {
  q?: string;
  pipelineId?: string;
  stageId?: string;
  customerId?: string;
  state?: 'open' | 'closed';
}

export const dealKeys = {
  all: ['crm', 'deals'] as const,
  list: (params: DealListParams) => [...dealKeys.all, 'list', params] as const,
  detail: (id: string) => [...dealKeys.all, id] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

export function dealCustomerName(link: DealCustomerLink | null): string | null {
  if (!link) return null;
  const name = [link.firstName, link.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (link.company?.trim()) return link.company.trim();
  if (link.email?.trim()) return link.email.trim();
  return 'A customer';
}

export function formatMoney(value: number | string | null | undefined, currency = 'USD'): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useDeals(params: DealListParams) {
  return useQuery({
    queryKey: dealKeys.list(params),
    queryFn: () =>
      api.list<Deal>('/v1/crm/deals', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.pipelineId ? { pipeline_id: params.pipelineId } : {}),
        ...(params.stageId ? { stage_id: params.stageId } : {}),
        ...(params.customerId ? { customer_id: params.customerId } : {}),
        ...(params.state ? { state: params.state } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: dealKeys.detail(id),
    queryFn: () => api.get<Deal>(`/v1/crm/deals/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateDeals() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: dealKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: dealKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface DealInput {
  pipelineId: string;
  stageId: string;
  customerId?: string | null;
  assignedRepId?: string | null;
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string | null;
  source?: string | null;
  tags?: string[];
}

export function useCreateDeal() {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: (input: DealInput) => api.post<Deal>('/v1/crm/deals', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateDeal(id: string) {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: (patch: Partial<DealInput>) => api.patch<Deal>(`/v1/crm/deals/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Move a deal to a new stage via the dedicated endpoint (emits the stage-changed
 *  event). `closedReason` is captured when the target stage is won/lost. */
export function useMoveDealStage(id: string) {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: (input: { toStageId: string; closedReason?: string }) =>
      api.post<Deal>(`/v1/crm/deals/${id}/move-stage`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/**
 * Soft-delete a deal — for a mistake, not the normal close. The server keeps the
 * row and its history and just stamps `deletedAt`, so it drops out of every list.
 * The everyday way a deal leaves the board is moving it to a Won/Lost stage.
 */
export function useDeleteDeal(id: string) {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: () => api.delete(`/v1/crm/deals/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function dealErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
