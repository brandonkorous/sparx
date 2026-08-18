'use client';

// ══════════════════════════════════════════════════════════════════════════
// SENDING STOCK BACK, AND CHASING THE MONEY (docs/146 Phase 8.7)
//
// The reason a return needs a record rather than an adjustment is the money.
// Writing off six broken pumps tells the ledger the truth about the shelf and
// nothing at all about the £900 the supplier owes — after which that credit is
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
      return 'Gone back — waiting for credit';
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
  { value: 'overstock', label: 'Too many — sending some back' },
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
