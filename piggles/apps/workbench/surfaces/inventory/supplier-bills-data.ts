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
// `plural`, because this file writes sentences a business owner reads. Receiving
// learned that in issue 495, when a delivery two metres short told a dressmaker
// "1 line(s) are short"; the bill check beside it kept saying it.
import { plural, type Tone } from './data';

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
  /** Billed minus what was LEFT to invoice — what arrived, less whatever other
   *  live invoices already charged for. Null when there is nothing to compare
   *  against. */
  quantityVarianceUnits: number | null;
  /** Billed minus agreed, per unit. */
  priceVarianceCents: number | null;
  /** The money wrongly charged on this line. Positive = the bill is higher than
   *  the goods justify. A shortfall contributes nothing to it. */
  amountVarianceCents: number | null;
  /** What the units that arrived and are on no invoice yet are worth. */
  uninvoicedCents: number | null;
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
  /** Units of this order line already charged for on other live invoices.
   *  Without it a row reading "arrived 40, billed 2, agrees" cannot explain
   *  itself. */
  alreadyBilledQuantity: number | null;
  match: MatchResult;
}

export interface BillMatch {
  /** Null when nothing on the bill could be matched — the check did not run. */
  ok: boolean | null;
  linesMatched: number;
  linesFlagged: number;
  /** The money riding on THIS invoice: the flagged lines only. */
  totalVarianceCents: number | null;
  /** What the goods that arrived and are on no invoice yet are worth. Never
   *  part of the figure above — an invoice nobody has sent is not at stake. */
  uninvoicedCents: number | null;
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
  freightCents: number;
  totalCents: number;
  /** Null until paid — not 0. */
  paidCents: number | null;
  paidAt: string | null;
  varianceAcceptedByUserId: string | null;
  varianceAcceptedByName: string | null;
  varianceAcceptedAt: string | null;
  notes: string | null;
  /**
   * Negative = overdue. Null when nobody set a due date, or once it is paid.
   *
   * NOT what the screens count with. The server divides elapsed milliseconds by
   * a day, in UTC, which makes the hour a document happened to be raised at part
   * of the answer and knows nothing about where the business is. Both panes call
   * `daysUntilDue` from `lib/console/days.ts` instead, which counts calendar
   * days in the shop's own zone (issue 885). Kept because it is a real field on
   * a public API, and other clients read it.
   */
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
  /** The part of the above queried with the supplier — inside the total, not
   *  beside it. See supplier-bills-words.ts. */
  queriedCents: number;
  queriedCount: number;
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
  freightCents?: number;
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

/** The way back out of a query. Without it, querying an invoice was a one-way
 *  door whose only other exit was cancelling the invoice altogether: approve
 *  and pay both refuse while it is disputed. Settling returns it to a draft, so
 *  the figures can be corrected off whatever the supplier sent back. */
export function useSettleBillQuery(id: string) {
  const invalidate = useInvalidateBills();
  return useMutation({
    mutationFn: () =>
      api.post<SupplierBillDetail>(`/v1/inventory/supplier-bills/${id}/settle-query`, {}),
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
      return 'Canceled';
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
    // NOT "billed for less than arrived", which reads as an accusation. On an
    // order that turns up in more than one drop this is simply where the
    // paperwork is: these units are here and their invoice has not come yet.
    case 'under_billed':
      return 'Rest still to be invoiced';
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
    // Neither is an alarm. `price_lower` is worth a look, because a supplier who
    // undercharges today issues a correction next month; `under_billed` is not
    // a look at all, just a note that another invoice is still to come.
    case 'under_billed':
    case 'price_lower':
      return 'info';
    default:
      return 'neutral';
  }
}

/** The one-line verdict for the whole bill. Three states, and the third is why
 *  `ok` is nullable. */
export function matchSummary(
  match: BillMatch,
  /** The bill's own lines, for the one fact the aggregate does not carry: how
   *  much of this order is already on somebody else's invoice. Defaulted so an
   *  older caller still compiles, and so the sentence degrades to the careful
   *  one rather than the confident one. */
  lines: readonly { alreadyBilledQuantity: number | null }[] = []
): { label: string; tone: Tone; detail: string } {
  if (match.ok === null) {
    return {
      label: 'Not checked',
      tone: 'neutral',
      detail:
        'None of these lines points at an order you sent, so there is nothing to compare them against. Link the bill to an order to have it checked.',
    };
  }
  if (match.ok) {
    // A partial invoice passes, and it must not be described as matching what
    // arrived, because it does not: it charges for part of it. What it matches
    // is the agreed price, on goods that are here.
    //
    // ── WHAT THE REST OF THE ORDER IS DOING (issue 886) ────────────────────
    //
    // There are two ways an invoice can cover part of a delivery, and the
    // sentence has to say which. AM-2214 from Ashcombe Mills charged for 2
    // units of a 40-unit order whose other 38 were on AM-2198, and the bill
    // passed the check — correctly, because 2 at the agreed price against 2
    // units nobody else had invoiced is exactly right. It then said:
    //
    //     The one line on this bill matches what was ordered and what arrived.
    //
    // over a table reading ordered 40, arrived 40, billed 2. The row underneath
    // already carried "38 on other invoices"; the sentence above it had never
    // been told. [[feedback_a_fix_leaves_its_neighbour_behind]]
    const elsewhere = lines.some((l) => (l.alreadyBilledQuantity ?? 0) > 0);
    const stillToCome = match.uninvoicedCents !== null && match.uninvoicedCents > 0;
    if (stillToCome || elsewhere) {
      return {
        label: 'Agrees with the delivery',
        tone: 'success',
        detail: `Everything charged here is at the agreed price, for goods that arrived. ${
          stillToCome && elsewhere
            ? 'The rest of this order is partly on other invoices and partly not invoiced yet.'
            : elsewhere
              ? 'The rest of this order is on other invoices.'
              : 'The rest of this order has not been invoiced yet.'
        }`,
      };
    }
    // ARRIVED and the AGREED PRICE, which is what the check compares. Saying
    // "what was ordered" claims something it never looked at: a delivery two
    // short, invoiced for the two-short amount, passes this check and does not
    // match the order.
    return {
      label: 'Agrees with the delivery',
      tone: 'success',
      detail:
        match.linesMatched === 1
          ? 'The one line on this bill charges for what arrived, at the price you agreed.'
          : `All ${String(match.linesMatched)} lines charge for what arrived, at the price you agreed.`,
    };
  }
  return {
    label: `${plural(match.linesFlagged, 'line', 'lines')} ${
      match.linesFlagged === 1 ? 'does' : 'do'
    } not agree`,
    tone: 'danger',
    detail:
      match.unorderedLines > 0
        ? `${match.unorderedLines} of them were never ordered at all.`
        : 'Check these before the bill is approved for payment.',
  };
}
