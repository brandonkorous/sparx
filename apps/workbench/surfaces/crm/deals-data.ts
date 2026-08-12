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
  companyId: string | null;
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
  /** The extra details THIS business tracks on a deal (docs/144 §3). */
  customProperties: Record<string, unknown>;
  /** How healthy this business's own rules think the deal is (docs/144 §10).
   *  Asks a different question from a contact's score — "will this close",
   *  not "how interested are they". */
  score: number;
  /** When the score was last worked out. Null means it never has been. */
  scoredAt: string | null;
  /** A standing hand adjustment that survives re-scoring — see the same field
   *  on `Customer`. */
  scoreOffset: number;
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
  /** Every deal with this company, whoever the named contact is. Sent as
   *  `b2b_account_id` — the wire name deliberately survived the company rename
   *  (docs/144 §11 deviation 1), so the parameter and the field differ on
   *  purpose rather than by mistake. */
  companyId?: string;
  state?: 'open' | 'closed';
  /**
   * How many to pull. The table wants a page; the board wants every deal on the
   * pipeline at once, because a column that silently stops at 100 reads as "this
   * is all of them" when it isn't. Server caps this at 250.
   */
  take?: number;
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

/**
 * The one thing worth saying about a deal at a glance, or nothing.
 *
 * A board card that badges everything badges nothing, so this returns AT MOST
 * one signal, and only when the date is actually urgent: a close date three
 * months out is not news. Closed deals return null — "past due" on a deal you
 * won last week is noise.
 */
export function dealDueSignal(
  deal: Pick<Deal, 'expectedCloseDate' | 'stage'>,
  now: Date = new Date()
): { label: string; tone: 'danger' | 'warning' } | null {
  if (deal.stage && deal.stage.stageType !== 'open') return null;
  if (!deal.expectedCloseDate) return null;

  const due = new Date(deal.expectedCloseDate);
  if (Number.isNaN(due.getTime())) return null;

  // Whole days apart, both floored to local midnight — otherwise a deal due
  // this afternoon reads as "due in 0 days" all morning and "past due" at 5pm.
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);

  if (days < 0) return { label: days === -1 ? '1 day late' : `${-days} days late`, tone: 'danger' };
  if (days === 0) return { label: 'Due today', tone: 'warning' };
  if (days === 1) return { label: 'Due tomorrow', tone: 'warning' };
  if (days <= 7) return { label: `Due in ${days} days`, tone: 'warning' };
  return null;
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
        ...(params.companyId ? { b2b_account_id: params.companyId } : {}),
        ...(params.state ? { state: params.state } : {}),
        take: params.take ?? 100,
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
  closedReason?: string | null;
  customProperties?: Record<string, unknown>;
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
 * Move ANY deal to a new stage — the board's mutation.
 *
 * `useMoveDealStage` above is bound to one id, which is right for the detail
 * pane and wrong for a board where every card is a candidate. This takes the
 * deal in the variables instead, and patches the cached lists optimistically so
 * the card lands in its new column on drop rather than after a round trip.
 *
 * The caller passes the whole target stage, not just its id: a cached row
 * carries `stage: { name, stageType }` for its badge, so patching only
 * `stageId` would leave the card labelled with the stage it came from until the
 * refetch landed.
 */
export function useMoveDealToStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      toStage,
      closedReason,
    }: {
      id: string;
      toStage: { id: string; name: string; stageType: StageType };
      closedReason?: string;
    }) =>
      api.post<Deal>(`/v1/crm/deals/${id}/move-stage`, {
        toStageId: toStage.id,
        ...(closedReason?.trim() ? { closedReason: closedReason.trim() } : {}),
      }),

    onMutate: async ({ id, toStage }) => {
      // Stop an in-flight list refetch from overwriting the patch below.
      await queryClient.cancelQueries({ queryKey: dealKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: dealKeys.all });

      queryClient.setQueriesData<{ items: Deal[]; total?: number }>(
        { queryKey: dealKeys.all },
        (current) => {
          if (!current?.items) return current;
          return {
            ...current,
            items: current.items.map((deal) =>
              deal.id === id
                ? {
                    ...deal,
                    stageId: toStage.id,
                    stage: { name: toStage.name, stageType: toStage.stageType },
                  }
                : deal
            ),
          };
        }
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      // Put every list back exactly as it was — the card returns to its column.
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },

    // Settled, not success: a failed move still needs the server's truth back.
    onSettled: (_deal, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: dealKeys.all });
      void queryClient.invalidateQueries({ queryKey: dealKeys.detail(variables.id) });
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
