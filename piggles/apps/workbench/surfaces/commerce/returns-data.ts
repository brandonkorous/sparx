'use client';

// Returns — a customer sending something back, and the steps a business takes
// to settle it.
//
// This file OWNS the ['commerce','returns'] query key and every hook that moves
// a return. The shapes it reads live in ./returns-types and the words it is
// shown in live in ./returns-words.
//
// A return moves through a real state machine on the server — requested →
// approved/denied → received → inspected → refunded — and each step is a
// separate write with its own endpoint. The hooks below mirror that one-to-one,
// and every one invalidates the whole returns key so the list badge and the
// detail pane can never disagree about where a return is.
//
// OPENING one is not here: that happens from the order a return came from, and
// lives in ./order-return-data beside the sale (persona issue 219).

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import type {
  ReturnDetail,
  ReturnDispositionRow,
  ReturnSummary,
  SetDispositionBody,
  SetDispositionResult,
  ReturnStatus,
} from './returns-types';

// The shapes and the words are each their own module now; this stays the one
// import site for a returns screen, the same way ./data is for orders.
export * from './returns-types';
export * from './returns-words';

export const RETURNS_KEY = ['commerce', 'returns'];

/* ── Queries ────────────────────────────────────────────────────────────── */

export interface ReturnsQuery {
  status?: ReturnStatus;
  take: number;
  skip: number;
}

export function useReturns(query: ReturnsQuery) {
  return useQuery({
    queryKey: [...RETURNS_KEY, 'list', query],
    queryFn: () =>
      api.list<ReturnSummary>('/v1/commerce/returns', {
        ...(query.status ? { status: query.status } : {}),
        take: query.take,
        skip: query.skip,
      }),
    // Keep the current window on screen while the next one loads, so paging and
    // filtering don't blink the table out to empty and back.
    placeholderData: (previous) => previous,
  });
}

export function useReturn(id: string) {
  return useQuery({
    queryKey: [...RETURNS_KEY, 'detail', id],
    queryFn: () => api.get<ReturnDetail>(`/v1/commerce/returns/${id}`),
    enabled: id !== '',
  });
}

/* ── Lifecycle moves ────────────────────────────────────────────────────── */
//
// One hook per transition the server exposes. Each posts the body its endpoint
// validates and then invalidates the whole returns key — the list, the badge
// and the detail pane all re-read, so nothing on screen can lag the real state.

function useReturnAction<TBody>(action: (id: string, body: TBody) => Promise<unknown>, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => action(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RETURNS_KEY });
    },
  });
}

export interface ApproveReturnBody {
  itemDecisions: { returnLineItemId: string; approvedQuantity: number }[];
  generateLabel: boolean;
  staffNote?: string;
}

export function useApproveReturn(id: string) {
  return useReturnAction<ApproveReturnBody>(
    (returnId, body) => api.post(`/v1/commerce/returns/${returnId}/approve`, body),
    id
  );
}

export function useDenyReturn(id: string) {
  return useReturnAction<{ reason: string }>(
    (returnId, body) => api.post(`/v1/commerce/returns/${returnId}/deny`, body),
    id
  );
}

export function useReceiveReturn(id: string) {
  return useReturnAction<void>(
    (returnId) => api.post(`/v1/commerce/returns/${returnId}/received`, {}),
    id
  );
}

export interface InspectReturnBody {
  inspections: {
    returnLineItemId: string;
    condition: string;
    restockable: boolean;
    note?: string;
  }[];
}

export function useInspectReturn(id: string) {
  return useReturnAction<InspectReturnBody>(
    (returnId, body) => api.post(`/v1/commerce/returns/${returnId}/inspection`, body),
    id
  );
}

export interface RefundReturnBody {
  refundAmountCents: number;
  asAccountCredit: boolean;
  restockingFeeCents?: number;
}

export function useRefundReturn(id: string) {
  return useReturnAction<RefundReturnBody>(
    (returnId, body) => api.post(`/v1/commerce/returns/${returnId}/refund`, body),
    id
  );
}

export interface SettleExchangeBody {
  replacementVariantId: string;
  quantity: number;
  staffNote?: string;
}

/** Settling by SENDING something rather than by moving money. A separate
 *  endpoint from the refund, because it is a separate thing (issue 220). */
export function useSettleExchange(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SettleExchangeBody) => api.post(`/v1/commerce/returns/${id}/exchange`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RETURNS_KEY });
      // Both halves of the swap moved stock, so every stock screen is stale.
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

/**
 * The server's own sentence for a 4xx. These routes explain the real problem
 * ("Cannot approve return from status \"refunded\"", "No payment gateway is
 * configured to settle this refund") far better than anything this side could
 * infer from a status code. A 5xx has no such sentence, so it falls back to the
 * caller's wording.
 */
export function returnErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/* ── What happens to the goods (docs/146 Phase 9.7) ─────────────────────── */
//
// Separate endpoints from `/inspection` because they are separate moments: an
// inspection is a judgement about condition, a disposition is a decision about
// where the units go, and a returns bench routinely makes the second one hours
// after the first — or never, which is what the work list is for.

export function useReturnDispositions(returnId: string) {
  return useQuery({
    queryKey: [...RETURNS_KEY, 'dispositions', returnId],
    queryFn: () => api.list<ReturnDispositionRow>(`/v1/commerce/returns/${returnId}/dispositions`),
    enabled: returnId !== '',
  });
}

export function useSetReturnDisposition(returnId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetDispositionBody) =>
      api.post<SetDispositionResult>(`/v1/commerce/returns/${returnId}/disposition`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RETURNS_KEY });
      // Three of the four dispositions move stock, so every stock screen is
      // stale the moment one is recorded.
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
