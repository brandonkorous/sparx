import * as React from 'react';
import { EmailLayout } from './_layout';
import {
  EmailDisplayHeading,
  EmailFieldPanel,
  EmailFinePrint,
  EmailLineItems,
  EmailParagraph,
  type EmailFieldRow,
  type LineItem,
  type SummaryRow,
} from '../components';

export interface PurchaseOrderSentEmailProps {
  /** The business placing the order: the tenant's own name, never ours. */
  fromName: string;
  /** Who the order is to, as the business has them on file. */
  supplierName: string;
  /** The person at the supplier the business deals with, when it has one. */
  contactName?: string | null;
  /** e.g. "PO-000001". The number the supplier quotes back on the invoice. */
  documentNumber: string;
  /** Major units, already divided. */
  total: number;
  currency: string;
  /** ISO-8601. The day the business expects the goods. Absent when nobody set
   *  one: the email then names no date rather than inventing a deadline. */
  expectedBy?: string | null;
  /** Where the goods go: the receiving location's name and address. */
  shipTo: { name: string; lines: string[] };
  /** The business's own reference for this order, if it gave one. */
  reference?: string | null;
  /** Payment terms agreed with this supplier ("Net 30"). */
  paymentTerms?: string | null;
  /** The lines, as they appear on the printed order. */
  lines: LineItem[];
  summary: SummaryRow[];
  /** The note the business wrote on the order, if any. */
  note?: string | null;
  /** True when a reply reaches the business. The send sets the Reply-To from
   *  the business's own address; without one a reply would go to a mailbox
   *  nobody reads, so the email does not invite it. */
  canReply?: boolean;
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
  // UTC: the expected date is a DAY, stored as midnight UTC, and the worker
  // that renders this runs in UTC. Left to the host zone it read a day early in
  // the Americas.
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(t));
}

// A business → its supplier purchase order.
//
// ── WHY THE ORDER IS IN THE EMAIL ───────────────────────────────────────────
//
// Same reason as the invoice: there is no public page for a purchase order and
// the event path carries no attachment, so a mail that only announced one would
// announce something the supplier cannot open. What they need to fill it (the
// number to quote back, every line with THEIR code, the quantities and prices,
// where it goes, when it is wanted, the terms) is in the body.
//
// ── WHY IT NAMES THE BUSINESS AND NOT US ────────────────────────────────────
//
// The supplier deals with the business and has never heard of the platform.
// `fromName` is the business; the frame is the visitor frame, which carries no
// platform masthead (sparx persona issue 071).
export function PurchaseOrderSentEmail({
  fromName,
  supplierName,
  contactName,
  documentNumber,
  total,
  currency,
  expectedBy,
  shipTo,
  reference,
  paymentTerms,
  lines,
  summary,
  note,
  canReply = false,
}: PurchaseOrderSentEmailProps) {
  const wanted = expectedBy ? formatDate(expectedBy) : null;
  const greeting = contactName?.trim() ? contactName.trim() : supplierName;
  const rows: EmailFieldRow[] = [
    {
      label: 'Deliver to',
      value: [shipTo.name, ...shipTo.lines].filter((line) => line.trim() !== '').join(', '),
    },
  ];
  if (wanted) rows.push({ label: 'Wanted by', value: wanted });
  if (reference) rows.push({ label: 'Our reference', value: reference });
  if (paymentTerms) rows.push({ label: 'Terms', value: paymentTerms });

  return (
    <EmailLayout
      preview={`Purchase order ${documentNumber} from ${fromName}: ${formatMoney(total, currency)}`}
      footerNote={`${fromName} sent ${supplierName} purchase order ${documentNumber}.`}
      audience="visitor"
    >
      <EmailDisplayHeading>Purchase order from {fromName}</EmailDisplayHeading>
      <EmailParagraph>
        Hi {greeting}, please supply the items below on purchase order{' '}
        <strong>{documentNumber}</strong>. Quote that number on your invoice and delivery note.
      </EmailParagraph>

      <EmailFieldPanel rows={rows} />

      <EmailLineItems
        items={lines}
        summary={summary}
        total={{ label: 'Order total', value: formatMoney(total, currency) }}
      />

      {note ? <EmailParagraph>{note}</EmailParagraph> : null}

      {/* Never ends on the business's name: "Gillett Diesel Service Inc." plus
          a full stop printed two of them. */}
      <EmailFinePrint>
        {canReply
          ? `Questions about this order, or something you cannot supply? ${fromName} reads every reply to this email.`
          : `Questions about this order, or something you cannot supply? Please contact ${fromName} about it.`}
      </EmailFinePrint>
    </EmailLayout>
  );
}

export function purchaseOrderSentSubject(documentNumber: string, fromName: string): string {
  return `Purchase order ${documentNumber} from ${fromName}`;
}
