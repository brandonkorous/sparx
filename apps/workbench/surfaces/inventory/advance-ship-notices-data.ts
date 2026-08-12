'use client';

// ══════════════════════════════════════════════════════════════════════════
// WHAT THE SUPPLIER SAYS IS ON THE WAY (docs/146 Phase 8.6)
//
// A notice is a CLAIM, never a fact. Nothing here moves stock: the goods are on
// a lorry and the supplier's word is not a delivery. Every quantity in these
// types is what they SAID.
//
// The payoff is at the receiving desk. Booking a delivery stops being
// transcription — the lines are already there with quantities on them — and,
// more importantly, a DISCREPANCY becomes visible. Without a notice, a short
// shipment and a short order look identical, so nobody ever notices they were
// billed for the difference.
//
// `discrepancyUnits` is NULL until the delivery has actually been booked, and
// that matters: printing 0 before anything has arrived would read as "the notice
// matched", which is a claim about a pallet nobody has opened.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';
import { purchaseOrderKeys } from './purchase-orders-data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface AsnLine {
  id: string;
  purchaseOrderLineId: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  /** Base units, as stated by the supplier. */
  quantityShipped: number;
  uomCode: string | null;
  unitsPerUom: number;
  lotNumber: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  /** Received minus shipped, once the delivery has been booked. Null before. */
  discrepancyUnits: number | null;
}

export interface AdvanceShipNotice {
  id: string;
  number: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string | null;
  supplierId: string;
  supplierName: string | null;
  status: string;
  reference: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  packageCount: number | null;
  shippedAt: string | null;
  expectedArrivalAt: string | null;
  receivedAt: string | null;
  goodsReceiptId: string | null;
  /** manual | file | api — a notice typed off an emailed PDF and one posted by
   *  the supplier's own system deserve different confidence. */
  source: string;
  notes: string | null;
  unitsShipped: number;
  /** Said to have left, past its date, still not here. */
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AsnDetail extends AdvanceShipNotice {
  lines: AsnLine[];
  /** Null while nothing has been received — see `discrepancyUnits`. */
  hasDiscrepancy: boolean | null;
}

export interface AsnPrefillLine {
  purchaseOrderLineId: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantity: number;
  uomCode: string | null;
  unitsPerUom: number;
  lotNumber: string | null;
  quantityOutstanding: number;
  /** The notice claims more than the order still has open — the case a notice
   *  exists to expose, so it is never quietly clamped away. */
  exceedsOutstanding: boolean;
}

export interface AsnPrefill {
  advanceShipNoticeId: string;
  number: string;
  purchaseOrderId: string;
  reference: string | null;
  lines: AsnPrefillLine[];
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const asnKeys = {
  all: ['inventory', 'advance-ship-notices'] as const,
  list: (filter: string) => [...asnKeys.all, 'list', filter] as const,
  detail: (id: string) => [...asnKeys.all, 'detail', id] as const,
  forOrder: (purchaseOrderId: string) => [...asnKeys.all, 'order', purchaseOrderId] as const,
  prefill: (id: string) => [...asnKeys.all, 'prefill', id] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export interface AsnListQuery {
  status?: 'expected' | 'received' | 'cancelled';
  overdueOnly?: boolean;
  supplierId?: string;
}

export function useAdvanceShipNotices(query: AsnListQuery = {}) {
  const key = `${query.status ?? 'any'}:${query.overdueOnly ? 'overdue' : 'all'}:${query.supplierId ?? ''}`;
  return useQuery({
    queryKey: asnKeys.list(key),
    queryFn: () =>
      api.list<AdvanceShipNotice>('/v1/inventory/advance-ship-notices', {
        ...(query.status ? { status: query.status } : {}),
        ...(query.overdueOnly ? { overdue_only: true } : {}),
        ...(query.supplierId ? { supplier_id: query.supplierId } : {}),
        take: 200,
      }),
    placeholderData: (previous) => previous,
  });
}

/** The notices against one order — shown on the order's own pane, because "what
 *  have they told us is coming" is a question about the order. */
export function useOrderAsns(purchaseOrderId: string) {
  return useQuery({
    queryKey: asnKeys.forOrder(purchaseOrderId),
    queryFn: () =>
      api.list<AdvanceShipNotice>('/v1/inventory/advance-ship-notices', {
        purchase_order_id: purchaseOrderId,
        take: 50,
      }),
    enabled: purchaseOrderId !== '' && purchaseOrderId !== 'new',
  });
}

export function useAdvanceShipNotice(id: string) {
  return useQuery({
    queryKey: asnKeys.detail(id),
    queryFn: () => api.get<AsnDetail>(`/v1/inventory/advance-ship-notices/${id}`),
    enabled: id !== '' && id !== 'new',
  });
}

/** The suggestion a receiver starts from. A READ: it books nothing, because the
 *  person with the pallet in front of them is the one who decides what arrived. */
export function useAsnPrefill(id: string) {
  return useQuery({
    queryKey: asnKeys.prefill(id),
    queryFn: () => api.get<AsnPrefill>(`/v1/inventory/advance-ship-notices/${id}/prefill`),
    enabled: id !== '',
  });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

function useInvalidateAsns() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: asnKeys.all });
    void queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
  };
}

export interface AsnInput {
  purchaseOrderId: string;
  reference?: string;
  carrier?: string;
  trackingNumber?: string;
  packageCount?: number;
  shippedAt?: string;
  expectedArrivalAt?: string;
  source?: 'manual' | 'file' | 'api';
  notes?: string;
  lines: {
    purchaseOrderLineId: string;
    quantityShipped: number;
    uomCode?: string;
    lotNumber?: string;
  }[];
}

export function useCreateAsn() {
  const invalidate = useInvalidateAsns();
  return useMutation({
    mutationFn: (input: AsnInput) =>
      api.post<AsnDetail>('/v1/inventory/advance-ship-notices', input),
    onSuccess: invalidate,
  });
}

export function useUpdateAsn(id: string) {
  const invalidate = useInvalidateAsns();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch<AsnDetail>(`/v1/inventory/advance-ship-notices/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useCancelAsn() {
  const invalidate = useInvalidateAsns();
  return useMutation({
    mutationFn: (id: string) => api.post(`/v1/inventory/advance-ship-notices/${id}/cancel`, {}),
    onSuccess: invalidate,
  });
}

/* ── Saying it out loud ─────────────────────────────────────────────────── */

export function asnStatusLabel(notice: { status: string; isOverdue: boolean }): string {
  switch (notice.status) {
    case 'expected':
      return notice.isOverdue ? 'Should have arrived' : 'On the way';
    case 'received':
      return 'Arrived';
    case 'cancelled':
      return 'Called off';
    default:
      return notice.status;
  }
}

export function asnStatusTone(notice: { status: string; isOverdue: boolean }): Tone {
  switch (notice.status) {
    case 'expected':
      return notice.isOverdue ? 'danger' : 'info';
    case 'received':
      return 'success';
    default:
      return 'neutral';
  }
}

/** Where the notice came from, in the shop's words. */
export function asnSourceLabel(source: string): string {
  switch (source) {
    case 'api':
      return 'Sent by the supplier’s system';
    case 'file':
      return 'Imported from a file';
    default:
      return 'Typed in by hand';
  }
}

/**
 * A line's discrepancy, in words.
 *
 * Three genuinely different states, and the third is the one that matters:
 * nothing has arrived yet, so there is nothing to disagree with. Saying
 * "matched" there would be a claim about an unopened pallet.
 */
export function discrepancyLabel(units: number | null): string {
  if (units === null) return 'Not checked in yet';
  if (units === 0) return 'Matched';
  if (units < 0) return `${Math.abs(units)} short of the notice`;
  return `${units} more than the notice`;
}

export function discrepancyTone(units: number | null): Tone {
  if (units === null) return 'neutral';
  if (units === 0) return 'success';
  if (units < 0) return 'danger';
  return 'warning';
}
