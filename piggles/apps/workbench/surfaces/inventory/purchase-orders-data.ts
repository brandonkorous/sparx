'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE BUYING REFERENCE DATA — PURCHASE ORDERS
//
// A purchase order (PO) is one order you place with a supplier: which items,
// how many, at what agreed price, landing at which of your locations, expected
// by when. It moves through a life:
//
//   Draft   — being written; freely editable, nothing committed.
//   Placed  — sent to the supplier; locked, now you wait for it.
//   Partly received — some of it has turned up (Receiving books this).
//   Received — all of it has turned up.
//   Closed  — you have stopped expecting the rest (a short shipment settled).
//   Cancelled — called off before anything arrived.
//
// The server calls "placed" `submitted`; we say Placed to a shop owner. Only a
// draft can be edited, so this file's saver reconciles a whole local draft — the
// header plus every line — down to the individual add/update/remove calls the
// API exposes, in one Save. That is what lets the detail pane behave like every
// other editor: type freely, one Save, one dirty guard.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { type Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One line on a PO — an item, how many, the agreed price, how many have come
 *  in so far. Mirrors the server's PurchaseOrderLineRow. */
export interface PurchaseOrderLine {
  id: string;
  variantId: string;
  description: string | null;
  supplierSku: string | null;
  variantSku: string | null;
  productTitle: string | null;
  /** ALWAYS in single units, whatever the buyer typed (docs/146 Phase 6.2). The
   *  pair below says what they typed it IN, so the line can read "4 cases". */
  quantityOrdered: number;
  quantityReceived: number;
  /** Per single unit. Multiply by `unitsPerUom` for the price of a pack. */
  unitCostCents: number;
  lineTotalCents: number;
  uomCode: string | null;
  unitsPerUom: number;
}

export interface PurchaseOrder {
  id: string;
  /** The human reference — PO-000123. Allocated by the server. */
  number: string;
  status: string;
  supplierId: string;
  supplierName: string | null;
  supplierCode: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  currency: string;
  paymentTerms: string | null;
  /** Your own reference for this order, e.g. a quote number. */
  reference: string | null;
  orderedAt: string | null;
  expectedArrivalAt: string | null;
  receivedAt: string | null;
  /** When the nightly pass announced this order as late, or null if it never
   *  has. Null is NOT "on time" — an order that went past its date this
   *  afternoon has not been through a nightly pass yet. */
  lateAlertedAt: string | null;
  subtotalCents: number;
  freightCents: number;
  totalCents: number;
  lineCount: number;
  quantityOrdered: number;
  quantityReceived: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  lines: PurchaseOrderLine[];
  /** Freight booked in WITH a delivery, which `freightCents` never hears about.
   *  Separate from it on purpose: one is what was agreed and the other is what
   *  turned up, and checking a supplier's invoice needs both (issue 552). */
  receiptFreightCents: number;
}

export interface PurchaseOrderListQuery {
  q?: string;
  status?: string;
  supplierId?: string;
  take: number;
  skip: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

/** `approvalKeys.all` from `po-approvals-data`, which cannot be imported here:
 *  that module already imports `purchaseOrderKeys` from this one. The copy is
 *  held to the original by a test rather than by hope. */
export const APPROVALS_QUERY_KEY = ['inventory', 'po-approvals'] as const;

export const purchaseOrderKeys = {
  all: ['inventory', 'purchase-orders'] as const,
  list: (query: PurchaseOrderListQuery) => [...purchaseOrderKeys.all, 'list', query] as const,
  detail: (id: string) => [...purchaseOrderKeys.all, 'detail', id] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** One window of the PO list. Status, supplier and search are all SERVER
 *  filters — "what is still outstanding from ACME" cannot be answered by
 *  sieving one page. */
export function usePurchaseOrders(query: PurchaseOrderListQuery) {
  return useQuery({
    queryKey: purchaseOrderKeys.list(query),
    queryFn: () =>
      api.list<PurchaseOrder>('/v1/inventory/purchase-orders', {
        ...(query.q ? { search: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.supplierId ? { supplier_id: query.supplierId } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: purchaseOrderKeys.detail(id),
    queryFn: () => api.get<PurchaseOrderDetail>(`/v1/inventory/purchase-orders/${id}`),
    enabled: id !== 'new',
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidatePurchaseOrders() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
    // Placing an order OPENS a sign-off request when a spending limit catches
    // it, so the queue and its "waiting" count are now stale. The mirror of
    // this already existed — deciding an approval invalidates the orders — and
    // only went the one way, so an order placed while the Sign-offs pane was
    // open left it reading "Nothing waiting" over the order it was holding.
    // [[feedback_a_fix_leaves_its_neighbour_behind]]
    void queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
  };
}

/* ── The whole-draft saver ──────────────────────────────────────────────── */

/** The header fields a draft PO carries. Supplier is fixed once created (the
 *  line prices are snapshots taken against it), so it is not editable here. */
export interface PurchaseOrderHeaderDraft {
  supplierId: string;
  warehouseId: string;
  currency: string;
  paymentTerms: string | null;
  reference: string | null;
  expectedArrivalAt: string | null;
  freightCents: number;
  notes: string | null;
}

/** One line as the draft holds it. No server id means a line not yet saved. */
export interface PurchaseOrderLineDraft {
  /** Present once saved; absent for a line added in this editing session. */
  id?: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  description: string | null;
  supplierSku: string | null;
  /** Single units, always. The editor types singles; the unit below is carried
   *  through so the row still reads "4 cases" and a save does not silently drop
   *  the unit the line was ordered in. */
  quantityOrdered: number;
  unitCostCents: number;
  uomCode: string | null;
  unitsPerUom: number;
}

function lineToInput(line: PurchaseOrderLineDraft) {
  return {
    variantId: line.variantId,
    quantity: line.quantityOrdered,
    unitCostCents: line.unitCostCents,
    ...(line.supplierSku ? { supplierSku: line.supplierSku } : {}),
    ...(line.description ? { description: line.description } : {}),
  };
}

/** Create a brand-new PO in one request — the API takes the whole thing (header
 *  + lines) at once for a draft that has never existed. */
async function createPurchaseOrderRequest(
  header: PurchaseOrderHeaderDraft,
  lines: PurchaseOrderLineDraft[]
): Promise<PurchaseOrderDetail> {
  return api.post<PurchaseOrderDetail>('/v1/inventory/purchase-orders', {
    supplierId: header.supplierId,
    warehouseId: header.warehouseId,
    currency: header.currency,
    ...(header.paymentTerms ? { paymentTerms: header.paymentTerms } : {}),
    ...(header.reference ? { reference: header.reference } : {}),
    ...(header.expectedArrivalAt ? { expectedArrivalAt: header.expectedArrivalAt } : {}),
    freightCents: header.freightCents,
    ...(header.notes ? { notes: header.notes } : {}),
    lines: lines.map(lineToInput),
  });
}

/** Save edits to an EXISTING draft. The API has no "replace the whole PO" call,
 *  so this diffs the draft against what was loaded and issues exactly the header
 *  patch, line adds, line updates and line removals needed — the reconciliation
 *  that lets the pane present one Save button over many endpoints. */
async function saveDraftPurchaseOrder(
  id: string,
  header: PurchaseOrderHeaderDraft,
  lines: PurchaseOrderLineDraft[],
  original: PurchaseOrderLine[]
): Promise<PurchaseOrderDetail> {
  // Header first — a warehouse/terms/shipping change is independent of the lines.
  await api.patch<PurchaseOrderDetail>(`/v1/inventory/purchase-orders/${id}`, {
    warehouseId: header.warehouseId,
    currency: header.currency,
    paymentTerms: header.paymentTerms,
    reference: header.reference,
    expectedArrivalAt: header.expectedArrivalAt,
    freightCents: header.freightCents,
    notes: header.notes,
  });

  const keptIds = new Set(lines.filter((line) => line.id).map((line) => line.id));

  // Remove the lines the draft dropped.
  for (const line of original) {
    if (!keptIds.has(line.id)) {
      await api.delete(`/v1/inventory/purchase-orders/${id}/lines/${line.id}`);
    }
  }

  // Add or update each remaining line. A line without an id is new; one whose
  // numbers match its saved self is skipped, so an untouched line costs nothing.
  const byId = new Map(original.map((line) => [line.id, line]));
  for (const line of lines) {
    if (!line.id) {
      await api.post(`/v1/inventory/purchase-orders/${id}/lines`, lineToInput(line));
      continue;
    }
    const before = byId.get(line.id);
    // A line whose numbers still match its saved self is skipped; an unknown
    // `before` (a line that vanished server-side) reads as changed and re-patches.
    const changed =
      before?.quantityOrdered !== line.quantityOrdered ||
      before?.unitCostCents !== line.unitCostCents ||
      (before?.supplierSku ?? null) !== (line.supplierSku ?? null) ||
      (before?.description ?? null) !== (line.description ?? null);
    if (changed) {
      await api.patch(`/v1/inventory/purchase-orders/${id}/lines/${line.id}`, {
        quantity: line.quantityOrdered,
        unitCostCents: line.unitCostCents,
        supplierSku: line.supplierSku,
        description: line.description,
      });
    }
  }

  return api.get<PurchaseOrderDetail>(`/v1/inventory/purchase-orders/${id}`);
}

export interface SavePurchaseOrderInput {
  id: string;
  header: PurchaseOrderHeaderDraft;
  lines: PurchaseOrderLineDraft[];
  original: PurchaseOrderLine[];
}

/** Save a draft — creating it or reconciling it, depending on whether it exists
 *  yet. One hook so the pane never branches on new-vs-existing itself. */
export function useSavePurchaseOrder() {
  const invalidate = useInvalidatePurchaseOrders();
  return useMutation({
    mutationFn: (input: SavePurchaseOrderInput) =>
      input.id === 'new'
        ? createPurchaseOrderRequest(input.header, input.lines)
        : saveDraftPurchaseOrder(input.id, input.header, input.lines, input.original),
    onSuccess: (detail) => {
      invalidate(detail.id);
    },
  });
}

/* ── Lifecycle transitions ──────────────────────────────────────────────── */

export function usePlacePurchaseOrder(id: string) {
  const invalidate = useInvalidatePurchaseOrders();
  return useMutation({
    mutationFn: (expectedArrivalAt?: string) =>
      api.post<PurchaseOrderDetail>(
        `/v1/inventory/purchase-orders/${id}/submit`,
        expectedArrivalAt ? { expectedArrivalAt } : {}
      ),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useCancelPurchaseOrder(id: string) {
  const invalidate = useInvalidatePurchaseOrders();
  return useMutation({
    mutationFn: () => api.post<PurchaseOrderDetail>(`/v1/inventory/purchase-orders/${id}/cancel`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useClosePurchaseOrder(id: string) {
  const invalidate = useInvalidatePurchaseOrders();
  return useMutation({
    mutationFn: () => api.post<PurchaseOrderDetail>(`/v1/inventory/purchase-orders/${id}/close`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeletePurchaseOrder(id: string) {
  const invalidate = useInvalidatePurchaseOrders();
  return useMutation({
    mutationFn: () => api.delete(`/v1/inventory/purchase-orders/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Saying what a PO's state means ─────────────────────────────────────── */

export interface PurchaseOrderState {
  label: string;
  tone: Tone;
  /** One sentence a shop owner would recognise. */
  detail: string;
}

export function purchaseOrderState(po: {
  status: string;
  quantityOrdered: number;
  quantityReceived: number;
}): PurchaseOrderState {
  switch (po.status) {
    case 'draft':
      return {
        label: 'Draft',
        tone: 'neutral',
        detail: 'Not sent yet. You can still change anything on it.',
      };
    // Its own state, not a flavour of draft (docs/146 Phase 8.5). The order has
    // left the buyer's hands and is waiting on somebody else — but it has NOT
    // been placed, and nothing may be received against it.
    case 'pending_approval':
      return {
        label: 'Waiting for sign-off',
        tone: 'warning',
        detail:
          'This order is over a limit your business set, so somebody has to approve it before it goes to the supplier. Nothing has been ordered yet.',
      };
    case 'submitted':
      return {
        label: 'Placed',
        tone: 'info',
        detail: 'Sent to the supplier. Waiting for it to arrive.',
      };
    case 'partial':
      return {
        label: 'Partly received',
        tone: 'warning',
        detail: 'Some of this order has arrived; the rest is still outstanding.',
      };
    case 'received':
      return {
        label: 'Received',
        tone: 'success',
        detail: 'Everything on this order has arrived and been booked into stock.',
      };
    case 'closed':
      return {
        label: 'Closed',
        tone: 'neutral',
        detail: 'You have stopped expecting anything more against this order.',
      };
    case 'cancelled':
      return {
        label: 'Canceled',
        tone: 'danger',
        detail: 'This order was called off. Nothing was received.',
      };
    default:
      return { label: po.status, tone: 'neutral', detail: '' };
  }
}

/** How many units are still to come — ordered minus already received. Zero once
 *  the order is complete; the number a buyer chases a supplier about. */
export function outstandingUnits(po: {
  quantityOrdered: number;
  quantityReceived: number;
}): number {
  return Math.max(0, po.quantityOrdered - po.quantityReceived);
}

/** Whether a PO can still be edited (draft only). */
export function isEditable(status: string): boolean {
  return status === 'draft';
}

/** Whether goods can still be booked against a PO. */
export function isReceivable(status: string): boolean {
  return status === 'submitted' || status === 'partial';
}

/**
 * A stored calendar DAY, printed as the day it actually is — "20 July 2026".
 *
 * `timeZone: 'UTC'`, deliberately. A day-valued field is stored at UTC midnight
 * (`pickedDayUtc`), and handing UTC midnight to `toLocaleDateString` renders it
 * on the READER's clock, which is the previous day for everyone west of
 * Greenwich. MEASURED 2026-09-18 in Los Angeles: a buyer typed September 10 into
 * "When it is expected", pressed Record it, got "New date recorded", and the
 * order above read "September 9, 2026". `finance/format.ts` has carried this
 * exact line and this exact reasoning for months; Buying never got it.
 *
 * For a real INSTANT — when a delivery was booked in, when an order was placed —
 * use `formatMoment`. That is the reader's own clock and should be: a delivery
 * booked in at half past four on Tuesday happened on Tuesday, for her.
 */
export function formatDay(iso: string | null): string {
  if (!iso) return 'Not set';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** An INSTANT, printed as the day it happened on the reader's own clock. The
 *  twin of `formatDay`, which is for days. Keeping them apart is the whole
 *  point: one of these two is wrong for every field, and which one is wrong
 *  depends on what the column holds, never on how it looks. */
export function formatMoment(iso: string | null): string {
  if (!iso) return 'Not set';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
