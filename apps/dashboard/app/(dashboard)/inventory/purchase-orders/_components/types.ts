// Shared client types + formatters for the purchase-order surface (docs/100
// P3b). Plain TS (no 'use server' / no React), safe to import from both server
// pages and client components. Shapes mirror the @sparx/inventory serializers
// exposed by /v1/inventory/purchase-orders.

export type BadgeColor =
  | 'neutral'
  | 'info'
  | 'warning'
  | 'success'
  | 'danger'
  | 'module'
  | 'primary';

export interface PurchaseOrderLineRow {
  id: string;
  variantId: string;
  description: string | null;
  supplierSku: string | null;
  variantSku: string | null;
  productTitle: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitCostCents: number;
  lineTotalCents: number;
}

export interface PurchaseOrderRow {
  id: string;
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
  reference: string | null;
  orderedAt: string | null;
  expectedArrivalAt: string | null;
  receivedAt: string | null;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  lineCount: number;
  quantityOrdered: number;
  quantityReceived: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderDetail extends PurchaseOrderRow {
  lines: PurchaseOrderLineRow[];
}

const STATUS: Record<string, { color: BadgeColor; label: string }> = {
  draft: { color: 'neutral', label: 'Draft' },
  submitted: { color: 'info', label: 'Submitted' },
  partial: { color: 'warning', label: 'Partially received' },
  received: { color: 'success', label: 'Received' },
  closed: { color: 'neutral', label: 'Closed' },
  cancelled: { color: 'danger', label: 'Cancelled' },
};

export function purchaseOrderStatus(status: string): { color: BadgeColor; label: string } {
  return STATUS[status] ?? { color: 'neutral', label: status };
}

/** The status values that allow editing the draft header + lines. */
export function isDraft(status: string): boolean {
  return status === 'draft';
}

export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
