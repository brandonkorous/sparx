// Finance display helpers — money, dates, and the plain-language names for the
import { productCopy } from '../../lib/product';
// technical codes the API returns.
//
// Users own a business, not a payment stack: a row must say "Card" and "Your
// website", never "stripe" and "storefront". Every label here is written for
// someone who has never heard the underlying term, per the platform's
// non-technical-audience rule.

export function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

/** The spend half of Finance speaks CENTS on the wire (docs/148) — money crosses
 *  the API as integers so a rounding error cannot reach a ledger. The money-in
 *  routes predate that and send major units, hence two formatters rather than one
 *  that guesses which it was handed. */
export function formatCents(cents: number, currency = 'USD'): string {
  return formatMoney(cents / 100, currency);
}

/** Signed, for anywhere a negative is the point rather than an error: a loss, a
 *  vendor credit, a period-over-period fall. `-$40.00`, never `$-40.00`. */
export function formatCentsSigned(cents: number, currency = 'USD'): string {
  const formatted = formatCents(Math.abs(cents), currency);
  return cents < 0 ? `−${formatted}` : formatted;
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

/**
 * An INSTANT rendered as a date — a moment that happened at a clock time, shown
 * in the reader's zone. Correct for `createdAt`, an order's `placedAt`, a Stripe
 * timestamp. Wrong for a calendar day: use `formatDay`.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/**
 * A CALENDAR DAY, rendered as the day it actually is.
 *
 * Finance stores several day-valued fields — `incurredAt` ("the day a cost
 * belongs to"), `dueAt`, `nextRunOn`, `endsOn`, and the period range bounds — as
 * UTC midnight. Some sit in `@db.Date` columns; `incurredAt` is a `Timestamptz`
 * that nevertheless only ever carries a day (`period.ts` filters it as one, and
 * the labour deriver writes it straight from a `@db.Date` `workedOn`).
 *
 * Handing UTC midnight to `toLocaleDateString` renders it in the reader's zone,
 * which is the PREVIOUS DAY for everyone west of Greenwich. A wage cost written
 * for 2026-08-11 displayed as "Aug 10, 2026" for a US reader — the day is data,
 * not a moment, so it must be read back in the zone it was minted in.
 */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
}

/** A calendar day as a day NUMBER, so two days can be compared without a clock
 *  dragging one of them across a midnight. Local Y/M/D for "today" (the reader's
 *  day), UTC Y/M/D for a stored day — the same convention as `period.ts`. */
function dayNumber(value: Date, stored: boolean): number {
  const ms = stored
    ? Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    : Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  return Math.floor(ms / 86_400_000);
}

/**
 * Whole days past a due date — negative when it is still ahead, `null` when
 * nobody set one. Null is NOT zero: "no deadline" and "due today" are different
 * facts, and rendering the first as the second invents a deadline.
 *
 * Lives here rather than in a surface because both the bill BADGE and the
 * aging BUCKETS need it and they must never disagree. Each had its own copy of
 * `(now - dueAt) / 86_400_000`, which counts elapsed milliseconds between a
 * UTC-midnight day and a local instant — so from early evening onward a US
 * reader's bill due TODAY was badged "1 day late" and filed under "1–30 days
 * late" in the same view.
 */
export function daysPastDue(dueAt: string | null | undefined, now = new Date()): number | null {
  if (!dueAt) return null;
  return dayNumber(now, false) - dayNumber(new Date(dueAt), true);
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
  sparx_market: productCopy('finance.channel.sparxMarket', 'sparx Market'),
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

/** A payment's state, in plain words + its semantic color. Status is its own
 *  color axis (docs/23), independent of the finance module hue. */
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

/* ── The spend half (docs/148) ─────────────────────────────────────────────── */

/**
 * The three cost slices, and the color each wears everywhere.
 *
 * These three must be told apart AT A GLANCE — a P&L where cost of sale, wages
 * and overhead render the same grey is a failed P&L (docs/148 §5, DESIGN.md
 * RULE #4). Getting three hues that stay distinct in BOTH themes rules most of
 * the semantic palette out: `success` and the finance module hue are both green,
 * `error`/`danger` mean broken, `primary` is the affirmative action, and
 * `secondary`/`accent` collapse into `info` in dark mode. That leaves amber and
 * blue, so the third is borrowed from the module palette — violet, the furthest
 * registered hue from the other two.
 *
 * Defined ONCE here and read through `kindColor` so no surface ever types the
 * borrowed name: if a better registered color appears, this is the only edit.
 */
export type SpendColor = 'warning' | 'info' | 'module-chat';

export type ExpenseKindName = 'cost_of_sale' | 'labor' | 'operating';

export function kindColor(kind: ExpenseKindName): SpendColor {
  switch (kind) {
    case 'cost_of_sale':
      return 'warning';
    case 'labor':
      return 'info';
    default:
      return 'module-chat';
  }
}

/** What each slice is called on screen. Never "COGS", never "opex" — the reader
 *  owns a business, not an accounting qualification. */
export function kindLabel(kind: ExpenseKindName): string {
  switch (kind) {
    case 'cost_of_sale':
      return 'Cost of the work';
    case 'labor':
      return 'Wages';
    default:
      return 'Running costs';
  }
}

/** One line on what belongs in each slice, for the category editor — the whole
 *  profit calculation hinges on an owner filing things in the right one. */
export function kindHelp(kind: ExpenseKindName): string {
  switch (kind) {
    case 'cost_of_sale':
      return 'Costs that only happen because you did the job — parts, materials, a subcontractor. These come off first.';
    case 'labor':
      return 'What you pay people. Wages, contractors on retainer, payroll costs.';
    default:
      return 'The cost of being open whether or not you sell anything — rent, software, insurance, fuel, marketing.';
  }
}

/** A bill's state, in plain words + its semantic color. Two dates decide it, and
 *  conflating them is the classic error: `paidAt` says whether money left, `dueAt`
 *  says whether it is late. A paid bill is never overdue, however old. */
export function billState(
  paidAt: string | null,
  dueAt: string | null,
  now = new Date()
): { label: string; tone: Tone } {
  if (paidAt) return { label: 'Paid', tone: 'success' };
  if (!dueAt) return { label: 'Unpaid', tone: 'warning' };

  const days = daysPastDue(dueAt, now) ?? 0;
  if (days > 0) {
    return { label: days === 1 ? '1 day late' : `${String(days)} days late`, tone: 'error' };
  }
  if (days === 0) return { label: 'Due today', tone: 'warning' };
  if (days >= -7) return { label: `Due in ${String(-days)} days`, tone: 'warning' };
  return { label: `Due ${formatDay(dueAt)}`, tone: 'info' };
}

/** How often a recurring cost lands, in plain words. */
export function cadenceLabel(cadence: string): string {
  switch (cadence) {
    case 'weekly':
      return 'Every week';
    case 'biweekly':
      return 'Every two weeks';
    case 'monthly':
      return 'Every month';
    case 'quarterly':
      return 'Every three months';
    case 'annual':
      return 'Once a year';
    default:
      return cadence;
  }
}

/** Where an expense row came from. A derived row is corrected at its source, and
 *  the label has to make that obvious before someone hunts for an edit button. */
export function sourceLabel(source: string): string {
  switch (source) {
    case 'manual':
      return 'Entered by hand';
    case 'recurring':
      return 'From a repeating cost';
    case 'imported':
      return 'Imported';
    case 'purchase_order':
      return 'From a purchase order';
    case 'supplier_bill':
      return 'From a supplier bill';
    default:
      return source.replace(/_/g, ' ');
  }
}

/**
 * A margin rate as a percentage — or an em-dash when there is no rate.
 *
 * `null` means nobody could compute one (no revenue to divide by), and it must
 * never render as "0%": that would rank a job that took £80 of cost and earned
 * nothing alongside one that genuinely broke even.
 */
export function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

/** Period-over-period movement, or null when the previous period was zero and a
 *  percentage would be meaningless (everything is an infinite rise from nothing). */
export function changeRate(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
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
