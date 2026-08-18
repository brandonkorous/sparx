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

/** ISO → a compact relative age (`just now`, `5m`, `3h`, `2d`, `4w`), falling back
 *  to an absolute date past ~30 days. For scannable list "age" columns. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks}w`;
  return formatDate(iso) ?? '';
}
