// Finance display helpers — money, dates, and the plain-language names for the
// technical codes the API returns.
//
// Users own a business, not a payment stack: a row must say "Card" and "Your
// website", never "stripe" and "storefront". Every label here is written for
// someone who has never heard the underlying term, per the platform's
// non-technical-audience rule.

export function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

/** Compact above five figures, exact below — a $545.30 total rendered "$545.3"
 *  reads as a typo, but past $10k the cents stop being the point and width does. */
export function formatMoneyCompact(amount: number, currency = 'USD'): string {
  if (Math.abs(amount) >= 10_000) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return formatMoney(amount, currency);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** A short "how long ago" for a payments feed, where the exact clock time rarely
 *  matters but "today vs 3 weeks ago" always does. */
export function formatRelativeDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${String(days)} days ago`;
  return formatDate(iso);
}

type MarketplaceLabels = Record<string, string>;
const MARKETPLACE: MarketplaceLabels = {
  etsy: 'Etsy',
  amazon: 'Amazon',
  ebay: 'eBay',
  walmart: 'Walmart',
  tiktok_shop: 'TikTok Shop',
  faire: 'Faire',
  meta: 'Facebook & Instagram',
  google_shopping: 'Google Shopping',
  pinterest: 'Pinterest',
  sparx_market: 'sparx Market',
};

/** Where a sale happened, in plain words. A marketplace keeps its own name;
 *  everything else describes the place a business owner would recognise. */
export function channelLabel(channel: string | null, source: string | null): string {
  if (channel === 'marketplace') {
    if (source && MARKETPLACE[source]) return MARKETPLACE[source];
    if (source) return source.replace(/_/g, ' ');
    return 'Marketplace';
  }
  switch (channel) {
    case 'storefront':
      return 'Your website';
    case 'b2b_portal':
      return 'Wholesale portal';
    case 'admin':
      return 'In person or by phone';
    case 'import':
      return 'Imported';
    case 'mcp':
      return 'AI assistant';
    case 'pos':
      return 'In person';
    default:
      return channel ? channel.replace(/_/g, ' ') : 'Other';
  }
}

/** How the money was taken, in plain words. */
export function methodLabel(processor: string | null): string {
  switch (processor) {
    case 'stripe':
    case 'sparx_pay':
      return 'Card';
    case 'square':
      return 'Card (Square)';
    case 'paypal':
      return 'PayPal';
    case 'check':
      return 'Check';
    case 'wire':
      return 'Bank transfer';
    case 'cash':
      return 'Cash';
    case 'net_terms':
      return 'On account';
    case 'manual':
      return 'Recorded by hand';
    default:
      return processor ? processor.replace(/_/g, ' ') : 'Other';
  }
}

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** A payment's state, in plain words + its semantic colour. Status is its own
 *  colour axis (docs/23), independent of the finance module hue. */
export function paymentState(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'captured':
      return { label: 'Paid', tone: 'success' };
    case 'authorized':
      return { label: 'Held', tone: 'info' };
    case 'pending':
      return { label: 'Pending', tone: 'warning' };
    case 'failed':
      return { label: 'Failed', tone: 'error' };
    case 'voided':
      return { label: 'Cancelled', tone: 'neutral' };
    case 'refunded':
      return { label: 'Refunded', tone: 'warning' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** A payout's state — has it reached the bank yet? The derived model only ever emits
 *  `paid` / `in_transit`; real Stripe (sparx Pay) payouts add `pending`, `canceled`, and
 *  `failed`, which must read honestly (a failed deposit is NOT "on its way"). */
export function payoutState(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'paid':
      return { label: 'In your bank', tone: 'success' };
    case 'failed':
      return { label: 'Failed', tone: 'error' };
    case 'canceled':
      return { label: 'Canceled', tone: 'warning' };
    case 'pending':
      return { label: 'Queued', tone: 'info' };
    case 'in_transit':
    default:
      return { label: 'On its way', tone: 'info' };
  }
}
