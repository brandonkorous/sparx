// Shapes returned by /v1/invoicing/documents. Hand-written rather than pulled
// from @wizeworks/api-client's generated openapi.d.ts because the invoicing routes
// aren't in the published spec yet — swap these for the generated types once
// they are, and the surfaces below won't change.

import { daysPastDue } from '../../lib/console/days';
import { invoiceState, type InvoiceStatus, type InvoiceTone } from '../../lib/invoice-status';
import { formatAmount } from '../../lib/money-format';

export type ArStatus = InvoiceStatus;

export interface BillingParty {
  name?: string;
  email?: string;
  address?: string;
}

/** The server's frozen record of how a markup/pass-through line was priced. */
export interface LineMarkupSnapshotWire {
  ruleId: string | null;
  ruleName: string | null;
  method: string;
  value: number | null;
  marginPct: number;
  markupPct: number;
  costBasisValueCents: number;
}

export interface BillingDocumentLine {
  id?: string;
  lineTypeId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  /** An absolute money reduction on this line, before document-level tax. */
  discountAmount?: number;
  taxable?: boolean;
  productId?: string | null;
  variantId?: string | null;
  /** Cost basis the server resolved, in cents. */
  costCents?: number | null;
  /** Present on a line priced by cost + markup. */
  appliedMarkup?: LineMarkupSnapshotWire | null;
  /** Refundable core deposit per unit on a rebuilt part (sparx issue 051). */
  coreCharge?: number | string | null;
  /** The line's free-form bag. Carries `priceNote`, the words saying where a
   *  trade price came from (issue 077); read it through `priceNoteOf`. */
  metadata?: Record<string, unknown> | null;
}

/**
 * A stage in a document workflow (docs/87 §3). `stageType` is the semantic
 * role system logic keys off; `customerLabel` is the tenant's own wording for
 * it, which is what operators see everywhere in the UI.
 */
export type DocumentStageType = 'draft' | 'open' | 'committed' | 'final' | 'paid' | 'void';

export interface DocumentStage {
  id: string;
  name: string;
  customerLabel: string;
  stageType: DocumentStageType;
  /** Entry effects — what happens to the document when it ENTERS this stage. */
  snapshotOnEnter: boolean;
  numberOnEnter: boolean;
  /** Prefix for the number minted on entry ('INV-'). Only meaningful with
   *  `numberOnEnter`; null lets the server fall back to its own default. */
  numberPrefix: string | null;
  locksEditing: boolean;
  sortOrder: number;
}

/**
 * One workflow with its stages, as /v1/invoicing/workflows returns it.
 *
 * This is the WHOLE row, not the subset a document needs, because the workflows
 * surfaces configure it — and a second, narrower copy of this type is how a
 * screen ends up saving a field it never fetched. Consumers that only care
 * about the stage chain (lifecycle.tsx) simply read less of it.
 */
export interface DocumentWorkflowDetail {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  sortOrder: number;
  archivedAt: string | null;
  stages: DocumentStage[];
}

/**
 * A frozen record captured when the document entered a `snapshotOnEnter` stage.
 * Stage label + number are copied at capture time, so a later stage rename or
 * renumber never rewrites what a record claims about the past. The list route
 * also returns the full frozen substance; the UI only needs the header fields —
 * the substance is what `…/snapshots/:id/pdf` renders.
 */
export interface DocumentSnapshot {
  id: string;
  stageType: DocumentStage['stageType'];
  customerLabel: string;
  documentNumber: string | null;
  createdAt: string;
}

/** Semantic tone for a stage — status is its own color axis (docs/23). */
export function stageTone(
  type: DocumentStage['stageType']
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (type) {
    case 'paid':
      return 'success';
    case 'final':
      return 'warning'; // billable + awaiting money — the same axis as `unpaid`
    case 'committed':
      return 'info';
    case 'open':
      return 'info';
    case 'void':
      return 'danger';
    default:
      return 'neutral'; // draft — nothing binding yet
  }
}

export interface BillingDocument {
  id: string;
  /** Null until the document reaches a numbering stage. */
  number: string | null;
  currency: string;
  /** The CRM customer being billed. A document must reference this or a B2B
   *  account — see the refine on CreateBillingDocumentInput. */
  customerId: string | null;
  billTo: BillingParty | null;
  shipTo: BillingParty | null;
  /**
   * Who this document bills, resolved SERVER-side for list rows.
   *
   * Present on list responses, absent when fetching one document (the detail
   * view has the full relations). It exists because `billTo` is only written
   * when a document is snapshotted — so reading `billTo.name` alone left the
   * customer column empty for every draft and open document, which is most of
   * a working receivables list.
   */
  billedToName?: string | null;
  /**
   * When the customer was actually emailed this, resolved server-side on LIST
   * rows. Null means the bill is still sitting here.
   *
   * Present on list responses. Read it rather than the metadata bag directly:
   * the send route is the only writer and the server owns the shape.
   */
  sentAt?: string | null;
  /** On a list row: a quote or estimate, a price offered rather than a bill
   *  (sparx persona issue 085). */
  priceOffer?: boolean;
  /** On a list row: where it stands on its workflow, and that stage's type. */
  stageName?: string;
  stageType?: DocumentStage['stageType'];
  /**
   * Where a send would actually go, resolved server-side on the single-document
   * read: the frozen `billTo` address first, else the customer's own.
   *
   * The Send dialog must not resolve this itself. Reading `billTo.email` alone
   * made it announce "there is no email address on this invoice" about an
   * invoice whose customer has one, and then send it anyway on confirm, because
   * the server knew the fallback and the screen did not.
   */
  billedToEmail?: string | null;
  taxRate: number;
  /** The note printed on the document the customer receives — `billing-document-html`
   *  renders it under a "Notes" heading. It was missing from this interface, which
   *  is why the editor seeded its notes box from a hardcoded `''`. */
  notes: string | null;
  subtotal: number;
  taxTotal: number;
  /** Document-level charges carried across from the order: not lines, not taxed,
   *  added last. They were missing from this interface, so the editor's running
   *  total was short by exactly the delivery charge and no screen ever showed
   *  it -- see issue 442. */
  shippingTotal: number;
  surchargeTotal: number;
  /** Money already taken against this document before it was raised. The
   *  printed copy subtracts it from the balance, so a preview that does not
   *  carry it asks the customer for more than the document does. */
  depositTotal: number;
  /** When the document was issued, or null while it is still a draft. The
   *  printed copy dates itself `finalizedAt ?? createdAt`; without it the
   *  preview stamped today on a document raised weeks ago. */
  finalizedAt: string | null;
  total: number;
  balance: number;
  amountPaid: number;
  status: ArStatus;
  /** Net-terms due date. Null for pay-now/retail documents with no terms, and
   *  always null on a quote or an estimate — an offer has no money owing on it,
   *  so it has an expiry instead. */
  dueAt: string | null;
  /** When a price offer stops standing. Null on a bill. The Quotes list reads
   *  this for its "Valid until" column and its Expired badge. */
  validUntil: string | null;
  /**
   * Days past due, computed server-side. The UI never re-derives this — if it
   * did, the list and the AR aging report could disagree about whether the same
   * invoice is late.
   */
  overdueDays: number;
  workflowId: string;
  /** The wholesale account this document bills, or null for none. */
  companyId?: string | null;
  stageId: string;
  /** Everything the document carries that has no column of its own. `sentAt` /
   *  `sentTo` live here: there is no `sent_at` column, and this is where the
   *  send route records that the customer has it. */
  metadata?: Record<string, unknown> | null;
  lines?: BillingDocumentLine[];
  /** Set once an accepted quote has been converted — the FK lives on Order, so
   *  the API looks it up and sends it along with the document. */
  convertedOrder?: { id: string; orderNumber: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * api-rest's `paged(items, meta)` helper returns `{ success, data: items, meta }`
 * — `data` IS the array, and the page counts live in the sibling `meta`.
 *
 * SparxClient unwraps to `payload.data` and replaces `meta` with HTTP response
 * metadata (status/headers/etag), so the envelope's pagination meta is dropped
 * on the floor today. List surfaces therefore read the array and can't show a
 * total yet; wiring real pagination means teaching the client to surface the
 * envelope meta, not working around it here.
 */
export interface PaginationMeta {
  total: number;
  skip: number;
  per_page: number;
}

/**
 * Coerce a document off the wire.
 *
 * Every money column on BillingDocument is a Prisma `Decimal`, and Decimal
 * serializes to JSON as a STRING — `"409.44"`, not `409.44`. The types above
 * say `number` because that is what the rest of the app needs to be true, so
 * this is the one place the lie gets corrected.
 *
 * It matters more than it looks. `"9.00" < "100.00"` is true as a string
 * comparison, so a list sorting raw wire values puts $100 above $9 — money
 * sorted alphabetically, which looks like a sort that simply doesn't work.
 * Anything reading these fields must go through here first.
 */
function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeDocument(raw: BillingDocument): BillingDocument {
  return {
    ...raw,
    taxRate: num(raw.taxRate),
    subtotal: num(raw.subtotal),
    taxTotal: num(raw.taxTotal),
    shippingTotal: num(raw.shippingTotal),
    surchargeTotal: num(raw.surchargeTotal),
    // Prisma sends every Decimal over the wire as a STRING, so a money field
    // left out of this list is typed `number` and holds "30.00" at runtime.
    depositTotal: num(raw.depositTotal),
    total: num(raw.total),
    balance: num(raw.balance),
    amountPaid: num(raw.amountPaid),
    overdueDays: num(raw.overdueDays),
    ...(raw.lines
      ? {
          lines: raw.lines.map((line) => ({
            ...line,
            quantity: num(line.quantity),
            unitPrice: num(line.unitPrice),
            discountAmount: num(line.discountAmount),
          })),
        }
      : {}),
  };
}

export type ArTone = InvoiceTone;
export { invoiceState };

/** The color of a quote's standing. Accepted is the good outcome, a priced
 *  quote is waiting on the customer, a declined or expired one is over. A draft
 *  carries no color: nothing about it is decided yet. */
export function priceOfferTone(
  stageType: string | undefined
): 'success' | 'info' | 'danger' | undefined {
  switch (stageType) {
    case 'committed':
    case 'paid':
      return 'success';
    case 'open':
    case 'final':
      return 'info';
    case 'void':
      return 'danger';
    default:
      return undefined;
  }
}

type DocumentRow = Pick<BillingDocument, 'status' | 'balance'> & {
  priceOffer?: boolean;
  stageName?: string;
  stageType?: string;
};

/**
 * What a row on ANY list of documents says it is doing.
 *
 * A quote or estimate is a price offered, not a bill: its payment status is
 * `unpaid` from birth, so reading that status called every quote "Owed". The
 * Invoicing list learned this in issue 085; the company page and the customer's
 * Invoices tab kept reading the status, and Wasatch Front's company page said
 * $13,469.60 was owed where $5,976.80 was (sparx persona issue 111). One rule,
 * every list.
 */
export function documentRowState(doc: DocumentRow): { label: string; tone: InvoiceTone } {
  return doc.priceOffer
    ? { label: doc.stageName ?? 'Quote', tone: priceOfferTone(doc.stageType) }
    : invoiceState(doc.status);
}

/** What is owed on a row: nothing on a quote, whatever it carries. */
export function owedOn(doc: DocumentRow): number {
  return doc.priceOffer ? 0 : doc.balance;
}

export function formatMoney(amount: number, currency: string): string {
  return formatAmount(amount, currency);
}

/**
 * Money for the summary band, where space is scarce but precision still matters.
 *
 * Compact notation ONLY above five figures. Below that it actively hurts:
 * $545.30 renders as "$545.3", which reads as a typo rather than a total, and
 * an owner looking at what they're owed wants the real number. Past $10k the
 * exact cents stop being the point and the width does.
 */
const COMPACT_THRESHOLD = 10_000;

export function formatMoneyCompact(amount: number, currency = 'USD'): string {
  if (Math.abs(amount) >= COMPACT_THRESHOLD) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return formatAmount(amount, currency);
}

export interface AgingBucket {
  key: string;
  label: string;
  balance: number;
  count: number;
}

export interface AgingReport {
  buckets: AgingBucket[];
  totalOutstanding: number;
  totalCount: number;
}

/**
 * Due-date phrasing, in the words an owner would use rather than a raw date.
 *
 * `overdueDays` is a STORED column with a default of `0`, and nothing recomputes
 * it when a document goes past its date: setting a due date of two weeks ago
 * flipped the status to `overdue` and left `overdueDays` at 0. Trusting it alone
 * printed "Due today" in the Due column beside a "Late" chip in the Status
 * column, on the same row, for an invoice fourteen days late. "Due today" is the
 * damaging half: it reads as nothing-to-do-yet.
 *
 * A default zero is indistinguishable from a measured zero, so the count is
 * taken from the DATE, which is a fact, and the stored value is used only when
 * it is larger. The server stays authoritative wherever it has actually counted.
 */
export function describeDue(
  dueAt: string | null | undefined,
  overdueDays: number,
  /** The business's own zone, from `useBusinessZone()`. The server counts on the
   *  same one, so this is what keeps the invoice list and the chase list saying
   *  the same number about the same invoice. */
  timeZone?: string | null
): { label: string; tone: 'danger' | 'warning' | 'muted'; title: string } {
  // NOT "no payment terms set". A due date arrives from the payer's terms only
  // when the document is ADVANCED into a payable stage, so an invoice raised
  // straight into one has none however carefully the terms were agreed. Sending
  // her to set terms she already set is advice that cannot work; the invoice is
  // where the date is fixed, so that is what this says.
  if (!dueAt) {
    return {
      label: 'No due date',
      tone: 'muted',
      title: 'No date set, so this never counts as late. Open it to give it one.',
    };
  }

  const due = new Date(dueAt);
  const title = due.toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' });

  // CALENDAR DAYS, not elapsed milliseconds — `daysPastDue` is the console's one
  // rule for this and the reasoning is in `lib/console/days.ts`. The old
  // `(Date.now() - due) / 86_400_000` let the HOUR a document happened to be
  // raised decide the answer: eight invoices all printed "Due Sep 8, 2026" and
  // this function called seven of them "9 days late" and the one raised at noon
  // "8 days late", on the same screen, under the same printed date.
  const past = daysPastDue(dueAt, new Date(), timeZone) ?? 0;
  const late = Math.max(overdueDays, past);
  if (late > 0) {
    return {
      label: late === 1 ? '1 day late' : `${String(late)} days late`,
      tone: 'danger',
      title: `Was due ${title}`,
    };
  }

  const days = -past;
  if (days <= 0) return { label: 'Due today', tone: 'warning', title: `Due ${title}` };
  if (days === 1) return { label: 'Due tomorrow', tone: 'warning', title: `Due ${title}` };
  if (days <= 7)
    return { label: `Due in ${String(days)} days`, tone: 'warning', title: `Due ${title}` };
  return { label: title, tone: 'muted', title: `Due ${title}` };
}
