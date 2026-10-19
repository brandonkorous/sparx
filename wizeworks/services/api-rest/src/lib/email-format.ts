// The small formatters every email's data shares: money, a quantity, a line's
// name. Kept apart from the data sources so a rule built on them can be tested
// without a database.

/** Decimal-dollar money (orders / quotes / invoices) → `$1,234.50`. */
export function money(amount: unknown): string {
  if (amount == null) return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Decimal | Int quantity → a clean string (drops a trailing `.000`). */
export function qty(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : String(n);
}

/** First non-empty string of the candidates (`''` if none) — a line-item's `name`
 *  falls back to its `description`. */
export function firstText(...vals: (string | null | undefined)[]): string {
  for (const v of vals) if (v) return v;
  return '';
}
