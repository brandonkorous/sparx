import * as React from 'react';
import { EmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAmountHero,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailLineItems,
  EmailParagraph,
  type Tone,
} from '../components';

export interface AccountStatementOpenInvoice {
  /** e.g. "INV-000001". */
  number: string;
  /** The BUYER's own purchase order number, when they gave one. It is what
   *  their accounts department matches the invoice against before paying. */
  poNumber?: string | null;
  /** ISO-8601, or absent when the invoice is due on receipt. */
  dueAt?: string | null;
  /** Whole days past due at the end of the period; zero or less is not late. */
  daysLate: number;
  /** Still owed on it, in major units. */
  amount: number;
}

export interface AccountStatementAgingBucket {
  label: string;
  /** Major units. */
  amount: number;
}

export interface AccountStatementEmailProps {
  /** The business sending the statement: the tenant's own name, never ours. */
  fromName: string;
  /** The trade account the statement is for. */
  accountName: string;
  /** The person it is addressed to, when known. */
  contactName?: string | null;
  /** "Oct 1, 2026 to Oct 31, 2026". */
  periodText: string;
  currency: string;
  /** Owed at the start of the period, major units. */
  opening: number;
  /** Owed at the end of the period, major units. */
  closing: number;
  /** Due by the end of the period, late or due that day, major units. */
  dueNow: number;
  /** Past its due date at the end of the period, major units. */
  pastDue: number;
  /** The aging columns, in order. */
  aging: AccountStatementAgingBucket[];
  /** What is still open at the end of the period. */
  openInvoices: AccountStatementOpenInvoice[];
  /** The statement on the shop's own site, where the buyer can print it. */
  statementUrl?: string | null;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  // Pinned to UTC, for the reason invoice-sent gives: due dates are calendar
  // days, and the worker that renders this runs in UTC.
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(t));
}

function dueLine(invoice: AccountStatementOpenInvoice): string {
  const due = invoice.dueAt ? formatDate(invoice.dueAt) : null;
  if (!due) return 'Due on receipt';
  if (invoice.daysLate > 0) {
    return `Due ${due}, ${invoice.daysLate === 1 ? '1 day' : `${String(invoice.daysLate)} days`} late`;
  }
  return `Due ${due}`;
}

/** The pill beside the headline figure: the one thing the reader acts on. */
function standing(props: AccountStatementEmailProps): { label: string; tone: Tone } {
  if (props.pastDue > 0) {
    return { label: `${formatMoney(props.pastDue, props.currency)} is late`, tone: 'danger' };
  }
  if (props.dueNow > 0) {
    return { label: `${formatMoney(props.dueNow, props.currency)} due now`, tone: 'warn' };
  }
  if (props.closing > 0) return { label: 'Nothing due yet', tone: 'info' };
  return { label: 'Nothing owed', tone: 'success' };
}

// A tenant to their trade customer: the month's account statement.
//
// ── WHY THE OPEN INVOICES ARE IN THE EMAIL ─────────────────────────────────
//
// The person who reads this is an accounts-payable clerk, and the first thing
// they do is match each open invoice to a purchase order in their own books. So
// every open invoice is listed with OUR number and THEIR PO number side by side,
// which is the promise the B2B page makes ("it rides onto the invoice and every
// statement, so AP can reconcile without a phone call"). The full statement,
// with every payment in the period, is a click away on the shop's own site.
//
// ── WHY IT NAMES THE BUSINESS AND NOT US ───────────────────────────────────
//
// Same as invoice-sent: the reader buys from the shop and has never heard of
// the platform, so the visitor frame signs it with the shop's own name.
export function AccountStatementEmail(props: AccountStatementEmailProps) {
  const {
    fromName,
    accountName,
    contactName,
    periodText,
    currency,
    opening,
    closing,
    dueNow,
    aging,
    openInvoices,
    statementUrl,
  } = props;
  const owing = aging.filter((bucket) => bucket.amount > 0);
  return (
    <EmailLayout
      preview={`Statement from ${fromName} for ${accountName}: ${formatMoney(closing, currency)} owed`}
      footerNote={`${fromName} sent the statement for ${accountName}, ${periodText}.`}
      audience="visitor"
    >
      <EmailDisplayHeading>Your statement from {fromName}</EmailDisplayHeading>
      <EmailParagraph>
        Hi {contactName ?? 'there'}, here is the statement for <strong>{accountName}</strong>,{' '}
        {periodText}. You owed {formatMoney(opening, currency)} at the start of the period and{' '}
        {formatMoney(closing, currency)} at the end of it.
        {dueNow > 0
          ? ` ${formatMoney(dueNow, currency)} of that is due now.`
          : closing > 0
            ? ' None of it is due yet.'
            : ''}
      </EmailParagraph>

      <EmailAmountHero
        amount={formatMoney(closing, currency)}
        caption="Owed at the end of the period"
        status={standing(props)}
      />

      {owing.length > 0 ? (
        <EmailParagraph>
          How late:{' '}
          {owing
            .map((bucket) => `${bucket.label} ${formatMoney(bucket.amount, currency)}`)
            .join(', ')}
          .
        </EmailParagraph>
      ) : null}

      {openInvoices.length > 0 ? (
        <EmailLineItems
          items={openInvoices.map((invoice) => ({
            title: invoice.poNumber
              ? `${invoice.number}, your PO ${invoice.poNumber}`
              : invoice.number,
            subtitle: dueLine(invoice),
            amount: formatMoney(invoice.amount, currency),
          }))}
          total={{ label: 'Still owed', value: formatMoney(closing, currency) }}
        />
      ) : (
        <EmailParagraph>Nothing is owed on the account. Thank you.</EmailParagraph>
      )}

      {statementUrl ? (
        <EmailActionButton href={statementUrl}>See the full statement</EmailActionButton>
      ) : null}

      <EmailFinePrint>
        Questions about this statement? {fromName} reads every reply to this email.
      </EmailFinePrint>
    </EmailLayout>
  );
}

export function accountStatementSubject(
  fromName: string,
  accountName: string,
  periodText: string
): string {
  return `Statement for ${accountName} from ${fromName}, ${periodText}`;
}
