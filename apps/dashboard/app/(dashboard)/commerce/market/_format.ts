// Local cents formatter for the sparx.market surface. Mirrors the per-surface
// `formatMoney(cents, currency)` helpers used across the dashboard (inventory,
// invoicing, channels) — there is no single shared dashboard formatter, so each
// surface keeps its own integer-cents → currency-string helper.

export function formatMoney(cents: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
