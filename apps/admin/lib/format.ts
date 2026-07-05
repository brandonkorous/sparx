// Presentation formatters for the operator console. Money/date formatting
// mirrors the dashboard's own (representation parity, D7) so an operator reads a
// tenant's numbers exactly as the tenant does; bytes is the storage-footprint
// formatter for the tenant detail.

/** Cents → `$1,234` / `$12.50` (mirrors the dashboard's `money`). */
export function formatMoneyCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Bytes → a human string (`0 B`, `4.2 MB`, `1.1 GB`). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const exponent = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const unit = BYTE_UNITS[exponent] ?? 'B';
  const value = bytes / 1024 ** exponent;
  return `${value.toLocaleString('en-US', { maximumFractionDigits: exponent === 0 ? 0 : 1 })} ${unit}`;
}

/** ISO → `Jul 5, 2026`, or null passthrough. */
export function formatDate(iso: string | null): string | null {
  return iso
    ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;
}

/** ISO → `Jul 5, 2026, 3:04 PM`, or null passthrough. */
export function formatDateTime(iso: string | null): string | null {
  return iso
    ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : null;
}
