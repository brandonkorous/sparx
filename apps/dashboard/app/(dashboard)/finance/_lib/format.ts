// Money + date formatting shared across the Finance hub. Two money helpers because
// the backends disagree on units (a fact, not a preference): commerce/market/billing
// speak cents; the AR aging report speaks dollars (it mirrors Decimal money columns).
// Keeping both explicit avoids a /100 slipping into the wrong source.

export function fmtCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function fmtDollars(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

export function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
