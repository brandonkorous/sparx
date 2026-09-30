'use client';

// ══════════════════════════════════════════════════════════════════════════
// SENDING STOCK BACK, AND CHASING THE MONEY (docs/146 Phase 8.7)
//
// The reason a return needs a record rather than an adjustment is the money.
// Writing off six broken pumps tells the ledger the truth about the shelf and
// nothing at all about the $900 the supplier owes — after which that credit is
// remembered by one person, in their head, until they leave.
//
// So two facts are recorded separately. The EXPECTATION when the goods go, and
// the RESOLUTION later. `creditReceivedCents` is null until somebody records a
// credit note: zero would mean "they refused", which is a completely different
// conversation from "we are still waiting".
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';
import { stockKeys } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface SupplierReturnLine {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantity: number;
  unitCostCents: number;
  lineTotalCents: number;
  uomCode: string | null;
  unitsPerUom: number;
  lotNumber: string | null;
  note: string | null;
  movementId: string | null;
}

export interface SupplierReturn {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  status: string;
  reason: string;
  creditExpectedCents: number;
  /** Null until a credit note is recorded. NOT zero. */
  creditReceivedCents: number | null;
  /** Expected minus received, once a credit exists. Null before. */
  creditShortfallCents: number | null;
  currency: string;
  rmaNumber: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  sentAt: string | null;
  resolvedAt: string | null;
  /** Days since the goods left with nothing credited. The chase number. */
  awaitingCreditDays: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierReturnDetail extends SupplierReturn {
  lines: SupplierReturnLine[];
}

export interface SupplierReturnsReport {
  items: SupplierReturn[];
  total: number;
  /** What suppliers owe right now, across everything sent and uncredited. */
  awaitingCreditCents: number;
  awaitingCreditCount: number;
  /** Every return ever raised, whatever the view is filtered to. An empty list
   *  is two opposite facts and only this can tell them apart. */
  everCount: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const returnKeys = {
  all: ['inventory', 'supplier-returns'] as const,
  list: (filter: string) => [...returnKeys.all, 'list', filter] as const,
  detail: (id: string) => [...returnKeys.all, 'detail', id] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export interface ReturnListQuery {
  status?: 'draft' | 'sent' | 'credited' | 'closed' | 'cancelled';
  awaitingCreditOnly?: boolean;
  supplierId?: string;
}

export function useSupplierReturns(query: ReturnListQuery = {}) {
  const key = `${query.status ?? 'any'}:${query.awaitingCreditOnly ? 'awaiting' : 'all'}:${query.supplierId ?? ''}`;
  return useQuery({
    queryKey: returnKeys.list(key),
    queryFn: () =>
      api.get<SupplierReturnsReport>('/v1/inventory/supplier-returns', {
        ...(query.status ? { status: query.status } : {}),
        ...(query.awaitingCreditOnly ? { awaiting_credit_only: true } : {}),
        ...(query.supplierId ? { supplier_id: query.supplierId } : {}),
        take: 200,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useSupplierReturn(id: string) {
  return useQuery({
    queryKey: returnKeys.detail(id),
    queryFn: () => api.get<SupplierReturnDetail>(`/v1/inventory/supplier-returns/${id}`),
    enabled: id !== '' && id !== 'new',
  });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

function useInvalidateReturns() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: returnKeys.all });
    // Sending a return takes units off a shelf, so the stock screens are stale
    // the moment it happens.
    void queryClient.invalidateQueries({ queryKey: stockKeys.all });
  };
}

export interface SupplierReturnInput {
  supplierId: string;
  warehouseId: string;
  purchaseOrderId?: string;
  reason: string;
  rmaNumber?: string;
  carrier?: string;
  trackingNumber?: string;
  currency?: string;
  notes?: string;
  lines: {
    variantId: string;
    quantity: number;
    unitCostCents?: number;
    uomCode?: string;
    lotNumber?: string;
    note?: string;
  }[];
}

export function useCreateSupplierReturn() {
  const invalidate = useInvalidateReturns();
  return useMutation({
    mutationFn: (input: SupplierReturnInput) =>
      api.post<SupplierReturnDetail>('/v1/inventory/supplier-returns', input),
    onSuccess: invalidate,
  });
}

export function useUpdateSupplierReturn(id: string) {
  const invalidate = useInvalidateReturns();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch<SupplierReturnDetail>(`/v1/inventory/supplier-returns/${id}`, input),
    onSuccess: invalidate,
  });
}

/** The pallet leaves. This is the one that moves stock. */
export function useSendSupplierReturn(id: string) {
  const invalidate = useInvalidateReturns();
  return useMutation({
    mutationFn: () =>
      api.post<SupplierReturnDetail>(`/v1/inventory/supplier-returns/${id}/send`, {}),
    onSuccess: invalidate,
  });
}

export function useRecordSupplierCredit(id: string) {
  const invalidate = useInvalidateReturns();
  return useMutation({
    mutationFn: (input: { creditReceivedCents: number; note?: string }) =>
      api.post<SupplierReturnDetail>(`/v1/inventory/supplier-returns/${id}/credit`, input),
    onSuccess: invalidate,
  });
}

export function useCloseSupplierReturn(id: string) {
  const invalidate = useInvalidateReturns();
  return useMutation({
    mutationFn: (note: string) =>
      api.post<SupplierReturnDetail>(`/v1/inventory/supplier-returns/${id}/close`, { note }),
    onSuccess: invalidate,
  });
}

export function useCancelSupplierReturn(id: string) {
  const invalidate = useInvalidateReturns();
  return useMutation({
    mutationFn: () =>
      api.post<SupplierReturnDetail>(`/v1/inventory/supplier-returns/${id}/cancel`, {}),
    onSuccess: invalidate,
  });
}

/* ── Saying it out loud ─────────────────────────────────────────────────── */

export function returnStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Being put together';
    case 'sent':
      return 'Gone back: waiting for credit';
    case 'credited':
      return 'Credited';
    case 'closed':
      return 'Written off';
    case 'cancelled':
      return 'Called off';
    default:
      return status;
  }
}

export function returnStatusTone(status: string): Tone {
  switch (status) {
    case 'draft':
      return 'neutral';
    case 'sent':
      return 'warning';
    case 'credited':
      return 'success';
    case 'closed':
      return 'danger';
    default:
      return 'neutral';
  }
}

export const RETURN_REASONS = [
  { value: 'damaged', label: 'Arrived damaged' },
  { value: 'wrong_item', label: 'Wrong item sent' },
  { value: 'quality', label: 'Not good enough' },
  { value: 'overstock', label: 'Too many: sending some back' },
  { value: 'expired', label: 'Out of date' },
  { value: 'recall', label: 'Recalled by the supplier' },
  { value: 'other', label: 'Something else' },
] as const;

export function returnReasonLabel(reason: string): string {
  return RETURN_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

/** Reasons that are the SUPPLIER's fault carry their color; the ones that are
 *  ours (overstock) do not pretend to be a complaint. */
export function returnReasonTone(reason: string): Tone {
  switch (reason) {
    case 'damaged':
    case 'wrong_item':
    case 'quality':
      return 'danger';
    case 'expired':
    case 'recall':
      return 'warning';
    case 'overstock':
      return 'info';
    default:
      return 'neutral';
  }
}

/** How long a credit has been outstanding, as a color. Thirty days is the point
 *  at which most suppliers' own terms say it should have been settled. */
export function chaseTone(days: number | null): Tone {
  if (days === null) return 'neutral';
  if (days >= 30) return 'danger';
  if (days >= 14) return 'warning';
  return 'info';
}

/* ── Is this one still a chase? ─────────────────────────────────────────── */

/**
 * Whether the return has FINISHED, whichever way it finished.
 *
 * The server has written this rule down three times and the screens had never
 * been told. `listSupplierReturns` builds the chase list from
 * `{ status: 'sent', creditReceivedCents: null }`, counts the "you are owed"
 * headline against that same `where`, and documents `awaitingCreditDays` as
 * "null before it is sent, and null once it is resolved".
 *
 * That last null is what broke three cells. It covers THREE different returns
 * at once - one never sent, one credited, one written off - and the cell under
 * the heading "Waiting" was written for the first of them. A return credited in
 * full fell into the same branch and printed the day the goods LEFT, so a
 * settled return read "2 weeks ago" under a word that asks how long something
 * has been outstanding, four inches from a toolbar correctly saying "Nothing
 * outstanding". Branch on the STATE, never on the absence of a number.
 */
export function returnIsSettled(status: string): boolean {
  return status === 'credited' || status === 'closed' || status === 'cancelled';
}

/**
 * What the ending is CALLED, or null while the return is still open.
 *
 * This lived privately in the detail pane, where it had already fixed one of
 * the three cells. The list two files away still carried the defect it was
 * written to describe, so the rule lives out here now and both screens read it.
 */
export function returnSettledTitle(status: string): string | null {
  switch (status) {
    case 'credited':
      return 'Credited';
    case 'closed':
      return 'Written off';
    case 'cancelled':
      return 'Called off';
    default:
      return null;
  }
}

/**
 * The heading over `creditExpectedCents`.
 *
 * That number is the size of the CLAIM and it never changes. Whether she is
 * still OWED it very much does: "You are owed $18.00" printed beside "settled
 * in full" is the screen telling her to go and chase money that had already
 * arrived. A draft has not left the shelf yet, so she is not owed it either.
 */
export function returnClaimTitle(status: string): string {
  if (returnIsSettled(status)) return 'You asked for';
  if (status === 'draft') return 'To claim back';
  return 'You are owed';
}
