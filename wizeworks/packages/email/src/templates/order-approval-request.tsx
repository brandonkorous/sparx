import * as React from 'react';
import { EmailLayout } from './_layout';
import {
  EmailButton,
  EmailDisplayHeading,
  EmailFieldPanel,
  EmailFinePrint,
  EmailLineItems,
  EmailParagraph,
  type EmailFieldRow,
  type LineItem,
  type SummaryRow,
} from '../components';

export interface OrderApprovalRequestEmailProps {
  /** The business the order was placed with: the site's own name, never ours. */
  fromName: string;
  /** The person being asked, as the business has them on the account. */
  approverName: string;
  /** The trade account the order was placed on, as the business has it. */
  accountName: string;
  /** Who placed the order: a colleague of the person being asked. */
  placedBy: string;
  /** e.g. "O-000014". */
  orderNumber: string;
  /** Major units, already divided. */
  total: number;
  currency: string;
  /** Major units. The spending limit the order went over. Absent when the rule
   *  that held it has gone since: the email then names no figure rather than
   *  inventing one. */
  limit?: number | null;
  /** The buyer's own purchase order number, when they gave one. */
  poNumber?: string | null;
  /** True when the business also signs this order off, before or after them. */
  businessToo?: boolean;
  /** The lines, as they were ordered. */
  lines: LineItem[];
  summary: SummaryRow[];
  /** The order on the business's site, where they approve it or turn it down. */
  orderUrl: string;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// A trade account's own approver, asked to sign off a colleague's order.
//
// ── WHY THIS EMAIL EXISTS ───────────────────────────────────────────────────
//
// A business can put somebody on a trade account as "Can approve orders" and
// set a spending limit the account signs off itself. Until this email, the
// person with that role was never told an order was waiting for them: Renée
// placed a $1,208.00 order over a $1,000.00 limit, it was held, and Teodora,
// the one person whose role said she approves orders, heard nothing (sparx
// persona issue 087).
//
// ── WHAT IT CARRIES ─────────────────────────────────────────────────────────
//
// Enough to decide from the inbox: who placed it, the total, the limit it went
// over, their own PO number and every line. The decision itself is one button
// to the order on the business's site, where they approve it or turn it down.
//
// ── WHY IT NAMES THE BUSINESS AND NOT US ────────────────────────────────────
//
// The approver buys from the business and has never heard of the platform.
// `fromName` is the business; the visitor frame carries no platform masthead.
export function OrderApprovalRequestEmail({
  fromName,
  approverName,
  accountName,
  placedBy,
  orderNumber,
  total,
  currency,
  limit,
  poNumber,
  businessToo = false,
  lines,
  summary,
  orderUrl,
}: OrderApprovalRequestEmailProps) {
  const hasLimit = typeof limit === 'number' && Number.isFinite(limit);
  const rows: EmailFieldRow[] = [
    { label: 'Placed by', value: placedBy },
    { label: 'Account', value: accountName },
  ];
  if (hasLimit) rows.push({ label: 'Spending limit', value: formatMoney(limit, currency) });
  if (poNumber) rows.push({ label: 'PO number', value: poNumber });

  return (
    <EmailLayout
      preview={`${placedBy} placed order ${orderNumber} for ${formatMoney(total, currency)}. It needs your approval.`}
      footerNote={`${fromName} asked you to approve order ${orderNumber}.`}
      audience="visitor"
    >
      <EmailDisplayHeading>An order is waiting for your approval</EmailDisplayHeading>
      <EmailParagraph>
        {/* Ends on the order number, not a company name: a name ending "LLC."
            or "Inc." would otherwise print two full stops. */}
        Hi {approverName}, {placedBy} placed an order for{' '}
        <strong>{formatMoney(total, currency)}</strong> with {fromName}, order{' '}
        <strong>{orderNumber}</strong>.
        {hasLimit
          ? ` It is over your spending limit of ${formatMoney(limit, currency)}, so it waits for somebody who can approve orders to say yes.`
          : ' It waits for somebody who can approve orders to say yes.'}
      </EmailParagraph>
      {businessToo ? (
        <EmailParagraph>
          {fromName} also signs off this order, so it goes ahead once you and they have both
          approved it.
        </EmailParagraph>
      ) : (
        <EmailParagraph>It goes ahead as soon as you approve it.</EmailParagraph>
      )}

      <EmailFieldPanel rows={rows} />

      <EmailLineItems
        items={lines}
        summary={summary}
        total={{ label: 'Order total', value: formatMoney(total, currency) }}
      />

      <EmailParagraph>Open the order to approve it or turn it down.</EmailParagraph>
      <EmailButton href={orderUrl}>Review order {orderNumber}</EmailButton>

      <EmailFinePrint>
        You get this email because you can approve orders on this account. If somebody else at your
        company already decided, the order page says so.
      </EmailFinePrint>
    </EmailLayout>
  );
}

export function orderApprovalRequestSubject(orderNumber: string, placedBy: string): string {
  return `Order ${orderNumber} from ${placedBy} needs your approval`;
}
