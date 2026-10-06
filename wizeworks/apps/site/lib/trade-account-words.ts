// The words a trade buyer reads on her wholesale account pages, from the codes
// the account, its invoices and its quotes are stored under.
//
// Renée's account page read "buyer · NET30", an invoice read "partial", and a
// quote the shop had not priced yet showed a total of $0.00 (sparx persona
// issue 084). Every code here is the platform's word for a fact; the buyer gets
// the fact.

import type { SilicaColor } from '@wizeworks/silicaui-react';

import { termsDays } from './account-terms-words';
import { orderWaitingSentence, type SignOffView } from './sign-off-words';

/** A contact's role on the account, as a word. Roles are documented on
 *  `B2bAccountContact` (62-b2b-contacts.prisma). */
export function contactRoleWords(role: string): string {
  switch (role) {
    case 'primary_contact':
      return 'Primary contact';
    case 'buyer':
      return 'Buyer';
    case 'approver':
      return 'Approver';
    case 'viewer':
      return 'Viewer';
    default: {
      const spaced = role.replace(/_/g, ' ').trim();
      return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    }
  }
}

/** When the account pays, as a sentence fragment. Terms are `prepay` or
 *  `net<days>` (crm-schemas `common.ts`). Null when there is nothing to say,
 *  so a code the buyer cannot read is never printed. */
export function paymentTermsWords(terms: string | null | undefined): string | null {
  if (!terms) return null;
  if (terms.toLowerCase() === 'prepay') return 'Pay before it ships';
  const days = termsDays(terms);
  if (days === null) return null;
  return `Pay within ${days === 1 ? '1 day' : `${days} days`}`;
}

export function accountStatusWords(status: string): string {
  switch (status) {
    case 'credit_hold':
      return 'Credit hold';
    case 'suspended':
      return 'Suspended';
    case 'inactive':
      return 'Inactive';
    default:
      return 'Active';
  }
}

/** Inactive carries no color: it is a plain fact, not a warning about anything
 *  the buyer can act on. */
export function accountStatusTone(status: string): SilicaColor | undefined {
  switch (status) {
    case 'credit_hold':
      return 'warning';
    case 'suspended':
      return 'danger';
    case 'inactive':
      return undefined;
    default:
      return 'success';
  }
}

/** An invoice's payment state (`BillingDocument.status`) in the buyer's words. */
export function invoiceStatusWords(status: string): string {
  switch (status) {
    case 'unpaid':
      return 'Unpaid';
    case 'partial':
      return 'Partly paid';
    case 'overdue':
      return 'Overdue';
    case 'paid':
      return 'Paid';
    case 'void':
      return 'Canceled';
    default: {
      const spaced = status.replace(/_/g, ' ');
      return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    }
  }
}

export function invoiceStatusTone(status: string): SilicaColor | undefined {
  switch (status) {
    case 'paid':
      return 'success';
    case 'overdue':
      return 'danger';
    case 'unpaid':
    case 'partial':
      return 'warning';
    default:
      return undefined;
  }
}

/** The stage a buyer may accept or decline from. */
export const QUOTE_ACTIONABLE_STAGE = 'Quoted';

export interface QuoteStageInput {
  /** The stage's system name on the `b2b-quotes` workflow. */
  stageName: string;
  /** draft | open | committed | final | paid | void */
  stageType: string;
  totalCents: number;
  /** The site that issued the quote, or null when it is not known. */
  shopName: string | null;
  /** Whether this buyer's role may accept, decline and request quotes. */
  canWrite: boolean;
  /** Already formatted for reading, or null. */
  validUntil: string | null;
  /** The order an accepted quote became, or null when there is none yet. */
  order?: { orderNumber: string; status: string; signOff?: SignOffView | null } | null;
}

export interface QuoteStageView {
  label: string;
  tone: SilicaColor;
  /** One or two short sentences telling the buyer where the quote stands. */
  note: string;
  /** Whether the shop has set the prices, so they may be shown. Before that,
   *  a line typed by the buyer carries a $0.00 placeholder and a catalog line
   *  carries the list price, and neither is what the shop will charge. */
  priced: boolean;
}

/** Where a quote stands, in the buyer's words. Stage names are the system
 *  workflow's (crm-schemas `builtins/invoicing.ts`, `B2B_QUOTE_WORKFLOW`). */
export function quoteStageView(input: QuoteStageInput): QuoteStageView {
  // A blank name falls back as surely as a missing one.
  const named = input.shopName?.trim() ?? '';
  const shop = named.length > 0 ? named : 'The shop';
  switch (input.stageName) {
    case 'Draft':
      return {
        label: 'Being prepared',
        tone: 'info',
        note: `${shop} is still working on this quote.`,
        priced: false,
      };
    case 'Submitted':
      return {
        label: 'Requested',
        tone: 'info',
        note: `${shop} has your request and has not priced it yet. Prices show here when they are ready.`,
        priced: false,
      };
    case 'Under Review':
      return {
        label: 'Being priced',
        tone: 'info',
        note: `${shop} is pricing this request. Prices show here when they are ready.`,
        priced: false,
      };
    case QUOTE_ACTIONABLE_STAGE:
      return {
        label: 'Priced',
        tone: 'primary',
        note: input.canWrite
          ? `${shop} has priced this quote. Accept it to go ahead, or decline it.`
          : `${shop} has priced this quote. A buyer or the primary contact on your account can accept or decline it.`,
        priced: true,
      };
    case 'Accepted':
      // Accepting places the order (sparx persona issue 085), so the quote says
      // which order it became, and when it is held, who it is waiting on: a
      // spending limit may be signed off by someone at the buyer's own account
      // rather than the shop, or by both (sparx persona issue 087). Without a
      // sign-off it says only that it is waiting, never a guess at whose yes.
      // With no order yet, the shop has been told to make one.
      return {
        label: 'Accepted',
        tone: 'success',
        note: !input.order
          ? `You accepted this quote. ${shop} will turn it into an order.`
          : input.order.status === 'pending_approval'
            ? `You accepted this quote. ${orderWaitingSentence(input.order.orderNumber, input.order.signOff, named.length > 0 ? named : null)}`
            : `You accepted this quote. It is now order ${input.order.orderNumber}.`,
        priced: true,
      };
    case 'Declined':
      return {
        label: 'Declined',
        tone: 'danger',
        note: 'This quote was declined.',
        priced: input.totalCents > 0,
      };
    case 'Expired':
      return {
        label: 'Expired',
        tone: 'warning',
        note:
          (input.validUntil
            ? `This quote expired on ${input.validUntil}.`
            : 'This quote has expired.') +
          (input.canWrite ? ' Request a new one if you still need these items.' : ''),
        priced: input.totalCents > 0,
      };
    default: {
      // A stage this page does not know by name: read its type.
      if (input.stageType === 'committed' || input.stageType === 'paid') {
        return { label: input.stageName, tone: 'success', note: '', priced: true };
      }
      if (input.stageType === 'void') {
        return {
          label: input.stageName,
          tone: 'danger',
          note: '',
          priced: input.totalCents > 0,
        };
      }
      return {
        label: input.stageName,
        tone: 'info',
        note: `${shop} is still working on this quote.`,
        priced: false,
      };
    }
  }
}

/** A quantity as a person writes it: 2, 2.5, never 2.000. */
export function quantityWords(quantity: number): string {
  return quantity.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

export interface QuoteTotalsInput {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  surchargeCents: number;
  coreDepositCents: number;
  totalCents: number;
}

export interface QuoteSummaryRow {
  label: string;
  /** Signed: a discount is negative, so the rows sum to the total. */
  cents: number;
  total?: boolean;
}

/**
 * How a priced quote's total is made up, in the order the printed quote lists
 * it. Zero rows are left out, except the subtotal and the total.
 *
 * Renée's Q-000002 read $4,075.60 over lines that added to $3,175.60: the
 * missing $900.00 was six refundable core deposits, which sit in the total and
 * in no line's amount. The rows here always add up to the total.
 */
export function quoteSummaryRows(t: QuoteTotalsInput): QuoteSummaryRow[] {
  const rows: QuoteSummaryRow[] = [{ label: 'Subtotal', cents: t.subtotalCents }];
  if (t.discountCents > 0) rows.push({ label: 'Discount', cents: -t.discountCents });
  if (t.taxCents > 0) rows.push({ label: 'Tax', cents: t.taxCents });
  if (t.shippingCents > 0) rows.push({ label: 'Shipping', cents: t.shippingCents });
  if (t.surchargeCents > 0) rows.push({ label: 'Surcharge', cents: t.surchargeCents });
  if (t.coreDepositCents > 0) {
    rows.push({ label: 'Refundable core deposits', cents: t.coreDepositCents });
  }
  rows.push({ label: 'Total', cents: t.totalCents, total: true });
  return rows;
}

/** The sentence under a rebuilt part's line, from its per-unit deposit. */
export function coreDepositSentence(perUnit: string, quantity: number): string {
  return quantity === 1
    ? `Plus a ${perUnit} refundable core deposit, paid back when the old part is returned.`
    : `Plus a ${perUnit} refundable core deposit on each, paid back when the old parts are returned.`;
}

interface QuoteLineMoney {
  unitPriceCents: number | null;
  lineSubtotalCents: number | null;
  lineTotalCents: number | null;
}

/**
 * A quote's figures, or null when the shop has not sent them. The portal sends
 * none before the offer is made: a request the buyer sent starts at their
 * account's price, and those are the shop's working figures until it prices and
 * sends the quote (sparx persona issue 086). All of them or none, so the page
 * can never print a total over lines it was not told the prices of.
 */
export function pricedQuote<T extends object, L extends QuoteLineMoney>(quote: {
  totalCents: number | null;
  totals: T | null;
  lines: L[];
}): {
  totalCents: number;
  totals: T;
  lines: (L & { unitPriceCents: number; lineSubtotalCents: number; lineTotalCents: number })[];
} | null {
  const { totalCents, totals } = quote;
  if (totalCents === null || totals === null) return null;
  const lines: (L & {
    unitPriceCents: number;
    lineSubtotalCents: number;
    lineTotalCents: number;
  })[] = [];
  for (const l of quote.lines) {
    if (l.unitPriceCents === null || l.lineSubtotalCents === null || l.lineTotalCents === null) {
      return null;
    }
    lines.push({
      ...l,
      unitPriceCents: l.unitPriceCents,
      lineSubtotalCents: l.lineSubtotalCents,
      lineTotalCents: l.lineTotalCents,
    });
  }
  return { totalCents, totals, lines };
}
