// Small date + rate helpers shared across the Partner Portal. Money formatting
// reuses the platform `fmtMoneyCents` (overview-bits) so partner earnings read
// identically to every other cents figure in the dashboard — only the partner-
// specific bits (a commission rate, a date range) live here.

export function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A start→end date range on one line, collapsing a same-day range to one date. */
export function fmtDateRange(startIso: string, endIso: string): string {
  const start = fmtDate(startIso);
  const end = fmtDate(endIso);
  if (!start) return end ?? '—';
  if (!end || start === end) return start;
  return `${start} – ${end}`;
}

/** A Prisma-Decimal commission rate ("0.2000") rendered as a percent ("20%"). */
export function fmtRate(rate: string | number | null | undefined): string {
  if (rate == null) return '—';
  const n = typeof rate === 'string' ? Number(rate) : rate;
  if (!Number.isFinite(n)) return '—';
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** A short, human account label for a referred org (we only have its uuid). */
export function shortTenantRef(tenantId: string): string {
  return `Account ${tenantId.slice(0, 8)}`;
}
