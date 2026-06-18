// Shared client types + formatters for the lots / serials surface (docs/100 P4d).
// Plain TS (no 'use server' / no React), safe to import from both server pages and
// client components. Shapes mirror the @sparx/inventory serializers exposed by
// /v1/inventory/lots + /v1/inventory/serials.

export type BadgeColor =
  | 'neutral'
  | 'info'
  | 'warning'
  | 'success'
  | 'danger'
  | 'module'
  | 'primary';

export interface LotRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  lotNumber: string;
  manufacturedAt: string | null;
  expiresAt: string | null;
  quantity: number;
  hazmatClass: string;
  recallStatus: string | null;
  recallReason: string | null;
  recalledAt: string | null;
  supplierBatchRef: string | null;
  serialCount: number;
  createdAt: string;
}

export interface LotDetail extends LotRow {
  serialCounts: { status: string; count: number }[];
}

export interface SerialRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  lotBatchId: string | null;
  lotNumber: string | null;
  serial: string;
  status: string;
  soldOnOrderItemId: string | null;
  soldAt: string | null;
  createdAt: string;
}

// ─── Serial status ───────────────────────────────────────────────────────────

export const SERIAL_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'sold', label: 'Sold' },
  { value: 'returned', label: 'Returned' },
  { value: 'scrapped', label: 'Scrapped' },
  { value: 'lost', label: 'Lost' },
];

const SERIAL_STATUS_COLOR: Record<string, BadgeColor> = {
  in_stock: 'success',
  reserved: 'info',
  sold: 'neutral',
  returned: 'warning',
  scrapped: 'danger',
  lost: 'danger',
};

export function serialStatusLabel(status: string): string {
  return SERIAL_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function serialStatusColor(status: string): BadgeColor {
  return SERIAL_STATUS_COLOR[status] ?? 'neutral';
}

// ─── Recall + hazmat ─────────────────────────────────────────────────────────

export function recallBadge(
  recallStatus: string | null
): { color: BadgeColor; label: string } | null {
  if (!recallStatus) return null;
  if (recallStatus === 'active') return { color: 'danger', label: 'Recalled' };
  if (recallStatus === 'pending') return { color: 'warning', label: 'Recall pending' };
  if (recallStatus === 'cleared') return { color: 'neutral', label: 'Recall cleared' };
  return { color: 'neutral', label: recallStatus };
}

export const HAZMAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'class_1_explosive', label: 'Class 1 — Explosive' },
  { value: 'class_2_gas', label: 'Class 2 — Gas' },
  { value: 'class_3_flammable_liquid', label: 'Class 3 — Flammable liquid' },
  { value: 'class_4_flammable_solid', label: 'Class 4 — Flammable solid' },
  { value: 'class_5_oxidizer', label: 'Class 5 — Oxidizer' },
  { value: 'class_6_toxic', label: 'Class 6 — Toxic' },
  { value: 'class_7_radioactive', label: 'Class 7 — Radioactive' },
  { value: 'class_8_corrosive', label: 'Class 8 — Corrosive' },
  { value: 'class_9_misc', label: 'Class 9 — Misc' },
];

export function hazmatLabel(hazmatClass: string): string {
  return HAZMAT_OPTIONS.find((o) => o.value === hazmatClass)?.label ?? hazmatClass;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export const RECALL_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Any recall state' },
  { value: 'active', label: 'Recalled' },
  { value: 'pending', label: 'Recall pending' },
  { value: 'cleared', label: 'Recall cleared' },
];

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Days until expiry (negative = already expired); null when no expiry. */
export function daysUntil(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - nowMs) / (24 * 60 * 60 * 1000));
}
