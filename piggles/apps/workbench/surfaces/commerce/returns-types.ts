'use client';

// The shapes a return is read in.
//
// The list and the detail pane read these SAME types, so a field one renders is
// always a field the other fetched. Split from the hooks that fetch them
// because a type has no dependencies and a query has several — nothing here
// imports a client, so anything may import this.
//
// Money arrives as integer CENTS on a return (refunded amount, restocking fee),
// NOT the Decimal-as-string that orders use.

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
  // Settled by sending a replacement. Its own end rather than a $0.00 refund,
  // so "how much did we give back" stays answerable (issue 220).
  | 'exchanged'
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
