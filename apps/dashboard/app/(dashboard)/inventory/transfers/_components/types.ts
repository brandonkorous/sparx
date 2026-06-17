// Shared client types + formatters for the inventory-transfer surface (docs/100 P4).
// Plain TS (no 'use server' / no React), safe to import from both server pages and
// client components. Shapes mirror the @sparx/inventory serializers exposed by
// /v1/inventory/transfers.

export type BadgeColor =
  | 'neutral'
  | 'info'
  | 'warning'
  | 'success'
  | 'danger'
  | 'module'
  | 'primary';

export interface InventoryTransferLineRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantity: number;
  receivedQuantity: number | null;
  shipMovementId: string | null;
  receiveMovementId: string | null;
  note: string | null;
}

export interface InventoryTransferRow {
  id: string;
  number: string;
  fromWarehouseId: string;
  fromWarehouseName: string | null;
  fromWarehouseCode: string | null;
  toWarehouseId: string;
  toWarehouseName: string | null;
  toWarehouseCode: string | null;
  status: 'draft' | 'in_transit' | 'received' | 'cancelled';
  note: string | null;
  lineCount: number;
  totalQuantity: number;
  shippedAt: string | null;
  shippedBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface InventoryTransferDetail extends InventoryTransferRow {
  lines: InventoryTransferLineRow[];
}

const STATUS: Record<string, { color: BadgeColor; label: string }> = {
  draft: { color: 'neutral', label: 'Draft' },
  in_transit: { color: 'info', label: 'In transit' },
  received: { color: 'success', label: 'Received' },
  cancelled: { color: 'danger', label: 'Cancelled' },
};

export function transferStatus(status: string): { color: BadgeColor; label: string } {
  return STATUS[status] ?? { color: 'neutral', label: status };
}

export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** The status that allows editing lines (add/remove/quantity) + deleting. */
export function isDraft(status: string): boolean {
  return status === 'draft';
}

export function warehouseLabel(name: string | null, code: string | null): string {
  return name ?? code ?? '—';
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
