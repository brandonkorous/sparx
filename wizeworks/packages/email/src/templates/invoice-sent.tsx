import * as React from 'react';
import { EmailLayout } from './_layout';
import {
  EmailAmountHero,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailLineItems,
  EmailParagraph,
  type LineItem,
  type SummaryRow,
} from '../components';

export interface InvoiceSentEmailProps {
  /** Who is being billed, as printed on the document. */
  billToName?: string;
  /** The business doing the billing — the tenant's own name, never ours. */
  fromName: string;
  /** The tenant's word for this document: "Invoice", "Bill", "Statement". */
  documentLabel: string;
  /** e.g. "INV-000001". */
  documentNumber: string;
  /** Major units, already divided. */
  total: number;
  /** What is still owed — differs from `total` once a part payment is in. */
  balance: number;
  currency: string;
  /** ISO-8601. Absent when the business agreed no terms: the email then says
   *  nothing about when it is due rather than inventing a date. Always absent
   *  on a price offer, which falls due on no date at all. */
  dueAt?: string | null;
  /** True when this document OFFERS a price rather than DEMANDS money — a quote
   *  or an estimate. Nothing is owed on one, so the email never asks for it. */
  priceOffer?: boolean;
  /** ISO-8601. When the price stops standing. A price offer's own date, and the
   *  only one it has; absent means the price holds until the business says
   *  otherwise, which the email states rather than leaving blank. */
  validUntil?: string | null;
  /** The lines, as they appear on the document. */
  lines: LineItem[];
  summary: SummaryRow[];
  /** The note the business wrote on the document, if any. */
  note?: string | null;
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
  // Pinned to UTC: the worker that sends this runs in UTC, so that is the day
  // the customer reads. Left to the host zone, the same email said "September 3"
  // on a laptop in the Americas and "September 4" in production.
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(t));
}

// A tenant → their-customer invoice.
//
// ── WHY THE INVOICE IS IN THE EMAIL ─────────────────────────────────────────
//
// There is no public invoice page and no attachment on the event path, so a
// mail that only announced an invoice would be an announcement of something the
// recipient cannot see. Everything they need to check it — who it is from, the
// number, the lines, the total, what is still owed and when — is in the body,
// which is also what a café's bookkeeper actually wants: a thing they can read
// on a phone and forward, not a link behind a login.
//
// ── WHY IT NAMES THE BUSINESS AND NOT US ────────────────────────────────────
//
// The customer has never heard of the platform and is not our customer. Every
// sentence names the tenant: `fromName` is the bakery, and the words avoid any
// claim about who processes the money, because on manual payments nobody does.
export function InvoiceSentEmail({
  billToName,
  fromName,
  documentLabel,
  documentNumber,
  total,
  balance,
  currency,
  dueAt,
  priceOffer = false,
  validUntil,
  lines,
  summary,
  note,
}: InvoiceSentEmailProps) {
  const label = documentLabel || 'Invoice';
  const due = dueAt ? formatDate(dueAt) : null;
  const goodUntil = validUntil ? formatDate(validUntil) : null;
  // Once part of it is paid, the number that matters is what is LEFT — showing
  // the full total as the headline would ask for money already handed over.
  // Never on a price offer: a deposit taken to hold a job does not turn the
  // rest of the price into a debt, so the headline there is always the TOTAL.
  const outstanding = !priceOffer && balance > 0 && balance < total;
  // The one number the recipient is being shown. A bill asks for what is left;
  // an offer states what the job would come to.
  const headline = priceOffer ? total : balance;
  return (
    // EmailLayout, not PlatformEmailLayout: this is a TENANT send. The platform
    // chassis puts OUR wordmark in the masthead, and the person reading this has
    // never heard of us — an invoice from a bakery headed with a software
    // product's name reads like a billing service nobody hired, or a scam. The
    // tenant frame signs it with the business's own name instead.
    <EmailLayout
      preview={`${label} ${documentNumber} from ${fromName}: ${formatMoney(headline, currency)}`}
      footerNote={`${fromName} sent you ${label.toLowerCase()} ${documentNumber}.`}
      // No masthead, and no operator in the fine print. `EmailWordmark` paints
      // the PLATFORM's wordmark, and the person reading this bought bread from a
      // bakery — a software product's name over their invoice reads like a
      // billing service nobody hired. The business names itself in the heading
      // and the first sentence instead, which is what a paper invoice does.
      //
      // This used to be `header={false}`, a lever only THIS template ever
      // pulled — so the masthead was right here and wrong on every other
      // visitor-facing send, and the footer went on naming the operating company
      // to a stranger regardless. Audience decides both now.
      audience="visitor"
    >
      <EmailDisplayHeading>
        {label} from {fromName}
      </EmailDisplayHeading>
      <EmailParagraph>
        Hi {billToName ?? 'there'}, here is {label.toLowerCase()} <strong>{documentNumber}</strong>{' '}
        from {fromName}.
        {/* A bill says when the money is wanted. An offer says how long the
            price stands, and says so plainly when it stands until further
            notice rather than leaving the question hanging. */}
        {priceOffer
          ? goodUntil
            ? ` This price holds until ${goodUntil}.`
            : ' Nothing is owed on it. It is a price, not a bill.'
          : due
            ? ` It is due by ${due}.`
            : ''}
      </EmailParagraph>

      <EmailAmountHero
        amount={formatMoney(headline, currency)}
        caption={
          outstanding
            ? `Still owed of ${formatMoney(total, currency)}`
            : `${label} ${documentNumber}`
        }
        status={{
          label: priceOffer
            ? goodUntil
              ? `Good until ${goodUntil}`
              : 'No closing date'
            : due
              ? `Due ${due}`
              : 'Due on receipt',
          tone: 'info',
        }}
      />

      <EmailLineItems
        items={lines}
        summary={summary}
        total={{
          label: outstanding ? 'Still owed' : 'Total',
          value: formatMoney(headline, currency),
        }}
      />

      {note ? <EmailParagraph>{note}</EmailParagraph> : null}

      <EmailFinePrint>
        Questions about this {label.toLowerCase()}? Reply to this email and it goes straight to{' '}
        {fromName}.
      </EmailFinePrint>
    </EmailLayout>
  );
}

export function invoiceSentSubject(
  documentLabel: string,
  documentNumber: string,
  fromName: string
): string {
  const label = documentLabel || 'Invoice';
  return `${label} ${documentNumber} from ${fromName}`;
}
