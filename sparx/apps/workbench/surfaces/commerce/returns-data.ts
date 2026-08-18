'use client';

// Returns data — a customer sending something back, and the steps a business
// takes to settle it.
//
// This file OWNS the return types and the ['commerce','returns'] query key. The
// return list and the return detail read the SAME shapes from here, so a field
// one renders is always a field the other fetched.
//
// A return moves through a real state machine on the server — requested →
// approved/denied → received → inspected → refunded — and each step is a
// separate write with its own endpoint. The mutation hooks below mirror that
// one-to-one, and every one invalidates the whole returns key so the list badge
// and the detail pane never disagree about what state a return is in.
//
// Money arrives as integer CENTS on a return (refunded amount, restocking fee),
// NOT the Decimal-as-string that orders use — so the cents helpers here divide
// by 100 once, at the render edge, and the shared `formatMoney` from ./data
// stays the single money formatter across every commerce surface.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'denied'
  | 'awaiting_shipment'
  | 'in_transit'
  | 'received'
  | 'inspecting'
  | 'inspected'
  | 'refunded'
  | 'cancelled';

/** A row in the returns list — enough to name the return and the sale it came
 *  from without a lookup per row. */
export interface ReturnSummary {
  id: string;
  orderId: string;
  orderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  status: ReturnStatus;
  preferredOutcome: string;
  itemCount: number;
  requestedAt: string;
}

export interface ReturnLine {
  id: string;
  orderItemId: string;
  orderItemName: string | null;
  quantity: number;
  approvedQuantity: number;
  reasonCode: string;
  customerNote: string | null;
  mediaAssetIds: string[];
}

export interface ReturnInspectionRecord {
  id: string;
  returnLineItemId: string;
  lineItemName: string | null;
  condition: string;
  restockable: boolean;
  warehouseId: string | null;
  warehouseName: string | null;
  note: string | null;
}

export interface ReturnLabelRecord {
  id: string;
  providerSlug: string;
  labelRef: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelMediaId: string | null;
  costCents: number;
}

export interface ReturnDetail extends ReturnSummary {
  staffNote: string | null;
  refundedAmountCents: number | null;
  restockingFeeCents: number | null;
  refundIssuedAs: string | null;
  approvedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  cancelledAt: string | null;
  items: ReturnLine[];
  inspections: ReturnInspectionRecord[];
  labels: ReturnLabelRecord[];
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export const RETURNS_KEY = ['commerce', 'returns'];

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

/**
 * The server's own sentence for a 4xx. These routes explain the real problem
 * ("Cannot approve return from status \"refunded\"", "No payment gateway is
 * configured to settle this refund") far better than anything this side could
 * infer from a status code. A 5xx has no such sentence, so it falls back to the
 * caller's wording.
 */
export function returnErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/* ── Saying what a state means ──────────────────────────────────────────── */

/**
 * Where a return is, in the words a business owner uses. The stored values are a
 * developer's vocabulary — "inspected" and "in_transit" tell an owner nothing
 * about what they should do next.
 */
export function returnState(status: ReturnStatus): { label: string; tone: Tone; detail: string } {
  switch (status) {
    case 'requested':
      return {
        label: 'Needs a decision',
        tone: 'warning',
        detail: 'A customer has asked to send something back. Approve it or turn it down.',
      };
    case 'approved':
      return {
        label: 'Approved',
        tone: 'info',
        detail: 'You said yes. Waiting for the goods to come back to you.',
      };
    case 'awaiting_shipment':
      return {
        label: 'Waiting to be sent',
        tone: 'info',
        detail: 'Approved — the customer has not put it in the post yet.',
      };
    case 'in_transit':
      return {
        label: 'On its way back',
        tone: 'info',
        detail: 'The customer has sent it and it is coming back to you.',
      };
    case 'received':
      return {
        label: 'Back with you',
        tone: 'info',
        detail: 'The goods have arrived. Check their condition, then settle the refund.',
      };
    case 'inspecting':
      return {
        label: 'Being checked',
        tone: 'info',
        detail: 'You are looking over what came back.',
      };
    case 'inspected':
      return {
        label: 'Checked, ready to settle',
        tone: 'info',
        detail: 'You have recorded the condition. Give the customer their money back to finish.',
      };
    case 'refunded':
      return {
        label: 'Settled',
        tone: 'success',
        detail: 'The customer has had their money back and this return is done.',
      };
    case 'denied':
      return {
        label: 'Turned down',
        tone: 'danger',
        detail: 'You declined this return. Nothing is coming back and no money changes hands.',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        tone: 'neutral',
        detail: 'This return was called off before it was settled.',
      };
    default:
      return { label: status, tone: 'neutral', detail: '' };
  }
}

/** Why the customer is sending it back, in plain words. */
export const REASON_LABELS: Record<string, string> = {
  wrong_item: 'Wrong item sent',
  wrong_size: 'Wrong size',
  defective: 'Faulty',
  damaged_in_transit: 'Damaged on the way',
  not_as_described: 'Not as described',
  no_longer_needed: 'No longer needed',
  arrived_late: 'Arrived too late',
  other: 'Another reason',
};

/** What the customer would like instead of keeping the item. */
export const OUTCOME_LABELS: Record<string, string> = {
  refund: 'Money back',
  account_credit: 'Store credit',
  store_credit: 'Store credit',
  exchange: 'A replacement',
  repair: 'A repair',
};

/** How the goods came back, worst-to-best mattering for whether they can be
 *  resold. */
export const CONDITION_LABELS: Record<string, string> = {
  unopened: 'Unopened',
  like_new: 'As new',
  used_good: 'Used — good',
  used_acceptable: 'Used — acceptable',
  damaged: 'Damaged',
  destroyed: 'Destroyed',
};

/** How the money was actually given back. */
export const REFUND_ISSUED_AS_LABELS: Record<string, string> = {
  original_payment: 'Back to how they paid',
  account_credit: 'As store credit',
  gift_card: 'As a gift card',
};

export function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code;
}

export function outcomeLabel(code: string): string {
  return OUTCOME_LABELS[code] ?? code;
}

export function conditionLabel(code: string): string {
  return CONDITION_LABELS[code] ?? code;
}

/* ── What happens to the goods (docs/146 Phase 9.7) ─────────────────────── */
//
// `restockable` was the whole decision and could not carry it. Four things
// happen to returned goods and only one of them is "put it back"; the other
// three were all recorded as the same `false` and physically went wherever the
// person holding them decided.
//
// `disposition` is null until somebody chooses, and that null is the work list.
// There is no safe default in either direction — defaulting to restock puts a
// customer's damaged goods back on the shelf, defaulting to scrap throws away
// stock that was fine.

export interface ReturnDispositionRow {
  inspectionId: string;
  returnId: string;
  returnLineItemId: string;
  variantId: string | null;
  variantSku: string | null;
  variantName: string | null;
  quantity: number;
  condition: string;
  /** Null until somebody decides. */
  disposition: string | null;
  dispositionBinId: string | null;
  dispositionBinCode: string | null;
  dispositionAt: string | null;
  dispositionNote: string | null;
  warehouseId: string | null;
  inspectedAt: string;
}

export function useReturnDispositions(returnId: string) {
  return useQuery({
    queryKey: [...RETURNS_KEY, 'dispositions', returnId],
    queryFn: () => api.list<ReturnDispositionRow>(`/v1/commerce/returns/${returnId}/dispositions`),
    enabled: returnId !== '',
  });
}

export interface SetDispositionBody {
  inspectionId: string;
  disposition: string;
  binId?: string;
  note?: string;
}

export interface SetDispositionResult {
  inspectionId: string;
  disposition: string;
  unitsRestocked: number;
  binId: string | null;
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

/** What each decision is called in the words a person would use. */
export function dispositionLabel(disposition: string): string {
  switch (disposition) {
    case 'restock':
      return 'Back on sale';
    case 'quarantine':
      return 'Quarantined';
    case 'repair':
      return 'Awaiting repair';
    case 'scrap':
      return 'Scrapped';
    default:
      return 'Not decided';
  }
}

/** Color carries the distinction: back-on-sale is a recovery, scrap is a loss,
 *  and the two middle states are different kinds of "not yet" (DESIGN.md). */
export function dispositionTone(
  disposition: string | null
): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  switch (disposition) {
    case 'restock':
      return 'success';
    case 'quarantine':
      return 'warning';
    case 'repair':
      return 'info';
    case 'scrap':
      return 'danger';
    default:
      return 'neutral';
  }
}
