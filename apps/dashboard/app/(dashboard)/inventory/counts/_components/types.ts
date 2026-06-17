// Shared client types + formatters for the inventory-count surface (docs/100 P4).
// Plain TS (no 'use server' / no React), safe to import from both server pages and
// client components. Shapes mirror the @sparx/inventory serializers exposed by
// /v1/inventory/counts.

export type BadgeColor =
  | 'neutral'
  | 'info'
  | 'warning'
  | 'success'
  | 'danger'
  | 'module'
  | 'primary';

export interface InventoryCountLineRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  expectedQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  unitCostCents: number | null;
  appliedDelta: number | null;
  movementId: string | null;
  note: string | null;
}

export interface InventoryCountRow {
  id: string;
  number: string;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  type: 'cycle' | 'full';
  status: 'counting' | 'review' | 'approved' | 'posted' | 'cancelled';
  note: string | null;
  approvalThresholdCents: number;
  requiresApproval: boolean;
  varianceValueCents: number;
  lineCount: number;
  countedLineCount: number;
  startedAt: string;
  countedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  postedAt: string | null;
  createdAt: string;
}

export interface InventoryCountDetail extends InventoryCountRow {
  lines: InventoryCountLineRow[];
}

const STATUS: Record<string, { color: BadgeColor; label: string }> = {
  counting: { color: 'info', label: 'Counting' },
  review: { color: 'warning', label: 'In review' },
  approved: { color: 'primary', label: 'Approved' },
  posted: { color: 'success', label: 'Posted' },
  cancelled: { color: 'danger', label: 'Cancelled' },
};

export function countStatus(status: string): { color: BadgeColor; label: string } {
  return STATUS[status] ?? { color: 'neutral', label: status };
}

export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'counting', label: 'Counting' },
  { value: 'review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'posted', label: 'Posted' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function countTypeLabel(type: string): string {
  return type === 'full' ? 'Full count' : 'Cycle count';
}

/** The status that allows editing lines + entering counts. */
export function isCounting(status: string): boolean {
  return status === 'counting';
}

export function formatMoney(cents: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** Signed unit delta, e.g. +3 / −2 / 0. */
export function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
