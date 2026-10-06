// The arithmetic of a trade account's statement, with no database in it.
//
// A statement answers the question an accounts-payable clerk asks once a month:
// what did we owe you at the start, what happened since, and what do we owe you
// now. It is the page they reconcile against their own ledger line by line, so
// every line has to carry the thing their ledger is keyed on: the invoice number
// and THEIR purchase order number.
//
// ── WHY THIS IS A SEPARATE, PURE FILE ──────────────────────────────────────
//
// Opening balance, running balance, closing balance and aging are four views of
// one set of events, and a statement whose closing figure does not equal its
// opening figure plus its own rows is worse than no statement: the clerk finds
// the gap, and stops trusting every other number on the page. Kept pure, the
// rule that ties them together is something a test can hold, separate from the
// query that finds the rows (b2b-statement-service.ts).
//
// ── WHAT AN EVENT IS ───────────────────────────────────────────────────────
//
//   An invoice issued         adds its total, on the day it was issued.
//   A payment or deposit      takes its amount off, on the day it arrived.
//   A refund                  puts its amount back, on the day it went out.
//   A write-off               takes off whatever was still owed when the shop
//                             wrote the invoice off, on that day.
//
// Money is whole cents throughout. A running balance summed in floating dollars
// drifts by a cent somewhere around the fortieth row, and that cent is exactly
// what a clerk reconciling to the penny goes looking for.

import { CrmValidationError } from '../errors';
import {
  AGING_BUCKETS,
  agingBucketKey,
  daysPastDue,
  startOfBusinessDay,
  type AgingBucketKey,
} from './billing-ar';

const DAY_MS = 86_400_000;

// ─────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────

export interface StatementPaymentInput {
  id: string;
  /** deposit | payment | refund, as `billing_document_payments.kind` stores it. */
  kind: string;
  /** cash | card | check | ach | wire | account_credit | store_credit | other */
  method: string;
  /** The check number or memo the shop typed, if any. */
  reference: string | null;
  amountCents: number;
  receivedAt: Date;
}

export interface StatementBillInput {
  id: string;
  number: string | null;
  /** The buyer's own purchase order number, or null when they gave none. */
  poNumber: string | null;
  /** When the bill was issued: finalized, or created when it never was. */
  issuedAt: Date;
  dueAt: Date | null;
  totalCents: number;
  /** When the shop wrote it off, or null. */
  voidedAt: Date | null;
  payments: StatementPaymentInput[];
}

/** A statement period as calendar days, plus the instants that bound it. */
export interface StatementPeriod {
  /** `YYYY-MM-DD`, the first day in the period. */
  from: string;
  /** `YYYY-MM-DD`, the last day in the period, inclusive. */
  to: string;
  /** Midnight UTC at the start of `from`. */
  start: Date;
  /** Midnight UTC at the end of `to`: the first instant NOT in the period. */
  endExclusive: Date;
}

// ─────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────

export type StatementRowKind = 'invoice' | 'payment' | 'refund' | 'write_off';

export interface StatementRow {
  kind: StatementRowKind;
  /** ISO instant the event happened. */
  at: string;
  documentId: string;
  /** The invoice this row belongs to. */
  documentNumber: string | null;
  poNumber: string | null;
  /** The invoice's due date, on the invoice row only. */
  dueAt: string | null;
  /** What happened, in words a bookkeeper reads: "Payment by check, ref 10442". */
  description: string;
  /** What this row added to the balance. Zero on a credit. */
  chargeCents: number;
  /** What this row took off the balance. Zero on a charge. */
  creditCents: number;
  /** What was owed straight after this row. */
  balanceCents: number;
}

export interface StatementOpenItem {
  documentId: string;
  number: string | null;
  poNumber: string | null;
  issuedAt: string;
  dueAt: string | null;
  totalCents: number;
  /** Still owed on it at the end of the period. */
  openCents: number;
  /** Whole calendar days past due at the end of the period; zero or less is not late. */
  daysLate: number;
  bucket: AgingBucketKey;
}

export interface StatementAgingBucket {
  key: AgingBucketKey;
  label: string;
  count: number;
  cents: number;
}

export interface StatementFigures {
  /** Owed at the start of the first day of the period. */
  openingCents: number;
  /** Everything charged in the period. */
  chargesCents: number;
  /** Everything paid, credited or written off in the period. */
  creditsCents: number;
  /** Owed at the end of the last day: opening + charges - credits. */
  closingCents: number;
  /** Open invoices already due by the end of the period, late or due that day. */
  dueNowCents: number;
  /** Open invoices past their due date at the end of the period. */
  pastDueCents: number;
  rows: StatementRow[];
  openItems: StatementOpenItem[];
  aging: StatementAgingBucket[];
}

/** The aging columns, in the words a buyer and a shop owner both use. Keyed on
 *  the same buckets as the AR aging report, so a balance sits in the same
 *  column on both. */
export const STATEMENT_AGING_LABELS: Record<AgingBucketKey, string> = {
  current: 'Not yet due',
  d1_30: '1 to 30 days late',
  d31_60: '31 to 60 days late',
  d61_90: '61 to 90 days late',
  d90_plus: 'Over 90 days late',
};

// ─────────────────────────────────────────────────────────────────────────
// The period
// ─────────────────────────────────────────────────────────────────────────

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Midnight UTC of a `YYYY-MM-DD`, or null when it is not a real day. Rejects
 *  "2026-02-30" rather than letting `Date` roll it into March. */
export function parseStatementDay(day: string): Date | null {
  const match = DAY_PATTERN.exec(day.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const at = new Date(Date.UTC(year, month - 1, date));
  if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month - 1 || at.getUTCDate() !== date) {
    return null;
  }
  return at;
}

/** `YYYY-MM-DD` of a UTC-midnight date. */
export function statementDayText(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * The period a statement covers.
 *
 * Left blank, it is the month so far: the first of this month to today, on the
 * BUSINESS's calendar. A shop in Denver printing a statement at 7pm on the last
 * day of the month means that month, not the one UTC has already started.
 *
 * Only one end given, the other is filled in around it: a start alone runs to
 * today, an end alone starts on the first of its month.
 *
 * An end after today is refused rather than allowed: aging is worked out as of
 * the end of the period, and a statement dated next month would report as late
 * invoices that nobody is late on yet.
 */
export function statementPeriod(
  input: { from?: string | null; to?: string | null },
  now: Date,
  timeZone?: string | null
): StatementPeriod {
  const today = startOfBusinessDay(now, timeZone);
  const fromText = input.from?.trim() ?? '';
  const toText = input.to?.trim() ?? '';

  const end = toText === '' ? today : parseStatementDay(toText);
  if (!end) {
    throw new CrmValidationError('The end of the period is not a date.', [
      { field: 'to', message: 'Use a full date, like 2026-10-31.' },
    ]);
  }
  const start =
    fromText === ''
      ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
      : parseStatementDay(fromText);
  if (!start) {
    throw new CrmValidationError('The start of the period is not a date.', [
      { field: 'from', message: 'Use a full date, like 2026-10-01.' },
    ]);
  }
  if (end.getTime() > today.getTime()) {
    throw new CrmValidationError('The end of the period cannot be after today.', [
      { field: 'to', message: `Pick ${statementDayText(today)} or earlier.` },
    ]);
  }
  if (start.getTime() > end.getTime()) {
    throw new CrmValidationError('The period starts after it ends.', [
      { field: 'from', message: 'Pick a start on or before the end of the period.' },
    ]);
  }
  return {
    from: statementDayText(start),
    to: statementDayText(end),
    start,
    endExclusive: new Date(end.getTime() + DAY_MS),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Words
// ─────────────────────────────────────────────────────────────────────────

const METHOD_WORDS: Record<string, string> = {
  cash: 'cash',
  card: 'card',
  check: 'check',
  ach: 'bank transfer',
  wire: 'wire transfer',
  account_credit: 'account credit',
  store_credit: 'store credit',
};

/** How the money moved, as words. `other` and anything unknown say nothing
 *  rather than printing a code. */
export function paymentMethodWords(method: string): string | null {
  return METHOD_WORDS[method] ?? null;
}

function paymentDescription(payment: StatementPaymentInput): string {
  const noun =
    payment.kind === 'refund' ? 'Refund' : payment.kind === 'deposit' ? 'Deposit' : 'Payment';
  const how = paymentMethodWords(payment.method);
  const ref = payment.reference?.trim() ?? '';
  return [how ? `${noun} by ${how}` : noun, ref !== '' ? `ref ${ref}` : null]
    .filter(Boolean)
    .join(', ');
}

/** What the account agreed to pay on, in words, or null when nothing was
 *  agreed. Terms are `prepay` or `net<days>` (crm-schemas `PaymentTerms`). */
export function paymentTermsWords(terms: string | null | undefined): string | null {
  if (!terms) return null;
  const value = terms.trim().toLowerCase();
  if (value === 'prepay') return 'Pay before it ships';
  const match = /^net(\d+)$/.exec(value);
  if (!match) return null;
  const days = Number(match[1]);
  if (days <= 0) return null;
  return `Pay within ${days === 1 ? '1 day' : `${String(days)} days`}`;
}

// ─────────────────────────────────────────────────────────────────────────
// The arithmetic
// ─────────────────────────────────────────────────────────────────────────

interface StatementEvent {
  kind: StatementRowKind;
  at: Date;
  bill: StatementBillInput;
  /** Signed: positive adds to what is owed, negative takes off. */
  cents: number;
  description: string;
}

const KIND_ORDER: Record<StatementRowKind, number> = {
  invoice: 0,
  refund: 1,
  payment: 2,
  write_off: 3,
};

/** Net money received on a bill up to (not including) `before`: payments and
 *  deposits count, refunds give it back. */
function netPaidBefore(bill: StatementBillInput, before: Date): number {
  let cents = 0;
  for (const p of bill.payments) {
    if (p.receivedAt.getTime() >= before.getTime()) continue;
    cents += p.kind === 'refund' ? -p.amountCents : p.amountCents;
  }
  return cents;
}

/** When the write-off lands and how much it takes off. Never before the bill
 *  was issued, and never more than was still owed at that moment. */
function writeOff(bill: StatementBillInput): { at: Date; cents: number } | null {
  if (!bill.voidedAt) return null;
  const at = bill.voidedAt.getTime() < bill.issuedAt.getTime() ? bill.issuedAt : bill.voidedAt;
  // Payments received AT the write-off instant were in before it.
  const owed = bill.totalCents - netPaidBefore(bill, new Date(at.getTime() + 1));
  return owed > 0 ? { at, cents: owed } : null;
}

function eventsOf(bill: StatementBillInput): StatementEvent[] {
  // The number has its own column on every copy of the statement, so the row
  // says what happened and leaves the number to that column.
  const label = 'Invoice issued';
  const events: StatementEvent[] = [
    { kind: 'invoice', at: bill.issuedAt, bill, cents: bill.totalCents, description: label },
  ];
  for (const p of bill.payments) {
    const refund = p.kind === 'refund';
    events.push({
      kind: refund ? 'refund' : 'payment',
      at: p.receivedAt,
      bill,
      cents: refund ? p.amountCents : -p.amountCents,
      description: paymentDescription(p),
    });
  }
  const off = writeOff(bill);
  if (off) {
    events.push({
      kind: 'write_off',
      at: off.at,
      bill,
      cents: -off.cents,
      description: 'Written off',
    });
  }
  return events;
}

function compareEvents(a: StatementEvent, b: StatementEvent): number {
  const byTime = a.at.getTime() - b.at.getTime();
  if (byTime !== 0) return byTime;
  const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (byKind !== 0) return byKind;
  return (a.bill.number ?? a.bill.id).localeCompare(b.bill.number ?? b.bill.id);
}

/**
 * Work out a statement from every bill on the account.
 *
 * Pass ALL of the account's bills issued before the end of the period, not only
 * the ones touched in it: an invoice from March paid in October is a row in
 * October, and its March total is part of October's opening balance.
 */
export function computeStatement(
  bills: readonly StatementBillInput[],
  period: Pick<StatementPeriod, 'start' | 'endExclusive' | 'to'>
): StatementFigures {
  const start = period.start.getTime();
  const end = period.endExclusive.getTime();
  const inScope = bills.filter((b) => b.issuedAt.getTime() < end);

  const events = inScope
    .flatMap(eventsOf)
    .filter((e) => e.at.getTime() < end)
    .sort(compareEvents);

  let openingCents = 0;
  let chargesCents = 0;
  let creditsCents = 0;
  let running = 0;
  const rows: StatementRow[] = [];
  for (const e of events) {
    if (e.at.getTime() < start) {
      openingCents += e.cents;
      running = openingCents;
      continue;
    }
    running += e.cents;
    if (e.cents >= 0) chargesCents += e.cents;
    else creditsCents += -e.cents;
    rows.push({
      kind: e.kind,
      at: e.at.toISOString(),
      documentId: e.bill.id,
      documentNumber: e.bill.number,
      poNumber: e.bill.poNumber,
      dueAt: e.kind === 'invoice' && e.bill.dueAt ? e.bill.dueAt.toISOString() : null,
      description: e.description,
      chargeCents: e.cents >= 0 ? e.cents : 0,
      creditCents: e.cents < 0 ? -e.cents : 0,
      balanceCents: running,
    });
  }

  // What is still open at the end of the period, and how late. Aged as of the
  // LAST DAY of the period, so a statement for September says what was late on
  // September 30th, not what is late today.
  const asOfDay = new Date(end - DAY_MS);
  const openItems: StatementOpenItem[] = [];
  for (const bill of inScope) {
    const off = writeOff(bill);
    const writtenOff = off && off.at.getTime() < end ? off.cents : 0;
    const openCents = bill.totalCents - netPaidBefore(bill, period.endExclusive) - writtenOff;
    if (openCents <= 0) continue;
    // A bill with no due date is due on receipt, so it is due now, and not late.
    const daysLate = daysPastDue(bill.dueAt, asOfDay, null);
    openItems.push({
      documentId: bill.id,
      number: bill.number,
      poNumber: bill.poNumber,
      issuedAt: bill.issuedAt.toISOString(),
      dueAt: bill.dueAt ? bill.dueAt.toISOString() : null,
      totalCents: bill.totalCents,
      openCents,
      daysLate,
      bucket: agingBucketKey(daysLate),
    });
  }
  // Oldest due DAY first, then by number: two invoices due the same day read in
  // the order they were numbered, not by the minute each happened to be raised.
  const dueDay = (item: StatementOpenItem) => (item.dueAt ?? item.issuedAt).slice(0, 10);
  openItems.sort(
    (a, b) =>
      dueDay(a).localeCompare(dueDay(b)) ||
      (a.number ?? a.documentId).localeCompare(b.number ?? b.documentId)
  );

  const aging: StatementAgingBucket[] = AGING_BUCKETS.map(({ key }) => {
    const inBucket = openItems.filter((item) => item.bucket === key);
    return {
      key,
      label: STATEMENT_AGING_LABELS[key],
      count: inBucket.length,
      cents: inBucket.reduce((sum, item) => sum + item.openCents, 0),
    };
  });

  const dueNowCents = openItems
    .filter((item) => item.dueAt === null || item.daysLate >= 0)
    .reduce((sum, item) => sum + item.openCents, 0);
  const pastDueCents = openItems
    .filter((item) => item.daysLate > 0)
    .reduce((sum, item) => sum + item.openCents, 0);

  return {
    openingCents,
    chargesCents,
    creditsCents,
    closingCents: openingCents + chargesCents - creditsCents,
    dueNowCents,
    pastDueCents,
    rows,
    openItems,
    aging,
  };
}
