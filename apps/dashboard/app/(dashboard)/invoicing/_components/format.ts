// Shared display helpers for the invoicing dashboard surface.

/** AR status → Badge color (the four-axis semantic palette). Payment-derived
 *  status, independent of the workflow stage (docs/87 §8). */
export const AR_STATUS_VARIANT: Record<
  string,
  'neutral' | 'warning' | 'success' | 'danger' | 'info'
> = {
  unpaid: 'neutral',
  partial: 'warning',
  paid: 'success',
  overdue: 'danger',
  void: 'neutral',
};

/** `USD 1,234.56` — currency code + grouped 2-dp figure (the dashboard money idiom). */
export function formatMoney(value: string | number, currency: string): string {
  const n = Number(value);
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** A fractional-friendly quantity: whole counts render without decimals. */
export function formatQuantity(value: string | number): string {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}
