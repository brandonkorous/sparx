'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SUPPLIER'S INVOICE, AND WHETHER IT IS RIGHT (docs/146 Phase 8.8)
//
// Three documents, compared: what was ORDERED, what was RECEIVED, what is being
// BILLED. The comparison that matters is billed-against-received — a supplier
// who ships eight of ten and invoices for ten has not made an ordering error,
// they have billed for goods that are not on your shelf, and only the delivery
// record knows.
//
// The match comes back ON THE DETAIL, every time, rather than behind a "check
// this bill" button. A screen that needs a second click to say whether the
// invoice agrees with the delivery is a screen where nobody clicks it.
//
// `match.ok` is `boolean | null`, and the null is load-bearing: a bill that
// points at no order line at all has not PASSED the check, the check never ran.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type MatchVerdict =
  | 'matched'
  | 'not_received'
  | 'over_billed'
  | 'under_billed'
  | 'price_higher'
  | 'price_lower'
  | 'unordered';

export interface MatchResult {
  verdict: MatchVerdict;
  /** Billed minus received. Null when there is nothing to compare against. */
  quantityVarianceUnits: number | null;
  /** Billed minus agreed, per unit. */
  priceVarianceCents: number | null;
  /** What the variance is worth. Positive = the bill is higher than the goods
   *  justify. */
  amountVarianceCents: number | null;
  needsReview: boolean;
}

export interface SupplierBillLine {
  id: string;
  purchaseOrderLineId: string | null;
  variantId: string | null;
  variantSku: string | null;
  productTitle: string | null;
  description: string | null;
  quantity: number;
  unitCostCents: number;
  amountCents: number;
  uomCode: string | null;
  unitsPerUom: number;
  orderedQuantity: number | null;
  orderedUnitCostCents: number | null;
  receivedQuantity: number | null;
  match: MatchResult;
}

export interface BillMatch {
  /** Null when nothing on the bill could be matched — the check did not run. */
  ok: boolean | null;
  linesMatched: number;
  linesFlagged: number;
  totalVarianceCents: number | null;
  /** Lines billed that were never ordered. Not a variance to net off. */
  unorderedLines: number;
}

export interface SupplierBill {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  status: string;
  currency: string;
  fxRate: number | null;
  billedAt: string;
  dueAt: string | null;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  /** Null until paid — not 0. */
  paidCents: number | null;
  paidAt: string | null;
  varianceAcceptedByUserId: string | null;
  varianceAcceptedByName: string | null;
  varianceAcceptedAt: string | null;
  notes: string | null;
  /** Negative = overdue. Null when nobody set a due date, or once it is paid. */
  daysUntilDue: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierBillDetail extends SupplierBill {
  lines: SupplierBillLine[];
  match: BillMatch;
}

export interface SupplierBillsReport {
  items: SupplierBill[];
  total: number;
  outstandingCents: number;
  outstandingCount: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const billKeys = {
  all: ['inventory', 'supplier-bills'] as const,
  list: (filter: string) => [...billKeys.all, 'list', filter] as const,
  detail: (id: string) => [...billKeys.all, 'detail', id] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export interface BillListQuery {
  status?: string;
  overdueOnly?: boolean;
  supplierId?: string;
  purchaseOrderId?: string;
}

export function useSupplierBills(query: BillListQuery = {}) {
  const key = `${query.status ?? 'any'}:${query.overdueOnly ? 'overdue' : 'all'}:${query.supplierId ?? ''}:${query.purchaseOrderId ?? ''}`;
  return useQuery({
    queryKey: billKeys.list(key),
    queryFn: () =>
      api.get<SupplierBillsReport>('/v1/inventory/supplier-bills', {
        ...(query.status ? { status: query.status } : {}),
        ...(query.overdueOnly ? { overdue_only: true } : {}),
        ...(query.supplierId ? { supplier_id: query.supplierId } : {}),
        ...(query.purchaseOrderId ? { purchase_order_id: query.purchaseOrderId } : {}),
        take: 200,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useSupplierBill(id: string) {
  return useQuery({
    queryKey: billKeys.detail(id),
    queryFn: () => api.get<SupplierBillDetail>(`/v1/inventory/supplier-bills/${id}`),
    enabled: id !== '' && id !== 'new',
  });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

function useInvalidateBills() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: billKeys.all });
  };
}

export interface SupplierBillInput {
  supplierId: string;
  purchaseOrderId?: string;
  number: string;
  billedAt: string;
  dueAt?: string;
  currency?: string;
  taxCents?: number;
  shippingCents?: number;
  notes?: string;
  lines: {
    purchaseOrderLineId?: string;
    variantId?: string;
    description?: string;
    quantity: number;
    unitCostCents: number;
    amountCents?: number;
    uomCode?: string;
  }[];
}

export function useCreateSupplierBill() {
  const invalidate = useInvalidateBills();
  return useMutation({
    mutationFn: (input: SupplierBillInput) =>
      api.post<SupplierBillDetail>('/v1/inventory/supplier-bills', input),
    onSuccess: invalidate,
  });
}

export function useUpdateSupplierBill(id: string) {
  const invalidate = useInvalidateBills();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch<SupplierBillDetail>(`/v1/inventory/supplier-bills/${id}`, input),
    onSuccess: invalidate,
  });
}

/** Refused by the server while the match has flagged something nobody has
 *  explained. That refusal IS the feature. */
export function useApproveSupplierBill(id: string) {
  const invalidate = useInvalidateBills();
  return useMutation({
    mutationFn: () =>
      api.post<SupplierBillDetail>(`/v1/inventory/supplier-bills/${id}/approve`, {}),
    onSuccess: invalidate,
  });
}

export function useAcceptBillVariance(id: string) {
  const invalidate = useInvalidateBills();
  return useMutation({
    mutationFn: (note: string) =>
      api.post<SupplierBillDetail>(`/v1/inventory/supplier-bills/${id}/accept-variance`, { note }),
    onSuccess: invalidate,
  });
}

export function useDisputeSupplierBill(id: string) {
  const invalidate = useInvalidateBills();
  return useMutation({
    mutationFn: (note: string) =>
      api.post<SupplierBillDetail>(`/v1/inventory/supplier-bills/${id}/dispute`, { note }),
    onSuccess: invalidate,
  });
}

export function useRecordBillPayment(id: string) {
  const invalidate = useInvalidateBills();
  return useMutation({
    mutationFn: (input: { paidCents: number; note?: string }) =>
      api.post<SupplierBillDetail>(`/v1/inventory/supplier-bills/${id}/pay`, input),
    onSuccess: invalidate,
  });
}

export function useCancelSupplierBill(id: string) {
  const invalidate = useInvalidateBills();
  return useMutation({
    mutationFn: () => api.post<SupplierBillDetail>(`/v1/inventory/supplier-bills/${id}/cancel`, {}),
    onSuccess: invalidate,
  });
}

/* ── Saying it out loud ─────────────────────────────────────────────────── */

export function billStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Entered';
    case 'awaiting_approval':
      return 'Waiting for sign-off';
    case 'approved':
      return 'Approved to pay';
    case 'disputed':
      return 'Queried with the supplier';
    case 'paid':
      return 'Paid';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function billStatusTone(status: string): Tone {
  switch (status) {
    case 'draft':
      return 'neutral';
    case 'awaiting_approval':
      return 'warning';
    case 'approved':
      return 'info';
    case 'disputed':
      return 'danger';
    case 'paid':
      return 'success';
    default:
      return 'neutral';
  }
}

/** What the match found on one line, in the shop's words. Each verdict is a
 *  different conversation with the supplier, so each gets its own sentence. */
export function verdictLabel(verdict: MatchVerdict): string {
  switch (verdict) {
    case 'matched':
      return 'Agrees';
    case 'not_received':
      return 'Billed but nothing arrived';
    case 'over_billed':
      return 'Billed for more than arrived';
    case 'under_billed':
      return 'Billed for less than arrived';
    case 'price_higher':
      return 'Charged more than agreed';
    case 'price_lower':
      return 'Charged less than agreed';
    case 'unordered':
      return 'Never ordered';
    default:
      return verdict;
  }
}

export function verdictTone(verdict: MatchVerdict): Tone {
  switch (verdict) {
    case 'matched':
      return 'success';
    case 'not_received':
    case 'unordered':
      return 'danger';
    case 'over_billed':
    case 'price_higher':
      return 'warning';
    // In the tenant's favour — still worth a look, because an under-bill today
    // is a correction next month, but it is not an alarm.
    case 'under_billed':
    case 'price_lower':
      return 'info';
    default:
      return 'neutral';
  }
}

/** The one-line verdict for the whole bill. Three states, and the third is why
 *  `ok` is nullable. */
export function matchSummary(match: BillMatch): { label: string; tone: Tone; detail: string } {
  if (match.ok === null) {
    return {
      label: 'Not checked',
      tone: 'neutral',
      detail:
        'None of these lines points at a purchase order, so there is nothing to compare them against. Link the bill to an order to have it checked.',
    };
  }
  if (match.ok) {
    return {
      label: 'Agrees with the delivery',
      tone: 'success',
      detail: `All ${match.linesMatched} line(s) match what was ordered and what arrived.`,
    };
  }
  return {
    label: `${match.linesFlagged} line(s) do not agree`,
    tone: 'danger',
    detail:
      match.unorderedLines > 0
        ? `${match.unorderedLines} of them were never ordered at all.`
        : 'Check these before the bill is approved for payment.',
  };
}
