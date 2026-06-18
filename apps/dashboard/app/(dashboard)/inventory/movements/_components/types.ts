// Shared client types + formatters for the movement / audit-log viewer (docs/100
// P4, docs/99 D5). Plain TS (no 'use server' / no React), safe to import from both
// server pages and client components. Shapes mirror the @sparx/inventory
// `MovementRow` serializer exposed by /v1/inventory/movements.

export type BadgeColor =
  | 'neutral'
  | 'info'
  | 'warning'
  | 'success'
  | 'danger'
  | 'module'
  | 'primary';

export interface MovementRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  delta: number;
  balanceAfter: number | null;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  actorType: string;
  actorId: string | null;
  source: string | null;
  note: string | null;
  unitCostCents: number | null;
  createdAt: string;
}

// The ledger's reason vocabulary (mirrors the InventoryAdjustReason enum). First
// entry is the "all" sentinel for the filter select.
export const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All reasons' },
  { value: 'sale', label: 'Sale' },
  { value: 'return', label: 'Return' },
  { value: 'cancel', label: 'Cancel (restock)' },
  { value: 'recount', label: 'Recount' },
  { value: 'loss', label: 'Loss' },
  { value: 'damage', label: 'Damage' },
  { value: 'transfer_in', label: 'Transfer in' },
  { value: 'transfer_out', label: 'Transfer out' },
  { value: 'receive', label: 'Receive' },
  { value: 'reserve', label: 'Reserve' },
  { value: 'release', label: 'Release' },
  { value: 'manual', label: 'Manual' },
  { value: 'sync', label: 'Sync' },
];

export const ACTOR_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All actors' },
  { value: 'user', label: 'User' },
  { value: 'ai', label: 'AI' },
  { value: 'system', label: 'System' },
  { value: 'integration', label: 'Integration' },
];

const REASON_COLOR: Record<string, BadgeColor> = {
  receive: 'success',
  return: 'success',
  transfer_in: 'success',
  cancel: 'success',
  sale: 'info',
  reserve: 'info',
  release: 'info',
  sync: 'info',
  recount: 'warning',
  transfer_out: 'warning',
  manual: 'warning',
  loss: 'danger',
  damage: 'danger',
};

export function reasonLabel(reason: string): string {
  const opt = REASON_OPTIONS.find((o) => o.value === reason);
  if (opt) return opt.label;
  return reason.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function reasonColor(reason: string): BadgeColor {
  return REASON_COLOR[reason] ?? 'neutral';
}

export function actorLabel(actorType: string): string {
  if (actorType === 'ai') return 'AI';
  return actorType.replace(/^\w/, (c) => c.toUpperCase());
}

/** Signed unit delta, e.g. +3 / −2 / 0. */
export function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

export function formatMoney(cents: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
