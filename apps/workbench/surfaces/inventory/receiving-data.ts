'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE BUYING REFERENCE DATA — RECEIVING (GOODS RECEIPTS)
//
// Receiving is the last link in the chain: a delivery turns up against a placed
// purchase order, and you book in what actually arrived. That is the moment the
// stock numbers move — every received line writes an "arrived from a supplier"
// movement and bumps the item's on-hand — so posting a receipt has to refresh
// the Stock surfaces AND the PO it advanced, not just its own list.
//
// A receipt is booked into the location the PO already names; the server takes
// the warehouse from the order, so this surface SHOWS where goods land rather
// than asking. A receipt is immutable once posted — a mistake is corrected later
// by a count, never by editing history — so there is no draft and no edit here,
// only a list, a read, and the one POST that books a delivery.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import { stockKeys, type Tone } from './data';
import { purchaseOrderKeys } from './purchase-orders-data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One booked-in line — an item and how many of it arrived on this delivery. */
export interface GoodsReceiptLine {
  id: string;
  purchaseOrderLineId: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantityReceived: number;
  unitCostCents: number;
  lotNumber: string | null;
  movementId: string | null;
}

export interface GoodsReceipt {
  id: string;
  /** The human reference — GR-000123. Allocated by the server. */
  number: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  /** The packing slip or carrier reference off the delivery. */
  reference: string | null;
  note: string | null;
  receivedAt: string;
  createdAt: string;
  lineCount: number;
  quantityReceived: number;
}

export interface GoodsReceiptDetail extends GoodsReceipt {
  lines: GoodsReceiptLine[];
}

export interface ReceiptListQuery {
  q?: string;
  purchaseOrderId?: string;
  take: number;
  skip: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const receiptKeys = {
  all: ['inventory', 'receipts'] as const,
  list: (query: ReceiptListQuery) => [...receiptKeys.all, 'list', query] as const,
  detail: (id: string) => [...receiptKeys.all, 'detail', id] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useReceipts(query: ReceiptListQuery) {
  return useQuery({
    queryKey: receiptKeys.list(query),
    queryFn: () =>
      api.list<GoodsReceipt>('/v1/inventory/receipts', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.purchaseOrderId ? { purchase_order_id: query.purchaseOrderId } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useReceipt(id: string) {
  return useQuery({
    queryKey: receiptKeys.detail(id),
    queryFn: () => api.get<GoodsReceiptDetail>(`/v1/inventory/receipts/${id}`),
    enabled: id !== 'new',
  });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/** One line as the booking form sends it: which PO line, and how many good units
 *  arrived (the count that becomes stock). `quantityDamaged` reports units that
 *  turned up broken — recorded in the stock ledger (received, then written off)
 *  but never added to sellable stock and never counted against the order. An
 *  optional `lotNumber` marks the good units as a traceable batch — when present,
 *  receiving mints or extends that lot so the stock can later be traced (an
 *  expiry, a recall). Both are left off for ordinary lines. */
export interface ReceiveLineInput {
  purchaseOrderLineId: string;
  quantity: number;
  quantityDamaged?: number;
  lotNumber?: string;
}

export interface CreateReceiptInput {
  purchaseOrderId: string;
  receivedAt?: string;
  reference?: string;
  note?: string;
  lines: ReceiveLineInput[];
}

/**
 * Book a delivery.
 *
 * On success this reaches THREE caches: its own list, the PO it advanced (a
 * placed order may now read "partly received"), and the whole Stock cluster —
 * because the counts this just moved are the same numbers the Stock list and
 * every product's Stock panel show. A booked delivery sitting beside a stale
 * on-hand figure is exactly the confusion this invalidation prevents.
 */
export function useCreateReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReceiptInput) =>
      api.post<GoodsReceiptDetail>('/v1/inventory/receipts', input),
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      void queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      void queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(receipt.purchaseOrderId),
      });
      // The point of receiving: the stock numbers just moved.
      void queryClient.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}

/* ── Comparing what arrived against what was ordered ────────────────────── */

export interface ReceiptLineState {
  label: string;
  tone: Tone;
}

/**
 * How a received quantity compares to what was still outstanding on the line, in
 * plain words. `outstanding` is ordered minus already received — what this
 * delivery could reasonably complete. `damaged` (default 0) is only needed to
 * name the total-loss case: a line with 0 good units but some damaged ones is a
 * fully-damaged arrival — nothing joins stock and the order stays open for it.
 */
export function receiptLineState(
  received: number,
  outstanding: number,
  damaged = 0
): ReceiptLineState {
  if (received <= 0 && damaged > 0) {
    return { label: 'All damaged — nothing added to stock', tone: 'danger' };
  }
  if (received <= 0) return { label: 'Not receiving now', tone: 'neutral' };
  if (received === outstanding) return { label: 'Completes this line', tone: 'success' };
  if (received < outstanding) {
    return { label: `${String(outstanding - received)} short`, tone: 'warning' };
  }
  return { label: `${String(received - outstanding)} more than expected`, tone: 'info' };
}
